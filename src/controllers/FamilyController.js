const crypto = require("crypto");
const { Family, FAMILY_ROLE } = require("../models/familyModels");
const User = require("../models/userModels");
const Account = require("../models/accountModels");
const { sendEmail } = require("../services/emailService");

const MAX_MEMBERS = 7;
const INVITE_EXPIRY_HOURS = 48;

// ─────────────────────────────────────────────
// Helper — generate a secure invite token
// ─────────────────────────────────────────────
const generateInviteToken = () => crypto.randomBytes(32).toString("hex");

// ─────────────────────────────────────────────
// Helper — send invite email
// ─────────────────────────────────────────────
const sendInviteEmail = async ({ toEmail, inviterName, familyName, token }) => {
  const acceptUrl = `${process.env.FRONTEND_URL}/family/invite/accept?token=${token}`;
  const declineUrl = `${process.env.FRONTEND_URL}/family/invite/decline?token=${token}`;

  await sendEmail({
    to: toEmail,
    subject: `${inviterName} invited you to join the "${familyName}" family`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to join their family group
           <strong>"${familyName}"</strong>.</p>
        <p>This invitation expires in <strong>${INVITE_EXPIRY_HOURS} hours</strong>.</p>
        <div style="margin:24px 0;">
          <a href="${acceptUrl}" style="
            display:inline-block;padding:12px 24px;background:#4F46E5;
            color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;
            margin-right:12px;">Accept</a>
          <a href="${declineUrl}" style="
            display:inline-block;padding:12px 24px;background:#e5e7eb;
            color:#111;border-radius:6px;text-decoration:none;font-weight:bold;">Decline</a>
        </div>
        <p style="color:#999;font-size:12px;">If you did not expect this email, you can safely ignore it.</p>
      </div>
    `,
  });
};

// ─────────────────────────────────────────────
// POST /api/families
// Create a new family (owner is the logged-in user)
// ─────────────────────────────────────────────
exports.createFamily = async (req, res) => {
  try {
    const { name } = req.body;
    const ownerId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Family name is required." });
    }

    // A user can only belong to one family at a time
    const existingFamily = await Family.findOne({
      "members.user": ownerId,
      isActive: true,
    });

    if (existingFamily) {
      return res
        .status(409)
        .json({ message: "You already belong to a family." });
    }

    const owner = await User.findById(ownerId);

    const family = await Family.create({
      name: name.trim(),
      owner: ownerId,
      members: [
        {
          user: ownerId,
          email: owner.email,
          role: FAMILY_ROLE.OWNER,
          joinedAt: new Date(),
        },
      ],
    });
    const account = await Account.create({
      familyId: family._id,
      balance: 0,
      income: 0,
      expenses: 0,
    });

    return res.status(201).json({
      message: "Family created successfully.",
      family,
      account,
    });
  } catch (error) {
    console.error("createFamily error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// POST /api/families/:familyId/invite
// Owner invites someone by email
// Body: { email }
// ─────────────────────────────────────────────
exports.inviteMember = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { email } = req.body;
    const requesterId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const family = await Family.findById(familyId);
    if (!family || !family.isActive) {
      return res.status(404).json({ message: "Family not found." });
    }

    // Only the owner can invite
    if (family.owner.toString() !== requesterId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the family owner can invite members." });
    }

    // Hard cap — members array only has confirmed members
    if (family.members.length >= MAX_MEMBERS) {
      return res.status(400).json({
        message: `A family can have at most ${MAX_MEMBERS} members.`,
      });
    }

    // Check if already a confirmed member
    const alreadyMember = family.members.find(
      (m) => m.email === normalizedEmail,
    );
    if (alreadyMember) {
      return res
        .status(409)
        .json({ message: "This person is already a family member." });
    }

    // Check if a pending invite already exists for this email
    const existingInvite = family.pendingInvites.find(
      (i) => i.email === normalizedEmail,
    );
    if (existingInvite) {
      // If not expired, block re-invite
      if (existingInvite.tokenExpires > new Date()) {
        return res.status(409).json({
          message: "An invitation has already been sent to this email.",
        });
      }
      // If expired, remove old invite and allow a fresh one
      family.pendingInvites = family.pendingInvites.filter(
        (i) => i.email !== normalizedEmail,
      );
    }

    // Check if this email belongs to a user already in another family
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const inOtherFamily = await Family.findOne({
        _id: { $ne: familyId },
        "members.user": existingUser._id,
        isActive: true,
      });
      if (inOtherFamily) {
        return res.status(409).json({
          message: "This user already belongs to another family.",
        });
      }
    }

    // Create and store the pending invite
    const token = generateInviteToken();
    const tokenExpires = new Date(
      Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    family.pendingInvites.push({ email: normalizedEmail, token, tokenExpires });
    await family.save();

    const inviter = await User.findById(requesterId);
    await sendInviteEmail({
      toEmail: normalizedEmail,
      inviterName: inviter.name,
      familyName: family.name,
      token,
    });

    return res.status(200).json({ message: "Invitation sent successfully." });
  } catch (error) {
    console.error("inviteMember error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/families/invite/accept?token=...
// Invited user accepts — moved from pendingInvites into members
// ─────────────────────────────────────────────
exports.acceptInvite = async (req, res) => {
  try {
    const { token } = req.query;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ message: "Invite token is required." });
    }

    const family = await Family.findOne({
      "pendingInvites.token": token,
      isActive: true,
    });

    if (!family) {
      return res
        .status(404)
        .json({ message: "Invalid or expired invite token." });
    }

    const invite = family.pendingInvites.find((i) => i.token === token);

    if (!invite) {
      return res.status(404).json({ message: "Invite not found." });
    }

    if (invite.tokenExpires < new Date()) {
      // Clean up expired invite
      family.pendingInvites = family.pendingInvites.filter(
        (i) => i.token !== token,
      );
      await family.save();
      return res.status(410).json({ message: "This invite link has expired." });
    }

    // Verify the logged-in user's email matches the invite
    const user = await User.findById(userId);
    if (user.email.toLowerCase() !== invite.email) {
      return res.status(403).json({
        message: "This invite was sent to a different email address.",
      });
    }

    // Check the user isn't already in a different family
    const alreadyInFamily = await Family.findOne({
      _id: { $ne: family._id },
      "members.user": userId,
      isActive: true,
    });

    if (alreadyInFamily) {
      return res
        .status(409)
        .json({ message: "You already belong to another family." });
    }

    // Move from pendingInvites → members
    family.pendingInvites = family.pendingInvites.filter(
      (i) => i.token !== token,
    );
    family.members.push({
      user: userId,
      email: invite.email,
      role: FAMILY_ROLE.MEMBER,
      joinedAt: new Date(),
    });

    await family.save();

    return res.status(200).json({
      message: "You have successfully joined the family.",
      family,
    });
  } catch (error) {
    console.error("acceptInvite error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/families/invite/decline?token=...
// Invited user declines — invite is simply removed
// ─────────────────────────────────────────────
exports.declineInvite = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Invite token is required." });
    }

    const family = await Family.findOne({
      "pendingInvites.token": token,
      isActive: true,
    });

    if (!family) {
      return res
        .status(404)
        .json({ message: "Invalid or expired invite token." });
    }

    // Just remove the invite — no trace left
    family.pendingInvites = family.pendingInvites.filter(
      (i) => i.token !== token,
    );
    await family.save();

    return res.status(200).json({ message: "Invitation declined." });
  } catch (error) {
    console.error("declineInvite error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/families/me
// Get the logged-in user's family (no ID needed)
// ─────────────────────────────────────────────
exports.getMyFamily = async (req, res) => {
  try {
    const userId = req.user.id;

    const family = await Family.findOne({
      "members.user": userId,
      isActive: true,
    })
      .populate("owner", "name email photo")
      .populate("members.user", "name email photo");

    if (!family) {
      return res
        .status(404)
        .json({ message: "You are not part of any family." });
    }

    return res.status(200).json({ family });
  } catch (error) {
    console.error("getMyFamily error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/families/:familyId/members/:memberId
// Owner removes a confirmed member
// ─────────────────────────────────────────────
exports.removeMember = async (req, res) => {
  try {
    const { familyId, memberId } = req.params;
    const requesterId = req.user.id;

    const family = await Family.findById(familyId);
    if (!family || !family.isActive) {
      return res.status(404).json({ message: "Family not found." });
    }

    if (family.owner.toString() !== requesterId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the family owner can remove members." });
    }

    const memberIndex = family.members.findIndex(
      (m) => m._id.toString() === memberId,
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Member not found." });
    }

    const memberToRemove = family.members[memberIndex];

    if (memberToRemove.role === FAMILY_ROLE.OWNER) {
      return res
        .status(400)
        .json({ message: "The owner cannot be removed from the family." });
    }

    family.members.splice(memberIndex, 1);
    await family.save();

    return res.status(200).json({ message: "Member removed successfully." });
  } catch (error) {
    console.error("removeMember error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/families/:familyId/invites/:inviteId
// Owner cancels a pending invite
// ─────────────────────────────────────────────
exports.cancelInvite = async (req, res) => {
  try {
    const { familyId, inviteId } = req.params;
    const requesterId = req.user.id;

    const family = await Family.findById(familyId);
    if (!family || !family.isActive) {
      return res.status(404).json({ message: "Family not found." });
    }

    if (family.owner.toString() !== requesterId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the family owner can cancel invites." });
    }

    const inviteIndex = family.pendingInvites.findIndex(
      (i) => i._id.toString() === inviteId,
    );

    if (inviteIndex === -1) {
      return res.status(404).json({ message: "Invite not found." });
    }

    family.pendingInvites.splice(inviteIndex, 1);
    await family.save();

    return res.status(200).json({ message: "Invite cancelled successfully." });
  } catch (error) {
    console.error("cancelInvite error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

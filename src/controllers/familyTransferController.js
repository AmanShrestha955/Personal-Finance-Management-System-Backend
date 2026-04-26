const {
  FamilyTransfer,
  TRANSFER_STATUS,
} = require("../models/familytransferModels");
const { Family } = require("../models/familyModels");
const Account = require("../models/accountModels");
const Transaction = require("../models/transactionModels");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Helper — check both users belong to the family
// ─────────────────────────────────────────────
const bothMembersInFamily = (family, fromUserId, toUserId) => {
  const memberIds = family.members.map((m) => m.user.toString());
  return (
    memberIds.includes(fromUserId.toString()) &&
    memberIds.includes(toUserId.toString())
  );
};

// ─────────────────────────────────────────────
// POST /api/family-transfers
// Create a transfer — "Mom gave me 2000"
// Body: { familyId, toUser, amount, note, transferDate }
// ─────────────────────────────────────────────
const createTransfer = async (req, res) => {
  try {
    const fromUser = req.user.id;
    const { familyId, toUser, amount, note, transferDate } = req.body;

    if (!familyId || !toUser || !amount) {
      return res
        .status(400)
        .json({ message: "familyId, toUser, and amount are required." });
    }

    // Cannot transfer to yourself
    if (fromUser.toString() === toUser.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot transfer money to yourself." });
    }

    const family = await Family.findById(familyId);
    console.log("Family found for transfer:", family);
    if (!family || !family.isActive) {
      return res.status(404).json({ message: "Family not found." });
    }
    console.log("Family members:", family.members);
    // Verify both users are family members
    if (!bothMembersInFamily(family, fromUser, toUser)) {
      return res
        .status(403)
        .json({ message: "Both users must be members of this family." });
    }

    const transfer = await FamilyTransfer.create({
      familyId,
      fromUser,
      toUser,
      amount,
      note: note || null,
      transferDate: transferDate ? new Date(transferDate) : new Date(),
      status: TRANSFER_STATUS.PENDING,
    });

    await transfer.populate([
      { path: "fromUser", select: "name email photo" },
      { path: "toUser", select: "name email photo" },
    ]);

    return res.status(201).json({
      message: "Transfer recorded successfully.",
      transfer,
    });
  } catch (error) {
    console.error("createTransfer error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/family-transfers/:transferId/confirm
// Receiver confirms they received the money
// Creates expense for sender and income for receiver
// ─────────────────────────────────────────────
const confirmTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const userId = req.user.id;

    const transfer = await FamilyTransfer.findById(transferId);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    // Only the receiver can confirm
    if (transfer.toUser.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the receiver can confirm this transfer." });
    }

    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      return res
        .status(400)
        .json({ message: `Transfer is already ${transfer.status}.` });
    }

    // Start a transaction session for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get sender and receiver accounts
      const senderAccount = await Account.findOne({
        userId: transfer.fromUser,
      }).session(session);
      const receiverAccount = await Account.findOne({
        userId: transfer.toUser,
      }).session(session);

      if (!senderAccount) {
        throw new Error("Sender account not found");
      }
      if (!receiverAccount) {
        throw new Error("Receiver account not found");
      }

      // Check if sender has sufficient balance
      if (senderAccount.balance < transfer.amount) {
        throw new Error("Insufficient account balance for transfer");
      }

      // Create expense transaction for sender
      const senderTransaction = new Transaction({
        userId: transfer.fromUser,
        accountId: senderAccount._id,
        title: `Transfer to ${transfer.toUser.name || "Family Member"}`,
        amount: transfer.amount,
        type: "expense",
        category: "Transfers",
        paymentMethod: "Transfer",
        transactionDate: transfer.transferDate,
        description: transfer.note || "Family transfer",
        familyId: transfer.familyId,
        visibility: "shared",
      });
      await senderTransaction.save({ session });

      // Create income transaction for receiver
      const receiverTransaction = new Transaction({
        userId: transfer.toUser,
        accountId: receiverAccount._id,
        title: `Transfer from ${transfer.fromUser.name || "Family Member"}`,
        amount: transfer.amount,
        type: "income",
        category: "Transfers",
        paymentMethod: "Transfer",
        transactionDate: transfer.transferDate,
        description: transfer.note || "Family transfer",
        familyId: transfer.familyId,
        visibility: "shared",
      });
      await receiverTransaction.save({ session });

      // Update sender account (deduct amount)
      senderAccount.balance -= transfer.amount;
      senderAccount.expenses += transfer.amount;
      await senderAccount.save({ session });

      // Update receiver account (add amount)
      receiverAccount.balance += transfer.amount;
      receiverAccount.income += transfer.amount;
      await receiverAccount.save({ session });

      // Mark transfer as confirmed
      transfer.status = TRANSFER_STATUS.CONFIRMED;
      await transfer.save({ session });

      await session.commitTransaction();

      // Populate for response
      await transfer.populate([
        { path: "fromUser", select: "name email photo" },
        { path: "toUser", select: "name email photo" },
      ]);

      return res.status(200).json({
        message: "Transfer confirmed successfully.",
        transfer,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("confirmTransfer error:", error);
    return res.status(500).json({ message: error.message || "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/family-transfers/:transferId/cancel
// Sender cancels before it's confirmed
// ─────────────────────────────────────────────
const cancelTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const userId = req.user.id;

    const transfer = await FamilyTransfer.findById(transferId);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    // Only the sender can cancel
    if (transfer.fromUser.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the sender can cancel this transfer." });
    }

    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      return res
        .status(400)
        .json({ message: `Transfer is already ${transfer.status}.` });
    }

    transfer.status = TRANSFER_STATUS.CANCELLED;
    await transfer.save();

    return res.status(200).json({ message: "Transfer cancelled.", transfer });
  } catch (error) {
    console.error("cancelTransfer error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/family-transfers/family/:familyId
// Get all transfers for a family (most recent first)
// Query: ?status=pending|confirmed|cancelled
// ─────────────────────────────────────────────
const getFamilyTransfers = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { status } = req.query;
    const userId = req.user.id;

    const family = await Family.findById(familyId);
    if (!family || !family.isActive) {
      return res.status(404).json({ message: "Family not found." });
    }

    // Must be a family member to view
    const isMember = family.members.some(
      (m) => m.user.toString() === userId.toString(),
    );
    if (!isMember) {
      return res.status(403).json({ message: "Access denied." });
    }

    const query = { familyId };
    if (status && Object.values(TRANSFER_STATUS).includes(status)) {
      query.status = status;
    }

    const transfers = await FamilyTransfer.find(query)
      .populate("fromUser", "name email photo")
      .populate("toUser", "name email photo")
      .sort({ transferDate: -1 });

    return res.status(200).json({ transfers });
  } catch (error) {
    console.error("getFamilyTransfers error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// GET /api/family-transfers/my/:familyId
// Get transfers where logged-in user is sender or receiver
// ─────────────────────────────────────────────
const getMyTransfers = async (req, res) => {
  try {
    const { familyId } = req.params;
    const userId = req.user.id;

    const transfers = await FamilyTransfer.find({
      familyId,
      $or: [{ fromUser: userId }, { toUser: userId }],
    })
      .populate("fromUser", "name email photo")
      .populate("toUser", "name email photo")
      .sort({ transferDate: -1 });

    return res.status(200).json({ transfers });
  } catch (error) {
    console.error("getMyTransfers error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  createTransfer,
  confirmTransfer,
  cancelTransfer,
  getFamilyTransfers,
  getMyTransfers,
};

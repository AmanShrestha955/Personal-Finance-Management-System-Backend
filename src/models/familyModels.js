const { Schema, model } = require("mongoose");

const FAMILY_ROLE = {
  OWNER: "owner",
  MEMBER: "member",
};

// ─────────────────────────────────────────────
// Confirmed members only — no pending entries here
// ─────────────────────────────────────────────
const MemberSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: Object.values(FAMILY_ROLE),
      default: FAMILY_ROLE.MEMBER,
    },
    joinedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: true },
);

// ─────────────────────────────────────────────
// Temporary invite — deleted once accepted or declined
// ─────────────────────────────────────────────
const PendingInviteSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    token: {
      type: String,
      required: true,
    },
    tokenExpires: {
      type: Date,
      required: true,
    },
  },
  { _id: true },
);

const FamilySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Only confirmed (accepted) members live here
    members: {
      type: [MemberSchema],
      validate: {
        validator: function (members) {
          return members.length >= 1 && members.length <= 7;
        },
        message: "A family can have at most 7 members.",
      },
      default: [],
    },
    // Temporary holding area — cleared when invite is accepted or declined
    pendingInvites: {
      type: [PendingInviteSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Family = model("Family", FamilySchema);

module.exports = { Family, FAMILY_ROLE };

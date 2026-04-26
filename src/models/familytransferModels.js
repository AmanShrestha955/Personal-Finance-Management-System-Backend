const { Schema, model } = require("mongoose");

const TRANSFER_STATUS = {
  PENDING: "pending", // created but not confirmed by receiver
  CONFIRMED: "confirmed", // receiver confirmed they got it
  CANCELLED: "cancelled", // sender cancelled before confirmation
};

const FamilyTransferSchema = new Schema(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: "Family",
      required: true,
      index: true,
    },
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v > 0,
        message: "Transfer amount must be greater than zero.",
      },
    },
    note: {
      type: String,
      trim: true,
      default: null, // e.g. "For groceries" or "Pocket money"
    },
    transferDate: {
      type: Date,
      default: () => new Date(),
    },
    status: {
      type: String,
      enum: Object.values(TRANSFER_STATUS),
      default: TRANSFER_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

// Index for fast family-level transfer lookups
FamilyTransferSchema.index({ familyId: 1, transferDate: -1 });

const FamilyTransfer = model("FamilyTransfer", FamilyTransferSchema);

module.exports = { FamilyTransfer, TRANSFER_STATUS };

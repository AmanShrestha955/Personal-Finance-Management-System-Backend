const { Schema, model } = require("mongoose");

const RecurringTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },

    // --- Template fields (copied into Transaction on each run) ---
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v > 0,
        message: "Amount must be positive",
      },
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Credit Card", "Debit Card", "e-Wallet"],
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // --- Schedule fields ---
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null, // null = runs indefinitely
    },
    nextRunDate: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRunDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for the scheduler query
RecurringTransactionSchema.index({ isActive: 1, nextRunDate: 1 });

const RecurringTransaction = model(
  "RecurringTransaction",
  RecurringTransactionSchema,
);
module.exports = RecurringTransaction;

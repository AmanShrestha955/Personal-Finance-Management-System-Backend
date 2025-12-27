const { Schema, model } = require("mongoose");

const TransactionSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v > 0;
        },
      },
    },
    category: {
      type: String,
      required: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
    recipt: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, transactionDate: -1 });

const Transaction = model("Transaction", TransactionSchema);
module.exports = Transaction;

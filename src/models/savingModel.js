const { Schema, model } = require("mongoose");

const SavingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    savingGoalId: {
      type: Schema.Types.ObjectId,
      ref: "SavingGoal",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transactionType: {
      type: String,
      required: true,
      enum: ["add", "withdraw"],
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

const Saving = model("Saving", SavingSchema);
module.exports = Saving;

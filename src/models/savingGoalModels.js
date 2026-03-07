const { Schema, model } = require("mongoose");

const SavingGoalSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    goalName: {
      type: String,
      required: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currentSaving: {
      type: Number,
      default: 0,
    },
    deadline: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    reminderEnabled: { type: Boolean, default: true },
    reminderDay: { type: String, default: "monday" },
    lastReminderSent: { type: Date, default: null },
    lastNotificationSent: { type: Date, default: null },
  },
  { timestamps: true },
);

const SavingGoal = model("SavingGoal", SavingGoalSchema);
module.exports = SavingGoal;

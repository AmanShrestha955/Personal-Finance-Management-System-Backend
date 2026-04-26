const { Schema, model } = require("mongoose");

const SavingGoalSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: "Family",
      default: null, // null = personal budget
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
    visibility: {
      type: String,
      enum: ["personal", "shared"],
      default: "personal",
    },
  },
  { timestamps: true },
);

SavingGoalSchema.pre("validate", function (next) {
  if (!this.userId && !this.familyId) {
    return next(
      new Error("A saving goal must belong to either a user or a family"),
    );
  }
  next();
});

const SavingGoal = model("SavingGoal", SavingGoalSchema);
module.exports = SavingGoal;

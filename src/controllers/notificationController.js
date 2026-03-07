const SavingGoal = require("../models/savingGoalModels.js");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Called when user opens the app/webpage.
 * Checks all active goals and returns notifications
 * for any goal not notified in the last 7 days.
 * Also updates lastNotificationSent on those goals.
 */
const getInAppNotifications = async (req, res) => {
  try {
    const { id } = req.user;
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    // Find active goals that are due for a notification
    const goals = await SavingGoal.find({
      userId: id,
      isCompleted: false,
      reminderEnabled: true,
      $or: [
        { lastNotificationSent: null },
        { lastNotificationSent: { $lt: sevenDaysAgo } },
      ],
    });

    if (goals.length === 0) {
      return res.status(200).json({
        message: "No new notifications",
        data: [],
      });
    }

    // Build notification messages
    const notifications = goals.map((goal) => {
      const progress = ((goal.currentSaving / goal.targetAmount) * 100).toFixed(
        1,
      );
      const deadline = new Date(goal.deadline);
      const daysLeft = Math.ceil(
        (deadline - new Date()) / (1000 * 60 * 60 * 24),
      );
      const remaining = (goal.targetAmount - goal.currentSaving).toFixed(2);
      const weeksLeft = Math.ceil(daysLeft / 7);
      const weeklyNeeded =
        weeksLeft > 0 ? (remaining / weeksLeft).toFixed(2) : remaining;

      // Determine notification type based on deadline
      let type = "reminder";
      let title = "Saving Goal Reminder";
      if (daysLeft <= 0) {
        type = "overdue";
        title = "⚠️ Goal Overdue!";
      } else if (daysLeft <= 7) {
        type = "deadline_warning";
        title = "🔔 Deadline Approaching!";
      }

      return {
        goalId: goal._id,
        goalName: goal.goalName,
        category: goal.category,
        type,
        title,
        message: buildMessage(
          goal.goalName,
          progress,
          daysLeft,
          remaining,
          weeklyNeeded,
        ),
        progress: parseFloat(progress),
        daysLeft,
        currentSaving: goal.currentSaving,
        targetAmount: goal.targetAmount,
      };
    });

    // Update lastNotificationSent for all notified goals
    await SavingGoal.updateMany(
      { _id: { $in: goals.map((g) => g._id) } },
      { lastNotificationSent: new Date() },
    );

    return res.status(200).json({
      message: "Notifications fetched successfully",
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Toggle reminder on/off for a specific goal
 */
const toggleReminder = async (req, res) => {
  try {
    const { id } = req.user;
    const { goalId } = req.params;

    const goal = await SavingGoal.findOne({ _id: goalId, userId: id });

    if (!goal) {
      return res.status(404).json({ message: "Saving Goal not found" });
    }

    goal.reminderEnabled = !goal.reminderEnabled;
    await goal.save();

    return res.status(200).json({
      message: `Reminder ${goal.reminderEnabled ? "enabled" : "disabled"} successfully`,
      data: {
        goalId: goal._id,
        reminderEnabled: goal.reminderEnabled,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to toggle reminder",
      error: error.message,
    });
  }
};

// Helper to build notification message
const buildMessage = (
  goalName,
  progress,
  daysLeft,
  remaining,
  weeklyNeeded,
) => {
  if (daysLeft <= 0) {
    return `Your "${goalName}" goal is overdue! You still need $${remaining} to complete it.`;
  }
  if (daysLeft <= 7) {
    return `Only ${daysLeft} days left for "${goalName}"! You need $${remaining} more to reach your goal.`;
  }
  return `You're ${progress}% toward your "${goalName}" goal. Save $${weeklyNeeded}/week to hit your target in time!`;
};

module.exports = { getInAppNotifications, toggleReminder };

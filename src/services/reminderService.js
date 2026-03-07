const cron = require("node-cron");
const SavingGoal = require("../models/savingGoalModels.js");
const User = require("../models/userModels.js"); // adjust path if needed
const { sendWeeklyReminderEmail } = require("./emailService.js");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const sendWeeklyReminders = async () => {
  try {
    console.log("Running weekly reminder job...");

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    // Find all active goals where reminder is enabled
    // and either never sent or last sent more than 7 days ago
    const goals = await SavingGoal.find({
      isCompleted: false,
      reminderEnabled: true,
      $or: [
        { lastReminderSent: null },
        { lastReminderSent: { $lt: sevenDaysAgo } },
      ],
    });

    if (goals.length === 0) {
      console.log("No reminders to send.");
      return;
    }

    // Group goals by userId
    const goalsByUser = goals.reduce((acc, goal) => {
      const userId = goal.userId.toString();
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(goal);
      return acc;
    }, {});

    // Send one email per user with all their goals
    for (const [userId, userGoals] of Object.entries(goalsByUser)) {
      const user = await User.findById(userId).select("name email");

      if (!user || !user.email) {
        console.log(`No email found for user ${userId}, skipping.`);
        continue;
      }

      await sendWeeklyReminderEmail(user.email, user.name, userGoals);

      // Update lastReminderSent for all goals of this user
      await SavingGoal.updateMany(
        { _id: { $in: userGoals.map((g) => g._id) } },
        { lastReminderSent: new Date() },
      );
    }

    console.log("Weekly reminder job completed.");
  } catch (error) {
    console.error("Error in weekly reminder job:", error.message);
  }
};

// Schedule: runs every day at 8AM, but the 7-day check controls actual sending
// You can also set this to run once a week: '0 8 * * 1' (every Monday 8AM)
const startReminderJob = () => {
  cron.schedule("0 8 * * *", sendWeeklyReminders, {
    timezone: "Asia/Kathmandu", // adjust to your timezone
  });
  console.log("Weekly reminder cron job scheduled.");
};

module.exports = { startReminderJob };

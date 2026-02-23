const cron = require("node-cron");
const RecurringTransaction = require("../models/Recurringtransactionmodel");
const { createTransactionCore } = require("../services/transactionServices");

// ─────────────────────────────────────────────
// Helper: calculate the next run date
// ─────────────────────────────────────────────
function getNextRunDate(currentDate, frequency) {
  const next = new Date(currentDate);

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }

  return next;
}

// ─────────────────────────────────────────────
// Core processor
// ─────────────────────────────────────────────
async function processRecurringTransactions() {
  const now = new Date();
  console.log(`[Scheduler] Running at ${now.toISOString()}`);

  const dueRecurring = await RecurringTransaction.find({
    isActive: true,
    nextRunDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  });

  if (dueRecurring.length === 0) {
    console.log("[Scheduler] No recurring transactions due.");
    return;
  }

  console.log(
    `[Scheduler] Processing ${dueRecurring.length} transaction(s)...`,
  );

  for (const recurring of dueRecurring) {
    try {
      // Call the shared service — same logic as the HTTP controller
      await createTransactionCore({
        userId: recurring.userId,
        title: recurring.title,
        amount: recurring.amount,
        type: recurring.type,
        category: recurring.category,
        paymentMethod: recurring.paymentMethod,
        description: recurring.description,
        transactionDate: recurring.nextRunDate,
        recurringTransactionId: recurring._id, // traceability
      });

      // Compute next run date and check if we should deactivate
      const nextRun = getNextRunDate(
        recurring.nextRunDate,
        recurring.frequency,
      );
      const shouldDeactivate =
        recurring.endDate && nextRun > new Date(recurring.endDate);

      await RecurringTransaction.findByIdAndUpdate(recurring._id, {
        lastRunDate: recurring.nextRunDate,
        nextRunDate: nextRun,
        isActive: !shouldDeactivate,
      });

      console.log(
        `[Scheduler] ✓ recurringId=${recurring._id} | nextRun=${nextRun.toISOString()}${shouldDeactivate ? " | DEACTIVATED (end date reached)" : ""}`,
      );
    } catch (err) {
      // Log error but keep processing other records
      console.error(`[Scheduler] ✗ recurringId=${recurring._id}:`, err.message);
    }
  }

  console.log("[Scheduler] Done.");
}

// ─────────────────────────────────────────────
// Start the cron job (called once in server.js)
//
// "0 0 * * *" = every day at midnight
// ─────────────────────────────────────────────
function startRecurringTransactionScheduler() {
  cron.schedule("0 0 * * *", async () => {
    await processRecurringTransactions();
  });

  console.log("[Scheduler] Started — runs daily at midnight.");
}

module.exports = {
  startRecurringTransactionScheduler,
  processRecurringTransactions,
};

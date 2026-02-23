const express = require("express");
const recurringTransactionRouter = express.Router();
const {
  createRecurringTransaction,
  getRecurringTransactions,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
} = require("../controllers/RecurringTransactioncController");

const authMiddleware = require("../middlewares/authMiddlewares"); // your existing auth middleware

// All routes are protected (user must be logged in)
recurringTransactionRouter.use(authMiddleware);

recurringTransactionRouter
  .route("/")
  .post(createRecurringTransaction) // Create a new recurring transaction
  .get(getRecurringTransactions); // Get all recurring transactions for the user

recurringTransactionRouter
  .route("/:recurringId")
  .get(getRecurringTransactionById) // Get one by ID
  .put(updateRecurringTransaction) // Update schedule or template fields
  .delete(deleteRecurringTransaction); // Delete permanently

recurringTransactionRouter.patch(
  "/:recurringId/toggle",
  toggleRecurringTransaction,
); // Pause / resume

module.exports = recurringTransactionRouter;

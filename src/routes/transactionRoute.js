const {
  createTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  getTotalSpendByDateRange,
} = require("../controllers/transactionController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  uploadSingleReceipt,
  handleUploadError,
} = require("../middlewares/upload.middleware.js");
const transactionRouter = Router();

transactionRouter.post(
  "/",
  authMiddleware,
  uploadSingleReceipt,
  handleUploadError,
  createTransaction
);
transactionRouter.get("/:transactionId", authMiddleware, getTransactionById);
transactionRouter.get("/", authMiddleware, getTransactions);
transactionRouter.put(
  "/:transactionId",
  authMiddleware,
  uploadSingleReceipt,
  handleUploadError,
  updateTransaction
);
transactionRouter.delete("/:transactionId", authMiddleware, deleteTransaction);
transactionRouter.get(
  "/analytics/total-spend",
  authMiddleware,
  getTotalSpendByDateRange
);
// **Usage:**

// 1. **Total spend for all categories:**
// GET /transactions/analytics/total-spend?startDate=2025-01-01&endDate=2025-01-30

// 2. **Total spend for specific category:**
// GET /transactions/analytics/total-spend?startDate=2025-01-01&endDate=2025-01-30&category=Food

module.exports = transactionRouter;

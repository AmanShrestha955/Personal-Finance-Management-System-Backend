const {
  createTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
  deleteTransaction,
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

module.exports = transactionRouter;

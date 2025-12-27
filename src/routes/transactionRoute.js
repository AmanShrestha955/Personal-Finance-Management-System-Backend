const {
  createTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const transactionRouter = Router();

transactionRouter.post("/", authMiddleware, createTransaction);
transactionRouter.get("/:transactionId", authMiddleware, getTransactionById);
transactionRouter.get("/", authMiddleware, getTransactions);
transactionRouter.put("/:transactionId", authMiddleware, updateTransaction);
transactionRouter.delete("/:transactionId", authMiddleware, deleteTransaction);

module.exports = transactionRouter;

const Transaction = require("../models/transactionModels.js");
const Account = require("../models/accountModels.js");
const mongoose = require("mongoose");

const createTransaction = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const {
      amount,
      type,
      accountId,
      category,
      transactionDate,
      description,
      note,
      recipt,
      tags,
    } = req.body;
    const { id } = req.user;
    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.userId.toString() !== id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to access this account" });
    }
    const newTransaction = new Transaction({
      userId: id,
      accountId,
      amount,
      type,
      category,
      transactionDate,
      description,
      note,
      recipt,
      tags,
    });
    const savedTransaction = await newTransaction.save();
    if (!savedTransaction) {
      return res.status(500).json({ message: "Failed to create transaction" });
    }
    const updatedAccount = await Account.findById(accountId);
    if (type === "income") {
      updatedAccount.balance += amount;
    } else if (type === "expense") {
      updatedAccount.balance -= amount;
    }
    await updatedAccount.save();
    res.status(201).json({
      message: "Transaction created successfully",
      data: {
        transaction: newTransaction,
        account: updatedAccount,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Transaction creation failed. error in createTransaction function",
      error: error.message,
    });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { id } = req.user;
    const transactions = await Transaction.find({ userId: id });
    res.status(200).json({
      message: "Transactions fetched successfully",
      data: transactions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching transactions failed. error in getTransactions function",
      error: error.message,
    });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const { id } = req.user;
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.status(200).json({
      message: "Transaction fetched successfully",
      data: transaction,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching transaction failed. error in getTransactionById function",
      error: error.message,
    });
  }
};
// need to check
const updateTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.user;

    const {
      amount,
      type,
      category,
      transactionDate,
      description,
      note,
      recipt,
      tags,
    } = req.body;
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId).session(
      session
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.userId.toString() !== id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this transaction" });
    }

    const account = await Account.findById(transaction.accountId).session(
      session
    );
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (transaction.type === "income") {
      account.balance -= transaction.amount;
    } else if (transaction.type === "expense") {
      account.balance += transaction.amount;
    }

    const newType = type || transaction.type;
    const newAmount = amount || transaction.amount;

    if (newType === "income") {
      account.balance += newAmount;
    } else if (newType === "expense") {
      account.balance -= newAmount;
    }

    // Update the fields
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.category = category || transaction.category;
    transaction.transactionDate =
      transactionDate || transaction.transactionDate;
    transaction.description = description || transaction.description;
    transaction.note = note || transaction.note;
    transaction.recipt = recipt || transaction.recipt;
    transaction.tags = tags || transaction.tags;

    // save the updated transaction
    await transaction.save({ session });
    await account.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Transaction updated successfully",
      data: {
        transaction: transaction,
        account: account,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).json({
      message:
        "Updating transaction failed. error in updateTransaction function",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.user;
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.userId.toString() !== id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this transaction" });
    }

    const account = await Account.findById(transaction.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (transaction.type === "income") {
      account.balance -= transaction.amount;
    } else if (transaction.type === "expense") {
      account.balance += transaction.amount;
    }

    await Transaction.findByIdAndDelete(transactionId);
    await account.save();

    res.status(200).json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Deleting transaction failed. error in deleteTransaction function",
      error: error.message,
    });
  }
};

module.exports = {
  createTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};

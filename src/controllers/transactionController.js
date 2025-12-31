const Transaction = require("../models/transactionModels.js");
const Budget = require("../models/budgetModels.js");
const Account = require("../models/accountModels.js");
const mongoose = require("mongoose");

const createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log("Request Body:", req.body);
    console.log("Uploaded File:", req.file); // Multer adds this

    const {
      title,
      amount,
      type,
      accountId,
      category,
      paymentMethod,
      transactionDate,
      description,
      note,
      tags,
    } = req.body;
    const { id } = req.user;

    // Parse tags if sent as JSON string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = [];
      }
    }

    // Get receipt path from uploaded file
    const receiptPath = req.file ? req.file.path : null;
    // Or use relative path: req.file ? `/uploads/receipts/${req.file.filename}` : null;

    // Validation
    if (!amount || !type || !accountId || !category || !paymentMethod) {
      await session.abortTransaction();
      return res.status(400).json({
        message:
          "Amount, type, accountId, category, and paymentMethod are required",
      });
    }
    if (!title) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Title is required",
      });
    }
    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Amount must be positive",
      });
    }
    if (!["income", "expense"].includes(type)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Type must be either 'income' or 'expense'",
      });
    }

    const account = await Account.findById(accountId).session(session);
    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.userId.toString() !== id) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "You are not authorized to access this account" });
    }

    // Check for sufficient balance for expenses
    if (type === "expense" && account.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient account balance",
      });
    }

    const newTransaction = new Transaction({
      userId: id,
      accountId,
      title,
      amount,
      type,
      category,
      paymentMethod,
      transactionDate: transactionDate || new Date(),
      description,
      note,
      receipt: receiptPath, // Save file path
      tags: parsedTags,
    });

    await newTransaction.save({ session });

    // Update budget only for expenses
    let updatedBudget = null;
    if (type === "expense") {
      const budget = await Budget.findOne({
        userId: id,
        category: category,
      }).session(session);
      if (budget) {
        budget.spentAmount += amount;
        await budget.save({ session });
        updatedBudget = budget;
      }
    }

    if (type === "income") {
      account.balance += amount;
    } else if (type === "expense") {
      account.balance -= amount;
    }

    await account.save({ session });

    // Build response object
    const responseData = {
      transaction: newTransaction,
      account: account,
    };

    // Only include budget if it was updated
    if (updatedBudget) {
      responseData.budget = updatedBudget;
    }

    await session.commitTransaction();

    res.status(201).json({
      message: "Transaction created successfully",
      data: responseData,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).json({
      message:
        "Transaction creation failed. error in createTransaction function",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const getTransactions = async (req, res) => {
  try {
    const { id } = req.user;
    const transactions = await Transaction.find({ userId: id }).sort({
      createdAt: -1,
    });
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
    const { transactionId } = req.params;
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: id,
    });
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
    console.log("Request Body:", req.body);
    console.log("Uploaded File:", req.file); // Multer adds this

    const { id } = req.user;

    const {
      title,
      // amount,
      type,
      category,
      transactionDate,
      description,
      note,
      paymentMethod,
      tags,
    } = req.body;
    const { transactionId } = req.params;
    const amount = parseFloat(req.body.amount);

    // Get receipt path from uploaded file
    const receiptPath = req.file ? req.file.path : null;
    // Or use relative path: req.file ? `/uploads/receipts/${req.file.filename}` : null;

    // Find transaction first
    const transaction = await Transaction.findById(transactionId).session(
      session
    );

    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.userId.toString() !== id) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json({ message: "You are not authorized to update this transaction" });
    }

    // Get new values with fallbacks
    const newTitle = title || transaction.title;
    const newAmount = amount !== undefined ? amount : transaction.amount;
    const newType = type || transaction.type;
    const newCategory = category || transaction.category;
    const newPaymentMethod = paymentMethod || transaction.paymentMethod;

    // Validation on new values
    if (!newTitle) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Title is required",
      });
    }
    if (newAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Amount must be positive",
      });
    }
    if (!["income", "expense"].includes(newType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Type must be either 'income' or 'expense'",
      });
    }

    const account = await Account.findById(transaction.accountId).session(
      session
    );
    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Account not found" });
    }

    // Calculate the net effect on account balance
    let balanceChange = 0;

    // Reverse old transaction effect
    if (transaction.type === "income") {
      balanceChange -= transaction.amount; // Remove old income
    } else if (transaction.type === "expense") {
      balanceChange += transaction.amount; // Reverse old expense
    }

    // Apply new transaction effect
    if (newType === "income") {
      balanceChange += newAmount;
    } else if (newType === "expense") {
      balanceChange -= newAmount;
    }

    // Check for sufficient balance
    const projectedBalance = account.balance + balanceChange;
    if (projectedBalance < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Insufficient account balance for this update",
      });
    }

    // Update budgets only for expenses
    // Remove old expense from old budget
    if (transaction.type === "expense") {
      const oldBudget = await Budget.findOne({
        userId: id,
        category: transaction.category,
      }).session(session);
      if (oldBudget) {
        oldBudget.spentAmount -= transaction.amount;
        await oldBudget.save({ session });
      }
    }

    // Add new expense to new budget
    if (newType === "expense") {
      const newBudget = await Budget.findOne({
        userId: id,
        category: newCategory,
      }).session(session);
      if (newBudget) {
        newBudget.spentAmount += newAmount;
        await newBudget.save({ session });
      }
    }

    // Update account balance
    account.balance = projectedBalance;
    await account.save({ session });

    // Update transaction fields
    transaction.title = newTitle;
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.category = newCategory;
    transaction.transactionDate =
      transactionDate || transaction.transactionDate;
    transaction.description =
      description !== undefined ? description : transaction.description;
    transaction.note = note !== undefined ? note : transaction.note;
    transaction.receipt = receiptPath;
    transaction.tags = tags !== undefined ? tags : transaction.tags;
    transaction.paymentMethod = paymentMethod;

    await transaction.save({ session });

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.user;
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId).session(
      session
    );

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.userId.toString() !== id) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this transaction" });
    }

    const account = await Account.findById(transaction.accountId).session(
      session
    );
    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (transaction.type === "income") {
      account.balance -= transaction.amount;
    } else if (transaction.type === "expense") {
      account.balance += transaction.amount;
    }

    if (transaction.type === "expense") {
      const budget = await Budget.findOne({
        userId: id,
        category: transaction.category,
      }).session(session);

      if (budget) {
        budget.spentAmount -= transaction.amount;
        await budget.save({ session });
      }
    }

    await Transaction.findByIdAndDelete(transactionId).session(session);
    await account.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).json({
      message:
        "Deleting transaction failed. error in deleteTransaction function",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  createTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};

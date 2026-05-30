const Transaction = require("../models/transactionModels.js");
const Budget = require("../models/budgetModels.js");
const Account = require("../models/accountModels.js");
const User = require("../models/userModels.js");
const mongoose = require("mongoose");
const { createTransactionCore } = require("../services/transactionServices.js");
const { sendBudgetAlertEmail } = require("../services/emailService.js");

const createTransaction = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    console.log("Uploaded File:", req.file);

    const {
      title,
      type,
      category,
      paymentMethod,
      transactionDate,
      description,
      note,
      tags,
    } = req.body;

    const { id } = req.user;
    const amount = parseFloat(req.body.amount);

    // Parse tags if sent as JSON string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = [];
      }
    }

    const receiptPath = req.file ? req.file.path.replace(/\\/g, "/") : null;

    // Delegate all business logic to the shared service
    const result = await createTransactionCore({
      userId: id,
      title,
      amount,
      type,
      category,
      paymentMethod,
      transactionDate: transactionDate || new Date(),
      description,
      receiptPath,
      tags: parsedTags,
      note,
    });

    res.status(201).json({
      message: "Transaction created successfully",
      messageStatus: "success",
      warning: result.warning || null,
      warningStatus: result.warningStatus || null,
      data: result,
    });
  } catch (error) {
    console.log(error);

    // Surface validation errors as 400, everything else as 500
    const isValidationError = [
      "Title is required",
      "Amount must be positive",
      "Type must be 'income' or 'expense'",
      "Category is required",
      "PaymentMethod is required",
      "Insufficient account balance",
      "Account not found",
    ].includes(error.message);

    res.status(isValidationError ? 400 : 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { id } = req.user;
    const { type, category, startDate, endDate, search, page = 1, limit = 10 } = req.query;

    // ── Build filter ──────────────────────────────────────────────────────
    const filter = {
      userId: id,
      familyId: null,
    };

    // type filter — "all" or omitted means no type constraint
    if (type && type !== "all") {
      if (!["income", "expense"].includes(type)) {
        return res.status(400).json({
          message: "Type must be 'income', 'expense', or 'all'",
          messageStatus: "error",
        });
      }
      filter.type = type;
    }

    // category filter — case-insensitive exact match
    if (category) {
      const categoryList = category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (categoryList.length === 1) {
        filter.category = { $regex: new RegExp(`^${categoryList[0]}$`, "i") };
      } else {
        filter.category = {
          $in: categoryList.map((c) => new RegExp(`^${c}$`, "i")),
        };
      }
    }

    // date range filter on transactionDate
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            message: "Invalid startDate format",
            messageStatus: "error",
          });
        }
        filter.transactionDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            message: "Invalid endDate format",
            messageStatus: "error",
          });
        }
        end.setHours(23, 59, 59, 999); // include the full end day
        filter.transactionDate.$lte = end;
      }
    }

    // search filter — case-insensitive substring match on title
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    // Parse pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);

    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      message: "Transactions fetched successfully",
      messageStatus: "success",
      data: transactions,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching transactions failed. Error in getTransactions function",
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
    let warningStatus = null;
    let warningMessage = null;
    console.log("Request Body:", req.body);
    if (req.file) {
      console.log("Uploaded File:", req.file); // Multer adds this
    }
    const { id } = req.user;

    const {
      title,
      amount,
      type,
      category,
      transactionDate,
      description,
      note,
      paymentMethod,
      tags,
    } = req.body;

    const { transactionId } = req.params;

    // Find transaction first
    const transaction =
      await Transaction.findById(transactionId).session(session);

    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "Transaction not found", messageStatus: "error" });
    }

    if (transaction.userId.toString() !== id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "You are not authorized to update this transaction",
        messageStatus: "error",
      });
    }

    // Get receipt path from uploaded file
    const receiptPath = req.file
      ? req.file.path.replace(/\\/g, "/")
      : transaction.receipt;
    // Or use relative path: req.file ? `/uploads/receipts/${req.file.filename}` : transaction.receipt;

    // Get new values with fallbacks
    const newTitle = title || transaction.title;
    const newAmount =
      amount !== undefined ? parseFloat(amount) : transaction.amount;
    const newType = type || transaction.type;
    const newCategory = category || transaction.category;
    const newPaymentMethod = paymentMethod || transaction.paymentMethod;

    // Validation on new values
    if (!newTitle) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Title is required",
        messageStatus: "error",
      });
    }
    if (newAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Amount must be positive",
        messageStatus: "error",
      });
    }
    if (!["income", "expense"].includes(newType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Type must be either 'income' or 'expense'",
        messageStatus: "error",
      });
    }

    const account = await Account.findOne({ userId: id }).session(session);
    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "Account not found", messageStatus: "error" });
    }

    // Calculate the net effect on account balance
    let balanceChange = 0;

    // Reverse old transaction effect
    if (transaction.type === "income") {
      balanceChange -= transaction.amount; // Remove old income
      account.income -= transaction.amount;
    } else if (transaction.type === "expense") {
      balanceChange += transaction.amount; // Reverse old expense
      account.expenses -= transaction.amount;
    }

    // Apply new transaction effect
    if (newType === "income") {
      balanceChange += newAmount;
      account.income += newAmount;
    } else if (newType === "expense") {
      balanceChange -= newAmount;
      account.expenses += newAmount;
    }

    // Check for sufficient balance
    const projectedBalance = account.balance + balanceChange;

    if (projectedBalance < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        messageStatus: "error",
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

        // Check threshold
        const spentPercentage =
          (newBudget.spentAmount / newBudget.budgetAmount) * 100;
        if (spentPercentage >= newBudget.alertThreshold) {
          warningMessage = `You've used ${spentPercentage.toFixed(0)}% of your ${newCategory} budget.`;
          warningStatus = "warning";
          
          // Check if we should send email (once per month)
          const lastEmailSent = newBudget.lastAlertEmailSent ? new Date(newBudget.lastAlertEmailSent) : null;
          const currentMonth = new Date();
          const shouldSendEmail = !lastEmailSent || 
            lastEmailSent.getFullYear() !== currentMonth.getFullYear() || 
            lastEmailSent.getMonth() !== currentMonth.getMonth();
          
          if (shouldSendEmail) {
            try {
              const user = await User.findById(id).select("name email");
              if (user && user.email) {
                await sendBudgetAlertEmail(user.email, user.name, {
                  category: newCategory,
                  spentAmount: newBudget.spentAmount,
                  budgetAmount: newBudget.budgetAmount,
                  spentPercentage,
                  alertThreshold: newBudget.alertThreshold,
                });
                newBudget.lastAlertEmailSent = new Date();
              }
            } catch (emailError) {
              console.error(`Error sending budget alert email: ${emailError.message}`);
              // Don't throw - let transaction complete even if email fails
            }
          }
        }
        if (spentPercentage >= 100) {
          warningMessage = `You've exceeded your ${newCategory} budget!`;
          warningStatus = "danger";
        }
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
    transaction.tags =
      tags !== undefined
        ? typeof tags === "string"
          ? JSON.parse(tags)
          : tags
        : transaction.tags;
    transaction.paymentMethod = newPaymentMethod;

    await transaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Transaction updated successfully",
      messageStatus: "success",
      warning: warningMessage,
      warningStatus: warningStatus,
      data: {
        transaction: transaction,
        account: account,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).json({
      message: error.message,
      messageStatus: "error",
      error: error.message,
      moreInfo:
        "Updating transaction failed. error in updateTransaction function",
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

    const transaction =
      await Transaction.findById(transactionId).session(session);

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
      session,
    );
    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (transaction.type === "income") {
      account.balance -= transaction.amount;
      account.income -= transaction.amount;
    } else if (transaction.type === "expense") {
      account.balance += transaction.amount;
      account.expenses -= transaction.amount;
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

const getTotalSpendByDateRange = async (req, res) => {
  try {
    const { id } = req.user;
    const { startDate, endDate, category } = req.query;

    // Validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Both startDate and endDate are required",
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format",
      });
    }

    if (start > end) {
      return res.status(400).json({
        message: "Start date must be before or equal to end date",
      });
    }

    // Build match condition
    const matchCondition = {
      userId: new mongoose.Types.ObjectId(id),
      type: "expense",
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    // Add category filter if provided
    if (category) {
      matchCondition.category = category;
    }

    // Aggregate total spend for expenses only
    const result = await Transaction.aggregate([
      {
        $match: matchCondition,
      },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const totalSpend = result.length > 0 ? result[0].totalSpend : 0;
    const transactionCount = result.length > 0 ? result[0].transactionCount : 0;

    const responseData = {
      startDate: start,
      endDate: end,
      totalSpend: totalSpend,
      transactionCount: transactionCount,
    };

    // Include category in response if filtered
    if (category) {
      responseData.category = category;
    }

    res.status(200).json({
      message: "Total spend calculated successfully",
      data: responseData,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to calculate total spend",
      error: error.message,
    });
  }
};

const getRecentMonthTransactions = async (req, res) => {
  try {
    const { id } = req.user;
    const currentDate = new Date();
    const pastMonthDate = new Date();
    pastMonthDate.setMonth(currentDate.getMonth() - 1);

    const transaction = await Transaction.find({
      userId: id,
      transactionDate: { $gte: pastMonthDate, $lte: currentDate },
    }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      message: "Transactions fetched successfully",
      data: transaction,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching transactions failed. error in getTransactionsByTransactionDate function",
      error: error.message,
    });
  }
};

const getResentTags = async (req, res) => {
  try {
    const { id } = req.user;

    // Get the last 30 transactions for the user
    const transactions = await Transaction.find({
      userId: id,
      familyId: null,
    })
      .sort({ transactionDate: -1 })
      .limit(30)
      .select("tags");

    // Extract all unique tags from transactions
    const tagsSet = new Set();
    transactions.forEach((transaction) => {
      if (transaction.tags && Array.isArray(transaction.tags)) {
        transaction.tags.forEach((tag) => {
          if (tag) {
            tagsSet.add(tag);
          }
        });
      }
    });

    // Convert set to sorted array
    const uniqueTags = Array.from(tagsSet).sort();

    res.status(200).json({
      message: "Recent tags fetched successfully",
      messageStatus: "success",
      data: uniqueTags,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Fetching recent tags failed. error in getResentTags function",
      messageStatus: "error",
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
  getTotalSpendByDateRange,
  getRecentMonthTransactions,
  getResentTags,
};

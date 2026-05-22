// ─────────────────────────────────────────────────────────────────────────────
// familyTransactionController.js
//
// Income flow:
//   When a member adds income to the family, the amount is deducted from their
//   personal account and added to the family account. A mirror "expense"
//   transaction is also written to the personal ledger so the member's own
//   history reflects the outflow.
//
// Expense flow:
//   The amount is deducted directly from the family account balance.
//
// Role semantics:
//   owner  → create / update / delete ANY transaction in the family
//   member → create freely; update / delete their OWN transactions only
//
// IMPORTANT – One schema change required before using this controller:
//
//   In transactionModels.js, add a `familyTransactionRef` field so personal
//   mirror transactions can be linked back to their family transaction:
//
//     familyTransactionRef: {
//       type: Schema.Types.ObjectId,
//       ref: "Transaction",
//       default: null,
//     },
// ─────────────────────────────────────────────────────────────────────────────

const Transaction = require("../models/transactionModels.js");
const Account = require("../models/accountModels.js");
const Budget = require("../models/budgetModels.js");
const { Family, FAMILY_ROLE } = require("../models/familyModels.js");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Helper – resolve the caller's role inside a family
// Returns { family, memberEntry, isOwner } or throws.
// ─────────────────────────────────────────────
const resolveFamilyRole = async (familyId, userId, session) => {
  const family = await Family.findOne({
    _id: familyId,
    isActive: true,
  }).session(session);

  if (!family) {
    const err = new Error("Family not found or inactive");
    err.statusCode = 404;
    throw err;
  }

  const memberEntry = family.members.find(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!memberEntry) {
    const err = new Error("You are not a member of this family");
    err.statusCode = 403;
    throw err;
  }

  const isOwner = memberEntry.role === FAMILY_ROLE.OWNER;
  return { family, memberEntry, isOwner };
};

// ─────────────────────────────────────────────
// Helper – round to 2 decimal places
// ─────────────────────────────────────────────
const round2 = (n) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────
// Helper – parse tags from request body
// ─────────────────────────────────────────────
const parseTags = (tags) => {
  if (!tags) return [];
  try {
    return typeof tags === "string" ? JSON.parse(tags) : tags;
  } catch {
    return [];
  }
};

// ═════════════════════════════════════════════
// CREATE family transaction
// POST /api/families/:familyId/transactions
// Any member
// ═════════════════════════════════════════════
const createFamilyTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

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

    const amount = round2(parseFloat(req.body.amount));
    const receiptPath = req.file ? req.file.path.replace(/\\/g, "/") : null;
    const parsedTags = parseTags(tags);
    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    // ── Basic validation ──────────────────────────────────────────────────
    if (!title?.trim()) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Title is required", messageStatus: "error" });
    }
    if (isNaN(amount) || amount <= 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Amount must be positive", messageStatus: "error" });
    }
    if (!["income", "expense"].includes(type)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Type must be 'income' or 'expense'",
        messageStatus: "error",
      });
    }
    if (!category?.trim()) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Category is required", messageStatus: "error" });
    }
    if (!paymentMethod) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "PaymentMethod is required", messageStatus: "error" });
    }

    // ── Resolve role (any member can create) ─────────────────────────────
    await resolveFamilyRole(familyId, userId, session);

    // ── Fetch the family account ──────────────────────────────────────────
    const familyAccount = await Account.findOne({ familyId }).session(session);
    if (!familyAccount) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Family account not found. Please contact the family owner.",
        messageStatus: "error",
      });
    }

    let warningMessage = null;
    let warningStatus = null;

    // ── Pre-build the family transaction (needs _id for mirror ref) ───────
    const familyTransaction = new Transaction({
      userId,
      accountId: familyAccount._id,
      familyId,
      title: title.trim(),
      amount,
      type,
      category: category.trim(),
      paymentMethod,
      transactionDate: txDate,
      description,
      note,
      receipt: receiptPath,
      tags: parsedTags,
    });

    if (type === "income") {
      // ── INCOME: deduct from contributor's personal account ──────────────
      const personalAccount = await Account.findOne({
        userId,
        familyId: null,
      }).session(session);

      if (!personalAccount) {
        await session.abortTransaction();
        return res.status(404).json({
          message: "Your personal account was not found",
          messageStatus: "error",
        });
      }

      if (personalAccount.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient personal balance. You have ${round2(personalAccount.balance)} available.`,
          messageStatus: "error",
        });
      }

      // Update balances
      personalAccount.balance = round2(personalAccount.balance - amount);
      personalAccount.expenses = round2(personalAccount.expenses + amount);
      familyAccount.balance = round2(familyAccount.balance + amount);
      familyAccount.income = round2(familyAccount.income + amount);

      // Mirror transaction on the personal ledger.
      // familyTransactionRef links it back so delete/update can clean it up.
      const personalMirror = new Transaction({
        userId,
        accountId: personalAccount._id,
        familyId: null,
        familyTransactionRef: familyTransaction._id,
        title: `Family contribution: ${title.trim()}`,
        amount,
        type: "expense",
        category: category.trim(),
        paymentMethod,
        transactionDate: txDate,
        description,
        note,
        receipt: receiptPath,
        tags: parsedTags,
      });

      // Save all in order: accounts first, then transactions
      await personalAccount.save({ session });
      await familyAccount.save({ session });
      await familyTransaction.save({ session });
      await personalMirror.save({ session });
    } else {
      // ── EXPENSE: deduct from family account ───────────────────────────
      if (familyAccount.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient family balance. Family has ${round2(familyAccount.balance)} available.`,
          messageStatus: "error",
        });
      }

      familyAccount.balance = round2(familyAccount.balance - amount);
      familyAccount.expenses = round2(familyAccount.expenses + amount);

      // ── Budget check ──────────────────────────────────────────────────
      const budget = await Budget.findOne({
        familyId,
        category: category.trim(),
        isActive: true,
        visibility: "shared",
      }).session(session);

      if (budget) {
        budget.spentAmount = round2(budget.spentAmount + amount);
        await budget.save({ session });

        const spentPercentage =
          (budget.spentAmount / budget.budgetAmount) * 100;
        if (spentPercentage >= 100) {
          warningMessage = `Family has exceeded the ${category} budget!`;
          warningStatus = "danger";
        } else if (spentPercentage >= budget.alertThreshold) {
          warningMessage = `Family has used ${spentPercentage.toFixed(0)}% of the ${category} budget.`;
          warningStatus = "warning";
        }
      }

      await familyAccount.save({ session });
      await familyTransaction.save({ session });
    }

    await session.commitTransaction();

    res.status(201).json({
      message: "Family transaction created successfully",
      messageStatus: "success",
      warning: warningMessage,
      warningStatus,
      data: familyTransaction,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  } finally {
    session.endSession();
  }
};

// ═════════════════════════════════════════════
// GET all transactions for a family
// GET /api/families/:familyId/transactions
// GET /api/families/:familyId/transactions?type=income&startDate=2025-06-01
// Any member
// ═════════════════════════════════════════════
const getFamilyTransactions = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;
    const { type, category, startDate, endDate, search, page = 1, limit = 10 } = req.query;

    await resolveFamilyRole(familyId, userId, null);

    // ── Build filter ──────────────────────────────────────────────────────
    const filter = {
      familyId: new mongoose.Types.ObjectId(familyId),
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
      .populate("userId", "name email photo")
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      message: "Family transactions fetched successfully",
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
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// GET a single family transaction by ID
// GET /api/families/:familyId/transactions/:transactionId
// Any member
// ═════════════════════════════════════════════
const getFamilyTransactionById = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, transactionId } = req.params;

    await resolveFamilyRole(familyId, userId, null);

    const transaction = await Transaction.findOne({
      _id: transactionId,
      familyId,
    }).populate("userId", "name email photo");

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family transaction fetched successfully",
      messageStatus: "success",
      data: transaction,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// UPDATE a family transaction
// PUT /api/families/:familyId/transactions/:transactionId
//
// Owner  → can update any transaction in the family
// Member → can only update their own
// ═════════════════════════════════════════════
const updateFamilyTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let warningMessage = null;
    let warningStatus = null;

    const { id: userId } = req.user;
    const { familyId, transactionId } = req.params;

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

    // ── Role check ────────────────────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId, session);

    // ── Fetch transaction ─────────────────────────────────────────────────
    const transaction = await Transaction.findOne({
      _id: transactionId,
      familyId,
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Transaction not found",
        messageStatus: "error",
      });
    }

    // Members can only update their own
    if (!isOwner && transaction.userId.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Members can only update their own transactions",
        messageStatus: "error",
      });
    }

    // ── Resolve new values with fallbacks ─────────────────────────────────
    const newTitle = title?.trim() || transaction.title;
    const newAmount =
      req.body.amount !== undefined
        ? round2(parseFloat(req.body.amount))
        : transaction.amount;
    const newType = type || transaction.type;
    const newCategory = category?.trim() || transaction.category;
    const newPaymentMethod = paymentMethod || transaction.paymentMethod;
    const receiptPath = req.file
      ? req.file.path.replace(/\\/g, "/")
      : transaction.receipt;
    const newTxDate = transactionDate
      ? new Date(transactionDate)
      : transaction.transactionDate;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!newTitle) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Title is required", messageStatus: "error" });
    }
    if (isNaN(newAmount) || newAmount <= 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Amount must be positive", messageStatus: "error" });
    }
    if (!["income", "expense"].includes(newType)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Type must be 'income' or 'expense'",
        messageStatus: "error",
      });
    }

    // ── Fetch family account ──────────────────────────────────────────────
    const familyAccount = await Account.findOne({ familyId }).session(session);
    if (!familyAccount) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Family account not found",
        messageStatus: "error",
      });
    }

    // ── REVERSE the old transaction's effect ─────────────────────────────
    if (transaction.type === "income") {
      // Refund the original contributor's personal account
      const oldPersonalAccount = await Account.findOne({
        userId: transaction.userId,
        familyId: null,
      }).session(session);

      if (oldPersonalAccount) {
        oldPersonalAccount.balance = round2(
          oldPersonalAccount.balance + transaction.amount,
        );
        oldPersonalAccount.expenses = round2(
          oldPersonalAccount.expenses - transaction.amount,
        );
        await oldPersonalAccount.save({ session });
      }

      familyAccount.balance = round2(
        familyAccount.balance - transaction.amount,
      );
      familyAccount.income = round2(familyAccount.income - transaction.amount);

      // Delete the old personal mirror transaction
      await Transaction.deleteOne({
        familyTransactionRef: transaction._id,
        userId: transaction.userId,
      }).session(session);
    } else {
      // Old expense: refund to family account
      familyAccount.balance = round2(
        familyAccount.balance + transaction.amount,
      );
      familyAccount.expenses = round2(
        familyAccount.expenses - transaction.amount,
      );

      // Reverse old budget entry
      const oldBudget = await Budget.findOne({
        familyId,
        category: transaction.category,
        isActive: true,
        visibility: "shared",
      }).session(session);
      if (oldBudget) {
        oldBudget.spentAmount = round2(
          oldBudget.spentAmount - transaction.amount,
        );
        await oldBudget.save({ session });
      }
    }

    // ── APPLY the new transaction's effect ────────────────────────────────
    if (newType === "income") {
      // Keep the original contributor — updating a transaction doesn't
      // transfer ownership; the original userId is preserved
      const newPersonalAccount = await Account.findOne({
        userId: transaction.userId,
        familyId: null,
      }).session(session);

      if (!newPersonalAccount) {
        await session.abortTransaction();
        return res.status(404).json({
          message: "Contributor's personal account not found",
          messageStatus: "error",
        });
      }

      if (newPersonalAccount.balance < newAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient personal balance. Available: ${round2(newPersonalAccount.balance)}`,
          messageStatus: "error",
        });
      }

      newPersonalAccount.balance = round2(
        newPersonalAccount.balance - newAmount,
      );
      newPersonalAccount.expenses = round2(
        newPersonalAccount.expenses + newAmount,
      );
      familyAccount.balance = round2(familyAccount.balance + newAmount);
      familyAccount.income = round2(familyAccount.income + newAmount);

      await newPersonalAccount.save({ session });

      // Write a fresh personal mirror transaction
      const newPersonalMirror = new Transaction({
        userId: transaction.userId,
        accountId: newPersonalAccount._id,
        familyId: null,
        familyTransactionRef: transaction._id,
        title: `Family contribution: ${newTitle}`,
        amount: newAmount,
        type: "expense",
        category: newCategory,
        paymentMethod: newPaymentMethod,
        transactionDate: newTxDate,
        description:
          description !== undefined ? description : transaction.description,
        note: note !== undefined ? note : transaction.note,
        receipt: receiptPath,
        tags: tags !== undefined ? parseTags(tags) : transaction.tags,
      });
      await newPersonalMirror.save({ session });
    } else {
      // New type is expense
      if (familyAccount.balance < newAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient family balance. Available: ${round2(familyAccount.balance)}`,
          messageStatus: "error",
        });
      }

      familyAccount.balance = round2(familyAccount.balance - newAmount);
      familyAccount.expenses = round2(familyAccount.expenses + newAmount);

      // Apply new budget entry
      const newBudget = await Budget.findOne({
        familyId,
        category: newCategory,
        isActive: true,
        visibility: "shared",
      }).session(session);
      if (newBudget) {
        newBudget.spentAmount = round2(newBudget.spentAmount + newAmount);
        await newBudget.save({ session });

        const spentPercentage =
          (newBudget.spentAmount / newBudget.budgetAmount) * 100;
        if (spentPercentage >= 100) {
          warningMessage = `Family has exceeded the ${newCategory} budget!`;
          warningStatus = "danger";
        } else if (spentPercentage >= newBudget.alertThreshold) {
          warningMessage = `Family has used ${spentPercentage.toFixed(0)}% of the ${newCategory} budget.`;
          warningStatus = "warning";
        }
      }
    }

    // ── Save family account and update the transaction document ───────────
    await familyAccount.save({ session });

    transaction.title = newTitle;
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.category = newCategory;
    transaction.paymentMethod = newPaymentMethod;
    transaction.transactionDate = newTxDate;
    transaction.description =
      description !== undefined ? description : transaction.description;
    transaction.note = note !== undefined ? note : transaction.note;
    transaction.receipt = receiptPath;
    transaction.tags = tags !== undefined ? parseTags(tags) : transaction.tags;

    await transaction.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: "Family transaction updated successfully",
      messageStatus: "success",
      warning: warningMessage,
      warningStatus,
      data: { transaction, familyAccount },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  } finally {
    session.endSession();
  }
};

// ═════════════════════════════════════════════
// DELETE a family transaction
// DELETE /api/families/:familyId/transactions/:transactionId
//
// Owner  → can delete any transaction in the family
// Member → can only delete their own
// ═════════════════════════════════════════════
const deleteFamilyTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: userId } = req.user;
    const { familyId, transactionId } = req.params;

    // ── Role check ────────────────────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId, session);

    // ── Fetch transaction ─────────────────────────────────────────────────
    const transaction = await Transaction.findOne({
      _id: transactionId,
      familyId,
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Transaction not found",
        messageStatus: "error",
      });
    }

    // Members can only delete their own
    if (!isOwner && transaction.userId.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Members can only delete their own transactions",
        messageStatus: "error",
      });
    }

    // ── Fetch family account ──────────────────────────────────────────────
    const familyAccount = await Account.findOne({ familyId }).session(session);
    if (!familyAccount) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Family account not found",
        messageStatus: "error",
      });
    }

    // ── Reverse the transaction's effect ──────────────────────────────────
    if (transaction.type === "income") {
      // Refund the contributor's personal account
      const personalAccount = await Account.findOne({
        userId: transaction.userId,
        familyId: null,
      }).session(session);

      if (personalAccount) {
        personalAccount.balance = round2(
          personalAccount.balance + transaction.amount,
        );
        personalAccount.expenses = round2(
          personalAccount.expenses - transaction.amount,
        );
        await personalAccount.save({ session });
      }

      familyAccount.balance = round2(
        familyAccount.balance - transaction.amount,
      );
      familyAccount.income = round2(familyAccount.income - transaction.amount);

      // Delete the personal mirror transaction created on income entry
      await Transaction.deleteOne({
        familyTransactionRef: transaction._id,
        userId: transaction.userId,
      }).session(session);
    } else {
      // Expense: refund back to family account
      familyAccount.balance = round2(
        familyAccount.balance + transaction.amount,
      );
      familyAccount.expenses = round2(
        familyAccount.expenses - transaction.amount,
      );

      // Reverse budget entry
      const budget = await Budget.findOne({
        familyId,
        category: transaction.category,
        isActive: true,
        visibility: "shared",
      }).session(session);
      if (budget) {
        budget.spentAmount = round2(budget.spentAmount - transaction.amount);
        await budget.save({ session });
      }
    }

    await familyAccount.save({ session });
    await Transaction.findByIdAndDelete(transactionId).session(session);

    await session.commitTransaction();

    res.status(200).json({
      message: "Family transaction deleted successfully",
      messageStatus: "success",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  } finally {
    session.endSession();
  }
};

// ═════════════════════════════════════════════
// GET family transaction summary
// GET /api/families/:familyId/transactions/summary
// Any member
// ═════════════════════════════════════════════
const getFamilyTransactionSummary = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    await resolveFamilyRole(familyId, userId, null);

    const result = await Transaction.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    result.forEach(({ _id, total, count }) => {
      if (_id === "income") {
        summary.income = round2(total);
        summary.incomeCount = count;
      } else if (_id === "expense") {
        summary.expense = round2(total);
        summary.expenseCount = count;
      }
    });
    summary.balance = round2(summary.income - summary.expense);

    res.status(200).json({
      message: "Family transaction summary fetched successfully",
      messageStatus: "success",
      data: summary,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// GET recent tags from family transactions
// GET /api/families/:familyId/transactions/tags/recent
// Any member
// ═════════════════════════════════════════════
const getFamilyResentTags = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    // Verify user is a family member
    await resolveFamilyRole(familyId, userId, null);

    // Get the last 30 family transactions
    const transactions = await Transaction.find({
      familyId: new mongoose.Types.ObjectId(familyId),
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
      message: "Recent family tags fetched successfully",
      messageStatus: "success",
      data: uniqueTags,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

module.exports = {
  createFamilyTransaction,
  getFamilyTransactions,
  getFamilyTransactionById,
  updateFamilyTransaction,
  deleteFamilyTransaction,
  getFamilyTransactionSummary,
  getFamilyResentTags,
};

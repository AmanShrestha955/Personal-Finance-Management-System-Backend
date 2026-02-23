const RecurringTransaction = require("../models/Recurringtransactionmodel");
const Account = require("../models/accountModels");

// ─────────────────────────────────────────────
// Helper: calculate the first nextRunDate from startDate
// ─────────────────────────────────────────────
function computeFirstNextRunDate(startDate, frequency) {
  const next = new Date(startDate);

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
      throw new Error("Invalid frequency");
  }

  return next;
}

// ─────────────────────────────────────────────
// CREATE recurring transaction
// POST /api/recurring-transactions
// ─────────────────────────────────────────────
const createRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.user;
    const {
      title,
      amount,
      type,
      category,
      paymentMethod,
      description,
      frequency,
      startDate,
      endDate,
    } = req.body;

    // --- Validation ---
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ message: "Amount must be positive" });
    if (!type || !["income", "expense"].includes(type))
      return res
        .status(400)
        .json({ message: "Type must be 'income' or 'expense'" });
    if (!category)
      return res.status(400).json({ message: "Category is required" });
    if (!paymentMethod)
      return res.status(400).json({ message: "PaymentMethod is required" });
    if (
      !frequency ||
      !["daily", "weekly", "monthly", "yearly"].includes(frequency)
    )
      return res
        .status(400)
        .json({
          message: "Frequency must be daily, weekly, monthly, or yearly",
        });
    if (!startDate)
      return res.status(400).json({ message: "Start date is required" });

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime()))
      return res.status(400).json({ message: "Invalid startDate format" });

    let parsedEnd = null;
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime()))
        return res.status(400).json({ message: "Invalid endDate format" });
      if (parsedEnd <= parsedStart)
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
    }

    // --- Find account ---
    const account = await Account.findOne({ userId: id });
    if (!account) return res.status(404).json({ message: "Account not found" });

    // --- Compute first nextRunDate ---
    const nextRunDate = computeFirstNextRunDate(parsedStart, frequency);

    const recurring = new RecurringTransaction({
      userId: id,
      accountId: account._id,
      title,
      amount: parseFloat(amount),
      type,
      category,
      paymentMethod,
      description,
      frequency,
      startDate: parsedStart,
      endDate: parsedEnd,
      nextRunDate,
      isActive: true,
    });

    await recurring.save();

    res.status(201).json({
      message: "Recurring transaction created successfully",
      data: recurring,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to create recurring transaction",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET ALL recurring transactions for the user
// GET /api/recurring-transactions
// ─────────────────────────────────────────────
const getRecurringTransactions = async (req, res) => {
  try {
    const { id } = req.user;

    const recurringTransactions = await RecurringTransaction.find({
      userId: id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Recurring transactions fetched successfully",
      data: recurringTransactions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to fetch recurring transactions",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET ONE recurring transaction by ID
// GET /api/recurring-transactions/:recurringId
// ─────────────────────────────────────────────
const getRecurringTransactionById = async (req, res) => {
  try {
    const { id } = req.user;
    const { recurringId } = req.params;

    const recurring = await RecurringTransaction.findOne({
      _id: recurringId,
      userId: id,
    });

    if (!recurring)
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });

    res.status(200).json({
      message: "Recurring transaction fetched successfully",
      data: recurring,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to fetch recurring transaction",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// UPDATE recurring transaction
// PUT /api/recurring-transactions/:recurringId
// ─────────────────────────────────────────────
const updateRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.user;
    const { recurringId } = req.params;
    const {
      title,
      amount,
      type,
      category,
      paymentMethod,
      description,
      frequency,
      startDate,
      endDate,
      isActive,
    } = req.body;

    const recurring = await RecurringTransaction.findOne({
      _id: recurringId,
      userId: id,
    });

    if (!recurring)
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });

    // --- Apply updates with fallbacks ---
    if (title) recurring.title = title;
    if (amount !== undefined && parseFloat(amount) > 0)
      recurring.amount = parseFloat(amount);
    if (type && ["income", "expense"].includes(type)) recurring.type = type;
    if (category) recurring.category = category;
    if (paymentMethod) recurring.paymentMethod = paymentMethod;
    if (description !== undefined) recurring.description = description;
    if (isActive !== undefined) recurring.isActive = isActive;

    // If frequency or startDate changes, recalculate nextRunDate
    const newFrequency = frequency || recurring.frequency;
    const newStartDate = startDate ? new Date(startDate) : recurring.startDate;

    if (frequency || startDate) {
      recurring.frequency = newFrequency;
      recurring.startDate = newStartDate;
      recurring.nextRunDate = computeFirstNextRunDate(
        newStartDate,
        newFrequency,
      );
    }

    if (endDate !== undefined) {
      recurring.endDate = endDate ? new Date(endDate) : null;
    }

    await recurring.save();

    res.status(200).json({
      message: "Recurring transaction updated successfully",
      data: recurring,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to update recurring transaction",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// DELETE recurring transaction
// DELETE /api/recurring-transactions/:recurringId
// ─────────────────────────────────────────────
const deleteRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.user;
    const { recurringId } = req.params;

    const recurring = await RecurringTransaction.findOneAndDelete({
      _id: recurringId,
      userId: id,
    });

    if (!recurring)
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });

    res
      .status(200)
      .json({ message: "Recurring transaction deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to delete recurring transaction",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// TOGGLE active/inactive (convenience endpoint)
// PATCH /api/recurring-transactions/:recurringId/toggle
// ─────────────────────────────────────────────
const toggleRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.user;
    const { recurringId } = req.params;

    const recurring = await RecurringTransaction.findOne({
      _id: recurringId,
      userId: id,
    });

    if (!recurring)
      return res
        .status(404)
        .json({ message: "Recurring transaction not found" });

    recurring.isActive = !recurring.isActive;
    await recurring.save();

    res.status(200).json({
      message: `Recurring transaction ${recurring.isActive ? "activated" : "paused"} successfully`,
      data: recurring,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to toggle recurring transaction",
      error: error.message,
    });
  }
};

module.exports = {
  createRecurringTransaction,
  getRecurringTransactions,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
};

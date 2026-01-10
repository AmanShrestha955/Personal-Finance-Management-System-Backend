const Budget = require("../models/budgetModels.js");
const Transaction = require("../models/transactionModels.js");

const createBudget = async (req, res) => {
  try {
    console.log("budget is created.");
    const { category, budgetAmount, alertThreshold } = req.body;
    const { id } = req.user;

    // Get the start and end of the current month
    const currentMonth = new Date();
    const startOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Calculate spent amount using aggregation
    const result = await Transaction.aggregate([
      {
        $match: {
          userId: id,
          category: category,
          type: "expense",
          transactionDate: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$amount" },
        },
      },
    ]);

    const spentAmount = result.length > 0 ? result[0].totalSpent : 0;

    const budget = new Budget({
      userId: id,
      category: category,
      budgetAmount: budgetAmount,
      alertThreshold: alertThreshold,
      spentAmount: spentAmount,
      month: startOfMonth,
    });

    const savedBudget = await budget.save();

    if (!savedBudget) {
      return res.status(500).json({ message: "Failed to create Budget." });
    }

    return res.status(201).json({
      message: "Budget created Successfully",
      data: savedBudget,
      calculatedSpent: spentAmount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Create Budget failed. error in createBudget function",
      error: error.message,
    });
  }
};

const getBudgetByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { id } = req.user;
    const budget = await Budget.findOne({ category: category, userId: id });
    if (!budget) {
      return res.status(404).json({
        message: "Budget not found",
      });
    }
    res.status(200).json({
      message: "Budget fetched successfully",
      data: budget,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Fetching Budget failed. error in getBudgetByCategory function",
      error: error.message,
    });
  }
};

const getBudgets = async (req, res) => {
  try {
    const { id } = req.user;
    const budgets = await Budget.find({ userId: id });
    if (!budgets) {
      return res.status(404).json({
        message: "Failed to get Budgets",
      });
    }
    res
      .status(200)
      .json({ message: "Budgets fetched successfully", data: budgets });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Fetching Budgets failed. error in getBudgets function",
      error: error.message,
    });
  }
};

const getBudgetById = async (req, res) => {
  try {
    const { id } = req.user;
    const { budgetId } = req.params;

    const budget = await Budget.findOne({ _id: budgetId, userId: id });

    if (!budget) {
      return res.status(404).json({
        message: "Budget not found or you're not authorized to view it",
      });
    }

    res.status(200).json({
      message: "Budget fetched successfully",
      data: budget,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Fetching Budget failed. error in getBudgetById function",
      error: error.message,
    });
  }
};

const updateBudget = async (req, res) => {
  try {
    const { id } = req.user;
    const { category, budgetAmount, alertThreshold } = req.body;
    const { budgetId } = req.params;
    const budget = await Budget.findById(budgetId);
    if (!budget) {
      return res.status(404).json({ message: "Budget not Found" });
    }

    if (budget.userId.toString() !== id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this budget" });
    }

    if (category !== undefined) budget.category = category;
    if (budgetAmount !== undefined) budget.budgetAmount = budgetAmount;
    if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;

    if (budget.budgetAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Budget amount must be positive" });
    }

    await budget.save();
    res.status(200).json({
      message: "Budget update successfully",
      data: budget,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Edit Budget failed. error in updateBudget function",
      error: error.message,
    });
  }
};

const deleteBudget = async (req, res) => {
  try {
    const { id } = req.user;
    const { budgetId } = req.params;

    const budget = await Budget.findOneAndDelete({
      _id: budgetId,
      userId: id,
    });

    if (!budget) {
      return res.status(404).json({
        message: "Budget not found or you're not authorized to delete it",
      });
    }

    res.status(200).json({
      message: "Budget deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Delete Budget failed. error in deleteBudget function",
      error: error.message,
    });
  }
};

module.exports = {
  createBudget,
  getBudgetByCategory,
  getBudgets,
  updateBudget,
  deleteBudget,
  getBudgetById,
};

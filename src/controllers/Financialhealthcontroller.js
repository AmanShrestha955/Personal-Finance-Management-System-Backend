const Transaction = require("../models/transactionModels.js");
const Budget = require("../models/budgetModels.js");
const mongoose = require("mongoose");

/**
 * Get Financial Health Metrics
 * GET /api/stats/financial-health
 * Returns: Savings Rate, Spending Control, Budget Adherence
 */
const getFinancialHealthMetrics = async (req, res) => {
  try {
    const { id } = req.user;

    // Get current month date range
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Get current month transactions
    const monthlyTransactions = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(id),
          transactionDate: {
            $gte: currentMonthStart,
            $lte: currentMonthEnd,
          },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Extract income and expenses
    const totalIncome =
      monthlyTransactions.find((item) => item._id === "income")?.total || 0;
    const totalExpenses =
      monthlyTransactions.find((item) => item._id === "expense")?.total || 0;

    // ============================================
    // 1. SAVINGS RATE
    // ============================================
    const netSavings = totalIncome - totalExpenses;
    const savingsRate =
      totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    // ============================================
    // 2. SPENDING CONTROL & 3. BUDGET ADHERENCE
    // ============================================
    // Get all active budgets for this user
    const budgets = await Budget.find({
      userId: id,
      isActive: true,
    });

    // Calculate total budget (sum of all category budgets)
    const totalBudget = budgets.reduce(
      (sum, budget) => sum + budget.budgetAmount,
      0,
    );

    // Calculate spending control
    // Formula: ((Budget - Spent) / Budget) × 100
    // If spent 80% of budget = 20% control remaining
    const spendingControl =
      totalBudget > 0
        ? Math.round(((totalBudget - totalExpenses) / totalBudget) * 100)
        : 0;

    // Calculate budget adherence (% of categories within budget)
    let categoriesWithinBudget = 0;
    const totalCategories = budgets.length;

    const categoryBreakdown = budgets.map((budget) => {
      const isWithinBudget = budget.spentAmount <= budget.budgetAmount;
      if (isWithinBudget) {
        categoriesWithinBudget++;
      }

      return {
        category: budget.category,
        budgetAmount: budget.budgetAmount,
        spentAmount: budget.spentAmount,
        remaining: budget.budgetAmount - budget.spentAmount,
        percentage:
          budget.budgetAmount > 0
            ? Math.round((budget.spentAmount / budget.budgetAmount) * 100)
            : 0,
        isWithinBudget: isWithinBudget,
        status:
          budget.spentAmount <= budget.budgetAmount * 0.8
            ? "good"
            : budget.spentAmount <= budget.budgetAmount
              ? "warning"
              : "exceeded",
      };
    });

    const budgetAdherence =
      totalCategories > 0
        ? Math.round((categoriesWithinBudget / totalCategories) * 100)
        : 0;

    // ============================================
    // 4. OVERALL FINANCIAL HEALTH SCORE
    // ============================================
    // Weighted average of all three metrics
    // You can adjust weights based on importance
    const weights = {
      savingsRate: 0.35, // 35% weight
      spendingControl: 0.35, // 35% weight
      budgetAdherence: 0.3, // 30% weight
    };

    // Normalize metrics to 0-100 scale
    // For spending control, handle negative values (over budget)
    const normalizedSpendingControl = Math.max(
      0,
      Math.min(100, spendingControl),
    );
    const normalizedSavingsRate = Math.max(0, Math.min(100, savingsRate));
    const normalizedBudgetAdherence = Math.max(
      0,
      Math.min(100, budgetAdherence),
    );

    // Calculate weighted score
    const overallScore = Math.round(
      normalizedSavingsRate * weights.savingsRate +
        normalizedSpendingControl * weights.spendingControl +
        normalizedBudgetAdherence * weights.budgetAdherence,
    );

    // Determine overall status
    const getOverallStatus = (score) => {
      if (score >= 80) return "Excellent";
      if (score >= 60) return "Good";
      if (score >= 40) return "Fair";
      return "Needs Improvement";
    };

    const overallStatus = getOverallStatus(overallScore);

    // ============================================
    // RESPONSE
    // ============================================
    res.status(200).json({
      success: true,
      message: "Financial health metrics fetched successfully",
      period: {
        month: now.toLocaleString("default", { month: "long" }),
        year: now.getFullYear(),
        startDate: currentMonthStart.toISOString().split("T")[0],
        endDate: currentMonthEnd.toISOString().split("T")[0],
      },
      // Overall Financial Health Score
      overallHealthScore: {
        score: overallScore,
        outOf: 100,
        status: overallStatus,
        description:
          "Overall financial health based on savings, spending control, and budget adherence",
      },
      // Individual Metrics
      metrics: {
        savingsRate: {
          value: savingsRate,
          label: "Savings Rate",
          description: "Percentage of income saved this month",
          weight: weights.savingsRate * 100 + "%",
          status:
            savingsRate >= 20
              ? "excellent"
              : savingsRate >= 10
                ? "good"
                : "needs improvement",
        },
        spendingControl: {
          value: spendingControl,
          label: "Spending Control",
          description: "Percentage of budget remaining",
          weight: weights.spendingControl * 100 + "%",
          status:
            spendingControl >= 20
              ? "excellent"
              : spendingControl >= 0
                ? "good"
                : "over budget",
        },
        budgetAdherence: {
          value: budgetAdherence,
          label: "Budget Adherence",
          description: "Percentage of categories within budget",
          weight: weights.budgetAdherence * 100 + "%",
          status:
            budgetAdherence >= 80
              ? "excellent"
              : budgetAdherence >= 60
                ? "good"
                : "needs improvement",
        },
      },
      summary: {
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        netSavings: netSavings,
        totalBudget: totalBudget,
        budgetRemaining: totalBudget - totalExpenses,
        categoriesWithinBudget: categoriesWithinBudget,
        totalCategories: totalCategories,
      },
      categoryBreakdown: categoryBreakdown,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch financial health metrics",
      error: error.message,
    });
  }
};

module.exports = {
  getFinancialHealthMetrics,
};

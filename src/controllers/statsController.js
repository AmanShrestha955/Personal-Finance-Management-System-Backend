const Transaction = require("../models/transactionModels.js");
const Account = require("../models/accountModels.js");
const SavingGoal = require("../models/savingGoalModels");
const Saving = require("../models/savingModel");
const mongoose = require("mongoose");
const { getDateRange } = require("../services/dateRange.js");
const {
  formatCurrency,
  formatPercentage,
} = require("../services/formatData.js");

// Global constants
const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper function to calculate date ranges
const calculateDateRange = (week, month, year) => {
  const now = new Date();
  let startDate;
  let period = "all time";
  let endDate = new Date(now); // Use a separate endDate

  if (week === "1") {
    // This week (from Sunday to Saturday)
    const dayOfWeek = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0); // Set to 00:00:00
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    period = "this week";
  } else if (month === "1") {
    // This month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0); // Set to 00:00:00
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    period = "this month";
  } else if (month === "3") {
    // Last 3 months
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 3);
    startDate.setHours(0, 0, 0, 0); // Set to 00:00:00
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    period = "last 3 months";
  } else if (month === "6") {
    // Last 6 months
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 6);
    startDate.setHours(0, 0, 0, 0); // Set to 00:00:00
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    period = "last 6 months";
  } else if (year === "1") {
    // This year
    startDate = new Date(now.getFullYear(), 0, 1);
    startDate.setHours(0, 0, 0, 0); // Set to 00:00:00
    endDate = new Date(now.getFullYear(), 11, 31);
    endDate.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    period = "this year";
  }
  return { startDate, period, now: endDate };
};

const getTop5Expenses = async (req, res) => {
  try {
    const { id } = req.user;
    const { week, month, year } = req.query;

    const { startDate, period, now } = calculateDateRange(week, month, year);

    // Build the match criteria
    const matchCriteria = {
      userId: new mongoose.Types.ObjectId(id),
      type: "expense",
    };

    // Add date filter if a time period is selected
    if (startDate) {
      matchCriteria.transactionDate = {
        $gte: startDate,
        $lte: now,
      };
    }

    // Aggregate transactions to get total expenses by category
    const top5Expenses = await Transaction.aggregate([
      {
        // Match only expense transactions for the current user within the date range
        $match: matchCriteria,
      },
      {
        // Group by category and sum the amounts
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
        },
      },
      {
        // Sort by amount in descending order
        $sort: { amount: -1 },
      },
      {
        // Limit to top 5 categories
        $limit: 5,
      },
      {
        // Project to match the desired output format
        $project: {
          _id: 0,
          category: "$_id",
          amount: 1,
        },
      },
    ]);

    console.log(`Top 5 Expenses for ${period}:`, top5Expenses);

    res.status(200).json({
      message: `Top 5 expenses for ${period} fetched successfully`,
      period: period,
      dateRange: startDate
        ? {
            from: startDate.toISOString().split("T")[0],
            to: now.toISOString().split("T")[0],
          }
        : null,
      data: top5Expenses,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching top 5 expenses failed. error in getTop5Expenses function",
      error: error.message,
    });
  }
};

const getAmountByTimePeriodAndType = async (req, res) => {
  try {
    const { id } = req.user;
    const { week, month, year, type } = req.query;

    const { startDate, period, now } = calculateDateRange(week, month, year);
    console.log("startDate: ", startDate, "now: ", now);

    let groupFormat = "%Y-%m"; // Default to month grouping

    if (week === "1") {
      // This week - group by day
      groupFormat = "%Y-%m-%d";
    } else if (month === "1") {
      // This month - group by week
      groupFormat = "%Y-%U"; // Week of year
    } else if (month === "3") {
      // Last 3 months - group by week
      groupFormat = "%Y-%U";
    } else if (month === "6") {
      // Last 6 months - group by month
      groupFormat = "%Y-%m";
    } else if (year === "1") {
      // This year - group by month
      groupFormat = "%Y-%m";
    }

    // Build match criteria
    const matchCriteria = {
      userId: new mongoose.Types.ObjectId(id),
      type: type,
    };

    if (startDate) {
      matchCriteria.transactionDate = {
        $gte: startDate,
        $lte: now,
      };
    }

    // Aggregate expenses by time period
    const expensesData = await Transaction.aggregate([
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: "$transactionDate",
            },
          },
          amount: { $sum: "$amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          amount: 1,
        },
      },
    ]);

    console.log("data: ", expensesData);

    // Format response based on period type
    let formattedData = [];

    if (period === "this week") {
      // Generate 7 days (Mon-Sun)
      const dataMap = new Map(
        expensesData.map((item) => [item.period, item.amount]),
      );

      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        formattedData.push({
          day: DAY_NAMES[i],
          amount: dataMap.get(dateStr) || 0,
        });
      }
    } else if (period === "this month") {
      // Generate weeks for current month
      const weeksInMonth = getWeeksInMonth(now);
      const dataMap = new Map(
        expensesData.map((item) => [item.period, item.amount]),
      );
      for (let i = 0; i < weeksInMonth.length; i++) {
        const weekKey = getWeekKey(weeksInMonth[i]);
        formattedData.push({
          week: `week${i + 1}`,
          amount: dataMap.get(weekKey) || 0,
        });
      }
    } else if (period === "last 3 months") {
      // Generate weeks for last 3 months
      const weeks = getWeeksInRange(startDate, now);
      const dataMap = new Map(
        expensesData.map((item) => [item.period, item.amount]),
      );

      weeks.forEach((weekDate, index) => {
        const weekKey = getWeekKey(weekDate);
        formattedData.push({
          week: `week${index + 1}`,
          amount: dataMap.get(weekKey) || 0,
        });
      });
    } else if (period === "last 6 months") {
      // Generate months
      const dataMap = new Map(
        expensesData.map((item) => [item.period, item.amount]),
      );

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yearMonth = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;
        formattedData.push({
          month: MONTH_NAMES[date.getMonth()],
          amount: dataMap.get(yearMonth) || 0,
        });
      }
    } else {
      // Year - generate all 12 months
      const dataMap = new Map(
        expensesData.map((item) => [item.period, item.amount]),
      );

      for (let i = 0; i < 12; i++) {
        const yearMonth = `${now.getFullYear()}-${String(i + 1).padStart(
          2,
          "0",
        )}`;
        formattedData.push({
          month: MONTH_NAMES[i],
          amount: dataMap.get(yearMonth) || 0,
        });
      }
    }

    console.log(`Expenses by time period for ${period}:`, formattedData);

    res.status(200).json({
      message: `Expenses for ${period} fetched successfully`,
      period: period,
      data: formattedData,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching expenses by time period failed. error in getExpensesByTimePeriod function",
      error: error.message,
    });
  }
};

// Helper function to get week number from date
const getWeekKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay()) / 7);
  return `${year}-${String(weekNum).padStart(2, "0")}`;
};

// Helper function to get weeks in a month
const getWeeksInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const weeks = [];
  let currentWeekStart = new Date(firstDay);
  currentWeekStart.setDate(firstDay.getDate() - firstDay.getDay());

  while (currentWeekStart <= lastDay) {
    weeks.push(new Date(currentWeekStart));
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
};

// Helper function to get all weeks in a date range
const getWeeksInRange = (startDate, endDate) => {
  const weeks = [];
  let currentDate = new Date(startDate);

  // Start from the beginning of the week
  const dayOfWeek = currentDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentDate.setDate(currentDate.getDate() - diff);

  while (currentDate <= endDate) {
    weeks.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

const getAccountSummary = async (req, res) => {
  try {
    const { id } = req.user;

    // Get current account data
    const account = await Account.findOne({ userId: id });

    if (!account) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

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
    );

    // Get previous month date range (for comparison)
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const previousMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    // Calculate current month totals from transactions
    const currentMonthData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(id),
          familyId: null,
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

    // Calculate previous month totals from transactions
    const previousMonthData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(id),
          transactionDate: {
            $gte: previousMonthStart,
            $lte: previousMonthEnd,
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

    // Extract current month values
    const currentIncome =
      currentMonthData.find((item) => item._id === "income")?.total || 0;
    const currentExpenses =
      currentMonthData.find((item) => item._id === "expense")?.total || 0;
    const currentBalance = currentIncome - currentExpenses;

    const currentIncomePercentage = currentIncome
      ? (currentIncome / account.income) * 100
      : 0;
    const currentExpensesPercentage = currentExpenses
      ? (currentExpenses / account.expenses) * 100
      : 0;

    // Extract previous month values
    const previousIncome =
      previousMonthData.find((item) => item._id === "income")?.total || 0;
    const previousExpenses =
      previousMonthData.find((item) => item._id === "expense")?.total || 0;
    const previousBalance = previousIncome - previousExpenses;

    // Calculate changes (this month vs previous month)
    const incomeChange = currentIncome - previousIncome;
    const incomeChangePercentage = calculatePercentageChange(
      currentIncome,
      previousIncome,
    );

    const expensesChange = currentExpenses - previousExpenses;
    const expensesChangePercentage = calculatePercentageChange(
      currentExpenses,
      previousExpenses,
    );

    const balanceChange = currentBalance - previousBalance;
    const balanceChangePercentage = calculatePercentageChange(
      currentBalance,
      previousBalance,
    );

    const summary = {
      totalBalance: account.balance,
      thisMonth: {
        income: currentIncome,
        expenses: currentExpenses,
        balance: currentBalance,
      },
      monthChanges: {
        income: {
          amount: incomeChange,
          percentage: parseFloat(incomeChangePercentage.toFixed(2)),
          trend: incomeChange > 0 ? "up" : incomeChange < 0 ? "down" : "stable",
        },
        expenses: {
          amount: expensesChange,
          percentage: parseFloat(expensesChangePercentage.toFixed(2)),
          trend:
            expensesChange > 0 ? "up" : expensesChange < 0 ? "down" : "stable",
        },
        balance: {
          amount: balanceChange,
          percentage: parseFloat(balanceChangePercentage.toFixed(2)),
          trend:
            balanceChange > 0 ? "up" : balanceChange < 0 ? "down" : "stable",
        },
      },
    };

    console.log("Account summary:", summary);

    res.status(200).json({
      message: "Account summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching account summary failed. error in getAccountSummary function",
      error: error.message,
    });
  }
};

const getMoneyHighlightsData = async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || "This Month";

    const { startDate, endDate, previousStartDate, previousEndDate } =
      getDateRange(period);

    // Get current period transactions
    const currentTransactions = await Transaction.find({
      userId,
      transactionDate: { $gte: startDate, $lte: endDate },
    }).sort({ transactionDate: -1 });

    // Get previous period transactions
    const previousTransactions = await Transaction.find({
      userId,
      transactionDate: { $gte: previousStartDate, $lte: previousEndDate },
    });

    // Calculate current period totals
    const totalIncome = currentTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = currentTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate previous period totals
    const previousIncome = previousTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const previousExpenses = previousTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate percentage changes
    const incomeChange =
      previousIncome > 0
        ? ((totalIncome - previousIncome) / previousIncome) * 100
        : totalIncome > 0
          ? 100
          : 0;

    const expenseChange =
      previousExpenses > 0
        ? ((totalExpenses - previousExpenses) / previousExpenses) * 100
        : totalExpenses > 0
          ? 100
          : 0;

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const totalSavingsResult = await Saving.aggregate([
      {
        $match: {
          userId: userObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
    ]);

    console.log("total Saving Result:", totalSavingsResult);

    // Calculate net savings (add - withdraw)
    const currentAdded =
      totalSavingsResult.find((s) => s._id === "add")?.total || 0;
    const currentWithdrawn =
      totalSavingsResult.find((s) => s._id === "withdraw")?.total || 0;
    const netSavings = currentAdded - currentWithdrawn;
    const savingsPercentage =
      totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    // Transaction count
    const transactionCount = currentTransactions.length;

    res.status(200).json({
      success: true,
      period,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      data: {
        totalIncome: {
          amount: totalIncome,
          formatted: formatCurrency(totalIncome),
          change: formatPercentage(incomeChange, true),
          label: "Total Income",
        },
        totalExpenses: {
          amount: totalExpenses,
          formatted: formatCurrency(totalExpenses),
          change: formatPercentage(expenseChange, false),
          label: "Total Expenses",
        },
        totalSavings: {
          amount: netSavings,
          formatted: formatCurrency(netSavings),
          change: formatPercentage(savingsPercentage, true),
          label: "Total Savings",
        },
        transactions: {
          count: transactionCount,
          period: period,
          label: "Transactions",
        },
      },
      comparison: {
        currentPeriod: {
          income: totalIncome,
          expenses: totalExpenses,
          savings: netSavings,
          net: totalIncome - totalExpenses,
        },
        previousPeriod: {
          income: previousIncome,
          expenses: previousExpenses,
          net: previousIncome - previousExpenses,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

const getIncomeExpenseComparison = async (req, res) => {
  try {
    const { id } = req.user;
    const { week, month, year } = req.query;

    const { startDate, period, now } = calculateDateRange(week, month, year);

    let groupFormat = "%Y-%m"; // Default to month grouping
    let periodType = "month";

    if (week === "1") {
      // This week - group by day
      groupFormat = "%Y-%m-%d";
      periodType = "day";
    } else if (month === "1") {
      // This month - group by week
      groupFormat = "%Y-%U";
      periodType = "week";
    } else if (month === "3") {
      // Last 3 months - group by week
      groupFormat = "%Y-%U";
      periodType = "week";
    } else if (month === "6") {
      // Last 6 months - group by month
      groupFormat = "%Y-%m";
      periodType = "month";
    } else if (year === "1") {
      // This year - group by month
      groupFormat = "%Y-%m";
      periodType = "month";
    }

    // Build match criteria
    const matchCriteria = {
      userId: new mongoose.Types.ObjectId(id),
    };

    if (startDate) {
      matchCriteria.transactionDate = {
        $gte: startDate,
        $lte: now,
      };
    }

    // Aggregate both income and expenses
    const transactionData = await Transaction.aggregate([
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format: groupFormat,
                date: "$transactionDate",
              },
            },
            type: "$type",
          },
          amount: { $sum: "$amount" },
        },
      },
      {
        $sort: { "_id.period": 1 },
      },
    ]);

    // Create a map for easy lookup
    const dataMap = new Map();
    transactionData.forEach((item) => {
      const key = item._id.period;
      if (!dataMap.has(key)) {
        dataMap.set(key, { income: 0, expenses: 0 });
      }
      if (item._id.type === "income") {
        dataMap.get(key).income = item.amount;
      } else if (item._id.type === "expense") {
        dataMap.get(key).expenses = item.amount;
      }
    });

    let formattedData = [];

    if (period === "this week") {
      // Generate 7 days (Mon-Sun)
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        const data = dataMap.get(dateStr) || { income: 0, expenses: 0 };
        formattedData.push({
          day: DAY_NAMES[(i + 1) % 7], // Adjust for Monday start
          expenses: data.expenses,
          income: data.income,
        });
      }
    } else if (period === "this month") {
      // Generate weeks for current month
      const weeksInMonth = getWeeksInMonth(now);

      for (let i = 0; i < weeksInMonth.length; i++) {
        const weekKey = getWeekKey(weeksInMonth[i]);
        const data = dataMap.get(weekKey) || { income: 0, expenses: 0 };
        formattedData.push({
          week: `week${i + 1}`,
          expenses: data.expenses,
          income: data.income,
        });
      }
    } else if (period === "last 3 months") {
      // Generate weeks for last 3 months
      const weeks = getWeeksInRange(startDate, now);

      weeks.forEach((weekDate, index) => {
        const weekKey = getWeekKey(weekDate);
        const data = dataMap.get(weekKey) || { income: 0, expenses: 0 };
        formattedData.push({
          week: `week${index + 1}`,
          expenses: data.expenses,
          income: data.income,
        });
      });
    } else if (period === "last 6 months") {
      // Generate 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yearMonth = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}`;
        const data = dataMap.get(yearMonth) || { income: 0, expenses: 0 };
        formattedData.push({
          month: MONTH_NAMES[date.getMonth()],
          expenses: data.expenses,
          income: data.income,
        });
      }
    } else {
      // This year - generate all 12 months
      for (let i = 0; i < 12; i++) {
        const yearMonth = `${now.getFullYear()}-${String(i + 1).padStart(
          2,
          "0",
        )}`;
        const data = dataMap.get(yearMonth) || { income: 0, expenses: 0 };
        formattedData.push({
          month: MONTH_NAMES[i],
          expenses: data.expenses,
          income: data.income,
        });
      }
    }

    console.log(`Income vs Expenses for ${period}:`, formattedData);

    res.status(200).json({
      message: `Income vs Expenses for ${period} fetched successfully`,
      period: period,
      periodType: periodType,
      dateRange: startDate
        ? {
            from: startDate.toISOString().split("T")[0],
            to: now.toISOString().split("T")[0],
          }
        : null,
      data: formattedData,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching income vs expenses comparison failed. error in getIncomeExpenseComparison function",
      error: error.message,
    });
  }
};

module.exports = {
  getTop5Expenses,
  getAmountByTimePeriodAndType,
  getAccountSummary,
  getMoneyHighlightsData,
  getIncomeExpenseComparison,
};

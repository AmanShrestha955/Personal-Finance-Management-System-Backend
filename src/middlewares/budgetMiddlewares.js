const Budget = require("../models/budgetModels.js");

const checkAndResetMonthlyBudgets = async (req, res, next) => {
  try {
    const { id } = req.user;
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    // Find budgets that haven't been reset this month
    const budgetsToReset = await Budget.find({
      userId: id,
      isActive: true,
      month: { $lt: currentMonth },
    });

    // Reset each budget
    for (const budget of budgetsToReset) {
      budget.spentAmount = 0;
      budget.month = currentMonth;
      await budget.save();
    }

    next();
  } catch (error) {
    console.log("Error in budget reset middleware:", error);
    next(); // Continue even if reset fails
  }
};

module.exports = { checkAndResetMonthlyBudgets };

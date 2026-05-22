const {
  getTop5Expenses,
  getAmountByTimePeriodAndType,
  getAccountSummary,
  getMoneyHighlightsData,
  getIncomeExpenseComparison,
  getFutureProjection,
} = require("../controllers/statsController.js");
const {
  getFinancialHealthMetrics,
} = require("../controllers/Financialhealthcontroller.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");

const statsRouter = Router();

statsRouter.get("/top5", authMiddleware, getTop5Expenses);
statsRouter.get(
  "/expenses-timeline",
  authMiddleware,
  getAmountByTimePeriodAndType,
);
statsRouter.get("/money-highlights", authMiddleware, getMoneyHighlightsData);
statsRouter.get("/account-summary", authMiddleware, getAccountSummary);
statsRouter.get(
  "/income-expense-comparison",
  authMiddleware,
  getIncomeExpenseComparison,
);
statsRouter.get("/financial-health", authMiddleware, getFinancialHealthMetrics);
statsRouter.get("/projection", authMiddleware, getFutureProjection);

module.exports = statsRouter;

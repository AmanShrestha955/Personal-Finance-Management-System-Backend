const {
  createBudget,
  getBudgetByCategory,
  getBudgets,
  updateBudget,
  deleteBudget,
  getBudgetById,
} = require("../controllers/budgetController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  checkAndResetMonthlyBudgets,
} = require("../middlewares/budgetMiddlewares.js");
const budgetRouter = Router();

budgetRouter.use(authMiddleware, checkAndResetMonthlyBudgets);

budgetRouter.post("/", authMiddleware, createBudget);
budgetRouter.get("/", authMiddleware, getBudgets);
budgetRouter.get("/category/:category", authMiddleware, getBudgetByCategory);
budgetRouter.put("/:budgetId", authMiddleware, updateBudget);
budgetRouter.delete("/:budgetId", authMiddleware, deleteBudget);
budgetRouter.get("/:budgetId", authMiddleware, getBudgetById);
module.exports = budgetRouter;

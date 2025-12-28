const {
  createBudget,
  getBudgetByCategory,
  getBudgets,
  updateBudget,
  deleteBudget,
} = require("../controllers/budgetController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const budgetRouter = Router();

budgetRouter.post("/", authMiddleware, createBudget);
budgetRouter.get("/", authMiddleware, getBudgets);
budgetRouter.get("/category/:category", authMiddleware, getBudgetByCategory);
budgetRouter.put("/:budgetId", authMiddleware, updateBudget);
budgetRouter.delete("/:budgetId", authMiddleware, deleteBudget);
module.exports = budgetRouter;

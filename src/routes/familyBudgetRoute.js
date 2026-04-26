const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  createFamilyBudget,
  getFamilyBudgets,
  getFamilyBudgetById,
  getFamilyBudgetByCategory,
  updateFamilyBudget,
  deleteFamilyBudget,
  getFamilyBudgetSummary,
} = require("../controllers/familyBudgetController.js");
// ═════════════════════════════════════════════
// BUDGETS
// Base: /api/families/:familyId/budgets
// ═════════════════════════════════════════════

// POST   /api/families/:familyId/budgets                          → create (owner only)
// GET    /api/families/:familyId/budgets                          → get all (any member)
// GET    /api/families/:familyId/budgets/summary                  → budget summary (any member)
// GET    /api/families/:familyId/budgets/category/:category       → get by category (any member)
// GET    /api/families/:familyId/budgets/:budgetId                → get by id (any member)
// PUT    /api/families/:familyId/budgets/:budgetId                → update (owner only)
// DELETE /api/families/:familyId/budgets/:budgetId                → delete (owner only)

router.post("/:familyId/budgets", authMiddleware, createFamilyBudget);
router.get("/:familyId/budgets", authMiddleware, getFamilyBudgets);
router.get(
  "/:familyId/budgets/summary",
  authMiddleware,
  getFamilyBudgetSummary,
); // ← before :budgetId
router.get(
  "/:familyId/budgets/category/:category",
  authMiddleware,
  getFamilyBudgetByCategory,
); // ← before :budgetId
router.get("/:familyId/budgets/:budgetId", authMiddleware, getFamilyBudgetById);
router.put("/:familyId/budgets/:budgetId", authMiddleware, updateFamilyBudget);
router.delete(
  "/:familyId/budgets/:budgetId",
  authMiddleware,
  deleteFamilyBudget,
);

module.exports = router;

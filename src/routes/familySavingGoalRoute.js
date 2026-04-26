const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  createFamilySavingGoal,
  getFamilySavingGoals,
  getFamilySavingGoalById,
  getFamilySavingGoalByCategory,
  updateFamilySavingGoal,
  updateFamilySavingProgress,
  deleteFamilySavingGoal,
  getFamilySavingGoalStats,
} = require("../controllers/familySavingGoalController.js");

// ═════════════════════════════════════════════
// SAVING GOALS
// Base: /api/families/:familyId/saving-goals
// ═════════════════════════════════════════════

// POST   /api/families/:familyId/saving-goals                           → create (owner only)
// GET    /api/families/:familyId/saving-goals                           → get all (any member)
// GET    /api/families/:familyId/saving-goals/stats                     → stats summary (any member)
// GET    /api/families/:familyId/saving-goals/category/:category        → get by category (any member)
// GET    /api/families/:familyId/saving-goals/:goalId                   → get by id (any member)
// PUT    /api/families/:familyId/saving-goals/:goalId                   → update goal details (owner only)
// PATCH  /api/families/:familyId/saving-goals/:goalId/progress          → contribute / withdraw (any member)
// DELETE /api/families/:familyId/saving-goals/:goalId                   → delete (owner only)

router.post("/:familyId/saving-goals", authMiddleware, createFamilySavingGoal);
router.get("/:familyId/saving-goals", authMiddleware, getFamilySavingGoals);
router.get(
  "/:familyId/saving-goals/stats",
  authMiddleware,
  getFamilySavingGoalStats,
); // ← before :goalId
router.get(
  "/:familyId/saving-goals/category/:category",
  authMiddleware,
  getFamilySavingGoalByCategory,
); // ← before :goalId
router.get(
  "/:familyId/saving-goals/:goalId",
  authMiddleware,
  getFamilySavingGoalById,
);
router.put(
  "/:familyId/saving-goals/:goalId",
  authMiddleware,
  updateFamilySavingGoal,
);
router.patch(
  "/:familyId/saving-goals/:goalId/progress",
  authMiddleware,
  updateFamilySavingProgress,
);
router.delete(
  "/:familyId/saving-goals/:goalId",
  authMiddleware,
  deleteFamilySavingGoal,
);

module.exports = router;

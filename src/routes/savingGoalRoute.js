const {
  createSavingGoal,
  getSavingGoals,
  getSavingGoalById,
  getSavingGoalByCategory,
  updateSavingGoal,
  updateSavingProgress,
  deleteSavingGoal,
  getSavingGoalStats,
} = require("../controllers/savingGoalController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const savingGoalRouter = Router();

savingGoalRouter.post("/", authMiddleware, createSavingGoal);
savingGoalRouter.get("/", authMiddleware, getSavingGoals);
savingGoalRouter.get("/stats", authMiddleware, getSavingGoalStats);
savingGoalRouter.get(
  "/category/:category",
  authMiddleware,
  getSavingGoalByCategory,
);
savingGoalRouter.get("/:goalId", authMiddleware, getSavingGoalById);
savingGoalRouter.put("/:goalId", authMiddleware, updateSavingGoal);
savingGoalRouter.put("/:goalId/progress", authMiddleware, updateSavingProgress);
savingGoalRouter.delete("/:goalId", authMiddleware, deleteSavingGoal);

module.exports = savingGoalRouter;

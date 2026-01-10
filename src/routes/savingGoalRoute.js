const {
  createSavingGoal,
  getSavingGoals,
  getSavingGoalById,
  getSavingGoalByCategory,
  updateSavingGoal,
  updateSavingProgress,
  deleteSavingGoal,
} = require("../controllers/savingGoalController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const savingGoalRouter = Router();

console.log("Saving Goal Route has been loaded");

savingGoalRouter.post("/", authMiddleware, createSavingGoal);
savingGoalRouter.get("/", authMiddleware, getSavingGoals);
savingGoalRouter.get(
  "/category/:category",
  authMiddleware,
  getSavingGoalByCategory
);
savingGoalRouter.get("/:goalId", authMiddleware, getSavingGoalById);
savingGoalRouter.put("/:goalId", authMiddleware, updateSavingGoal);
savingGoalRouter.patch(
  "/:goalId/progress",
  authMiddleware,
  updateSavingProgress
);
savingGoalRouter.delete("/:goalId", authMiddleware, deleteSavingGoal);

module.exports = savingGoalRouter;

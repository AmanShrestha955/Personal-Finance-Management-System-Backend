const SavingGoal = require("../models/savingGoalModels.js");
const Account = require("../models/accountModels.js");
const mongoose = require("mongoose");

console.log("Saving Goal Controller has been loaded...");

const createSavingGoal = async (req, res) => {
  try {
    console.log("Saving goal is being created.");
    const { goalName, targetAmount, currentSaving, deadline, category } =
      req.body;
    const { id } = req.user;

    const savingGoal = new SavingGoal({
      userId: id,
      goalName: goalName,
      targetAmount: targetAmount,
      currentSaving: currentSaving || 0,
      deadline: deadline,
      category: category,
      isCompleted: currentSaving >= targetAmount ? true : false,
    });

    const savedGoal = await savingGoal.save();

    if (!savedGoal) {
      return res.status(500).json({ message: "Failed to create Saving Goal." });
    }

    return res.status(201).json({
      message: "Saving Goal created successfully",
      data: savedGoal,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Create Saving Goal failed. Error in createSavingGoal function",
      error: error.message,
    });
  }
};

const getSavingGoals = async (req, res) => {
  try {
    const { id } = req.user;
    const savingGoals = await SavingGoal.find({ userId: id });

    if (!savingGoals) {
      return res.status(404).json({
        message: "Failed to get Saving Goals",
      });
    }

    res.status(200).json({
      message: "Saving Goals fetched successfully",
      data: savingGoals,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Fetching Saving Goals failed. Error in getSavingGoals function",
      error: error.message,
    });
  }
};

const getSavingGoalById = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { id } = req.user;

    const savingGoal = await SavingGoal.findOne({ _id: goalId, userId: id });

    if (!savingGoal) {
      return res.status(404).json({
        message: "Saving Goal not found",
      });
    }

    res.status(200).json({
      message: "Saving Goal fetched successfully",
      data: savingGoal,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching Saving Goal failed. Error in getSavingGoalById function",
      error: error.message,
    });
  }
};

const getSavingGoalByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { id } = req.user;

    const savingGoal = await SavingGoal.findOne({
      category: category,
      userId: id,
    });

    if (!savingGoal) {
      return res.status(404).json({
        message: "Saving Goal not found",
      });
    }

    res.status(200).json({
      message: "Saving Goal fetched successfully",
      data: savingGoal,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching Saving Goal failed. Error in getSavingGoalByCategory function",
      error: error.message,
    });
  }
};

const updateSavingGoal = async (req, res) => {
  try {
    const { id } = req.user;
    const {
      goalName,
      targetAmount,
      currentSaving,
      deadline,
      category,
      isCompleted,
    } = req.body;
    const { goalId } = req.params;

    const savingGoal = await SavingGoal.findById(goalId);

    if (!savingGoal) {
      return res.status(404).json({ message: "Saving Goal not found" });
    }

    if (savingGoal.userId.toString() !== id) {
      return res.status(403).json({
        message: "You are not authorized to update this saving goal",
      });
    }

    if (goalName !== undefined) savingGoal.goalName = goalName;
    if (targetAmount !== undefined) savingGoal.targetAmount = targetAmount;
    if (currentSaving !== undefined) savingGoal.currentSaving = currentSaving;
    if (deadline !== undefined) savingGoal.deadline = deadline;
    if (category !== undefined) savingGoal.category = category;
    if (isCompleted !== undefined) savingGoal.isCompleted = isCompleted;

    if (savingGoal.targetAmount <= 0) {
      return res.status(400).json({
        message: "Target amount must be positive",
      });
    }

    if (savingGoal.currentSaving < 0) {
      return res.status(400).json({
        message: "Current saving cannot be negative",
      });
    }

    await savingGoal.save();

    res.status(200).json({
      message: "Saving Goal updated successfully",
      data: savingGoal,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Update Saving Goal failed. Error in updateSavingGoal function",
      error: error.message,
    });
  }
};

const updateSavingProgress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.user;
    const { amount } = req.body;
    const { goalId } = req.params;
    console.log("Updating saving progress with amount:", amount);

    if (amount === undefined || amount === null) {
      session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    const balance = await Account.findOne({ userId: id }).session(session);

    if (!balance || balance.balance < amount) {
      session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Insufficient account balance",
      });
    }

    const savingGoal = await SavingGoal.findById(goalId).session(session);

    if (!savingGoal) {
      session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Saving Goal not found" });
    }

    if (savingGoal.userId.toString() !== id) {
      session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "You are not authorized to update this saving goal",
      });
    }

    savingGoal.currentSaving += amount;
    balance.balance -= amount;

    if (savingGoal.currentSaving < 0) {
      session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Current saving cannot be negative",
      });
    }

    // Check if goal is completed
    if (savingGoal.currentSaving >= savingGoal.targetAmount) {
      savingGoal.isCompleted = true;
    }

    await savingGoal.save({ session });
    await balance.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Saving progress updated successfully",
      data: savingGoal,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Update progress failed. Error in updateSavingProgress function",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const deleteSavingGoal = async (req, res) => {
  try {
    const { id } = req.user;
    const { goalId } = req.params;

    const savingGoal = await SavingGoal.findOneAndDelete({
      _id: goalId,
      userId: id,
    });

    if (!savingGoal) {
      return res.status(404).json({
        message: "Saving Goal not found or you're not authorized to delete it",
      });
    }

    res.status(200).json({
      message: "Saving Goal deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Delete Saving Goal failed. Error in deleteSavingGoal function",
      error: error.message,
    });
  }
};

const getSavingGoalStats = async (req, res) => {
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
    );

    // Get previous month date range
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

    // Current month stats
    const currentGoals = await SavingGoal.find({
      userId: id,
      createdAt: { $lte: currentMonthEnd },
    });

    const totalSaved = currentGoals.reduce(
      (sum, goal) => sum + goal.currentSaving,
      0,
    );
    const totalGoals = currentGoals.length;
    const completedGoals = currentGoals.filter(
      (goal) => goal.isCompleted,
    ).length;

    // Previous month stats
    const previousGoals = await SavingGoal.find({
      userId: id,
      createdAt: { $lte: previousMonthEnd },
    });

    const previousTotalSaved = previousGoals.reduce(
      (sum, goal) => sum + goal.currentSaving,
      0,
    );
    const previousCompletedGoals = previousGoals.filter(
      (goal) => goal.isCompleted,
    ).length;

    // Calculate percentage changes
    const totalSavedChange =
      previousTotalSaved !== 0
        ? (
            ((totalSaved - previousTotalSaved) / previousTotalSaved) *
            100
          ).toFixed(1)
        : 0;

    const totalSavedDifference = totalSaved - previousTotalSaved;

    // Get account balance
    const account = await Account.findOne({ userId: id });
    const remainingBalance = account ? account.balance : 0;

    // For remaining balance percentage, we need to compare with previous month's balance
    // You might want to store historical balance data, but for now we'll calculate based on difference
    const remainingBalanceChange =
      previousTotalSaved !== 0
        ? (
            ((remainingBalance -
              (account ? account.balance - totalSavedDifference : 0)) /
              previousTotalSaved) *
            100
          ).toFixed(1)
        : 0;

    const remainingBalanceDifference = totalSavedDifference; // Simplified calculation

    res.status(200).json({
      message: "Saving goal statistics fetched successfully",
      data: {
        totalSaved: {
          amount: totalSaved,
          percentageChange: parseFloat(totalSavedChange),
          difference: totalSavedDifference,
        },
        totalGoals: {
          count: totalGoals,
        },
        completedGoals: {
          count: completedGoals,
        },
        remainingBalance: {
          amount: remainingBalance,
          percentageChange: parseFloat(remainingBalanceChange),
          difference: remainingBalanceDifference,
        },
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Fetching statistics failed. Error in getSavingGoalStats function",
      error: error.message,
    });
  }
};

module.exports = {
  createSavingGoal,
  getSavingGoals,
  getSavingGoalById,
  getSavingGoalByCategory,
  updateSavingGoal,
  updateSavingProgress,
  deleteSavingGoal,
  getSavingGoalStats,
};

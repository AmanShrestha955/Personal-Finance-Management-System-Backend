const SavingGoal = require("../models/savingGoalModels.js");
const Account = require("../models/accountModels.js");
const Saving = require("../models/savingModel.js");
const mongoose = require("mongoose");

console.log("Saving Goal Controller has been loaded...");

const createSavingGoal = async (req, res) => {
  try {
    console.log("Saving goal is being created.");
    const { goalName, targetAmount, currentSaving, deadline, category } =
      req.body;
    const { id } = req.user;

    // Check active (incomplete) goals count
    const activeGoalsCount = await SavingGoal.countDocuments({
      userId: id,
      isCompleted: false,
    });

    if (activeGoalsCount >= 3) {
      return res.status(400).json({
        message:
          "Maximum active goals limit reached. You can only have 3 active saving goals at a time. Please complete or remove an existing goal before creating a new one.",
      });
    }

    const savingGoal = new SavingGoal({
      userId: id,
      goalName: goalName,
      targetAmount: targetAmount,
      currentSaving: currentSaving || 0,
      deadline: deadline,
      category: category,
      isCompleted: currentSaving >= targetAmount,
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

    // Add pace projection to each goal
    const goalsWithProjection = await Promise.all(
      savingGoals.map(async (goal) => {
        const goalObj = goal.toObject();

        // Skip completed goals
        if (goal.isCompleted) {
          goalObj.projection = { status: "completed" };
          return goalObj;
        }

        // Get all 'add' saving transactions for this goal grouped by month
        const monthlySavings = await Saving.aggregate([
          {
            $match: {
              savingGoalId: goal._id,
              transactionType: "add",
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              totalAdded: { $sum: "$amount" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]);

        // Need at least 1 month of data
        if (monthlySavings.length === 0) {
          goalObj.projection = { status: "insufficient_data" };
          return goalObj;
        }

        // Calculate average monthly saving rate
        const totalAdded = monthlySavings.reduce(
          (sum, m) => sum + m.totalAdded,
          0,
        );
        const avgMonthlyRate = totalAdded / monthlySavings.length;

        if (avgMonthlyRate <= 0) {
          goalObj.projection = { status: "insufficient_data" };
          return goalObj;
        }

        // Calculate months needed to reach the goal
        const remaining = goal.targetAmount - goal.currentSaving;
        const monthsNeeded = Math.ceil(remaining / avgMonthlyRate);

        // Calculate projected date
        const projectedDate = new Date();
        projectedDate.setMonth(projectedDate.getMonth() + monthsNeeded);

        const projectedDateLabel = projectedDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        goalObj.projection = {
          status: "on_track",
          avgMonthlyRate: Math.round(avgMonthlyRate),
          monthsNeeded,
          projectedDate: projectedDate.toISOString(),
          projectedDateLabel, // e.g. "March 2026"
          message: `At this pace, you'll reach your goal by ${projectedDateLabel}`,
        };

        return goalObj;
      }),
    );

    res.status(200).json({
      message: "Saving Goals fetched successfully",
      data: goalsWithProjection,
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
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    if (amount === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Amount cannot be zero",
      });
    }

    const savingGoal = await SavingGoal.findById(goalId).session(session);

    if (!savingGoal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Saving Goal not found" });
    }

    if (savingGoal.userId.toString() !== id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "You are not authorized to update this saving goal",
      });
    }

    const balance = await Account.findOne({ userId: id }).session(session);

    // Determine transaction type
    let transactionType;

    if (amount > 0) {
      // Adding to savings
      transactionType = "add";

      if (!balance || balance.balance < amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Insufficient account balance",
        });
      }

      savingGoal.currentSaving += amount;
      balance.balance -= amount;
    } else {
      // Withdrawing from savings (negative amount)
      transactionType = "withdraw";
      const withdrawAmount = Math.abs(amount);

      if (savingGoal.currentSaving < withdrawAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Insufficient saving balance",
        });
      }

      savingGoal.currentSaving -= withdrawAmount;
      balance.balance += withdrawAmount;
    }

    if (savingGoal.currentSaving < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Current saving cannot be negative",
      });
    }

    // Check if goal is completed
    if (savingGoal.currentSaving >= savingGoal.targetAmount) {
      savingGoal.isCompleted = true;
    } else {
      savingGoal.isCompleted = false;
    }

    // Create transaction record
    const savingTransaction = new Saving({
      userId: id,
      savingGoalId: goalId,
      amount: Math.abs(amount),
      transactionType: transactionType,
      balanceAfter: savingGoal.currentSaving,
    });

    await savingGoal.save({ session });
    await balance.save({ session });
    await savingTransaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: "Saving progress updated successfully",
      data: {
        savingGoal: savingGoal,
        transaction: savingTransaction,
      },
    });
  } catch (error) {
    await session.abortTransaction();
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.user;
    const { goalId } = req.params;

    const savingGoal = await SavingGoal.findOne({
      _id: goalId,
      userId: id,
    }).session(session);

    if (!savingGoal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Saving Goal not found or you're not authorized to delete it",
      });
    }

    // Only refund if NOT completed and has saved amount
    if (!savingGoal.isCompleted && savingGoal.currentSaving > 0) {
      const account = await Account.findOne({ userId: id }).session(session);

      if (!account) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: "Account not found. Cannot refund saving balance.",
        });
      }

      account.balance += savingGoal.currentSaving;
      await account.save({ session });
    }

    await SavingGoal.findOneAndDelete({ _id: goalId, userId: id }).session(
      session,
    );

    await session.commitTransaction();

    res.status(200).json({
      message:
        !savingGoal.isCompleted && savingGoal.currentSaving > 0
          ? `Saving Goal deleted. Rs ${savingGoal.currentSaving} has been refunded to your account.`
          : "Saving Goal deleted successfully.",
      refundedAmount: !savingGoal.isCompleted ? savingGoal.currentSaving : 0,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    res.status(500).json({
      message: "Delete Saving Goal failed. Error in deleteSavingGoal function",
      error: error.message,
    });
  } finally {
    session.endSession();
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

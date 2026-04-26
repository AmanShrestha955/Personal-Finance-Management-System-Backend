// ─────────────────────────────────────────────────────────────────────────────
// familySavingGoalController.js
//
// IMPORTANT – Schema changes required before using this controller:
//
//  1. savingGoalModels.js — remove `required: true` from userId:
//       userId: { type: Schema.Types.ObjectId, ref: "User", default: null }
//
//  2. savingModel.js (the Saving transaction log) — add a familyId field so
//     family saving transactions are queryable:
//       familyId: { type: Schema.Types.ObjectId, ref: "Family", default: null }
//
// Role semantics:
//   owner  → create / update goal details / delete family goals
//   member → read all goals + contribute/withdraw their own funds (updateSavingProgress)
//   owner  → can also contribute/withdraw
//
// Progress flow:
//   ADD      → deducted from the contributor's personal Account balance
//              → added to the family SavingGoal's currentSaving
//   WITHDRAW → deducted from the family SavingGoal's currentSaving
//              → refunded to the requesting user's personal Account balance
//
// Active goal limit: 5 per family (vs 3 for personal)
// ─────────────────────────────────────────────────────────────────────────────

const SavingGoal = require("../models/savingGoalModels.js");
const Account = require("../models/accountModels.js");
const Saving = require("../models/savingModel.js");
const { Family, FAMILY_ROLE } = require("../models/familyModels.js");
const mongoose = require("mongoose");

const FAMILY_ACTIVE_GOAL_LIMIT = 5;

// ─────────────────────────────────────────────
// Helper – resolve the caller's role inside a family.
// Returns { family, memberEntry, isOwner } or throws.
// ─────────────────────────────────────────────
const resolveFamilyRole = async (familyId, userId) => {
  const family = await Family.findOne({ _id: familyId, isActive: true });

  if (!family) {
    const err = new Error("Family not found or inactive");
    err.statusCode = 404;
    throw err;
  }

  const memberEntry = family.members.find(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!memberEntry) {
    const err = new Error("You are not a member of this family");
    err.statusCode = 403;
    throw err;
  }

  return {
    family,
    memberEntry,
    isOwner: memberEntry.role === FAMILY_ROLE.OWNER,
  };
};

// ─────────────────────────────────────────────
// Helper – round to 2 decimal places
// ─────────────────────────────────────────────
const round2 = (n) => Math.round(n * 100) / 100;

// ═════════════════════════════════════════════
// CREATE a family saving goal
// POST /api/families/:familyId/saving-goals
// Owner only
// ═════════════════════════════════════════════
const createFamilySavingGoal = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;
    const {
      goalName,
      targetAmount,
      deadline,
      category,
      reminderEnabled,
      reminderDay,
    } = req.body;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      return res.status(403).json({
        message: "Only the family owner can create saving goals",
        messageStatus: "error",
      });
    }

    // ── Input validation ──────────────────────────────────────────────────
    if (!goalName?.trim()) {
      return res
        .status(400)
        .json({ message: "Goal name is required", messageStatus: "error" });
    }
    if (!targetAmount || isNaN(targetAmount) || Number(targetAmount) <= 0) {
      return res.status(400).json({
        message: "Target amount must be a positive number",
        messageStatus: "error",
      });
    }
    if (!deadline) {
      return res
        .status(400)
        .json({ message: "Deadline is required", messageStatus: "error" });
    }
    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({
        message: "Deadline must be a future date",
        messageStatus: "error",
      });
    }
    if (!category?.trim()) {
      return res
        .status(400)
        .json({ message: "Category is required", messageStatus: "error" });
    }

    // ── Active goal limit ─────────────────────────────────────────────────
    const activeCount = await SavingGoal.countDocuments({
      familyId,
      isCompleted: false,
    });

    if (activeCount >= FAMILY_ACTIVE_GOAL_LIMIT) {
      return res.status(400).json({
        message: `Maximum active goal limit reached. A family can have at most ${FAMILY_ACTIVE_GOAL_LIMIT} active saving goals at a time.`,
        messageStatus: "error",
      });
    }

    // ── Create goal ───────────────────────────────────────────────────────
    const savingGoal = new SavingGoal({
      userId, // owner who created it — audit trail
      familyId,
      goalName: goalName.trim(),
      targetAmount: Number(targetAmount),
      currentSaving: 0, // always starts at 0; contributions go through updateSavingProgress
      deadline: new Date(deadline),
      category: category.trim(),
      isCompleted: false,
      visibility: "shared",
      reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,
      reminderDay: reminderDay || "monday",
    });

    const savedGoal = await savingGoal.save();

    return res.status(201).json({
      message: "Family saving goal created successfully",
      messageStatus: "success",
      data: savedGoal,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// GET all saving goals for a family
// GET /api/families/:familyId/saving-goals
// Any member
// ═════════════════════════════════════════════
const getFamilySavingGoals = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const savingGoals = await SavingGoal.find({ familyId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      message: "Family saving goals fetched successfully",
      messageStatus: "success",
      data: savingGoals,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// GET a family saving goal by ID
// GET /api/families/:familyId/saving-goals/:goalId
// Any member
// ═════════════════════════════════════════════
const getFamilySavingGoalById = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, goalId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const savingGoal = await SavingGoal.findOne({ _id: goalId, familyId });

    if (!savingGoal) {
      return res.status(404).json({
        message: "Saving goal not found",
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family saving goal fetched successfully",
      messageStatus: "success",
      data: savingGoal,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// GET a family saving goal by category
// GET /api/families/:familyId/saving-goals/category/:category
// Any member
// ═════════════════════════════════════════════
const getFamilySavingGoalByCategory = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, category } = req.params;

    await resolveFamilyRole(familyId, userId);

    const savingGoal = await SavingGoal.findOne({ familyId, category });

    if (!savingGoal) {
      return res.status(404).json({
        message: `No saving goal found for category "${category}" in this family`,
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family saving goal fetched successfully",
      messageStatus: "success",
      data: savingGoal,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// UPDATE family saving goal details
// PUT /api/families/:familyId/saving-goals/:goalId
// Owner only — for editing goal metadata (name, target, deadline, etc.)
// To add/withdraw funds use updateFamilySavingProgress instead
// ═════════════════════════════════════════════
const updateFamilySavingGoal = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, goalId } = req.params;
    const {
      goalName,
      targetAmount,
      deadline,
      category,
      isCompleted,
      reminderEnabled,
      reminderDay,
    } = req.body;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      return res.status(403).json({
        message: "Only the family owner can update saving goal details",
        messageStatus: "error",
      });
    }

    const savingGoal = await SavingGoal.findOne({ _id: goalId, familyId });

    if (!savingGoal) {
      return res.status(404).json({
        message: "Saving goal not found",
        messageStatus: "error",
      });
    }

    // Apply updates
    if (goalName !== undefined) savingGoal.goalName = goalName.trim();
    if (targetAmount !== undefined)
      savingGoal.targetAmount = Number(targetAmount);
    if (deadline !== undefined) savingGoal.deadline = new Date(deadline);
    if (category !== undefined) savingGoal.category = category.trim();
    if (isCompleted !== undefined) savingGoal.isCompleted = isCompleted;
    if (reminderEnabled !== undefined)
      savingGoal.reminderEnabled = reminderEnabled;
    if (reminderDay !== undefined) savingGoal.reminderDay = reminderDay;

    // Validate after applying
    if (savingGoal.targetAmount <= 0) {
      return res.status(400).json({
        message: "Target amount must be positive",
        messageStatus: "error",
      });
    }
    if (savingGoal.currentSaving < 0) {
      return res.status(400).json({
        message: "Current saving cannot be negative",
        messageStatus: "error",
      });
    }

    // Auto-resolve completion state if target changed
    if (targetAmount !== undefined) {
      savingGoal.isCompleted =
        savingGoal.currentSaving >= savingGoal.targetAmount;
    }

    await savingGoal.save();

    res.status(200).json({
      message: "Family saving goal updated successfully",
      messageStatus: "success",
      data: savingGoal,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

// ═════════════════════════════════════════════
// UPDATE saving progress (contribute or withdraw)
// PATCH /api/families/:familyId/saving-goals/:goalId/progress
// Any member (owner or member)
//
// amount > 0 → ADD:      deducted from contributor's personal account
// amount < 0 → WITHDRAW: refunded to requesting user's personal account
// ═════════════════════════════════════════════
const updateFamilySavingProgress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: userId } = req.user;
    const { familyId, goalId } = req.params;
    const { amount } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (amount === undefined || amount === null) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Amount is required",
        messageStatus: "error",
      });
    }

    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Amount must be a non-zero number",
        messageStatus: "error",
      });
    }

    // ── Role check — any member can contribute / withdraw ─────────────────
    await resolveFamilyRole(familyId, userId);

    // ── Fetch goal ────────────────────────────────────────────────────────
    const savingGoal = await SavingGoal.findOne({
      _id: goalId,
      familyId,
    }).session(session);

    if (!savingGoal) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Saving goal not found",
        messageStatus: "error",
      });
    }

    if (savingGoal.isCompleted) {
      await session.abortTransaction();
      return res.status(400).json({
        message:
          "This goal is already completed. No further contributions are needed.",
        messageStatus: "error",
      });
    }

    // ── Fetch contributor's personal account ──────────────────────────────
    const personalAccount = await Account.findOne({
      userId,
      familyId: null,
    }).session(session);

    if (!personalAccount) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Your personal account was not found",
        messageStatus: "error",
      });
    }

    let transactionType;

    if (parsedAmount > 0) {
      // ── ADD: deduct from personal account, add to goal ──────────────────
      transactionType = "add";

      if (personalAccount.balance < parsedAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient personal balance. You have ${round2(personalAccount.balance)} available.`,
          messageStatus: "error",
        });
      }

      personalAccount.balance = round2(personalAccount.balance - parsedAmount);
      savingGoal.currentSaving = round2(
        savingGoal.currentSaving + parsedAmount,
      );
    } else {
      // ── WITHDRAW: deduct from goal, refund to personal account ──────────
      transactionType = "withdraw";
      const withdrawAmount = Math.abs(parsedAmount);

      if (savingGoal.currentSaving < withdrawAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient saving balance. Goal currently has ${round2(savingGoal.currentSaving)}.`,
          messageStatus: "error",
        });
      }

      savingGoal.currentSaving = round2(
        savingGoal.currentSaving - withdrawAmount,
      );
      personalAccount.balance = round2(
        personalAccount.balance + withdrawAmount,
      );
    }

    // ── Guard against negative saving (safety net) ────────────────────────
    if (savingGoal.currentSaving < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Current saving cannot be negative",
        messageStatus: "error",
      });
    }

    // ── Auto-complete check ───────────────────────────────────────────────
    savingGoal.isCompleted =
      savingGoal.currentSaving >= savingGoal.targetAmount;

    // ── Log the saving transaction ────────────────────────────────────────
    // NOTE: Add `familyId` field to savingModel.js for this to persist correctly.
    // savingModel.js: familyId: { type: Schema.Types.ObjectId, ref: "Family", default: null }
    const savingTransaction = new Saving({
      userId, // the member who made the move
      savingGoalId: goalId,
      familyId, // marks it as a family saving tx
      amount: Math.abs(parsedAmount),
      transactionType,
      balanceAfter: savingGoal.currentSaving,
    });

    await savingGoal.save({ session });
    await personalAccount.save({ session });
    await savingTransaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: `Saving progress ${transactionType === "add" ? "contribution" : "withdrawal"} recorded successfully`,
      messageStatus: "success",
      data: {
        savingGoal,
        transaction: savingTransaction,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  } finally {
    session.endSession();
  }
};

// ═════════════════════════════════════════════
// DELETE a family saving goal
// DELETE /api/families/:familyId/saving-goals/:goalId
// Owner only
//
// If the goal has currentSaving > 0, the accumulated amount is refunded
// back to the owner's personal account before deletion.
// ═════════════════════════════════════════════
const deleteFamilySavingGoal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: userId } = req.user;
    const { familyId, goalId } = req.params;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Only the family owner can delete saving goals",
        messageStatus: "error",
      });
    }

    const savingGoal = await SavingGoal.findOne({
      _id: goalId,
      familyId,
    }).session(session);

    if (!savingGoal) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Saving goal not found",
        messageStatus: "error",
      });
    }

    // ── Refund accumulated savings to owner's personal account ────────────
    if (savingGoal.currentSaving > 0) {
      const ownerAccount = await Account.findOne({
        userId,
        familyId: null,
      }).session(session);

      if (ownerAccount) {
        ownerAccount.balance = round2(
          ownerAccount.balance + savingGoal.currentSaving,
        );
        await ownerAccount.save({ session });
      }
    }

    await SavingGoal.findByIdAndDelete(goalId).session(session);
    await session.commitTransaction();

    res.status(200).json({
      message: "Family saving goal deleted successfully",
      messageStatus: "success",
      ...(savingGoal.currentSaving > 0 && {
        note: `${round2(savingGoal.currentSaving)} has been refunded to the owner's personal account.`,
      }),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  } finally {
    session.endSession();
  }
};

// ═════════════════════════════════════════════
// GET family saving goal stats
// GET /api/families/:familyId/saving-goals/stats
// Any member
// ═════════════════════════════════════════════
const getFamilySavingGoalStats = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const allGoals = await SavingGoal.find({ familyId });

    const totalGoals = allGoals.length;
    const completedGoals = allGoals.filter((g) => g.isCompleted).length;
    const activeGoals = totalGoals - completedGoals;

    const totalSaved = round2(
      allGoals.reduce((sum, g) => sum + g.currentSaving, 0),
    );
    const totalTarget = round2(
      allGoals.reduce((sum, g) => sum + g.targetAmount, 0),
    );
    const overallProgress =
      totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

    // Per-goal breakdown with progress percentage
    const goalBreakdown = allGoals.map((g) => ({
      _id: g._id,
      goalName: g.goalName,
      category: g.category,
      targetAmount: g.targetAmount,
      currentSaving: g.currentSaving,
      remaining: round2(Math.max(0, g.targetAmount - g.currentSaving)),
      progressPercentage:
        g.targetAmount > 0
          ? Math.min(100, Math.round((g.currentSaving / g.targetAmount) * 100))
          : 0,
      isCompleted: g.isCompleted,
      deadline: g.deadline,
    }));

    res.status(200).json({
      message: "Family saving goal stats fetched successfully",
      messageStatus: "success",
      data: {
        totalGoals,
        activeGoals,
        completedGoals,
        totalSaved,
        totalTarget,
        overallProgress,
        goalBreakdown,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      messageStatus: "error",
    });
  }
};

module.exports = {
  createFamilySavingGoal,
  getFamilySavingGoals,
  getFamilySavingGoalById,
  getFamilySavingGoalByCategory,
  updateFamilySavingGoal,
  updateFamilySavingProgress,
  deleteFamilySavingGoal,
  getFamilySavingGoalStats,
};

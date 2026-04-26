// ─────────────────────────────────────────────────────────────────────────────
// familyBudgetController.js
//
// IMPORTANT – One schema change required before using this controller:
//
//   In budgetModels.js, remove `required: true` from userId so family budgets
//   (which have no single owner userId) can be stored:
//
//     userId: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       default: null,   // null for family budgets
//     },
//
// Role semantics:
//   owner  → create / update / delete family budgets
//   member → read only (get all, get by id, get by category)
//
// spentAmount on creation:
//   Back-calculated from existing family expense transactions in the current
//   month for that category — exactly the same approach as the personal
//   budgetController.
// ─────────────────────────────────────────────────────────────────────────────

const Budget = require("../models/budgetModels.js");
const Transaction = require("../models/transactionModels.js");
const { Family, FAMILY_ROLE } = require("../models/familyModels.js");
const mongoose = require("mongoose");

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

  const isOwner = memberEntry.role === FAMILY_ROLE.OWNER;
  return { family, memberEntry, isOwner };
};

// ─────────────────────────────────────────────
// Helper – get start and end of the current month
// ─────────────────────────────────────────────
const getCurrentMonthRange = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { startOfMonth, endOfMonth };
};

// ═════════════════════════════════════════════
// CREATE a family budget
// POST /api/families/:familyId/budgets
// Owner only
// ═════════════════════════════════════════════
const createFamilyBudget = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;
    const { category, budgetAmount, alertThreshold } = req.body;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      return res.status(403).json({
        message: "Only the family owner can create budgets",
        messageStatus: "error",
      });
    }

    // ── Input validation ──────────────────────────────────────────────────
    if (!category?.trim()) {
      return res
        .status(400)
        .json({ message: "Category is required", messageStatus: "error" });
    }
    if (!budgetAmount || isNaN(budgetAmount) || Number(budgetAmount) <= 0) {
      return res.status(400).json({
        message: "Budget amount must be a positive number",
        messageStatus: "error",
      });
    }

    // ── Prevent duplicate budget for same category in this family ─────────
    const existingBudget = await Budget.findOne({
      familyId,
      category: category.trim(),
      isActive: true,
    });
    if (existingBudget) {
      return res.status(400).json({
        message:
          "A budget for this category already exists in this family. Please update it instead.",
        messageStatus: "error",
      });
    }

    // ── Back-calculate spentAmount from existing transactions ─────────────
    const { startOfMonth, endOfMonth } = getCurrentMonthRange();

    const result = await Transaction.aggregate([
      {
        $match: {
          familyId: new mongoose.Types.ObjectId(familyId),
          category: category.trim(),
          type: "expense",
          transactionDate: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$amount" },
        },
      },
    ]);

    const spentAmount = result.length > 0 ? result[0].totalSpent : 0;

    // ── Create budget ─────────────────────────────────────────────────────
    const budget = new Budget({
      userId, // owner who created it — useful for audit
      familyId,
      category: category.trim(),
      budgetAmount: Number(budgetAmount),
      alertThreshold:
        alertThreshold !== undefined ? Number(alertThreshold) : 80,
      spentAmount,
      month: startOfMonth,
      visibility: "shared",
    });

    const savedBudget = await budget.save();

    return res.status(201).json({
      message: "Family budget created successfully",
      messageStatus: "success",
      data: savedBudget,
      calculatedSpent: spentAmount,
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
// GET all budgets for a family
// GET /api/families/:familyId/budgets
// Any member
// ═════════════════════════════════════════════
const getFamilyBudgets = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const budgets = await Budget.find({ familyId, isActive: true }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      message: "Family budgets fetched successfully",
      messageStatus: "success",
      data: budgets,
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
// GET a family budget by ID
// GET /api/families/:familyId/budgets/:budgetId
// Any member
// ═════════════════════════════════════════════
const getFamilyBudgetById = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, budgetId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const budget = await Budget.findOne({ _id: budgetId, familyId });

    if (!budget) {
      return res.status(404).json({
        message: "Budget not found",
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family budget fetched successfully",
      messageStatus: "success",
      data: budget,
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
// GET a family budget by category
// GET /api/families/:familyId/budgets/category/:category
// Any member
// ═════════════════════════════════════════════
const getFamilyBudgetByCategory = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, category } = req.params;

    await resolveFamilyRole(familyId, userId);

    const budget = await Budget.findOne({
      familyId,
      category,
      isActive: true,
    });

    if (!budget) {
      return res.status(404).json({
        message: `No active budget found for category "${category}" in this family`,
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family budget fetched successfully",
      messageStatus: "success",
      data: budget,
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
// UPDATE a family budget
// PUT /api/families/:familyId/budgets/:budgetId
// Owner only
// ═════════════════════════════════════════════
const updateFamilyBudget = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, budgetId } = req.params;
    const { category, budgetAmount, alertThreshold, isActive } = req.body;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      return res.status(403).json({
        message: "Only the family owner can update budgets",
        messageStatus: "error",
      });
    }

    const budget = await Budget.findOne({ _id: budgetId, familyId });
    if (!budget) {
      return res.status(404).json({
        message: "Budget not found",
        messageStatus: "error",
      });
    }

    // ── If category is changing, check for duplicates ─────────────────────
    if (category !== undefined && category.trim() !== budget.category) {
      const duplicate = await Budget.findOne({
        familyId,
        category: category.trim(),
        isActive: true,
        _id: { $ne: budgetId }, // exclude the current budget
      });
      if (duplicate) {
        return res.status(400).json({
          message: `A budget for category "${category}" already exists in this family`,
          messageStatus: "error",
        });
      }
      budget.category = category.trim();
    }

    if (budgetAmount !== undefined) {
      const parsed = Number(budgetAmount);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({
          message: "Budget amount must be a positive number",
          messageStatus: "error",
        });
      }
      budget.budgetAmount = parsed;
    }

    if (alertThreshold !== undefined)
      budget.alertThreshold = Number(alertThreshold);
    if (isActive !== undefined) budget.isActive = Boolean(isActive);

    await budget.save();

    res.status(200).json({
      message: "Family budget updated successfully",
      messageStatus: "success",
      data: budget,
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
// DELETE a family budget
// DELETE /api/families/:familyId/budgets/:budgetId
// Owner only
// ═════════════════════════════════════════════
const deleteFamilyBudget = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId, budgetId } = req.params;

    // ── Role check — owner only ───────────────────────────────────────────
    const { isOwner } = await resolveFamilyRole(familyId, userId);
    if (!isOwner) {
      return res.status(403).json({
        message: "Only the family owner can delete budgets",
        messageStatus: "error",
      });
    }

    const budget = await Budget.findOneAndDelete({ _id: budgetId, familyId });

    if (!budget) {
      return res.status(404).json({
        message: "Budget not found",
        messageStatus: "error",
      });
    }

    res.status(200).json({
      message: "Family budget deleted successfully",
      messageStatus: "success",
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
// GET family budget summary (spent vs budgeted per category)
// GET /api/families/:familyId/budgets/summary
// Any member
// ═════════════════════════════════════════════
const getFamilyBudgetSummary = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;

    await resolveFamilyRole(familyId, userId);

    const budgets = await Budget.find({ familyId, isActive: true });

    if (!budgets.length) {
      return res.status(200).json({
        message: "No active family budgets found",
        messageStatus: "success",
        data: [],
      });
    }

    // Enrich each budget with percentage and status
    const summary = budgets.map((b) => {
      const spentPercentage =
        b.budgetAmount > 0
          ? Math.round((b.spentAmount / b.budgetAmount) * 100)
          : 0;

      let status = "on-track";
      if (spentPercentage >= 100) status = "exceeded";
      else if (spentPercentage >= b.alertThreshold) status = "warning";

      return {
        _id: b._id,
        category: b.category,
        budgetAmount: b.budgetAmount,
        spentAmount: b.spentAmount,
        remainingAmount: Math.max(0, b.budgetAmount - b.spentAmount),
        spentPercentage,
        alertThreshold: b.alertThreshold,
        status,
        month: b.month,
      };
    });

    res.status(200).json({
      message: "Family budget summary fetched successfully",
      messageStatus: "success",
      data: summary,
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
  createFamilyBudget,
  getFamilyBudgets,
  getFamilyBudgetById,
  getFamilyBudgetByCategory,
  updateFamilyBudget,
  deleteFamilyBudget,
  getFamilyBudgetSummary,
};

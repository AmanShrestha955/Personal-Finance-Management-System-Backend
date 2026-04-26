// ─────────────────────────────────────────────────────────────────────────────
// familyStatsController.js
//
// Two endpoints, scoped to a family (familyId from params):
//   1. getFamilyTop5Expenses     — top 5 expense categories by total amount
//   2. getFamilyAmountByTimePeriodAndType — time-series breakdown by type
//
// Both endpoints:
//   • Require the caller to be a member of the family
//   • Accept the same time-period query params as the personal statsController:
//       ?week=1          → this week  (grouped by day)
//       ?month=1         → this month (grouped by week)
//       ?month=3         → last 3 months (grouped by week)
//       ?month=6         → last 6 months (grouped by month)
//       ?year=1          → this year  (grouped by month)
//       (none)           → all time   (grouped by month)
// ─────────────────────────────────────────────────────────────────────────────

const Transaction = require("../models/transactionModels.js");
const { Family, FAMILY_ROLE } = require("../models/familyModels.js");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────
// Shared constants (mirrored from personal statsController)
// ─────────────────────────────────────────────
const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─────────────────────────────────────────────
// Helper – resolve the caller's role inside a family.
// Throws with a statusCode if not a member.
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
// Helper – calculate date range from query params
// Identical logic to personal statsController
// ─────────────────────────────────────────────
const calculateDateRange = (week, month, year) => {
  const now = new Date();
  let startDate;
  let period = "all time";

  if (week === "1") {
    const dayOfWeek = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    period = "this week";
  } else if (month === "1") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    period = "this month";
  } else if (month === "3") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 3);
    period = "last 3 months";
  } else if (month === "6") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 6);
    period = "last 6 months";
  } else if (year === "1") {
    startDate = new Date(now.getFullYear(), 0, 1);
    period = "this year";
  }

  return { startDate, period, now };
};

// ─────────────────────────────────────────────
// Helper – week key matching MongoDB's %Y-%U format
// ─────────────────────────────────────────────
const getWeekKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay()) / 7);
  return `${year}-${String(weekNum).padStart(2, "0")}`;
};

// ─────────────────────────────────────────────
// Helper – weeks that fall within a given month
// ─────────────────────────────────────────────
const getWeeksInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const weeks = [];
  let currentWeekStart = new Date(firstDay);
  currentWeekStart.setDate(firstDay.getDate() - firstDay.getDay());

  while (currentWeekStart <= lastDay) {
    weeks.push(new Date(currentWeekStart));
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
};

// ─────────────────────────────────────────────
// Helper – all week-start dates in a date range
// ─────────────────────────────────────────────
const getWeeksInRange = (startDate, endDate) => {
  const weeks = [];
  let currentDate = new Date(startDate);

  const dayOfWeek = currentDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentDate.setDate(currentDate.getDate() - diff);

  while (currentDate <= endDate) {
    weeks.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
};

// ═════════════════════════════════════════════
// GET top 5 expense categories for a family
// GET /api/families/:familyId/stats/top-expenses
// Any member
//
// Query params: ?week=1 | ?month=1|3|6 | ?year=1
// ═════════════════════════════════════════════
const getFamilyTop5Expenses = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;
    const { week, month, year } = req.query;

    // ── Role check ────────────────────────────────────────────────────────
    await resolveFamilyRole(familyId, userId);

    const { startDate, period, now } = calculateDateRange(week, month, year);

    // ── Build match criteria ──────────────────────────────────────────────
    const matchCriteria = {
      familyId: new mongoose.Types.ObjectId(familyId),
      type: "expense",
    };

    if (startDate) {
      matchCriteria.transactionDate = { $gte: startDate, $lte: now };
    }

    // ── Aggregate top 5 expense categories ───────────────────────────────
    const top5Expenses = await Transaction.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          category: "$_id",
          amount: 1,
          transactionCount: 1,
        },
      },
    ]);

    res.status(200).json({
      message: `Family top 5 expenses for ${period} fetched successfully`,
      messageStatus: "success",
      period,
      dateRange: startDate
        ? {
            from: startDate.toISOString().split("T")[0],
            to: now.toISOString().split("T")[0],
          }
        : null,
      data: top5Expenses,
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
// GET amount by time period and type for a family
// GET /api/families/:familyId/stats/amount-by-period
// Any member
//
// Query params:
//   type=income|expense  (required)
//   week=1 | month=1|3|6 | year=1  (optional, defaults to all time)
// ═════════════════════════════════════════════
const getFamilyAmountByTimePeriodAndType = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { familyId } = req.params;
    const { week, month, year, type } = req.query;

    // ── Role check ────────────────────────────────────────────────────────
    await resolveFamilyRole(familyId, userId);

    // ── Type validation ───────────────────────────────────────────────────
    if (!type || !["income", "expense"].includes(type)) {
      return res.status(400).json({
        message:
          "Query param 'type' is required and must be 'income' or 'expense'",
        messageStatus: "error",
      });
    }

    const { startDate, period, now } = calculateDateRange(week, month, year);

    // ── Determine MongoDB grouping format ─────────────────────────────────
    let groupFormat = "%Y-%m"; // default: group by month

    if (week === "1") {
      groupFormat = "%Y-%m-%d"; // this week → group by day
    } else if (month === "1" || month === "3") {
      groupFormat = "%Y-%U"; // this month / last 3 months → group by week
    } else if (month === "6" || year === "1") {
      groupFormat = "%Y-%m"; // last 6 months / this year → group by month
    }

    // ── Build match criteria ──────────────────────────────────────────────
    const matchCriteria = {
      familyId: new mongoose.Types.ObjectId(familyId),
      type,
    };

    if (startDate) {
      matchCriteria.transactionDate = { $gte: startDate, $lte: now };
    }

    // ── Aggregate ─────────────────────────────────────────────────────────
    const rawData = await Transaction.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: "$transactionDate" },
          },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: "$_id",
          amount: 1,
        },
      },
    ]);

    // ── Format response to fill all slots (zeros for missing periods) ─────
    let formattedData = [];
    const dataMap = new Map(rawData.map((item) => [item.period, item.amount]));

    if (period === "this week") {
      // 7 slots — one per day starting from Sunday
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        formattedData.push({
          day: DAY_NAMES[date.getDay()],
          amount: dataMap.get(dateStr) || 0,
        });
      }
    } else if (period === "this month") {
      // One slot per week in the current month
      const weeksInMonth = getWeeksInMonth(now);
      weeksInMonth.forEach((weekDate, index) => {
        formattedData.push({
          week: `week${index + 1}`,
          amount: dataMap.get(getWeekKey(weekDate)) || 0,
        });
      });
    } else if (period === "last 3 months") {
      // One slot per week across the last 3 months
      const weeks = getWeeksInRange(startDate, now);
      weeks.forEach((weekDate, index) => {
        formattedData.push({
          week: `week${index + 1}`,
          amount: dataMap.get(getWeekKey(weekDate)) || 0,
        });
      });
    } else if (period === "last 6 months") {
      // One slot per month for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        formattedData.push({
          month: MONTH_NAMES[date.getMonth()],
          amount: dataMap.get(yearMonth) || 0,
        });
      }
    } else if (period === "this year") {
      // 12 slots — one per month
      for (let i = 0; i < 12; i++) {
        const yearMonth = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
        formattedData.push({
          month: MONTH_NAMES[i],
          amount: dataMap.get(yearMonth) || 0,
        });
      }
    } else {
      // All time — return raw aggregated months as-is (no zero-filling needed)
      formattedData = rawData.map((item) => ({
        month: item.period,
        amount: item.amount,
      }));
    }

    res.status(200).json({
      message: `Family ${type} data for ${period} fetched successfully`,
      messageStatus: "success",
      period,
      type,
      dateRange: startDate
        ? {
            from: startDate.toISOString().split("T")[0],
            to: now.toISOString().split("T")[0],
          }
        : null,
      data: formattedData,
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
  getFamilyTop5Expenses,
  getFamilyAmountByTimePeriodAndType,
};

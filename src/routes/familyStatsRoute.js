const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  getFamilyTop5Expenses,
  getFamilyAmountByTimePeriodAndType,
} = require("../controllers/familyStatsController.js");
// ═════════════════════════════════════════════
// STATS
// Base: /api/families/:familyId/stats
// ═════════════════════════════════════════════

// GET /api/families/:familyId/stats/top-expenses
//   Query: ?week=1 | ?month=1|3|6 | ?year=1
//   → Top 5 expense categories by total amount (any member)

// GET /api/families/:familyId/stats/amount-by-period
//   Query: ?type=income|expense  &  ?week=1 | ?month=1|3|6 | ?year=1
//   → Time-series breakdown by type (any member)

router.get(
  "/:familyId/stats/top-expenses",
  authMiddleware,
  getFamilyTop5Expenses,
);
router.get(
  "/:familyId/stats/amount-by-period",
  authMiddleware,
  getFamilyAmountByTimePeriodAndType,
);
module.exports = router;

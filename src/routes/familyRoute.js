const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares"); // your JWT auth middleware
const {
  createFamily,
  inviteMember,
  acceptInvite,
  declineInvite,
  getMyFamily,
  removeMember,
  cancelInvite,
} = require("../controllers/FamilyController");
const familyTransactionRouter = require("./familyTransactionRoute");
const familyBudgetRouter = require("./familyBudgetRoute");
const familySavingsRouter = require("./familySavingGoalRoute");
const familyStatsRouter = require("./familyStatsRoute");

// Nested routes for family stats
router.use("/", familyStatsRouter);

router.use("/", familySavingsRouter); // Nested routes for family savings

// Nested routes for family budgets
router.use("/", familyBudgetRouter);

// Nested routes for family transactions
router.use("/", familyTransactionRouter);

// Family CRUD
router.post("/", authMiddleware, createFamily);
router.get("/me", authMiddleware, getMyFamily);

// Invite flow
router.post("/:familyId/invite", authMiddleware, inviteMember);
router.get("/invite/accept", authMiddleware, acceptInvite); // ?token=...
router.get("/invite/decline", authMiddleware, declineInvite); // ?token=...

// Member management
router.delete("/:familyId/members/:memberId", authMiddleware, removeMember);
router.delete("/:familyId/invites/:inviteId", authMiddleware, cancelInvite);

module.exports = router;

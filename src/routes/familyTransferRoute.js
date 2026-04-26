const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares");
const {
  createTransfer,
  confirmTransfer,
  cancelTransfer,
  getFamilyTransfers,
  getMyTransfers,
} = require("../controllers/familyTransferController");

// Create a transfer
router.post("/", authMiddleware, createTransfer);

// Get all transfers for a family
router.get("/family/:familyId", authMiddleware, getFamilyTransfers);

// Get transfers for the logged-in user within a family
router.get("/my/:familyId", authMiddleware, getMyTransfers);

// Confirm / cancel a transfer
router.patch("/:transferId/confirm", authMiddleware, confirmTransfer);
router.patch("/:transferId/cancel", authMiddleware, cancelTransfer);

module.exports = router;

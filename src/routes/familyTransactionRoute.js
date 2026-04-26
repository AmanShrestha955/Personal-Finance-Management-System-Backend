const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  createFamilyTransaction,
  getFamilyTransactions,
  getFamilyTransactionById,
  updateFamilyTransaction,
  deleteFamilyTransaction,
  getFamilyTransactionSummary,
} = require("../controllers/familyTransactionController.js");

const {
  uploadSingleReceipt,
  handleUploadError,
} = require("../middlewares/upload.middleware.js");

// ═════════════════════════════════════════════
// TRANSACTIONS
// Base: /api/families/:familyId/transactions
// ═════════════════════════════════════════════

// POST   /api/families/:familyId/transactions              → create (any member)
// GET    /api/families/:familyId/transactions              → get all (any member)
// GET    /api/families/:familyId/transactions/summary      → income/expense summary (any member)
// GET    /api/families/:familyId/transactions/:transactionId → get by id (any member)
// PUT    /api/families/:familyId/transactions/:transactionId → update (owner: any | member: own only)
// DELETE /api/families/:familyId/transactions/:transactionId → delete (owner: any | member: own only)

router.post(
  "/:familyId/transactions",
  authMiddleware,
  uploadSingleReceipt,
  handleUploadError,
  createFamilyTransaction,
);
router.get("/:familyId/transactions", authMiddleware, getFamilyTransactions);
router.get(
  "/:familyId/transactions/summary",
  authMiddleware,
  getFamilyTransactionSummary,
); // ← before :transactionId
router.get(
  "/:familyId/transactions/:transactionId",
  authMiddleware,
  getFamilyTransactionById,
);
router.put(
  "/:familyId/transactions/:transactionId",
  authMiddleware,
  uploadSingleReceipt,
  handleUploadError,
  updateFamilyTransaction,
);
router.delete(
  "/:familyId/transactions/:transactionId",
  authMiddleware,
  deleteFamilyTransaction,
);

module.exports = router;

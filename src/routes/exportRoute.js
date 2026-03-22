const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddlewares.js");
const { exportCSV, exportPDF } = require("../controllers/exportController");

// GET /export/csv?year=2025
router.get("/csv", authMiddleware, exportCSV);

// GET /export/pdf?year=2025
router.get("/pdf", authMiddleware, exportPDF);

module.exports = router;

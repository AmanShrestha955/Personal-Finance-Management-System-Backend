const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  adminLogin,
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  updateUser,
  deleteUser,
  getAllTransactions,
  getAllFamilies,
  updateFamily,
  deleteFamily,
} = require("./adminController.js");

const adminRouter = Router();

// Admin Authentication
adminRouter.post("/admin-login", adminLogin);

// Dashboard & Stats (Protected)
adminRouter.get("/dashboard/stats", authMiddleware, getDashboardStats);

// User Management (Protected)
adminRouter.get("/users", authMiddleware, getAllUsers);
adminRouter.get("/users/:userId", authMiddleware, getUserDetails);
adminRouter.put("/users/:userId/suspend", authMiddleware, suspendUser);
adminRouter.put("/users/:userId/unsuspend", authMiddleware, unsuspendUser);
adminRouter.put("/users/:userId", authMiddleware, updateUser);
adminRouter.delete("/users/:userId", authMiddleware, deleteUser);

// Transaction Management (Protected)
adminRouter.get("/transactions", authMiddleware, getAllTransactions);

// Family Management (Protected)
adminRouter.get("/families", authMiddleware, getAllFamilies);
adminRouter.put("/families/:familyId", authMiddleware, updateFamily);
adminRouter.delete("/families/:familyId", authMiddleware, deleteFamily);

module.exports = adminRouter;

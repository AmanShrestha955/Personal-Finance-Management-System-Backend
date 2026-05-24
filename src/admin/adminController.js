const Admin = require("./adminModels.js");
const User = require("../models/userModels.js");
const { Family } = require("../models/familyModels.js");
const Transaction = require("../models/transactionModels.js");
const Budget = require("../models/budgetModels.js");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken.js");

// Admin Login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  console.log("[ADMIN LOGIN] Request received for email:", email);

  try {
    // Validate input
    if (!email || !password) {
      console.log("[ADMIN LOGIN] Email or password missing");
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find admin by email
    console.log("[ADMIN LOGIN] Finding admin with email:", email);
    const admin = await Admin.findOne({ email });

    if (!admin) {
      console.log("[ADMIN LOGIN] Admin not found with email:", email);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    console.log(
      "[ADMIN LOGIN] Admin found:",
      admin.email,
      "Status:",
      admin.status,
    );

    // Check if admin account is locked
    if (admin.isLocked) {
      if (admin.lockedUntil && new Date() < admin.lockedUntil) {
        return res.status(423).json({
          message: "Admin account is locked. Try again later.",
        });
      } else {
        // Unlock the account if lock time has expired
        admin.isLocked = false;
        admin.lockedUntil = null;
        admin.loginAttempts = 0;
        await admin.save();
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      // Increment login attempts
      admin.loginAttempts = (admin.loginAttempts || 0) + 1;

      // Lock account after 5 failed attempts
      if (admin.loginAttempts >= 5) {
        admin.isLocked = true;
        admin.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      }

      await admin.save();

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Reset login attempts on successful login
    admin.loginAttempts = 0;
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateToken(admin._id);

    res.status(200).json({
      token: token,
      message: "Admin login successful",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      message: "Admin login failed",
      error: error.message,
    });
  }
};

// Get Dashboard Statistics
const getDashboardStats = async (req, res) => {
  console.log("[DASHBOARD STATS] Request received");
  try {
    // Get total users count
    console.log("[DASHBOARD STATS] Fetching user statistics...");
    const totalUsers = await User.countDocuments();
    console.log("[DASHBOARD STATS] Total users:", totalUsers);

    // Get active users (users who logged in within last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
    });

    // Get total families count
    const totalFamilies = await Family.countDocuments();

    // Get total transactions count
    const totalTransactions = await Transaction.countDocuments();

    // Get total budgets count
    const totalBudgets = await Budget.countDocuments();

    // Get user growth data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowthData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Get transaction volume data (last 6 months)
    const transactionGrowthData = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email");

    // Get transaction statistics by category
    const transactionByCategory = await Transaction.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]);

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully",
      stats: {
        totalUsers,
        activeUsers,
        totalFamilies,
        totalTransactions,
        totalBudgets,
      },
      userGrowthData,
      transactionGrowthData,
      recentTransactions,
      transactionByCategory,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      message: "Failed to retrieve dashboard statistics",
      error: error.message,
    });
  }
};

// Get All Users (Admin)
const getAllUsers = async (req, res) => {
  console.log("[GET ALL USERS] Request received with params:", req.query);
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    console.log(
      "[GET ALL USERS] Fetching users - page:",
      page,
      "limit:",
      limit,
      "search:",
      search,
    );
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
    }

    const users = await User.find(query)
      .skip(skip)
      .limit(Number(limit))
      .select("-password")
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      message: "Users retrieved successfully",
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      message: "Failed to retrieve users",
      error: error.message,
    });
  }
};

// Get User Details by ID
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-password")
      .populate("accounts");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User details retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      message: "Failed to retrieve user details",
      error: error.message,
    });
  }
};

// Suspend User
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isSuspended: true,
        suspensionReason: reason || "No reason provided",
        suspendedAt: new Date(),
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User suspended successfully",
      data: user,
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({
      message: "Failed to suspend user",
      error: error.message,
    });
  }
};

// Unsuspend User
const unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User unsuspended successfully",
      data: user,
    });
  } catch (error) {
    console.error("Unsuspend user error:", error);
    res.status(500).json({
      message: "Failed to unsuspend user",
      error: error.message,
    });
  }
};

// Get All Transactions (Admin)
const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      type,
      startDate,
      endDate,
    } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (userId) query.userId = userId;
    if (type) query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      message: "Transactions retrieved successfully",
      data: transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      message: "Failed to retrieve transactions",
      error: error.message,
    });
  }
};

// Get All Families (Admin)
const getAllFamilies = async (req, res) => {
  console.log("[GET ALL FAMILIES] Request received with params:", req.query);
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    console.log(
      "[GET ALL FAMILIES] Fetching families - page:",
      page,
      "limit:",
      limit,
      "search:",
      search,
    );
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [{ name: { $regex: search, $options: "i" } }],
      };
    }

    const families = await Family.find(query)
      .skip(skip)
      .limit(Number(limit))
      .populate("owner", "name email")
      .populate("members", "name email")
      .sort({ createdAt: -1 });

    const total = await Family.countDocuments(query);

    res.status(200).json({
      message: "Families retrieved successfully",
      data: families,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all families error:", error);
    res.status(500).json({
      message: "Failed to retrieve families",
      error: error.message,
    });
  }
};

// Update User
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email } = req.body;

    console.log("[UPDATE USER] Updating user:", userId);

    // Validate input
    if (!name && !email) {
      return res.status(400).json({
        message: "At least one field (name or email) is required to update",
      });
    }

    // Check if email is already in use by another user
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({
          message: "Email is already in use",
        });
      }
    }

    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    console.log("[UPDATE USER] User updated successfully:", updatedUser._id);

    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("[UPDATE USER] Error:", error);
    res.status(500).json({
      message: "Failed to update user",
      error: error.message,
    });
  }
};

// Delete User
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log("[DELETE USER] Deleting user:", userId);

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    console.log("[DELETE USER] User deleted successfully:", userId);

    res.status(200).json({
      message: "User deleted successfully",
      data: deletedUser,
    });
  } catch (error) {
    console.error("[DELETE USER] Error:", error);
    res.status(500).json({
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

// Update Family
const updateFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { name, status } = req.body;

    console.log("[UPDATE FAMILY] Updating family:", familyId);

    // Validate input
    if (!name && !status) {
      return res.status(400).json({
        message: "At least one field (name or status) is required to update",
      });
    }

    // Validate status if provided
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value",
      });
    }

    // Update family
    const updateData = {};
    if (name) updateData.name = name;
    if (status) updateData.status = status;

    const updatedFamily = await Family.findByIdAndUpdate(familyId, updateData, {
      new: true,
    })
      .populate("owner", "name email")
      .populate("members", "name email");

    if (!updatedFamily) {
      return res.status(404).json({
        message: "Family not found",
      });
    }

    console.log(
      "[UPDATE FAMILY] Family updated successfully:",
      updatedFamily._id,
    );

    res.status(200).json({
      message: "Family updated successfully",
      data: updatedFamily,
    });
  } catch (error) {
    console.error("[UPDATE FAMILY] Error:", error);
    res.status(500).json({
      message: "Failed to update family",
      error: error.message,
    });
  }
};

// Delete Family
const deleteFamily = async (req, res) => {
  try {
    const { familyId } = req.params;

    console.log("[DELETE FAMILY] Deleting family:", familyId);

    const deletedFamily = await Family.findByIdAndDelete(familyId);

    if (!deletedFamily) {
      return res.status(404).json({
        message: "Family not found",
      });
    }

    console.log("[DELETE FAMILY] Family deleted successfully:", familyId);

    res.status(200).json({
      message: "Family deleted successfully",
      data: deletedFamily,
    });
  } catch (error) {
    console.error("[DELETE FAMILY] Error:", error);
    res.status(500).json({
      message: "Failed to delete family",
      error: error.message,
    });
  }
};

module.exports = {
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
};

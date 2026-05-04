const jwt = require("jsonwebtoken");
const Admin = require("./adminModels.js");

// Verify admin authentication and permissions
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token provided. Please login as admin.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );
    const admin = await Admin.findById(decoded.userId);

    if (!admin) {
      return res.status(401).json({
        message: "Admin not found",
      });
    }

    if (admin.status !== "active") {
      return res.status(403).json({
        message: "Admin account is not active",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }
    res.status(500).json({
      message: "Authentication failed",
      error: error.message,
    });
  }
};

// Check if admin has specific permission
const checkAdminPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        message: "Admin authentication required",
      });
    }

    if (
      req.admin.role === "superadmin" ||
      req.admin.permissions.includes(requiredPermission)
    ) {
      next();
    } else {
      res.status(403).json({
        message: "Insufficient permissions",
      });
    }
  };
};

// Check if admin has superadmin role
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({
      message: "Admin authentication required",
    });
  }

  if (req.admin.role === "superadmin") {
    next();
  } else {
    res.status(403).json({
      message: "Superadmin role required",
    });
  }
};

module.exports = {
  adminAuthMiddleware,
  checkAdminPermission,
  requireSuperAdmin,
};

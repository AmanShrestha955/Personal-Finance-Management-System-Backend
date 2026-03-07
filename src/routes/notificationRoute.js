const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const {
  getInAppNotifications,
  toggleReminder,
} = require("../controllers/notificationController.js");

const notificationRouter = Router();

// Called on page load — returns goals due for notification
notificationRouter.get("/", authMiddleware, getInAppNotifications);

// Toggle reminder on/off for a specific goal
notificationRouter.put("/:goalId/toggle", authMiddleware, toggleReminder);

module.exports = notificationRouter;

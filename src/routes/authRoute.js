const {
  Login,
  Signup,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController.js");
const { SetUp } = require("../controllers/setUpController.js");

const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const authRouter = Router();

authRouter.post("/signup", Signup);
authRouter.post("/login", Login);
authRouter.get("/verify-email/:token", verifyEmail);
authRouter.post("/setup", authMiddleware, SetUp);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password/:token", resetPassword);

module.exports = authRouter;

const {
  Login,
  Signup,
  verifyEmail,
} = require("../controllers/authController.js");

const { Router } = require("express");
const authRouter = Router();

authRouter.post("/signup", Signup);
authRouter.post("/login", Login);
authRouter.get("/verify-email/:token", verifyEmail);

module.exports = authRouter;

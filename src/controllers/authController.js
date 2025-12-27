const User = require("../models/userModels.js");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken.js");
const crypto = require("crypto");
const {
  sendVerificationEmail,
} = require("../middlewares/sendVerificationEmail.js");
const {
  sendForgotPasswordEmail,
} = require("../middlewares/sendForgotPasswordEmail.js");

const Signup = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (!password === confirmPassword) {
    return res.status(400).json({ message: "password do not match" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "password must be at least 6 characters long" });
  }
  try {
    const userExists = await User.findOne({ email });
    if (userExists && userExists.isVerified === true) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const tokenVerification = crypto.randomBytes(32).toString("hex");
    console.log("Token Varification: ", tokenVerification);
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    console.log("Hashed password:", hashedPassword);
    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      verificationToken: tokenVerification,
      verificationTime: verificationTokenExpires,
    });
    const verifyUrl = `http://localhost:3000/verify-email/${tokenVerification}`; // frontend link
    console.log("verify Url: ", verifyUrl);
    sendVerificationEmail(email, verifyUrl);
    res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Signup failed. error in Signup function",
      error: error.message,
    });
  }
};

const Login = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login request body:", req.body);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in." });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = generateToken(user._id);
    res.status(200).json({
      token: token,
      message: "Login successful",
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed. error in Login function",
      error: error.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTime: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTime = undefined;
    await user.save();

    res
      .status(200)
      .json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Verification failed", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; //15 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    sendForgotPasswordEmail(email, resetUrl);
    res.status(200).json({
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Forgot password failed. error in forgotPassword function",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password is required and should be at least 6 characters long",
      });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Reset password failed. error in resetPassword function",
      error: error.message,
    });
  }
};

module.exports = { Signup, Login, verifyEmail, forgotPassword, resetPassword };

const User = require("../models/userModels.js");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken.js");
const crypto = require("crypto");
const Account = require("../models/accountModels.js");
const {
  sendVerificationEmail,
} = require("../middlewares/sendVerificationEmail.js");
const {
  sendForgotPasswordEmail,
} = require("../middlewares/sendForgotPasswordEmail.js");

const Signup = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  console.log("Signup request body:", req.body);
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
      console.log("User already exists and is verified:", userExists);
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
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${tokenVerification}`; // frontend link
    console.log("verify Url: ", verifyUrl);
    sendVerificationEmail(email, verifyUrl);
    console.log("User created:", user);
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
    // Google-only accounts have no password
    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses Google sign-in. Please use the 'Sign in with Google' button.",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = generateToken(user._id);
    console.log("isOnboarded status:", user.isOnboarded);
    res.status(200).json({
      token: token,
      isOnboarded: user.isOnboarded,
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

    const existingAccount = await Account.findOne({ userId: user._id });
    if (!existingAccount) {
      await Account.create({ userId: user._id });
    }

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

const deleteUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;

    // ── Block deletion if user is a family owner ──────────────────────────
    const ownedFamily = await Family.findOne({
      owner: userId,
      isActive: true,
    }).session(session);

    if (ownedFamily) {
      await session.abortTransaction();
      return res.status(400).json({
        message:
          "You must transfer family ownership or dissolve the family before deleting your account.",
      });
    }

    // ── Remove from family membership ─────────────────────────────────────
    await Family.updateMany(
      { "members.user": userId },
      { $pull: { members: { user: userId } } },
      { session },
    );

    // ── Remove pending invites by email ───────────────────────────────────
    const user = await User.findById(userId).session(session);
    await Family.updateMany(
      { "pendingInvites.email": user.email },
      { $pull: { pendingInvites: { email: user.email } } },
      { session },
    );

    // ── Delete personal finance data ──────────────────────────────────────
    await Transaction.deleteMany({ userId, familyId: null }).session(session);
    await Account.deleteMany({ userId, familyId: null }).session(session);
    await Budget.deleteMany({ userId, familyId: null }).session(session);
    await SavingGoal.deleteMany({ userId, familyId: null }).session(session);
    await Saving.deleteMany({ userId }).session(session);

    // ── Cancel pending transfers ───────────────────────────────────────────
    await FamilyTransfer.updateMany(
      {
        $or: [{ fromUser: userId }, { toUser: userId }],
        status: "pending",
      },
      { status: "cancelled" },
      { session },
    );

    // ── Delete the user ───────────────────────────────────────────────────
    await User.findByIdAndDelete(userId).session(session);

    await session.commitTransaction();
    res.status(200).json({ message: "Account deleted successfully." });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: "Internal server error." });
  } finally {
    session.endSession();
  }
};

module.exports = {
  Signup,
  Login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  deleteUser,
};

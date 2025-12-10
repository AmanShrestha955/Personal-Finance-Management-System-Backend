const User = require("../models/userModels.js");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken.js");
const crypto = require("crypto");
const {
  sendVerificationEmail,
} = require("../middlewares/sendVerificationEmail.js");

const Signup = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (!password === confirmPassword) {
    return res.status(400).json({ message: "password do not match" });
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

module.exports = { Signup, Login, verifyEmail };

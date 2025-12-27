const User = require("../models/userModels.js");
const Account = require("../models/accountModels.js");

const SetUp = async (req, res) => {
  try {
    const { balance } = req.body;
    const { id } = req.user;
    console.log("User ID from token:", id);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const existAccount = await Account.findOne({ userId: id });
    if (existAccount) {
      return res.status(400).json({ message: "You have already one account." });
    }
    const newAccount = new Account({ userId: id, balance });
    await newAccount.save();
    res.status(201).json({
      message: "Account created successfully",
      data: newAccount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Signup failed. error in Signup function",
      error: error.message,
    });
  }
};

module.exports = { SetUp };

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
    if (existAccount && user.isOnboarded === false) {
      existAccount.balance = balance;
      user.isOnboarded = true;
      await user.save();
      await existAccount.save();
      return res.status(200).json({
        message: "Account updated successfully",
        data: existAccount,
      });
    }
    const newAccount = new Account({ userId: id, balance });
    user.isOnboarded = true;
    await user.save();
    await newAccount.save();
    res.status(201).json({
      message: "Account created successfully",
      data: newAccount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Setup failed. error in SetUp function",
      error: error.message,
    });
  }
};

module.exports = { SetUp };

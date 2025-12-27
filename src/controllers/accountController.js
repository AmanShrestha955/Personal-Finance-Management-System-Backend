const Account = require("../models/accountModels.js");

const getAccount = async (req, res) => {
  try {
    const { id } = req.user;
    const accounts = await Account.find({ userId: id });
    res.status(200).json({ data: accounts });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Fetching accounts failed", error: error.message });
  }
};

module.exports = {
  getAccount,
};

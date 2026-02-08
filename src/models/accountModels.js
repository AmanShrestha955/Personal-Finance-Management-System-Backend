const { Schema, model } = require("mongoose");

const AccountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    income: {
      type: Number,
      default: 0,
    },
    expenses: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const Account = model("Account", AccountSchema);
module.exports = Account;

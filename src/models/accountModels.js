const { Schema, model } = require("mongoose");

const AccountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: "Family",
      default: null,
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

AccountSchema.pre("validate", function (next) {
  if (!this.userId && !this.familyId) {
    return next(
      new Error("An account must belong to either a user or a family"),
    );
  }
  next();
});

const Account = model("Account", AccountSchema);
module.exports = Account;

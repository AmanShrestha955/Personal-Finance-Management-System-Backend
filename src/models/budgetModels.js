const { Schema, model } = require("mongoose");

const BudgetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      unique: true,
    },
    budgetAmount: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value > 0;
        },
        message: "Budget amount must be greater than zero",
      },
    },
    spentAmount: {
      type: Number,
      default: 0,
    },
    alertThreshold: {
      type: Number,
      default: 80,
      validate: {
        validator: function (value) {
          return value >= 0 && value <= 100;
        },
        message: "Alert threshold must be between 0 and 100",
      },
    },
    month: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Budget = model("Budget", BudgetSchema);
module.exports = Budget;

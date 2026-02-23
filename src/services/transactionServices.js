const mongoose = require("mongoose");
const Transaction = require("../models/transactionModels");
const Budget = require("../models/budgetModels");
const Account = require("../models/accountModels");

/**
 * createTransactionCore
 *
 * Shared business logic for creating a transaction.
 * Used by both the HTTP controller (transactionController.js)
 * and the recurring transaction scheduler.
 *
 * @param {Object} data
 * @param {string}  data.userId
 * @param {string}  data.title
 * @param {number}  data.amount
 * @param {string}  data.type            - "income" | "expense"
 * @param {string}  data.category
 * @param {string}  data.paymentMethod
 * @param {Date}    data.transactionDate
 * @param {string}  [data.description]
 * @param {string}  [data.receiptPath]
 * @param {string[]} [data.tags]
 * @param {string}  [data.note]
 * @param {string}  [data.recurringTransactionId]  - set by scheduler for traceability
 *
 * @returns {{ transaction, account, budget? }}
 * @throws  Error with a descriptive message on any failure
 */
async function createTransactionCore(data) {
  const {
    userId,
    title,
    amount,
    type,
    category,
    paymentMethod,
    transactionDate,
    description,
    receiptPath = null,
    tags = [],
    note = null,
    recurringTransactionId = null,
  } = data;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- Validation ---
    if (!title) throw new Error("Title is required");
    if (!amount || amount <= 0) throw new Error("Amount must be positive");
    if (!type || !["income", "expense"].includes(type))
      throw new Error("Type must be 'income' or 'expense'");
    if (!category) throw new Error("Category is required");
    if (!paymentMethod) throw new Error("PaymentMethod is required");

    // --- Find account ---
    const account = await Account.findOne({ userId }).session(session);
    if (!account) throw new Error("Account not found");

    // --- Insufficient balance check ---
    if (type === "expense" && account.balance < amount) {
      throw new Error("Insufficient account balance");
    }

    // --- Create transaction ---
    const newTransaction = new Transaction({
      userId,
      accountId: account._id,
      title,
      amount,
      type,
      category,
      paymentMethod,
      transactionDate: transactionDate || new Date(),
      description,
      receipt: receiptPath,
      tags,
      note,
      recurringTransactionId, // null for manual transactions
    });

    await newTransaction.save({ session });

    // --- Update budget (expenses only) ---
    let updatedBudget = null;
    if (type === "expense") {
      const budget = await Budget.findOne({ userId, category }).session(
        session,
      );
      if (budget) {
        budget.spentAmount += amount;
        await budget.save({ session });
        updatedBudget = budget;
      }
    }

    // --- Update account balance ---
    if (type === "income") {
      account.balance += amount;
      account.income += amount;
    } else {
      account.balance -= amount;
      account.expenses += amount;
    }

    await account.save({ session });
    await session.commitTransaction();

    const result = { transaction: newTransaction, account };
    if (updatedBudget) result.budget = updatedBudget;
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error; // re-throw so caller (controller or scheduler) handles it
  } finally {
    session.endSession();
  }
}

module.exports = { createTransactionCore };

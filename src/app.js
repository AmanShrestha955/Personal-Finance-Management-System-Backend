const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./config/db.js");
const authRouter = require("./routes/authRoute.js");
const transactionRouter = require("./routes/transactionRoute.js");
const accountRouter = require("./routes/accountRoute.js");
const budgetRouter = require("./routes/budgetRoute.js");
const savingGoalRouter = require("./routes/savingGoalRoute.js");
const statsRouter = require("./routes/statsRoute.js");
const userRouter = require("./routes/userRoute.js");
const recurringTransactionRouter = require("./routes/RecurringTransactionRoute.js");
const notificationRouter = require("./routes/notificationRoute.js");

connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
console.log(path.join(__dirname, "uploads"));

app.get("/home", (req, res) => {
  res.json({ message: "API is running... Hello world" });
});

app.use("/api/users", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/budgets", budgetRouter);
app.use("/api/savingGoals", savingGoalRouter);
app.use("/api/stats", statsRouter);
app.use("/api/recurring-transactions", recurringTransactionRouter);
app.use("/api/notifications", notificationRouter);

module.exports = app;

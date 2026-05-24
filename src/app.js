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
const exportRoutes = require("./routes/exportRoute.js");
const familyRouter = require("./routes/familyRoute.js");
const familyTransferRouter = require("./routes/familyTransferRoute.js");
const adminRouter = require("./admin/adminRoute.js");
connectDB();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
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
app.use("/api/export", exportRoutes);
app.use("/api/families", familyRouter);
app.use("/api/family-transfers", familyTransferRouter);
app.use("/api/auth", adminRouter);

module.exports = app;

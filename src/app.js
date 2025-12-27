const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db.js");
const authRouter = require("./routes/authRoute.js");
const transactionRouter = require("./routes/transactionRoute.js");
const accountRouter = require("./routes/accountRoute.js");

connectDB();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/home", (req, res) => {
  res.json({ message: "API is running... Hello world" });
});

app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/accounts", accountRouter);

module.exports = app;

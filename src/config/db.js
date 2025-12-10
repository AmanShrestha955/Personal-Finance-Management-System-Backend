const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URL) {
      console.log(process.env.MONGO_URL);
      throw new Error("MONGO_URL is not defined in environment variables");
    }
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.log("MongoDB connection failed");
    console.error(err);
    process.exit(1);
  }
};

module.exports = { connectDB };

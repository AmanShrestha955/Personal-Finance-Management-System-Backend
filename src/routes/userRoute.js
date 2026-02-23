const {
  getUser,
  updateUser,
  deleteUser,
  changePassword,
} = require("../controllers/userController");
const {
  uploadUserPhoto,
  handleUploadError,
} = require("../middlewares/upload.middleware");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const { Router } = require("express");
const userRouter = Router();

userRouter.get("/me", authMiddleware, getUser);
userRouter.put(
  "/me",
  authMiddleware,
  uploadUserPhoto,
  handleUploadError,
  updateUser,
);
userRouter.delete("/me", authMiddleware, deleteUser);
userRouter.put("/me/change-password", authMiddleware, changePassword);
module.exports = userRouter;

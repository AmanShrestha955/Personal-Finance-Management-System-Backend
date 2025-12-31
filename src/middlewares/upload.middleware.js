const upload = require("../utils/multer.js");
const multer = require("multer");

// Middleware for single file upload
const uploadSingleReceipt = upload.single("receipt");

// Middleware with error handling
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      message: "File upload error",
      error: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
  next();
};

module.exports = {
  uploadSingleReceipt,
  handleUploadError,
};

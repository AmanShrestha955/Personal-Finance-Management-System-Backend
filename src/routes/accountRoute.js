const { getAccount } = require("../controllers/accountController.js");
const { Router } = require("express");
const authMiddleware = require("../middlewares/authMiddlewares.js");
const accountRouter = Router();

accountRouter.get("/", authMiddleware, getAccount);

module.exports = accountRouter;

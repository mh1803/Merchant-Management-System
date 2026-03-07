const express = require('express');
const { loginController, refreshController } = require('../controllers/authController');

const authRouter = express.Router();

authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshController);

module.exports = { authRouter };

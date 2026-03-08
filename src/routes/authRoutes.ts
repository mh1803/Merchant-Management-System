import express from 'express';
import { loginController, refreshController } from '../controllers/authController';

export const authRouter = express.Router();

authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshController);

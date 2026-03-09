import express from 'express';
import { loginController, refreshController } from '../controllers/authController';

export const authRouter = express.Router();

// Auth is intentionally small: one endpoint to establish a session, one to rotate it.
authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshController);

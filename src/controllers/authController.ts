import Joi from 'joi';
import { NextFunction, Request, Response } from 'express';
import { login, refresh } from '../services/authService';
import { LoginInput, RefreshInput } from '../types/auth';

const loginSchema = Joi.object<LoginInput>({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const refreshSchema = Joi.object<RefreshInput>({
  refreshToken: Joi.string().required()
});

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const value = await loginSchema.validateAsync(req.body, { abortEarly: false });
    const response = await login(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const value = await refreshSchema.validateAsync(req.body, { abortEarly: false });
    const response = await refresh(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

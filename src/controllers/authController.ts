import { NextFunction, Request, Response } from 'express';
import { login, refresh } from '../services/authService';
import { LoginInput, RefreshInput } from '../types/auth';
import { validateWithSchema, z } from '../utils/validation';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
}) satisfies z.ZodType<LoginInput>;

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
}) satisfies z.ZodType<RefreshInput>;

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Controllers validate external input and hand off to services; they do not own auth policy.
    const value = await validateWithSchema(loginSchema, req.body);
    const response = await login(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Refresh accepts only the token payload shape and leaves all replay/expiry checks to the service.
    const value = await validateWithSchema(refreshSchema, req.body);
    const response = await refresh(value);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

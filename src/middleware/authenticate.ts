import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { getOperatorByEmail } from '../db/authRepository';
import { verifyAccessToken } from '../services/tokenService';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.header('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED'));
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    const operator = await getOperatorByEmail(payload.email);

    if (!operator || operator.id !== payload.sub) {
      throw new AppError(401, 'Invalid access token', 'INVALID_ACCESS_TOKEN');
    }

    // Downstream controllers and services rely on this normalized operator context.
    res.locals.operator = {
      id: operator.id,
      email: operator.email,
      role: operator.role
    };

    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError(401, 'Invalid access token', 'INVALID_ACCESS_TOKEN')
    );
  }
}

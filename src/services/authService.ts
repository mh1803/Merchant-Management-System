import bcrypt from 'bcryptjs';
import { AppError } from '../errors';
import { config } from '../config';
import {
  deleteRefreshSession,
  getOperatorByEmail,
  getRefreshSession,
  saveRefreshSession,
  setOperatorLoginState
} from '../db/authRepository';
import { issueAccessToken, issueRefreshToken, verifyRefreshToken } from './tokenService';
import { AuthTokens, LoginInput, OperatorRecord, RefreshInput } from '../types/auth';

async function buildAuthResponse(operator: OperatorRecord): Promise<AuthTokens> {
  const accessToken = issueAccessToken({
    operatorId: operator.id,
    email: operator.email,
    role: operator.role
  });

  const { token: refreshToken, jti, expiresAt } = issueRefreshToken({
    operatorId: operator.id,
    email: operator.email,
    role: operator.role
  });

  await saveRefreshSession({
    jti,
    operatorId: operator.id,
    expiresAt
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.accessTtl
  };
}

function isLocked(operator: OperatorRecord): boolean {
  return Boolean(operator.lockoutUntil && Date.now() < operator.lockoutUntil);
}

export function lockoutRetrySeconds(operator: OperatorRecord): number {
  return Math.ceil(((operator.lockoutUntil || 0) - Date.now()) / 1000);
}

export async function login({ email, password }: LoginInput): Promise<AuthTokens> {
  const operator = await getOperatorByEmail(email);

  if (!operator) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (isLocked(operator)) {
    throw new AppError(423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
  }

  const passwordMatches = await bcrypt.compare(password, operator.passwordHash);

  if (!passwordMatches) {
    const failedLoginAttempts = operator.failedLoginAttempts + 1;
    let lockoutUntil: number | null = null;

    if (failedLoginAttempts >= config.loginMaxAttempts) {
      lockoutUntil = Date.now() + config.loginLockoutMinutes * 60 * 1000;
    }

    const updated = await setOperatorLoginState(operator.id, {
      failedLoginAttempts,
      lockoutUntil
    });

    if (updated && isLocked(updated)) {
      throw new AppError(423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
    }

    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await setOperatorLoginState(operator.id, {
    failedLoginAttempts: 0,
    lockoutUntil: null
  });

  return buildAuthResponse(operator);
}

export async function refresh({ refreshToken }: RefreshInput): Promise<AuthTokens> {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (payload.tokenType !== 'refresh' || !payload.jti) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const session = await getRefreshSession(payload.jti);
  if (!session || session.operatorId !== payload.sub) {
    throw new AppError(401, 'Refresh token is no longer valid', 'INVALID_REFRESH_TOKEN');
  }

  if (session.expiresAt < Date.now()) {
    await deleteRefreshSession(payload.jti);
    throw new AppError(401, 'Refresh token is no longer valid', 'INVALID_REFRESH_TOKEN');
  }

  await deleteRefreshSession(payload.jti);

  const operator = await getOperatorByEmail(payload.email);
  if (!operator) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  return buildAuthResponse(operator);
}

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AccessTokenPayload, RefreshTokenPayload, TokenSubject } from '../types/auth';

interface IssuedRefreshToken {
  token: string;
  jti: string;
  expiresAt: number;
}

// Token helpers are kept separate from auth orchestration so JWT concerns remain isolated.
export function issueAccessToken({ operatorId, email, role }: TokenSubject): string {
  return jwt.sign(
    { sub: operatorId, email, role, tokenType: 'access' },
    config.accessSecret,
    { expiresIn: config.accessTtl as jwt.SignOptions['expiresIn'] }
  );
}

export function issueRefreshToken({ operatorId, email, role }: TokenSubject): IssuedRefreshToken {
  // Refresh tokens get a unique JWT ID so the repository can track one concrete token instance.
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: operatorId, email, role, tokenType: 'refresh', jti },
    config.refreshSecret,
    { expiresIn: config.refreshTtl as jwt.SignOptions['expiresIn'] }
  );

  const decoded = jwt.decode(token);
  // Expiry is extracted once here so callers do not need to re-decode the token later.
  const expiresAt =
    decoded && typeof decoded === 'object' && typeof decoded.exp === 'number'
      ? decoded.exp * 1000
      : Date.now();

  return { token, jti, expiresAt };
}

export function verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
  return jwt.verify(refreshToken, config.refreshSecret) as RefreshTokenPayload;
}

export function verifyAccessToken(accessToken: string): AccessTokenPayload {
  return jwt.verify(accessToken, config.accessSecret) as AccessTokenPayload;
}

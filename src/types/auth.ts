export type OperatorRole = 'admin' | 'operator';

export interface OperatorRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: OperatorRole;
  failedLoginAttempts: number;
  lockoutUntil: number | null;
}

export interface RefreshSessionRecord {
  jti: string;
  operatorId: string;
  expiresAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface TokenSubject {
  operatorId: string;
  email: string;
  role: OperatorRole;
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: OperatorRole;
  tokenType: 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: OperatorRole;
  tokenType: 'access';
  iat?: number;
  exp?: number;
}

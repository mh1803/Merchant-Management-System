process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.LOGIN_MAX_ATTEMPTS = '3';
process.env.LOGIN_LOCKOUT_MINUTES = '15';

import bcrypt from 'bcryptjs';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { login, refresh } from '../src/services/authService';

describe('Auth service', () => {
  beforeEach(async () => {
    resetAuthStoreForTests();

    await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'admin'
    });
  });

  it('logs in with valid credentials and returns tokens', async () => {
    const res = await login({
      email: 'admin@example.com',
      password: 'StrongPass123'
    });

    expect(res.accessToken).toEqual(expect.any(String));
    expect(res.refreshToken).toEqual(expect.any(String));
    expect(res.tokenType).toBe('Bearer');
    expect(res.expiresIn).toBe('15m');
  });

  it('locks account after too many failed attempts', async () => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await expect(
        login({ email: 'admin@example.com', password: 'WrongPass123' })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    }

    await expect(
      login({ email: 'admin@example.com', password: 'WrongPass123' })
    ).rejects.toMatchObject({
      statusCode: 423,
      code: 'ACCOUNT_LOCKED'
    });

    await expect(
      login({ email: 'admin@example.com', password: 'StrongPass123' })
    ).rejects.toMatchObject({
      statusCode: 423,
      code: 'ACCOUNT_LOCKED'
    });
  });

  it('refreshes tokens and invalidates previous refresh token', async () => {
    const loginRes = await login({
      email: 'admin@example.com',
      password: 'StrongPass123'
    });

    const refreshed = await refresh({ refreshToken: loginRes.refreshToken });

    expect(refreshed.accessToken).toEqual(expect.any(String));
    expect(refreshed.refreshToken).toEqual(expect.any(String));
    expect(refreshed.refreshToken).not.toBe(loginRes.refreshToken);

    await expect(
      refresh({ refreshToken: loginRes.refreshToken })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN'
    });
  });

  it('rejects malformed refresh tokens', async () => {
    await expect(refresh({ refreshToken: 'invalid-token' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN'
    });
  });
});

process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.LOGIN_MAX_ATTEMPTS = '3';
process.env.LOGIN_LOCKOUT_MINUTES = '15';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('Auth HTTP API', () => {
  beforeEach(async () => {
    resetAuthStoreForTests();

    await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'admin'
    });
  });

  it('logs in with valid credentials and returns tokens', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'StrongPass123'
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.expiresIn).toBe('15m');
  });

  it('returns validation errors for malformed login input', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'not-an-email',
      password: 'short'
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(expect.any(Array));
  });

  it('locks the account after repeated failed logins', async () => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const invalidResponse = await request(app).post('/auth/login').send({
        email: 'admin@example.com',
        password: 'WrongPass123'
      });

      expect(invalidResponse.status).toBe(401);
      expect(invalidResponse.body.code).toBe('INVALID_CREDENTIALS');
    }

    const lockedResponse = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'WrongPass123'
    });

    expect(lockedResponse.status).toBe(423);
    expect(lockedResponse.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('refreshes tokens and invalidates the old refresh token', async () => {
    const loginResponse = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'StrongPass123'
    });

    const refreshResponse = await request(app).post('/auth/refresh').send({
      refreshToken: loginResponse.body.refreshToken
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toBe(loginResponse.body.refreshToken);

    const reusedResponse = await request(app).post('/auth/refresh').send({
      refreshToken: loginResponse.body.refreshToken
    });

    expect(reusedResponse.status).toBe(401);
    expect(reusedResponse.body.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { issueAccessToken } from '../src/services/tokenService';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('Merchant HTTP API', () => {
  let accessToken: string;

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetMerchantStoreForTests();

    const operator = await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'admin'
    });

    accessToken = issueAccessToken({
      operatorId: operator.id,
      email: operator.email,
      role: operator.role
    });
  });

  it('creates and retrieves a merchant', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('Atlas Pharmacy');

    const getResponse = await request(app)
      .get(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.contactEmail).toBe('owner@atlas.ma');
  });

  it('filters merchants by query params', async () => {
    await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Casa Electronics',
        category: 'Retail',
        city: 'Casablanca',
        contactEmail: 'sales@casa.ma',
        status: 'Active'
      });

    const response = await request(app)
      .get('/merchants')
      .query({ status: 'Active', city: 'Casablanca' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe('Casa Electronics');
  });

  it('updates merchant details', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    const updateResponse = await request(app)
      .patch(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        city: 'Rabat',
        status: 'Active'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.city).toBe('Rabat');
    expect(updateResponse.body.status).toBe('Active');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/merchants');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });
});

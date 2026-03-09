process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';
import { issueAccessToken } from '../src/services/tokenService';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('Merchant pricing tier HTTP API', () => {
  let adminAccessToken: string;
  let operatorAccessToken: string;
  let merchantId: string;

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();

    const admin = await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'admin'
    });
    const operator = await createOrUpdateOperator({
      email: 'operator@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'operator'
    });

    adminAccessToken = issueAccessToken({
      operatorId: admin.id,
      email: admin.email,
      role: admin.role
    });
    operatorAccessToken = issueAccessToken({
      operatorId: operator.id,
      email: operator.email,
      role: operator.role
    });

    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    merchantId = createResponse.body.id;
  });

  it('allows admins to change pricing tier', async () => {
    const response = await request(app)
      .patch(`/merchants/${merchantId}/pricing-tier`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ pricingTier: 'premium' });

    expect(response.status).toBe(200);
    expect(response.body.pricingTier).toBe('premium');
  });

  it('rejects pricing tier changes by non-admin operators', async () => {
    const response = await request(app)
      .patch(`/merchants/${merchantId}/pricing-tier`)
      .set('Authorization', `Bearer ${operatorAccessToken}`)
      .send({ pricingTier: 'premium' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_REQUIRED');
  });
});

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

describeHttp('Merchant status history HTTP API', () => {
  let accessToken: string;

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();

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

  it('returns status history for a merchant', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    await request(app)
      .patch(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'Active'
      });

    const historyResponse = await request(app)
      .get(`/merchants/${createResponse.body.id}/history`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.items).toHaveLength(1);
    expect(historyResponse.body.items[0]).toMatchObject({
      fieldName: 'status',
      previousValue: 'Pending KYB',
      newValue: 'Active',
      changedByEmail: 'admin@example.com'
    });
  });
});

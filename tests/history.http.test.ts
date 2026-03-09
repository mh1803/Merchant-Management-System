process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import { issueAccessToken } from '../src/services/tokenService';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('Merchant status history HTTP API', () => {
  let accessToken: string;

  async function addRequiredKybDocuments(merchantId: string): Promise<void> {
    for (const type of [
      'business_registration',
      'owner_identity_document',
      'bank_account_proof'
    ] as const) {
      await request(app)
        .post(`/merchants/${merchantId}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type,
          fileName: `${type}.pdf`
        });

      await request(app)
        .patch(`/merchants/${merchantId}/documents/${type}/verify`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ verified: true });
    }
  }

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
    resetKybStoreForTests();

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

    await addRequiredKybDocuments(createResponse.body.id);

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

  it('rejects unauthenticated history requests', async () => {
    const response = await request(app).get(
      '/merchants/38b8f2ea-632c-4f3c-9b25-6cd2f8141ab7/history'
    );

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects malformed merchant ids', async () => {
    const response = await request(app)
      .get('/merchants/not-a-uuid/history')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found for unknown merchants', async () => {
    const response = await request(app)
      .get('/merchants/38b8f2ea-632c-4f3c-9b25-6cd2f8141ab7/history')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('MERCHANT_NOT_FOUND');
  });
});

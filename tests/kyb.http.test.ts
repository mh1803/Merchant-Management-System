process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import { issueAccessToken } from '../src/services/tokenService';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('KYB HTTP API', () => {
  let accessToken: string;
  let merchantId: string;

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetMerchantStoreForTests();
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

    const merchantResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    merchantId = merchantResponse.body.id;
  });

  it('records and lists merchant documents', async () => {
    const createResponse = await request(app)
      .post(`/merchants/${merchantId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'business_registration',
        fileName: 'business-reg.pdf'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.verified).toBe(false);

    const listResponse = await request(app)
      .get(`/merchants/${merchantId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0].type).toBe('business_registration');
  });

  it('verifies a merchant document', async () => {
    await request(app)
      .post(`/merchants/${merchantId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'owner_identity_document',
        fileName: 'owner-id.pdf'
      });

    const verifyResponse = await request(app)
      .patch(`/merchants/${merchantId}/documents/owner_identity_document/verify`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ verified: true });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.verified).toBe(true);

    const getResponse = await request(app)
      .get(`/merchants/${merchantId}/documents/owner_identity_document`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.verified).toBe(true);
  });

  it('validates KYB document payloads', async () => {
    const response = await request(app)
      .post(`/merchants/${merchantId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'invalid_doc_type',
        fileName: 'x'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

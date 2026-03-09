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

describeHttp('Merchant HTTP API', () => {
  let adminAccessToken: string;
  let operatorAccessToken: string;

  async function addRequiredKybDocuments(merchantId: string): Promise<void> {
    for (const type of [
      'business_registration',
      'owner_identity_document',
      'bank_account_proof'
    ] as const) {
      const createResponse = await request(app)
        .post(`/merchants/${merchantId}/documents`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          type,
          fileName: `${type}.pdf`
        });

      expect(createResponse.status).toBe(201);

      const verifyResponse = await request(app)
        .patch(`/merchants/${merchantId}/documents/${type}/verify`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ verified: true });

      expect(verifyResponse.status).toBe(200);
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
    const standardOperator = await createOrUpdateOperator({
      email: 'operator@example.com',
      passwordHash: await bcrypt.hash('StrongPass123', 10),
      role: 'operator'
    });

    adminAccessToken = issueAccessToken({
      operatorId: operator.id,
      email: operator.email,
      role: operator.role
    });
    operatorAccessToken = issueAccessToken({
      operatorId: standardOperator.id,
      email: standardOperator.email,
      role: standardOperator.role
    });
  });

  it('creates and retrieves a merchant', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
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
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.contactEmail).toBe('owner@atlas.ma');
  });

  it('filters merchants by query params', async () => {
    await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    const createActiveCandidateResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Casa Electronics',
        category: 'Retail',
        city: 'Casablanca',
        contactEmail: 'sales@casa.ma'
      });

    await addRequiredKybDocuments(createActiveCandidateResponse.body.id);
    await request(app)
      .patch(`/merchants/${createActiveCandidateResponse.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        status: 'Active'
      });

    const response = await request(app)
      .get('/merchants')
      .query({ status: 'Active', city: 'Casablanca' })
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe('Casa Electronics');
  });

  it('updates merchant details', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    await addRequiredKybDocuments(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        city: 'Rabat',
        status: 'Active'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.city).toBe('Rabat');
    expect(updateResponse.body.status).toBe('Active');
  });

  it('rejects activation without verified KYB documents', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    const updateResponse = await request(app)
      .patch(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        status: 'Active'
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.code).toBe('KYB_REQUIREMENTS_NOT_MET');
  });

  it('rejects manual status assignment during merchant creation', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma',
        status: 'Active'
      });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.code).toBe('VALIDATION_ERROR');
  });

  it('allows admins to delete merchants', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    const deleteResponse = await request(app)
      .delete(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ deleted: true });
  });

  it('rejects merchant deletion by non-admin operators', async () => {
    const createResponse = await request(app)
      .post('/merchants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Atlas Pharmacy',
        category: 'Pharmacy',
        city: 'Casablanca',
        contactEmail: 'owner@atlas.ma'
      });

    const deleteResponse = await request(app)
      .delete(`/merchants/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${operatorAccessToken}`);

    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.body.code).toBe('ADMIN_REQUIRED');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/merchants');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });
});

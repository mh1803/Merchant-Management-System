process.env.AUTH_STORAGE = 'memory';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { createOrUpdateOperator, resetAuthStoreForTests } from '../src/db/authRepository';
import { resetWebhookStoreForTests } from '../src/db/webhookRepository';
import { resetWebhookSenderForTests } from '../src/services/webhookService';
import { issueAccessToken } from '../src/services/tokenService';

const describeHttp = process.env.RUN_HTTP_TESTS === 'true' ? describe : describe.skip;

describeHttp('Webhook HTTP API', () => {
  let accessToken: string;

  beforeEach(async () => {
    resetAuthStoreForTests();
    resetWebhookStoreForTests();
    resetWebhookSenderForTests();

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

  it('registers a webhook subscription', async () => {
    const response = await request(app)
      .post('/webhooks/subscriptions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        url: 'https://example.com/webhook',
        secret: 'supersecret'
      });

    expect(response.status).toBe(201);
    expect(response.body.url).toBe('https://example.com/webhook');
    expect(response.body.active).toBe(true);
  });
});

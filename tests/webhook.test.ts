process.env.AUTH_STORAGE = 'memory';

import { createOrUpdateOperator } from '../src/db/authRepository';
import { addMerchant, editMerchant } from '../src/services/merchantService';
import {
  listWebhookDeliveriesForTests,
  resetWebhookStoreForTests
} from '../src/db/webhookRepository';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import {
  registerWebhookSubscription,
  resetWebhookSenderForTests,
  setWebhookSenderForTests,
  waitForWebhookJobsForTests
} from '../src/services/webhookService';
import { recordMerchantDocument, verifyMerchantDocument } from '../src/services/kybService';

async function makeMerchantActive(merchantId: string): Promise<void> {
  // Webhook tests reuse the same helper so approval scenarios always satisfy activation rules.
  for (const type of [
    'business_registration',
    'owner_identity_document',
    'bank_account_proof'
  ] as const) {
    await recordMerchantDocument(merchantId, {
      type,
      fileName: `${type}.pdf`
    });
    await verifyMerchantDocument(
      merchantId,
      type,
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
  }
}

describe('Webhook service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
    resetKybStoreForTests();
    resetWebhookStoreForTests();
    resetWebhookSenderForTests();
  });

  it('registers a webhook subscription', async () => {
    const subscription = await registerWebhookSubscription({
      url: 'https://example.com/webhook',
      secret: 'supersecret'
    });

    expect(subscription.url).toBe('https://example.com/webhook');
    expect(subscription.secret).toBe('supersecret');
    expect(subscription.active).toBe(true);
  });

  it('sends approved webhook notifications in the background', async () => {
    const calls: Array<{ headers: Record<string, string>; body: string }> = [];
    setWebhookSenderForTests(async ({ headers, body }) => {
      calls.push({ headers, body });
      return { ok: true, status: 200 };
    });

    const operator = await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: 'hashed',
      role: 'admin'
    });

    await registerWebhookSubscription({
      url: 'https://example.com/webhook',
      secret: 'supersecret'
    });

    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await makeMerchantActive(merchant.id);

    await editMerchant(
      merchant.id,
      { status: 'Active' },
      { operatorId: operator.id, email: operator.email, role: operator.role }
    );

    await waitForWebhookJobsForTests();

    expect(calls).toHaveLength(1);
    expect(calls[0].headers['X-Webhook-Event']).toBe('merchant.approved');
    expect(calls[0].headers['X-Webhook-Signature']).toEqual(expect.any(String));

    const deliveries = await listWebhookDeliveriesForTests();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].attemptCount).toBe(1);
    expect(deliveries[0].deliveredAt).toEqual(expect.any(String));
  });

  it('retries failed webhook deliveries up to three times', async () => {
    let attempts = 0;
    setWebhookSenderForTests(async () => {
      attempts += 1;
      return { ok: false, status: 500, error: 'boom' };
    });

    const operator = await createOrUpdateOperator({
      email: 'admin@example.com',
      passwordHash: 'hashed',
      role: 'admin'
    });

    await registerWebhookSubscription({
      url: 'https://example.com/webhook',
      secret: 'supersecret'
    });

    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await editMerchant(
      merchant.id,
      { status: 'Suspended' },
      { operatorId: operator.id, email: operator.email, role: operator.role }
    );

    await waitForWebhookJobsForTests();

    expect(attempts).toBe(3);

    const deliveries = await listWebhookDeliveriesForTests();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].attemptCount).toBe(3);
    expect(deliveries[0].failedAt).toEqual(expect.any(String));
    expect(deliveries[0].lastError).toBe('boom');
  });
});

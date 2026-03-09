import crypto from 'crypto';
import { AppError } from '../errors';
import {
  createOrUpdateWebhookSubscription,
  createWebhookDelivery,
  listActiveWebhookSubscriptions,
  updateWebhookDeliveryAttempt
} from '../db/webhookRepository';
import {
  MerchantStatusWebhookEvent,
  RegisterWebhookSubscriptionInput
} from '../types/webhook';

interface WebhookSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

type WebhookSender = (input: {
  url: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<WebhookSendResult>;

let webhookSender: WebhookSender = async ({ url, headers, body }) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Webhook request failed'
    };
  }
};

const pendingWebhookJobs = new Set<Promise<void>>();

function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function registerWebhookSubscription(
  input: RegisterWebhookSubscriptionInput
) {
  return createOrUpdateWebhookSubscription(input);
}

async function deliverWebhookToSubscription(input: {
  subscriptionId: string;
  url: string;
  secret: string;
  eventType: string;
  payload: string;
}): Promise<void> {
  const delivery = await createWebhookDelivery({
    subscriptionId: input.subscriptionId,
    eventType: input.eventType,
    payload: input.payload
  });

  // Retries are tracked against a single delivery record so failures remain auditable.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const timestamp = new Date().toISOString();
    const signature = signPayload(input.secret, timestamp, input.payload);
    const result = await webhookSender({
      url: input.url,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': input.eventType,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Signature': signature
      },
      body: input.payload
    });

    const deliveredAt = result.ok ? new Date().toISOString() : null;
    const failedAt = !result.ok && attempt === 3 ? new Date().toISOString() : null;

    await updateWebhookDeliveryAttempt({
      deliveryId: delivery.id,
      attemptCount: attempt,
      lastStatusCode: result.status || null,
      lastError: result.ok ? null : result.error || `HTTP ${result.status}`,
      deliveredAt,
      failedAt
    });

    if (result.ok) {
      return;
    }
  }
}

export async function dispatchMerchantStatusWebhooks(
  event: MerchantStatusWebhookEvent
): Promise<void> {
  // A single status change fans out to every active subscriber using the same payload shape
  // so receivers can build stable integrations around a small event contract.
  const subscriptions = await listActiveWebhookSubscriptions();
  if (subscriptions.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    merchantId: event.merchantId,
    merchantName: event.merchantName,
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    changedAt: event.changedAt
  });

  await Promise.all(
    subscriptions.map((subscription) =>
      deliverWebhookToSubscription({
        subscriptionId: subscription.id,
        url: subscription.url,
        secret: subscription.secret,
        eventType: event.eventType,
        payload
      })
    )
  );
}

export function queueMerchantStatusWebhookDispatch(event: MerchantStatusWebhookEvent): void {
  // Dispatch is detached from the request/response cycle to avoid blocking merchant updates.
  const job = Promise.resolve()
    .then(async () => {
      await dispatchMerchantStatusWebhooks(event);
    })
    .catch(() => {
      // Delivery failures are tracked per webhook attempt and must not crash the request path.
    })
    .finally(() => {
      pendingWebhookJobs.delete(job);
    });

  pendingWebhookJobs.add(job);
}

export function setWebhookSenderForTests(sender: WebhookSender): void {
  webhookSender = sender;
}

export function resetWebhookSenderForTests(): void {
  webhookSender = async ({ url, headers, body }) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      return {
        ok: response.ok,
        status: response.status
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Webhook request failed'
      };
    }
  };
}

export async function waitForWebhookJobsForTests(): Promise<void> {
  await Promise.all(Array.from(pendingWebhookJobs));
}

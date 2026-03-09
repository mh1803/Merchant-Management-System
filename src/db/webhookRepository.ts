import crypto from 'crypto';
import { pool } from './index';
import {
  RegisterWebhookSubscriptionInput,
  WebhookDeliveryRecord,
  WebhookSubscriptionRecord
} from '../types/webhook';

interface WebhookSubscriptionRow {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookDeliveryRow {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: string;
  attempt_count: number;
  last_status_code: number | null;
  last_error: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

const memoryState = {
  subscriptionsById: new Map<string, WebhookSubscriptionRecord>(),
  deliveriesById: new Map<string, WebhookDeliveryRecord>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapSubscriptionFromDb(row?: WebhookSubscriptionRow): WebhookSubscriptionRecord | null {
  if (!row) {
    return null;
  }

  // Mapping keeps repository callers decoupled from SQL column naming and timestamp field names.
  return {
    id: row.id,
    url: row.url,
    secret: row.secret,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDeliveryFromDb(row?: WebhookDeliveryRow): WebhookDeliveryRecord | null {
  if (!row) {
    return null;
  }

  // Delivery rows are converted once here so retry logic can work with a clean domain shape.
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: row.attempt_count,
    lastStatusCode: row.last_status_code,
    lastError: row.last_error,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createOrUpdateWebhookSubscription(
  input: RegisterWebhookSubscriptionInput
): Promise<WebhookSubscriptionRecord> {
  const now = new Date().toISOString();

  if (storageMode() === 'memory') {
    const existing = Array.from(memoryState.subscriptionsById.values()).find(
      (subscription) => subscription.url === input.url
    );
    const next: WebhookSubscriptionRecord = {
      id: existing?.id || crypto.randomUUID(),
      url: input.url,
      secret: input.secret,
      active: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    memoryState.subscriptionsById.set(next.id, next);
    return { ...next };
  }

  const { rows } = await pool.query<WebhookSubscriptionRow>(
    `INSERT INTO webhook_subscriptions (id, url, secret, active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (url)
     DO UPDATE SET
       secret = EXCLUDED.secret,
       active = TRUE,
       updated_at = NOW()
     RETURNING id, url, secret, active, created_at, updated_at`,
    [crypto.randomUUID(), input.url, input.secret]
  );

  const subscription = mapSubscriptionFromDb(rows[0]);
  if (!subscription) {
    throw new Error('Failed to save webhook subscription');
  }

  return subscription;
}

export async function listActiveWebhookSubscriptions(): Promise<WebhookSubscriptionRecord[]> {
  if (storageMode() === 'memory') {
    return Array.from(memoryState.subscriptionsById.values())
      .filter((subscription) => subscription.active)
      .map((subscription) => ({ ...subscription }));
  }

  const { rows } = await pool.query<WebhookSubscriptionRow>(
    `SELECT id, url, secret, active, created_at, updated_at
     FROM webhook_subscriptions
     WHERE active = TRUE
     ORDER BY created_at ASC`
  );

  return rows.map((row) => mapSubscriptionFromDb(row) as WebhookSubscriptionRecord);
}

export async function createWebhookDelivery(input: {
  subscriptionId: string;
  eventType: string;
  payload: string;
}): Promise<WebhookDeliveryRecord> {
  const now = new Date().toISOString();
  const delivery: WebhookDeliveryRecord = {
    id: crypto.randomUUID(),
    subscriptionId: input.subscriptionId,
    eventType: input.eventType,
    payload: input.payload,
    attemptCount: 0,
    lastStatusCode: null,
    lastError: null,
    deliveredAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now
  };

  if (storageMode() === 'memory') {
    memoryState.deliveriesById.set(delivery.id, delivery);
    return { ...delivery };
  }

  // Deliveries are persisted before any outbound attempt so retry state and failures are visible.
  const { rows } = await pool.query<WebhookDeliveryRow>(
    `INSERT INTO webhook_deliveries (
       id,
       subscription_id,
       event_type,
       payload,
       attempt_count,
       last_status_code,
       last_error,
       delivered_at,
       failed_at
     )
     VALUES ($1, $2, $3, $4::jsonb, 0, NULL, NULL, NULL, NULL)

     RETURNING
       id,
       subscription_id,
       event_type,
       payload,
       attempt_count,
       last_status_code,
       last_error,
       delivered_at,
       failed_at,
       created_at,
       updated_at`,
    [delivery.id, delivery.subscriptionId, delivery.eventType, delivery.payload]
  );

  const created = mapDeliveryFromDb(rows[0]);
  if (!created) {
    throw new Error('Failed to create webhook delivery');
  }

  return created;
}

export async function updateWebhookDeliveryAttempt(input: {
  deliveryId: string;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
}): Promise<void> {
  if (storageMode() === 'memory') {
    const current = memoryState.deliveriesById.get(input.deliveryId);
    if (!current) {
      return;
    }

    memoryState.deliveriesById.set(input.deliveryId, {
      ...current,
      attemptCount: input.attemptCount,
      lastStatusCode: input.lastStatusCode,
      lastError: input.lastError,
      deliveredAt: input.deliveredAt,
      failedAt: input.failedAt,
      updatedAt: new Date().toISOString()
    });
    return;
  }

  // Each attempt overwrites the latest delivery state so the record reflects the current retry status.
  await pool.query(
    `UPDATE webhook_deliveries
     SET attempt_count = $2,
         last_status_code = $3,
         last_error = $4,
         delivered_at = $5,
         failed_at = $6,
         updated_at = NOW()
     WHERE id = $1`,
    [
      input.deliveryId,
      input.attemptCount,
      input.lastStatusCode,
      input.lastError,
      input.deliveredAt,
      input.failedAt
    ]
  );
}

export async function listWebhookDeliveriesForTests(): Promise<WebhookDeliveryRecord[]> {
  if (storageMode() === 'memory') {
    return Array.from(memoryState.deliveriesById.values()).map((delivery) => ({ ...delivery }));
  }

  const { rows } = await pool.query<WebhookDeliveryRow>(
    `SELECT
       id,
       subscription_id,
       event_type,
       payload,
       attempt_count,
       last_status_code,
       last_error,
       delivered_at,
       failed_at,
       created_at,
       updated_at
     FROM webhook_deliveries
     ORDER BY created_at ASC`
  );

  return rows.map((row) => mapDeliveryFromDb(row) as WebhookDeliveryRecord);
}

export function resetWebhookStoreForTests(): void {
  memoryState.subscriptionsById.clear();
  memoryState.deliveriesById.clear();
}

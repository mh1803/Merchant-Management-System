import { MerchantStatus } from './merchant';

export interface WebhookSubscriptionRecord {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: string;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterWebhookSubscriptionInput {
  url: string;
  secret: string;
}

export interface MerchantStatusWebhookEvent {
  eventType: 'merchant.approved' | 'merchant.suspended';
  merchantId: string;
  merchantName: string;
  previousStatus: MerchantStatus;
  newStatus: MerchantStatus;
  changedAt: string;
}

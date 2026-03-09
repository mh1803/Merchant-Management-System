import { AppError } from '../errors';
import { createMerchantStatusHistoryEntry } from '../db/historyRepository';
import {
  createMerchant,
  getMerchantById,
  listMerchants,
  updateMerchant
} from '../db/merchantRepository';
import { StatusChangeActor } from '../types/history';
import { queueMerchantStatusWebhookDispatch } from './webhookService';
import {
  CreateMerchantInput,
  MerchantFilters,
  MerchantRecord,
  UpdateMerchantInput
} from '../types/merchant';

export async function addMerchant(input: CreateMerchantInput): Promise<MerchantRecord> {
  return createMerchant(input);
}

export async function getMerchantDetails(merchantId: string): Promise<MerchantRecord> {
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return merchant;
}

export async function searchMerchants(filters: MerchantFilters): Promise<MerchantRecord[]> {
  return listMerchants(filters);
}

export async function editMerchant(
  merchantId: string,
  input: UpdateMerchantInput,
  actor?: StatusChangeActor
): Promise<MerchantRecord> {
  const current = await getMerchantById(merchantId);
  if (!current) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  const statusWillChange = typeof input.status !== 'undefined' && input.status !== current.status;
  if (statusWillChange && !actor) {
    throw new AppError(
      400,
      'Status changes must include the acting operator',
      'STATUS_CHANGE_ACTOR_REQUIRED'
    );
  }

  const merchant = await updateMerchant(merchantId, input);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (statusWillChange && actor) {
    const changedAt = new Date().toISOString();

    await createMerchantStatusHistoryEntry({
      merchantId,
      previousValue: current.status,
      newValue: merchant.status,
      changedByOperatorId: actor.operatorId,
      changedByEmail: actor.email
    });

    if (merchant.status === 'Active' || merchant.status === 'Suspended') {
      queueMerchantStatusWebhookDispatch({
        eventType: merchant.status === 'Active' ? 'merchant.approved' : 'merchant.suspended',
        merchantId,
        merchantName: merchant.name,
        previousStatus: current.status,
        newStatus: merchant.status,
        changedAt
      });
    }
  }

  return merchant;
}

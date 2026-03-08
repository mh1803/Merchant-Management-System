import { AppError } from '../errors';
import {
  createMerchant,
  getMerchantById,
  listMerchants,
  updateMerchant
} from '../db/merchantRepository';
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
  input: UpdateMerchantInput
): Promise<MerchantRecord> {
  const merchant = await updateMerchant(merchantId, input);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return merchant;
}

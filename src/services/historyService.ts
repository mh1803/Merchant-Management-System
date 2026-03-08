import { AppError } from '../errors';
import { getMerchantById } from '../db/merchantRepository';
import { listMerchantStatusHistory } from '../db/historyRepository';
import { MerchantStatusHistoryRecord } from '../types/history';

export async function getMerchantHistory(
  merchantId: string
): Promise<MerchantStatusHistoryRecord[]> {
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return listMerchantStatusHistory(merchantId);
}

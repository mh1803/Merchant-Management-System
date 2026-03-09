import { AppError } from '../errors';
import { getMerchantById } from '../db/merchantRepository';
import { listMerchantStatusHistory } from '../db/historyRepository';
import { MerchantHistoryRecord } from '../types/history';

export async function getMerchantHistory(
  merchantId: string
): Promise<MerchantHistoryRecord[]> {
  // History reads are only valid for real merchants; missing parents should not look like empty history.
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return listMerchantStatusHistory(merchantId);
}

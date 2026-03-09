import { MerchantPricingTier, MerchantStatus } from './merchant';

export type MerchantHistoryFieldName = 'status' | 'pricingTier';

export interface MerchantHistoryRecord {
  id: string;
  merchantId: string;
  fieldName: MerchantHistoryFieldName;
  previousValue: MerchantStatus | MerchantPricingTier;
  newValue: MerchantStatus | MerchantPricingTier;
  changedByOperatorId: string;
  changedByEmail: string;
  changedAt: string;
}

export interface StatusChangeActor {
  operatorId: string;
  email: string;
  role: 'admin' | 'operator';
}

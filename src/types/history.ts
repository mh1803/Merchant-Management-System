import { MerchantStatus } from './merchant';

export interface MerchantStatusHistoryRecord {
  id: string;
  merchantId: string;
  fieldName: 'status';
  previousValue: MerchantStatus;
  newValue: MerchantStatus;
  changedByOperatorId: string;
  changedByEmail: string;
  changedAt: string;
}

export interface StatusChangeActor {
  operatorId: string;
  email: string;
}

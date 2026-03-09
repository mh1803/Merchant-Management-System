export type MerchantDocumentType =
  | 'business_registration'
  | 'owner_identity_document'
  | 'bank_account_proof';

export interface MerchantDocumentRecord {
  id: string;
  merchantId: string;
  type: MerchantDocumentType;
  fileName: string;
  verified: boolean;
  uploadedAt: string;
  verifiedAt: string | null;
}

export interface RecordMerchantDocumentInput {
  type: MerchantDocumentType;
  fileName: string;
}

export interface VerifyMerchantDocumentInput {
  verified: boolean;
}

export interface MerchantDocumentVerificationHistoryRecord {
  id: string;
  merchantId: string;
  documentType: MerchantDocumentType;
  previousVerified: boolean;
  newVerified: boolean;
  changedByOperatorId: string;
  changedByEmail: string;
  changedAt: string;
}

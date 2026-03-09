import { AppError } from '../errors';
import { getMerchantById } from '../db/merchantRepository';
import {
  getMerchantDocument,
  listMerchantDocuments,
  setMerchantDocumentVerification,
  upsertMerchantDocument
} from '../db/kybRepository';
import {
  MerchantDocumentRecord,
  MerchantDocumentType,
  RecordMerchantDocumentInput,
  VerifyMerchantDocumentInput
} from '../types/kyb';

async function assertMerchantExists(merchantId: string): Promise<void> {
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }
}

export async function recordMerchantDocument(
  merchantId: string,
  input: RecordMerchantDocumentInput
): Promise<MerchantDocumentRecord> {
  await assertMerchantExists(merchantId);
  // Upload and verification are separate steps so operators explicitly approve each document.
  return upsertMerchantDocument({
    merchantId,
    type: input.type,
    fileName: input.fileName
  });
}

export async function getMerchantDocuments(
  merchantId: string
): Promise<MerchantDocumentRecord[]> {
  await assertMerchantExists(merchantId);
  return listMerchantDocuments(merchantId);
}

export async function getMerchantDocumentDetails(
  merchantId: string,
  type: MerchantDocumentType
): Promise<MerchantDocumentRecord> {
  await assertMerchantExists(merchantId);
  const document = await getMerchantDocument(merchantId, type);
  if (!document) {
    throw new AppError(404, 'Merchant document not found', 'MERCHANT_DOCUMENT_NOT_FOUND');
  }

  return document;
}

export async function verifyMerchantDocument(
  merchantId: string,
  type: MerchantDocumentType,
  input: VerifyMerchantDocumentInput
): Promise<MerchantDocumentRecord> {
  await assertMerchantExists(merchantId);
  const document = await setMerchantDocumentVerification({
    merchantId,
    type,
    verified: input.verified
  });

  if (!document) {
    throw new AppError(404, 'Merchant document not found', 'MERCHANT_DOCUMENT_NOT_FOUND');
  }

  return document;
}

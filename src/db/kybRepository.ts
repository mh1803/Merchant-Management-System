import crypto from 'crypto';
import { pool } from './index';
import {
  MerchantDocumentRecord,
  MerchantDocumentType
} from '../types/kyb';

interface MerchantDocumentRow {
  id: string;
  merchant_id: string;
  type: MerchantDocumentType;
  file_name: string;
  verified: boolean;
  uploaded_at: string;
  verified_at: string | null;
}

const memoryState = {
  documentsByMerchantId: new Map<string, Map<MerchantDocumentType, MerchantDocumentRecord>>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapDocumentFromDb(row?: MerchantDocumentRow): MerchantDocumentRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    merchantId: row.merchant_id,
    type: row.type,
    fileName: row.file_name,
    verified: row.verified,
    uploadedAt: row.uploaded_at,
    verifiedAt: row.verified_at
  };
}

export async function upsertMerchantDocument(input: {
  merchantId: string;
  type: MerchantDocumentType;
  fileName: string;
}): Promise<MerchantDocumentRecord> {
  const now = new Date().toISOString();

  if (storageMode() === 'memory') {
    const documents = memoryState.documentsByMerchantId.get(input.merchantId) || new Map();
    const current = documents.get(input.type);
    const next: MerchantDocumentRecord = {
      id: current?.id || crypto.randomUUID(),
      merchantId: input.merchantId,
      type: input.type,
      fileName: input.fileName,
      verified: false,
      uploadedAt: now,
      verifiedAt: null
    };

    documents.set(input.type, next);
    memoryState.documentsByMerchantId.set(input.merchantId, documents);
    return { ...next };
  }

  const { rows } = await pool.query<MerchantDocumentRow>(
    `INSERT INTO merchant_documents (id, merchant_id, type, file_name, verified, uploaded_at, verified_at)
     VALUES ($1, $2, $3, $4, FALSE, NOW(), NULL)
     ON CONFLICT (merchant_id, type)
     DO UPDATE SET
       file_name = EXCLUDED.file_name,
       verified = FALSE,
       uploaded_at = NOW(),
       verified_at = NULL
     RETURNING id, merchant_id, type, file_name, verified, uploaded_at, verified_at`,
    [crypto.randomUUID(), input.merchantId, input.type, input.fileName]
  );

  const document = mapDocumentFromDb(rows[0]);
  if (!document) {
    throw new Error('Failed to save merchant document');
  }

  return document;
}

export async function getMerchantDocument(
  merchantId: string,
  type: MerchantDocumentType
): Promise<MerchantDocumentRecord | null> {
  if (storageMode() === 'memory') {
    const documents = memoryState.documentsByMerchantId.get(merchantId);
    const document = documents?.get(type);
    return document ? { ...document } : null;
  }

  const { rows } = await pool.query<MerchantDocumentRow>(
    `SELECT id, merchant_id, type, file_name, verified, uploaded_at, verified_at
     FROM merchant_documents
     WHERE merchant_id = $1 AND type = $2
     LIMIT 1`,
    [merchantId, type]
  );

  return mapDocumentFromDb(rows[0]);
}

export async function listMerchantDocuments(
  merchantId: string
): Promise<MerchantDocumentRecord[]> {
  if (storageMode() === 'memory') {
    const documents = memoryState.documentsByMerchantId.get(merchantId);
    return Array.from(documents?.values() || [])
      .sort((left, right) => left.type.localeCompare(right.type))
      .map((document) => ({ ...document }));
  }

  const { rows } = await pool.query<MerchantDocumentRow>(
    `SELECT id, merchant_id, type, file_name, verified, uploaded_at, verified_at
     FROM merchant_documents
     WHERE merchant_id = $1
     ORDER BY type ASC`,
    [merchantId]
  );

  return rows.map((row) => mapDocumentFromDb(row) as MerchantDocumentRecord);
}

export async function setMerchantDocumentVerification(input: {
  merchantId: string;
  type: MerchantDocumentType;
  verified: boolean;
}): Promise<MerchantDocumentRecord | null> {
  if (storageMode() === 'memory') {
    const documents = memoryState.documentsByMerchantId.get(input.merchantId);
    const current = documents?.get(input.type);
    if (!current) {
      return null;
    }

    const next: MerchantDocumentRecord = {
      ...current,
      verified: input.verified,
      verifiedAt: input.verified ? new Date().toISOString() : null
    };

    documents?.set(input.type, next);
    return { ...next };
  }

  const { rows } = await pool.query<MerchantDocumentRow>(
    `UPDATE merchant_documents
     SET verified = $3,
         verified_at = CASE WHEN $3 THEN NOW() ELSE NULL END
     WHERE merchant_id = $1 AND type = $2
     RETURNING id, merchant_id, type, file_name, verified, uploaded_at, verified_at`,
    [input.merchantId, input.type, input.verified]
  );

  return mapDocumentFromDb(rows[0]);
}

export function resetKybStoreForTests(): void {
  memoryState.documentsByMerchantId.clear();
}

import crypto from 'crypto';
import { pool } from './index';
import {
  MerchantDocumentType,
  MerchantDocumentVerificationHistoryRecord
} from '../types/kyb';

interface MerchantDocumentVerificationHistoryRow {
  id: string;
  merchant_id: string;
  document_type: MerchantDocumentType;
  previous_verified: boolean;
  new_verified: boolean;
  changed_by_operator_id: string;
  changed_by_email: string;
  changed_at: string;
}

const memoryState = {
  historyByMerchantId: new Map<string, MerchantDocumentVerificationHistoryRecord[]>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapVerificationHistoryFromDb(
  row?: MerchantDocumentVerificationHistoryRow
): MerchantDocumentVerificationHistoryRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    merchantId: row.merchant_id,
    documentType: row.document_type,
    previousVerified: row.previous_verified,
    newVerified: row.new_verified,
    changedByOperatorId: row.changed_by_operator_id,
    changedByEmail: row.changed_by_email,
    changedAt: row.changed_at
  };
}

export async function createMerchantDocumentVerificationHistoryEntry(input: {
  merchantId: string;
  documentType: MerchantDocumentType;
  previousVerified: boolean;
  newVerified: boolean;
  changedByOperatorId: string;
  changedByEmail: string;
}): Promise<MerchantDocumentVerificationHistoryRecord> {
  const entry: MerchantDocumentVerificationHistoryRecord = {
    id: crypto.randomUUID(),
    merchantId: input.merchantId,
    documentType: input.documentType,
    previousVerified: input.previousVerified,
    newVerified: input.newVerified,
    changedByOperatorId: input.changedByOperatorId,
    changedByEmail: input.changedByEmail,
    changedAt: new Date().toISOString()
  };

  if (storageMode() === 'memory') {
    const current = memoryState.historyByMerchantId.get(input.merchantId) || [];
    current.push(entry);
    memoryState.historyByMerchantId.set(input.merchantId, current);
    return { ...entry };
  }

  const { rows } = await pool.query<MerchantDocumentVerificationHistoryRow>(
    `INSERT INTO merchant_document_verification_history (
       id,
       merchant_id,
       document_type,
       previous_verified,
       new_verified,
       changed_by_operator_id,
       changed_by_email
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id,
       merchant_id,
       document_type,
       previous_verified,
       new_verified,
       changed_by_operator_id,
       changed_by_email,
       changed_at`,
    [
      entry.id,
      entry.merchantId,
      entry.documentType,
      entry.previousVerified,
      entry.newVerified,
      entry.changedByOperatorId,
      entry.changedByEmail
    ]
  );

  const created = mapVerificationHistoryFromDb(rows[0]);
  if (!created) {
    throw new Error('Failed to create merchant document verification history');
  }

  return created;
}

export async function listMerchantDocumentVerificationHistory(
  merchantId: string,
  documentType?: MerchantDocumentType
): Promise<MerchantDocumentVerificationHistoryRecord[]> {
  if (storageMode() === 'memory') {
    const items = memoryState.historyByMerchantId.get(merchantId) || [];
    return items
      .filter((item) => !documentType || item.documentType === documentType)
      .map((item) => ({ ...item }));
  }

  const values: string[] = [merchantId];
  let whereSql = 'merchant_id = $1';

  if (documentType) {
    values.push(documentType);
    whereSql += ` AND document_type = $${values.length}`;
  }

  const { rows } = await pool.query<MerchantDocumentVerificationHistoryRow>(
    `SELECT
       id,
       merchant_id,
       document_type,
       previous_verified,
       new_verified,
       changed_by_operator_id,
       changed_by_email,
       changed_at
     FROM merchant_document_verification_history
     WHERE ${whereSql}
     ORDER BY changed_at ASC`,
    values
  );

  return rows.map((row) => mapVerificationHistoryFromDb(row) as MerchantDocumentVerificationHistoryRecord);
}

export async function deleteMerchantDocumentVerificationHistory(
  merchantId: string
): Promise<void> {
  if (storageMode() === 'memory') {
    memoryState.historyByMerchantId.delete(merchantId);
    return;
  }

  await pool.query('DELETE FROM merchant_document_verification_history WHERE merchant_id = $1', [
    merchantId
  ]);
}

export function resetKybHistoryStoreForTests(): void {
  memoryState.historyByMerchantId.clear();
}

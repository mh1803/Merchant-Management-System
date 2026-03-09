import crypto from 'crypto';
import { pool } from './index';
import { MerchantHistoryFieldName, MerchantHistoryRecord } from '../types/history';
import { MerchantPricingTier, MerchantStatus } from '../types/merchant';

interface MerchantStatusHistoryRow {
  id: string;
  merchant_id: string;
  field_name: MerchantHistoryFieldName;
  previous_value: MerchantStatus | MerchantPricingTier;
  new_value: MerchantStatus | MerchantPricingTier;
  changed_by_operator_id: string;
  changed_by_email: string;
  changed_at: string;
}

const memoryState = {
  historyByMerchantId: new Map<string, MerchantHistoryRecord[]>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapHistoryFromDb(row?: MerchantStatusHistoryRow): MerchantHistoryRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    merchantId: row.merchant_id,
    fieldName: row.field_name,
    previousValue: row.previous_value,
    newValue: row.new_value,
    changedByOperatorId: row.changed_by_operator_id,
    changedByEmail: row.changed_by_email,
    changedAt: row.changed_at
  };
}

export async function createMerchantHistoryEntry(input: {
  merchantId: string;
  fieldName: MerchantHistoryFieldName;
  previousValue: MerchantStatus | MerchantPricingTier;
  newValue: MerchantStatus | MerchantPricingTier;
  changedByOperatorId: string;
  changedByEmail: string;
}): Promise<MerchantHistoryRecord> {
  const entry: MerchantHistoryRecord = {
    id: crypto.randomUUID(),
    merchantId: input.merchantId,
    fieldName: input.fieldName,
    previousValue: input.previousValue,
    newValue: input.newValue,
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

  const { rows } = await pool.query<MerchantStatusHistoryRow>(
    `INSERT INTO merchant_status_history (
       id,
       merchant_id,
       field_name,
       previous_value,
       new_value,
       changed_by_operator_id,
       changed_by_email
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id,
       merchant_id,
       field_name,
       previous_value,
       new_value,
       changed_by_operator_id,
       changed_by_email,
       changed_at`,
    [
      entry.id,
      input.merchantId,
      input.fieldName,
      input.previousValue,
      input.newValue,
      input.changedByOperatorId,
      input.changedByEmail
    ]
  );

  const created = mapHistoryFromDb(rows[0]);
  if (!created) {
    throw new Error('Failed to create merchant status history');
  }

  return created;
}

export async function listMerchantStatusHistory(
  merchantId: string
): Promise<MerchantHistoryRecord[]> {
  if (storageMode() === 'memory') {
    const items: MerchantHistoryRecord[] = memoryState.historyByMerchantId.get(merchantId) || [];
    return items.map((item) => ({ ...item }));
  }

  const { rows } = await pool.query<MerchantStatusHistoryRow>(
    `SELECT
       id,
       merchant_id,
       field_name,
       previous_value,
       new_value,
       changed_by_operator_id,
       changed_by_email,
       changed_at
     FROM merchant_status_history
     WHERE merchant_id = $1
     ORDER BY changed_at ASC`,
    [merchantId]
  );

  return rows.map((row) => mapHistoryFromDb(row) as MerchantHistoryRecord);
}

export async function deleteMerchantHistoryEntries(merchantId: string): Promise<void> {
  if (storageMode() === 'memory') {
    memoryState.historyByMerchantId.delete(merchantId);
    return;
  }

  await pool.query('DELETE FROM merchant_status_history WHERE merchant_id = $1', [merchantId]);
}

export function resetHistoryStoreForTests(): void {
  memoryState.historyByMerchantId.clear();
}

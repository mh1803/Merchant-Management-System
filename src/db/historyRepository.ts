import crypto from 'crypto';
import { pool } from './index';
import { MerchantStatusHistoryRecord } from '../types/history';
import { MerchantStatus } from '../types/merchant';

interface MerchantStatusHistoryRow {
  id: string;
  merchant_id: string;
  field_name: 'status';
  previous_value: MerchantStatus;
  new_value: MerchantStatus;
  changed_by_operator_id: string;
  changed_by_email: string;
  changed_at: string;
}

const memoryState = {
  historyByMerchantId: new Map<string, MerchantStatusHistoryRecord[]>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapHistoryFromDb(row?: MerchantStatusHistoryRow): MerchantStatusHistoryRecord | null {
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

export async function createMerchantStatusHistoryEntry(input: {
  merchantId: string;
  previousValue: MerchantStatus;
  newValue: MerchantStatus;
  changedByOperatorId: string;
  changedByEmail: string;
}): Promise<MerchantStatusHistoryRecord> {
  const entry: MerchantStatusHistoryRecord = {
    id: crypto.randomUUID(),
    merchantId: input.merchantId,
    fieldName: 'status',
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
     VALUES ($1, $2, 'status', $3, $4, $5, $6)
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
): Promise<MerchantStatusHistoryRecord[]> {
  if (storageMode() === 'memory') {
    const items = memoryState.historyByMerchantId.get(merchantId) || [];
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

  return rows.map((row) => mapHistoryFromDb(row) as MerchantStatusHistoryRecord);
}

export function resetHistoryStoreForTests(): void {
  memoryState.historyByMerchantId.clear();
}

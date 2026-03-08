import crypto from 'crypto';
import { pool } from './index';
import {
  CreateMerchantInput,
  MerchantFilters,
  MerchantRecord,
  MerchantStatus,
  UpdateMerchantInput
} from '../types/merchant';

interface MerchantRow {
  id: string;
  name: string;
  category: string;
  city: string;
  contact_email: string;
  status: MerchantStatus;
  created_at: string;
  updated_at: string;
}

const memoryState = {
  merchantsById: new Map<string, MerchantRecord>()
};

function storageMode(): string {
  return process.env.AUTH_STORAGE || 'postgres';
}

function mapMerchantFromDb(row?: MerchantRow): MerchantRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    contactEmail: row.contact_email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function createMerchant(input: CreateMerchantInput): Promise<MerchantRecord> {
  const merchantId = crypto.randomUUID();
  const now = new Date().toISOString();
  const merchant: MerchantRecord = {
    id: merchantId,
    name: input.name,
    category: input.category,
    city: input.city,
    contactEmail: input.contactEmail.toLowerCase(),
    status: input.status || 'Pending KYB',
    createdAt: now,
    updatedAt: now
  };

  if (storageMode() === 'memory') {
    memoryState.merchantsById.set(merchantId, merchant);
    return { ...merchant };
  }

  const { rows } = await pool.query<MerchantRow>(
    `INSERT INTO merchants (id, name, category, city, contact_email, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, category, city, contact_email, status, created_at, updated_at`,
    [merchant.id, merchant.name, merchant.category, merchant.city, merchant.contactEmail, merchant.status]
  );

  const created = mapMerchantFromDb(rows[0]);
  if (!created) {
    throw new Error('Failed to create merchant');
  }

  return created;
}

export async function getMerchantById(merchantId: string): Promise<MerchantRecord | null> {
  if (storageMode() === 'memory') {
    const merchant = memoryState.merchantsById.get(merchantId);
    return merchant ? { ...merchant } : null;
  }

  const { rows } = await pool.query<MerchantRow>(
    `SELECT id, name, category, city, contact_email, status, created_at, updated_at
     FROM merchants
     WHERE id = $1
     LIMIT 1`,
    [merchantId]
  );

  return mapMerchantFromDb(rows[0]);
}

export async function listMerchants(filters: MerchantFilters): Promise<MerchantRecord[]> {
  if (storageMode() === 'memory') {
    const normalizedFilters: MerchantFilters = {
      status: filters.status,
      city: normalizeFilter(filters.city)?.toLowerCase(),
      category: normalizeFilter(filters.category)?.toLowerCase(),
      q: normalizeFilter(filters.q)?.toLowerCase()
    };

    return Array.from(memoryState.merchantsById.values())
      .filter((merchant) => {
        if (normalizedFilters.status && merchant.status !== normalizedFilters.status) {
          return false;
        }

        if (normalizedFilters.city && merchant.city.toLowerCase() !== normalizedFilters.city) {
          return false;
        }

        if (
          normalizedFilters.category &&
          merchant.category.toLowerCase() !== normalizedFilters.category
        ) {
          return false;
        }

        if (normalizedFilters.q) {
          const haystack = [
            merchant.name,
            merchant.category,
            merchant.city,
            merchant.contactEmail
          ]
            .join(' ')
            .toLowerCase();

          if (!haystack.includes(normalizedFilters.q)) {
            return false;
          }
        }

        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((merchant) => ({ ...merchant }));
  }

  const values: string[] = [];
  const whereClauses: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    whereClauses.push(`status = $${values.length}`);
  }

  if (filters.city) {
    values.push(filters.city);
    whereClauses.push(`LOWER(city) = LOWER($${values.length})`);
  }

  if (filters.category) {
    values.push(filters.category);
    whereClauses.push(`LOWER(category) = LOWER($${values.length})`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    whereClauses.push(
      `(name ILIKE $${values.length} OR category ILIKE $${values.length} OR city ILIKE $${values.length} OR contact_email ILIKE $${values.length})`
    );
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const { rows } = await pool.query<MerchantRow>(
    `SELECT id, name, category, city, contact_email, status, created_at, updated_at
     FROM merchants
     ${whereSql}
     ORDER BY name ASC`,
    values
  );

  return rows.map((row) => mapMerchantFromDb(row) as MerchantRecord);
}

export async function updateMerchant(
  merchantId: string,
  input: UpdateMerchantInput
): Promise<MerchantRecord | null> {
  if (storageMode() === 'memory') {
    const current = memoryState.merchantsById.get(merchantId);
    if (!current) {
      return null;
    }

    const next: MerchantRecord = {
      ...current,
      name: input.name ?? current.name,
      category: input.category ?? current.category,
      city: input.city ?? current.city,
      contactEmail: input.contactEmail?.toLowerCase() ?? current.contactEmail,
      status: input.status ?? current.status,
      updatedAt: new Date().toISOString()
    };

    memoryState.merchantsById.set(merchantId, next);
    return { ...next };
  }

  const current = await getMerchantById(merchantId);
  if (!current) {
    return null;
  }

  const next = {
    name: input.name ?? current.name,
    category: input.category ?? current.category,
    city: input.city ?? current.city,
    contactEmail: input.contactEmail?.toLowerCase() ?? current.contactEmail,
    status: input.status ?? current.status
  };

  const { rows } = await pool.query<MerchantRow>(
    `UPDATE merchants
     SET name = $2,
         category = $3,
         city = $4,
         contact_email = $5,
         status = $6,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, category, city, contact_email, status, created_at, updated_at`,
    [merchantId, next.name, next.category, next.city, next.contactEmail, next.status]
  );

  return mapMerchantFromDb(rows[0]);
}

export function resetMerchantStoreForTests(): void {
  memoryState.merchantsById.clear();
}

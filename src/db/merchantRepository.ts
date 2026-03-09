import crypto from 'crypto';
import { pool } from './index';
import {
  CreateMerchantInput,
  MerchantFilters,
  MerchantPricingTier,
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
  pricing_tier: MerchantPricingTier;
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
    pricingTier: row.pricing_tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function createMerchant(input: CreateMerchantInput): Promise<MerchantRecord> {
  // Merchant creation sets the authoritative defaults here so callers cannot bypass
  // initial lifecycle state or pricing-tier assumptions.
  const merchantId = crypto.randomUUID();
  const now = new Date().toISOString();
  const merchant: MerchantRecord = {
    id: merchantId,
    name: input.name,
    category: input.category,
    city: input.city,
    contactEmail: input.contactEmail.toLowerCase(),
    status: 'Pending KYB',
    pricingTier: input.pricingTier || 'standard',
    createdAt: now,
    updatedAt: now
  };

  if (storageMode() === 'memory') {
    memoryState.merchantsById.set(merchantId, merchant);
    return { ...merchant };
  }

  const { rows } = await pool.query<MerchantRow>(
    `INSERT INTO merchants (id, name, category, city, contact_email, status, pricing_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, category, city, contact_email, status, pricing_tier, created_at, updated_at`,
    [
      merchant.id,
      merchant.name,
      merchant.category,
      merchant.city,
      merchant.contactEmail,
      merchant.status,
      merchant.pricingTier
    ]
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
    `SELECT id, name, category, city, contact_email, status, pricing_tier, created_at, updated_at
     FROM merchants
     WHERE id = $1
     LIMIT 1`,
    [merchantId]
  );

  return mapMerchantFromDb(rows[0]);
}

export async function listMerchants(filters: MerchantFilters): Promise<MerchantRecord[]> {
  if (storageMode() === 'memory') {
    // The in-memory branch mirrors the SQL filter semantics used in production queries.
    const normalizedFilters: MerchantFilters = {
      status: filters.status,
      city: normalizeFilter(filters.city)?.toLowerCase(),
      category: normalizeFilter(filters.category)?.toLowerCase(),
      pricingTier: filters.pricingTier,
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

        if (normalizedFilters.pricingTier && merchant.pricingTier !== normalizedFilters.pricingTier) {
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

  if (filters.pricingTier) {
    values.push(filters.pricingTier);
    whereClauses.push(`pricing_tier = $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    whereClauses.push(
      `(name ILIKE $${values.length} OR category ILIKE $${values.length} OR city ILIKE $${values.length} OR contact_email ILIKE $${values.length})`
    );
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  // SQL is assembled incrementally to support optional filters without duplicating query text.
  const { rows } = await pool.query<MerchantRow>(
    `SELECT id, name, category, city, contact_email, status, pricing_tier, created_at, updated_at
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
  // Repository updates merge partial input onto the existing record so service-layer
  // validation can stay focused on business rules instead of persistence details.
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
      pricingTier: current.pricingTier,
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
    status: input.status ?? current.status,
    pricingTier: current.pricingTier
  };

  const { rows } = await pool.query<MerchantRow>(
    `UPDATE merchants
     SET name = $2,
         category = $3,
         city = $4,
         contact_email = $5,
         status = $6,
         pricing_tier = $7,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, category, city, contact_email, status, pricing_tier, created_at, updated_at`,
    [merchantId, next.name, next.category, next.city, next.contactEmail, next.status, next.pricingTier]
  );

  return mapMerchantFromDb(rows[0]);
}

export function resetMerchantStoreForTests(): void {
  memoryState.merchantsById.clear();
}

export async function updateMerchantPricingTier(
  merchantId: string,
  pricingTier: MerchantPricingTier
): Promise<MerchantRecord | null> {
  if (storageMode() === 'memory') {
    const current = memoryState.merchantsById.get(merchantId);
    if (!current) {
      return null;
    }

    const next: MerchantRecord = {
      ...current,
      pricingTier,
      updatedAt: new Date().toISOString()
    };
    memoryState.merchantsById.set(merchantId, next);
    return { ...next };
  }

  const { rows } = await pool.query<MerchantRow>(
    `UPDATE merchants
     SET pricing_tier = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, category, city, contact_email, status, pricing_tier, created_at, updated_at`,
    [merchantId, pricingTier]
  );

  return mapMerchantFromDb(rows[0]);
}

export async function deleteMerchantById(merchantId: string): Promise<boolean> {
  if (storageMode() === 'memory') {
    return memoryState.merchantsById.delete(merchantId);
  }

  const result = await pool.query('DELETE FROM merchants WHERE id = $1', [merchantId]);
  return (result.rowCount || 0) > 0;
}

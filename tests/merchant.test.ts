process.env.AUTH_STORAGE = 'memory';

import {
  addMerchant,
  changeMerchantPricingTier,
  removeMerchant,
  editMerchant,
  getMerchantDetails,
  searchMerchants
} from '../src/services/merchantService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import { recordMerchantDocument, verifyMerchantDocument } from '../src/services/kybService';

async function makeMerchantActive(merchantId: string): Promise<void> {
  // Test helper that simulates a merchant fully completing KYB so activation can be exercised.
  for (const type of [
    'business_registration',
    'owner_identity_document',
    'bank_account_proof'
  ] as const) {
    await recordMerchantDocument(merchantId, {
      type,
      fileName: `${type}.pdf`
    });
    await verifyMerchantDocument(
      merchantId,
      type,
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
  }
}

describe('Merchant service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
    resetKybStoreForTests();
  });

  it('creates a merchant with default status', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    expect(merchant.id).toEqual(expect.any(String));
    expect(merchant.status).toBe('Pending KYB');
    expect(merchant.pricingTier).toBe('standard');
    expect(merchant.contactEmail).toBe('owner@atlas.ma');
  });

  it('returns a merchant by id', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    const merchant = await getMerchantDetails(created.id);
    expect(merchant).toMatchObject({
      id: created.id,
      name: 'Atlas Pharmacy',
      city: 'Casablanca'
    });
  });

  it('filters merchants by status, city, and pricing tier', async () => {
    const pendingMerchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    const rabatMerchant = await addMerchant({
      name: 'Rabat Diner',
      category: 'Restaurant',
      city: 'Rabat',
      contactEmail: 'hello@diner.ma'
    });

    const activeMerchant = await addMerchant({
      name: 'Casa Electronics',
      category: 'Retail',
      city: 'Casablanca',
      contactEmail: 'sales@casa.ma'
    });

    await editMerchant(
      pendingMerchant.id,
      { status: 'Suspended' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
    await editMerchant(
      rabatMerchant.id,
      { status: 'Suspended' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
    await makeMerchantActive(activeMerchant.id);
    await editMerchant(
      activeMerchant.id,
      { status: 'Active' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    const merchants = await searchMerchants({
      status: 'Active',
      city: 'Casablanca',
      pricingTier: 'standard'
    });

    expect(merchants).toHaveLength(1);
    expect(merchants[0].name).toBe('Casa Electronics');
  });

  it('updates merchant details', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await makeMerchantActive(created.id);

    const updated = await editMerchant(
      created.id,
      {
        city: 'Rabat',
        status: 'Active'
      },
      {
        operatorId: 'operator-1',
        email: 'admin@example.com',
        role: 'admin'
      }
    );

    expect(updated.city).toBe('Rabat');
    expect(updated.status).toBe('Active');
  });

  it('rejects activation until all required KYB documents are verified', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await expect(
      editMerchant(
        created.id,
        { status: 'Active' },
        { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
      )
    ).rejects.toMatchObject({
      code: 'KYB_REQUIREMENTS_NOT_MET'
    });
  });

  it('rejects invalid status transitions', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await editMerchant(
      created.id,
      { status: 'Suspended' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    await expect(
      editMerchant(
        created.id,
        { status: 'Pending KYB' },
        { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
      )
    ).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION'
    });
  });

  it('allows admins to change merchant pricing tier', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    const updated = await changeMerchantPricingTier(
      created.id,
      { pricingTier: 'premium' },
      { operatorId: 'admin-1', email: 'admin@example.com', role: 'admin' }
    );

    expect(updated.pricingTier).toBe('premium');
  });

  it('allows admins to delete merchants', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    const result = await removeMerchant(created.id, {
      operatorId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin'
    });

    expect(result).toEqual({ deleted: true });
    await expect(getMerchantDetails(created.id)).rejects.toMatchObject({
      code: 'MERCHANT_NOT_FOUND'
    });
  });

  it('rejects merchant deletion by non-admin operators', async () => {
    const created = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await expect(
      removeMerchant(created.id, {
        operatorId: 'operator-1',
        email: 'operator@example.com',
        role: 'operator'
      })
    ).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED'
    });
  });
});

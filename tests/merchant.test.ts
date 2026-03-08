process.env.AUTH_STORAGE = 'memory';

import {
  addMerchant,
  editMerchant,
  getMerchantDetails,
  searchMerchants
} from '../src/services/merchantService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';

describe('Merchant service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
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

  it('filters merchants by status and city', async () => {
    await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await addMerchant({
      name: 'Rabat Diner',
      category: 'Restaurant',
      city: 'Rabat',
      contactEmail: 'hello@diner.ma',
      status: 'Active'
    });

    await addMerchant({
      name: 'Casa Electronics',
      category: 'Retail',
      city: 'Casablanca',
      contactEmail: 'sales@casa.ma',
      status: 'Active'
    });

    const merchants = await searchMerchants({
      status: 'Active',
      city: 'Casablanca'
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

    const updated = await editMerchant(created.id, {
      city: 'Rabat',
      status: 'Active'
    });

    expect(updated.city).toBe('Rabat');
    expect(updated.status).toBe('Active');
  });
});

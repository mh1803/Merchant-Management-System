process.env.AUTH_STORAGE = 'memory';

import {
  addMerchant,
  changeMerchantPricingTier,
  editMerchant
} from '../src/services/merchantService';
import { getMerchantHistory } from '../src/services/historyService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import { recordMerchantDocument, verifyMerchantDocument } from '../src/services/kybService';

async function makeMerchantActive(merchantId: string): Promise<void> {
  for (const type of [
    'business_registration',
    'owner_identity_document',
    'bank_account_proof'
  ] as const) {
    await recordMerchantDocument(merchantId, {
      type,
      fileName: `${type}.pdf`
    });
    await verifyMerchantDocument(merchantId, type, { verified: true });
  }
}

describe('Merchant status history service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
    resetKybStoreForTests();
  });

  it('records a history entry when merchant status changes', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await makeMerchantActive(merchant.id);

    await editMerchant(
      merchant.id,
      { status: 'Active' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    const history = await getMerchantHistory(merchant.id);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fieldName: 'status',
      previousValue: 'Pending KYB',
      newValue: 'Active',
      changedByOperatorId: 'operator-1',
      changedByEmail: 'admin@example.com'
    });
  });

  it('does not create history when status stays the same', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await editMerchant(
      merchant.id,
      { city: 'Rabat' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    const history = await getMerchantHistory(merchant.id);
    expect(history).toHaveLength(0);
  });

  it('records a history entry when pricing tier changes', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await changeMerchantPricingTier(
      merchant.id,
      { pricingTier: 'premium' },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    const history = await getMerchantHistory(merchant.id);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fieldName: 'pricingTier',
      previousValue: 'standard',
      newValue: 'premium',
      changedByOperatorId: 'operator-1',
      changedByEmail: 'admin@example.com'
    });
  });
});

process.env.AUTH_STORAGE = 'memory';

import { addMerchant, editMerchant } from '../src/services/merchantService';
import { getMerchantHistory } from '../src/services/historyService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';

describe('Merchant status history service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
  });

  it('records a history entry when merchant status changes', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await editMerchant(
      merchant.id,
      { status: 'Active' },
      { operatorId: 'operator-1', email: 'admin@example.com' }
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
      { operatorId: 'operator-1', email: 'admin@example.com' }
    );

    const history = await getMerchantHistory(merchant.id);
    expect(history).toHaveLength(0);
  });
});

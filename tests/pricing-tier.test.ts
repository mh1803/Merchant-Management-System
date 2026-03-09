process.env.AUTH_STORAGE = 'memory';

import { addMerchant, changeMerchantPricingTier } from '../src/services/merchantService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetHistoryStoreForTests } from '../src/db/historyRepository';

describe('Merchant pricing tier service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetHistoryStoreForTests();
  });

  it('rejects pricing tier changes by non-admin operators', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await expect(
      changeMerchantPricingTier(
        merchant.id,
        { pricingTier: 'premium' },
        { operatorId: 'operator-1', email: 'operator@example.com', role: 'operator' }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ADMIN_REQUIRED'
    });
  });
});

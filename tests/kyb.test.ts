process.env.AUTH_STORAGE = 'memory';

import { addMerchant } from '../src/services/merchantService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import {
  getMerchantDocumentDetails,
  getMerchantDocuments,
  recordMerchantDocument,
  verifyMerchantDocument
} from '../src/services/kybService';

describe('KYB service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetKybStoreForTests();
  });

  it('records a merchant document', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    const document = await recordMerchantDocument(merchant.id, {
      type: 'business_registration',
      fileName: 'business-reg.pdf'
    });

    expect(document.type).toBe('business_registration');
    expect(document.fileName).toBe('business-reg.pdf');
    expect(document.verified).toBe(false);
  });

  it('lists recorded merchant documents', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await recordMerchantDocument(merchant.id, {
      type: 'business_registration',
      fileName: 'business-reg.pdf'
    });
    await recordMerchantDocument(merchant.id, {
      type: 'bank_account_proof',
      fileName: 'bank-proof.pdf'
    });

    const documents = await getMerchantDocuments(merchant.id);

    expect(documents).toHaveLength(2);
    expect(documents.map((document) => document.type)).toEqual([
      'bank_account_proof',
      'business_registration'
    ]);
  });

  it('marks a document as verified', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await recordMerchantDocument(merchant.id, {
      type: 'owner_identity_document',
      fileName: 'owner-id.pdf'
    });

    const verified = await verifyMerchantDocument(merchant.id, 'owner_identity_document', {
      verified: true
    });

    expect(verified.verified).toBe(true);
    expect(verified.verifiedAt).toEqual(expect.any(String));

    const fetched = await getMerchantDocumentDetails(merchant.id, 'owner_identity_document');
    expect(fetched.verified).toBe(true);
  });

  it('replaces a re-uploaded document and resets verification', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await recordMerchantDocument(merchant.id, {
      type: 'business_registration',
      fileName: 'old-file.pdf'
    });
    await verifyMerchantDocument(merchant.id, 'business_registration', { verified: true });

    const replaced = await recordMerchantDocument(merchant.id, {
      type: 'business_registration',
      fileName: 'new-file.pdf'
    });

    expect(replaced.fileName).toBe('new-file.pdf');
    expect(replaced.verified).toBe(false);
    expect(replaced.verifiedAt).toBeNull();
  });
});

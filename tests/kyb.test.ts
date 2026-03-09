process.env.AUTH_STORAGE = 'memory';

import { addMerchant } from '../src/services/merchantService';
import { resetMerchantStoreForTests } from '../src/db/merchantRepository';
import { resetKybStoreForTests } from '../src/db/kybRepository';
import { resetKybHistoryStoreForTests } from '../src/db/kybHistoryRepository';
import {
  getMerchantDocumentDetails,
  getMerchantDocumentVerificationHistory,
  getMerchantDocuments,
  recordMerchantDocument,
  verifyMerchantDocument
} from '../src/services/kybService';

describe('KYB service', () => {
  beforeEach(() => {
    resetMerchantStoreForTests();
    resetKybStoreForTests();
    resetKybHistoryStoreForTests();
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

    const verified = await verifyMerchantDocument(
      merchant.id,
      'owner_identity_document',
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

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
    await verifyMerchantDocument(
      merchant.id,
      'business_registration',
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );

    const replaced = await recordMerchantDocument(merchant.id, {
      type: 'business_registration',
      fileName: 'new-file.pdf'
    });

    expect(replaced.fileName).toBe('new-file.pdf');
    expect(replaced.verified).toBe(false);
    expect(replaced.verifiedAt).toBeNull();
  });

  it('records immutable verification history with acting operator details', async () => {
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

    await verifyMerchantDocument(
      merchant.id,
      'owner_identity_document',
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
    await verifyMerchantDocument(
      merchant.id,
      'owner_identity_document',
      { verified: false },
      { operatorId: 'operator-2', email: 'reviewer@example.com', role: 'operator' }
    );

    const history = await getMerchantDocumentVerificationHistory(
      merchant.id,
      'owner_identity_document'
    );

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      previousVerified: false,
      newVerified: true,
      changedByOperatorId: 'operator-1',
      changedByEmail: 'admin@example.com'
    });
    expect(history[1]).toMatchObject({
      previousVerified: true,
      newVerified: false,
      changedByOperatorId: 'operator-2',
      changedByEmail: 'reviewer@example.com'
    });
  });

  it('rejects verification for missing documents', async () => {
    const merchant = await addMerchant({
      name: 'Atlas Pharmacy',
      category: 'Pharmacy',
      city: 'Casablanca',
      contactEmail: 'owner@atlas.ma'
    });

    await expect(
      verifyMerchantDocument(
        merchant.id,
        'bank_account_proof',
        { verified: true },
        { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'MERCHANT_DOCUMENT_NOT_FOUND'
    });
  });

  it('does not create duplicate history when verification state does not change', async () => {
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

    await verifyMerchantDocument(
      merchant.id,
      'owner_identity_document',
      { verified: true },
      { operatorId: 'operator-1', email: 'admin@example.com', role: 'admin' }
    );
    await verifyMerchantDocument(
      merchant.id,
      'owner_identity_document',
      { verified: true },
      { operatorId: 'operator-2', email: 'reviewer@example.com', role: 'operator' }
    );

    const history = await getMerchantDocumentVerificationHistory(
      merchant.id,
      'owner_identity_document'
    );

    expect(history).toHaveLength(1);
  });
});

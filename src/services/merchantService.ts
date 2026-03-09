import { AppError } from '../errors';
import {
  createMerchantHistoryEntry,
  deleteMerchantHistoryEntries
} from '../db/historyRepository';
import {
  createMerchant,
  deleteMerchantById,
  getMerchantById,
  listMerchants,
  updateMerchant,
  updateMerchantPricingTier
} from '../db/merchantRepository';
import { deleteMerchantDocuments, listMerchantDocuments } from '../db/kybRepository';
import { deleteMerchantDocumentVerificationHistory } from '../db/kybHistoryRepository';
import { StatusChangeActor } from '../types/history';
import { queueMerchantStatusWebhookDispatch } from './webhookService';
import {
  CreateMerchantInput,
  DeleteMerchantResult,
  MerchantFilters,
  MerchantRecord,
  MerchantStatus,
  UpdateMerchantPricingTierInput,
  UpdateMerchantInput
} from '../types/merchant';
import { MerchantDocumentType } from '../types/kyb';

const requiredActivationDocumentTypes: MerchantDocumentType[] = [
  'business_registration',
  'owner_identity_document',
  'bank_account_proof'
];

const allowedStatusTransitions: Record<MerchantStatus, MerchantStatus[]> = {
  'Pending KYB': ['Active', 'Suspended'],
  Active: ['Suspended'],
  Suspended: ['Active']
};

function getMissingActivationRequirements(
  documents: Awaited<ReturnType<typeof listMerchantDocuments>>
): MerchantDocumentType[] {
  return requiredActivationDocumentTypes.filter((type) => {
    const document = documents.find((candidate) => candidate.type === type);
    return !document || !document.verified;
  });
}

async function assertActivationEligible(merchantId: string): Promise<void> {
  // Activation is gated on document state rather than trusting callers to enforce KYB completion.
  const documents = await listMerchantDocuments(merchantId);
  const missingRequirements = getMissingActivationRequirements(documents);

  if (missingRequirements.length > 0) {
    throw new AppError(
      400,
      `Merchant cannot transition to Active until all required KYB documents are present and verified: ${missingRequirements.join(', ')}`,
      'KYB_REQUIREMENTS_NOT_MET'
    );
  }
}

async function assertValidStatusTransition(
  merchantId: string,
  currentStatus: MerchantStatus,
  nextStatus: MerchantStatus
): Promise<void> {
  if (currentStatus === nextStatus) {
    return;
  }

  // Status is treated as a lifecycle, so callers cannot arbitrarily jump between states.
  const allowedNextStatuses = allowedStatusTransitions[currentStatus];
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new AppError(
      400,
      `Invalid merchant status transition from ${currentStatus} to ${nextStatus}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  // Activation is the only transition that depends on cross-entity KYB state.
  if (nextStatus === 'Active') {
    await assertActivationEligible(merchantId);
  }
}

export async function addMerchant(input: CreateMerchantInput): Promise<MerchantRecord> {
  return createMerchant(input);
}

export async function getMerchantDetails(merchantId: string): Promise<MerchantRecord> {
  const merchant = await getMerchantById(merchantId);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return merchant;
}

export async function searchMerchants(filters: MerchantFilters): Promise<MerchantRecord[]> {
  return listMerchants(filters);
}

export async function editMerchant(
  merchantId: string,
  input: UpdateMerchantInput,
  actor?: StatusChangeActor
): Promise<MerchantRecord> {
  // Merchant updates are the main lifecycle entrypoint: this method validates transitions,
  // writes immutable history, and triggers webhooks when relevant status changes occur.
  const current = await getMerchantById(merchantId);
  if (!current) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  const statusWillChange = typeof input.status !== 'undefined' && input.status !== current.status;
  if (statusWillChange && !actor) {
    throw new AppError(
      400,
      'Status changes must include the acting operator',
      'STATUS_CHANGE_ACTOR_REQUIRED'
    );
  }

  if (statusWillChange && input.status) {
    await assertValidStatusTransition(merchantId, current.status, input.status);
  }

  const merchant = await updateMerchant(merchantId, input);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (statusWillChange && actor) {
    const changedAt = new Date().toISOString();

    // History is written before webhook fan-out so the audit trail survives delivery failures.
    await createMerchantHistoryEntry({
      merchantId,
      fieldName: 'status',
      previousValue: current.status,
      newValue: merchant.status,
      changedByOperatorId: actor.operatorId,
      changedByEmail: actor.email
    });

    if (merchant.status === 'Active' || merchant.status === 'Suspended') {
      // Webhooks are queued asynchronously to keep the primary request path fast.
      queueMerchantStatusWebhookDispatch({
        eventType: merchant.status === 'Active' ? 'merchant.approved' : 'merchant.suspended',
        merchantId,
        merchantName: merchant.name,
        previousStatus: current.status,
        newStatus: merchant.status,
        changedAt
      });
    }
  }

  return merchant;
}

export async function changeMerchantPricingTier(
  merchantId: string,
  input: UpdateMerchantPricingTierInput,
  actor: StatusChangeActor
): Promise<MerchantRecord> {
  // Pricing tier is modeled as a sensitive merchant attribute, so the authorization check
  // and audit write happen in the service layer instead of the controller.
  const current = await getMerchantById(merchantId);
  if (!current) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (actor.role !== 'admin') {
    throw new AppError(403, 'Only admins can change pricing tier', 'ADMIN_REQUIRED');
  }

  const merchant = await updateMerchantPricingTier(merchantId, input.pricingTier);
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (merchant.pricingTier !== current.pricingTier) {
    await createMerchantHistoryEntry({
      merchantId,
      fieldName: 'pricingTier',
      previousValue: current.pricingTier,
      newValue: merchant.pricingTier,
      changedByOperatorId: actor.operatorId,
      changedByEmail: actor.email
    });
  }

  return merchant;
}

export async function removeMerchant(
  merchantId: string,
  actor: StatusChangeActor
): Promise<DeleteMerchantResult> {
  // Deletion is restricted to admins and routed through the service so authorization stays
  // consistent regardless of how the endpoint is invoked.
  if (actor.role !== 'admin') {
    throw new AppError(403, 'Only admins can delete merchants', 'ADMIN_REQUIRED');
  }

  const current = await getMerchantById(merchantId);
  if (!current) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  const deleted = await deleteMerchantById(merchantId);
  if (!deleted) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  await Promise.all([
    deleteMerchantDocuments(merchantId),
    deleteMerchantDocumentVerificationHistory(merchantId),
    deleteMerchantHistoryEntries(merchantId)
  ]);

  return { deleted: true };
}

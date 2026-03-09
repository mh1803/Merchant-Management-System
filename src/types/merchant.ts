export type MerchantStatus = 'Pending KYB' | 'Active' | 'Suspended';
export type MerchantPricingTier = 'standard' | 'premium' | 'enterprise';

export interface MerchantRecord {
  id: string;
  name: string;
  category: string;
  city: string;
  contactEmail: string;
  status: MerchantStatus;
  pricingTier: MerchantPricingTier;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMerchantInput {
  name: string;
  category: string;
  city: string;
  contactEmail: string;
  pricingTier?: MerchantPricingTier;
}

export interface UpdateMerchantInput {
  name?: string;
  category?: string;
  city?: string;
  contactEmail?: string;
  status?: MerchantStatus;
}

export interface UpdateMerchantPricingTierInput {
  pricingTier: MerchantPricingTier;
}

export interface MerchantFilters {
  status?: MerchantStatus;
  city?: string;
  category?: string;
  q?: string;
}

export interface DeleteMerchantResult {
  deleted: boolean;
}

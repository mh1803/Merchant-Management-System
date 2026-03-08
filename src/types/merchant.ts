export type MerchantStatus = 'Pending KYB' | 'Active' | 'Suspended';

export interface MerchantRecord {
  id: string;
  name: string;
  category: string;
  city: string;
  contactEmail: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMerchantInput {
  name: string;
  category: string;
  city: string;
  contactEmail: string;
  status?: MerchantStatus;
}

export interface UpdateMerchantInput {
  name?: string;
  category?: string;
  city?: string;
  contactEmail?: string;
  status?: MerchantStatus;
}

export interface MerchantFilters {
  status?: MerchantStatus;
  city?: string;
  category?: string;
  q?: string;
}

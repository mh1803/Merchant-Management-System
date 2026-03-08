CREATE TABLE IF NOT EXISTS merchant_documents (
  id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('business_registration', 'owner_identity_document', 'bank_account_proof')
  ),
  file_name TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ NULL,
  UNIQUE (merchant_id, type)
);

CREATE INDEX IF NOT EXISTS idx_merchant_documents_merchant_id ON merchant_documents (merchant_id);

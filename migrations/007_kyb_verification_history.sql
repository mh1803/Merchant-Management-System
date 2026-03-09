CREATE TABLE IF NOT EXISTS merchant_document_verification_history (
  id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('business_registration', 'owner_identity_document', 'bank_account_proof')
  ),
  previous_verified BOOLEAN NOT NULL,
  new_verified BOOLEAN NOT NULL,
  changed_by_operator_id UUID NOT NULL REFERENCES operators(id),
  changed_by_email TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_document_verification_history_merchant_id
  ON merchant_document_verification_history (merchant_id, changed_at);

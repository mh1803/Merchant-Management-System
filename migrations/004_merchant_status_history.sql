CREATE TABLE IF NOT EXISTS merchant_status_history (
  id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL CHECK (field_name = 'status'),
  previous_value TEXT NOT NULL CHECK (previous_value IN ('Pending KYB', 'Active', 'Suspended')),
  new_value TEXT NOT NULL CHECK (new_value IN ('Pending KYB', 'Active', 'Suspended')),
  changed_by_operator_id UUID NOT NULL REFERENCES operators(id),
  changed_by_email TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_status_history_merchant_id
  ON merchant_status_history (merchant_id, changed_at);

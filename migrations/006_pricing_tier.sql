ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS pricing_tier TEXT NOT NULL DEFAULT 'standard'
  CHECK (pricing_tier IN ('standard', 'premium', 'enterprise'));

ALTER TABLE merchant_status_history
  DROP CONSTRAINT IF EXISTS merchant_status_history_field_name_check;

ALTER TABLE merchant_status_history
  ADD CONSTRAINT merchant_status_history_field_name_check
  CHECK (field_name IN ('status', 'pricingTier'));

ALTER TABLE merchant_status_history
  DROP CONSTRAINT IF EXISTS merchant_status_history_previous_value_check;

ALTER TABLE merchant_status_history
  ADD CONSTRAINT merchant_status_history_previous_value_check
  CHECK (
    previous_value IN (
      'Pending KYB',
      'Active',
      'Suspended',
      'standard',
      'premium',
      'enterprise'
    )
  );

ALTER TABLE merchant_status_history
  DROP CONSTRAINT IF EXISTS merchant_status_history_new_value_check;

ALTER TABLE merchant_status_history
  ADD CONSTRAINT merchant_status_history_new_value_check
  CHECK (
    new_value IN (
      'Pending KYB',
      'Active',
      'Suspended',
      'standard',
      'premium',
      'enterprise'
    )
  );

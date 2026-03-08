CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending KYB', 'Active', 'Suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants (status);
CREATE INDEX IF NOT EXISTS idx_merchants_city_lower ON merchants (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_merchants_category_lower ON merchants (LOWER(category));

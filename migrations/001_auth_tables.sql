CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  lockout_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operators_email_lower ON operators (LOWER(email));

CREATE TABLE IF NOT EXISTS refresh_sessions (
  jti UUID PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Persistent Celebrity Tool catalog (Neon/Postgres).
-- This migration intentionally creates no sample rows. Import only verified
-- Locket profiles supplied by the project owner.

CREATE TABLE IF NOT EXISTS celebrity_profiles (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  locket_url TEXT NOT NULL,
  country_code VARCHAR(8) NOT NULL DEFAULT 'OTHER',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT celebrity_profiles_uid_unique UNIQUE (uid),
  CONSTRAINT celebrity_profiles_username_unique UNIQUE (username),
  CONSTRAINT celebrity_profiles_locket_url_unique UNIQUE (locket_url)
);

CREATE INDEX IF NOT EXISTS celebrity_profiles_enabled_order
  ON celebrity_profiles (enabled, sort_order, display_name, id);

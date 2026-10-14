-- Run once through the project's SQL editor after reviewing this migration.
-- This creates new cloud tables; it does not import local accounts or passwords.
BEGIN;
CREATE SCHEMA IF NOT EXISTS qiye_private;
REVOKE ALL ON SCHEMA qiye_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS qiye_private.accounts (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('email', 'phone')),
  identity text NOT NULL UNIQUE,
  name text NOT NULL,
  salt text NOT NULL,
  hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS qiye_private.sessions (
  token text PRIMARY KEY,
  account text NOT NULL REFERENCES qiye_private.accounts(id) ON DELETE CASCADE,
  expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON qiye_private.sessions(expires);
CREATE TABLE IF NOT EXISTS qiye_private.avatars (
  account text PRIMARY KEY REFERENCES qiye_private.accounts(id) ON DELETE CASCADE,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS qiye_private.rooms (
  id text PRIMARY KEY,
  created bigint NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
CREATE INDEX IF NOT EXISTS rooms_created ON qiye_private.rooms(created);
CREATE TABLE IF NOT EXISTS qiye_private.usage_buckets (
  bucket text NOT NULL,
  window_start bigint NOT NULL,
  expires bigint NOT NULL,
  used integer NOT NULL CHECK (used >= 0),
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS usage_expiry ON qiye_private.usage_buckets(expires);

ALTER TABLE qiye_private.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiye_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiye_private.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiye_private.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiye_private.usage_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qiye_private FROM PUBLIC, anon, authenticated;
-- No browser policies or public RPC functions. Access is server-side only.
COMMIT;

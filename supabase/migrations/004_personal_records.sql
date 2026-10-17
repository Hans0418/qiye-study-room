BEGIN;
CREATE TABLE IF NOT EXISTS qiye_private.personal_records (
  account text NOT NULL, name text NOT NULL, revision bigint NOT NULL,
  body jsonb NOT NULL, PRIMARY KEY(account,name)
);
CREATE TABLE IF NOT EXISTS qiye_private.personal_record_versions (
  account text NOT NULL, name text NOT NULL, revision bigint NOT NULL,
  body jsonb NOT NULL, saved_at bigint NOT NULL,
  PRIMARY KEY(account,name,revision)
);
ALTER TABLE qiye_private.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiye_private.personal_record_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qiye_private.personal_records, qiye_private.personal_record_versions FROM anon, authenticated;
COMMIT;

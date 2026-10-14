# Cloud Setup: Runtime Adapted, Deployment Pending

`APP_RUNTIME=cloud` now selects Postgres-backed authentication and rooms, shared
request quotas and the approved Ark model. With that variable unset, local SQLite,
in-memory rooms and Ollama remain the default. Public deployment is still pending.

## Prepared Files

- `cloud-config.mjs`: explicit cloud opt-in, HTTPS origin validation, server-only
  credentials, fixed approved Ark model, bounded request limits and no fallback.
- `database.mjs`: Postgres connection pool, verified TLS, transactions and atomic
  multi-bucket request reservation. Shared request limits are not billing caps.
- `supabase/migrations/202610130001_qiye_private.sql`: new private cloud tables
  with RLS enabled and no access granted to browser roles.
- `.env.cloud.example`: empty credential template; no actual secrets.
- `package.json`: declares the Postgres driver and the portable test suite.
- `package-lock.json`: locks the installed dependency tree.
- `supabase/prod-ca-2021.crt`: public provider CA, loaded automatically unless
  `DATABASE_CA_PEM` is explicitly supplied. Never install private keys here.
- `cloud-migrate.mjs`: explicitly applies the additive schema migration.
- `cloud-integration-check.mjs`: checks real database permissions and transactional
  behavior; all test fixtures are rolled back.
- `cloud-auth.mjs` and `cloud-rooms.mjs`: server-side persistence preserving the
  frontend API contracts. Cloud cookies are HttpOnly, Secure and SameSite=Strict.
- `cloud-workflow-check.mjs`: two handler instances sharing a real database
  transaction; checks authentication, room persistence and AI quota enforcement.
  Its model response is mocked. This is not a two-browser or concurrent-load test.
- `api/index.mjs`, `vercel.json`, `build.mjs`: Vercel entrypoint, API routing and
  allowlisted static build, excluding credentials and downloaded audio/video.

## Verified on 2026-10-13

The configured database accepted a TLS-verified connection. The initial migration
was applied successfully. All five tables have RLS enabled and deny schema/table
access to `anon` and `authenticated`. Live checks passed for session foreign-key
cascades, multi-bucket usage rollback and test-fixture rollback. One short Ark
request returned HTTP 200 with a valid response. Cloud workflow checks passed for
registration, login, session rotation, avatar updates, room joins/start/goal/close,
host authorization, logged-in AI access and shared per-user quota rejection.
All fixture rows were rolled back. A real Ark planning request using strict JSON
schema produced three tasks totaling 25 minutes and passed application validation.
Earlier JSON-only requests sometimes failed validation; one successful structured
sample is not a broad model-quality evaluation. Server validation remains required.

With the private `.env.cloud` configured, run `npm run cloud:check` to repeat the
database checks. Run `npm run cloud:migrate` only against the intended project.
Run `npm run cloud:workflow` for the isolated cloud API workflow check.

## Credential Preparation

Use Supabase's Connect dialog to obtain the **Transaction pooler** Postgres URI.
The project HTTPS URL and a publishable key are not database connection strings.
Keep the URI and password private. Percent-encode special characters in the URI
password. Do not send the URI, database password or Ark API key in chat, screenshots
or GitHub commits.

Copy `.env.cloud.example` to the git-ignored `.env.cloud` for local integration
testing, or later configure these values in Vercel's server-side environment
settings. Never use a public/frontend environment prefix. A connection string
must not contain SSL query parameters that override certificate verification.
If a provider CA is needed, supply its trusted PEM in `DATABASE_CA_PEM`; do not
disable TLS verification.

Do not add `qiye_private` to Supabase's exposed Data API schemas. The application
will use server-side SQL and must retain endpoint authorization checks. No local
accounts are migrated. The migration is additive, but should only be applied to
the intended project after review and backup of any existing data.

Keep Ark's free-quota auto-pause enabled. The planned daily request limits are
20 globally and 3 per user by default; these limits do not guarantee free billing.
Only `doubao-seed-2-1-lite-260915` is selected. No GPT/Qwen fallback is configured.

## Remaining Before Release

1. Publish the runtime changes and approved image assets to the deployment source.
   Current media exclusions still need an explicit release decision; the build
   intentionally fails if required images are missing.
2. Connect only the intended GitHub repository to Vercel Hobby.
3. Configure server-only APP_RUNTIME, APP_ORIGIN, DATABASE_URL, ARK_API_KEY and
   request limits. APP_ORIGIN must be the final HTTPS site origin, not the example.
4. Deploy and verify routing, static assets and two-browser room behavior.
5. Check model failures, shared quotas and concurrent room joins on the deployment.

The room adapter serializes mutations using a transaction-level advisory lock,
matching the existing cap of 100 active rooms. This is deliberately a small-demo
implementation, not a high-throughput architecture. Supabase browser roles cannot
access the private schema; the server database credential remains privileged and
must never be exposed. The demo retains unverified email/phone registration.

The unit tests use a fake pool and static SQL checks. The separate live integration
check verifies Postgres execution, but not multi-instance application concurrency
or successful cloud deployment.

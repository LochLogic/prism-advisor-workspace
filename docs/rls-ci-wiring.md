# Wiring the RLS-isolation CI job

The `rls-isolation` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the
tenant-isolation SQL tests in [`supabase/tests/`](../supabase/tests/) against a real Postgres
database. [`scripts/db-test.mjs`](../scripts/db-test.mjs) decides what to do based on the
`DATABASE_URL` secret:

| State | Behaviour | Job result |
|---|---|---|
| Secret **unset** | Skips with a message | 🟢 green (inert) |
| Secret **set but DB unreachable** | `select 1` precheck fails → skips with a loud `::warning::` | 🟢 green (inert) |
| Secret **set and DB reachable** | Runs every `*.sql` file; fails on any error | 🟢 green / 🔴 red (enforcing) |

> ✅ **Current state (2026-06-07):** `DATABASE_URL` is wired to a disposable staging project
> ("PRISM · Advisor Workspace- test DB") via its **session pooler**, and the RLS tests now run and
> **enforce** in CI — `rls_isolation.sql` passes all 7 cross-tenant checks. The DB password and the
> 1-hour management token used during setup should be rotated/revoked.

## What the tests cover

- `rls_isolation.sql` — cross-tenant boundaries on **messages** and **documents** (RLS denies
  reads/writes across `tenant_id`).
- `integration.sql` — broader integration checks.

Each file runs inside a transaction that **ROLLS BACK**, so a run leaves no rows behind. This is
safe to point at any Postgres database — but use a **disposable / staging** project, never prod.

## Steps to wire it

1. **Create a disposable Supabase project** (free tier is fine) dedicated to CI. Do *not* reuse the
   production project.
2. **Apply the schema** to it so the tables/policies under test exist:
   - `supabase db push` against the staging project (preferred), or
   - run the migrations in `supabase/migrations/` in order.
3. **Get the SESSION POOLER connection string** — Supabase → *Connect* → *Session pooler*:
   ```
   postgresql://postgres.<ref>:<pw>@aws-<n>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   ⚠️ **Do NOT use the direct connection** (`db.<ref>.supabase.co:5432`). Supabase serves it over
   **IPv6 only**, and GitHub-hosted runners are **IPv4-only** → every CI run fails with
   `connection ... failed: Network is unreachable`. This was the original root cause. The **session
   pooler** (port `5432`, user `postgres.<ref>`) is IPv4 and gives a full session — required because
   the test scripts use `set local role` + transaction-scoped `set_config`. The *transaction* pooler
   (port `6543`) is not a safe substitute for `psql -f`.
   - URL-encode special characters in the password (`!`→`%21`, `$`→`%24`, etc.); libpq decodes them.
4. **Add the repo secret**: `gh secret set DATABASE_URL --repo <owner>/<repo>` (paste the URI at the
   hidden prompt), or via GitHub → Settings → Secrets and variables → Actions.
5. **Trigger CI** — push any branch / open a PR, or re-run an existing run (`gh run rerun <id>`;
   secrets are read at run time). The `rls-isolation` job will now execute the SQL and fail if
   isolation regresses. Read results with `gh run view <id> --log --job <rls-isolation job id>`.

## Notes

- `psql` is preinstalled on `ubuntu-latest`; the job's "Ensure psql client" step is a no-op fast
  path with a non-fatal apt fallback, so a flaky mirror can no longer turn the job red.
- Rotate the staging DB password if the secret is ever exposed; it's a throwaway project, so
  re-provisioning is cheap.
- The skip-on-unreachable behaviour keeps a non-required job from becoming permanent red noise. The
  trade-off: a genuinely-down staging DB skips silently (with a warning) rather than failing. Once
  the secret points at a **stable** DB and you promote the job to **required**, consider changing
  `db-test.mjs` so a connection failure hard-fails — at that point a down DB *should* block merges.
- Consider making `rls-isolation` a **required** check once it's wired, so isolation regressions
  block merges.

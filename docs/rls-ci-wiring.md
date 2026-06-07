# Wiring the RLS-isolation CI job

The `rls-isolation` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the
tenant-isolation SQL tests in [`supabase/tests/`](../supabase/tests/) against a real Postgres
database. Today it is **green but inert**: with no `DATABASE_URL` secret set,
[`scripts/db-test.mjs`](../scripts/db-test.mjs) skips gracefully (exit 0). The tests only *enforce*
once the secret points at a database.

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
3. **Get the connection string** from Supabase → Project Settings → Database → Connection string
   (URI form, e.g. `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres`). Use the
   direct connection (port 5432), not the pooler, so `ON_ERROR_STOP` + transactions behave.
4. **Add the repo secret**: GitHub → repo → Settings → Secrets and variables → Actions →
   New repository secret → name `DATABASE_URL`, value = the URI above.
5. **Re-run CI** on any branch. The `rls-isolation` job will now actually execute the SQL and fail
   if isolation regresses.

## Notes

- `psql` is preinstalled on `ubuntu-latest`; the job's "Ensure psql client" step is a no-op fast
  path with a non-fatal apt fallback, so a flaky mirror can no longer turn the job red.
- Rotate the staging DB password if the secret is ever exposed; it's a throwaway project, so
  re-provisioning is cheap.
- Consider making `rls-isolation` a **required** check once it's wired, so isolation regressions
  block merges.

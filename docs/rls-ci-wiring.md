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

> ⚠️ **Current state (2026-06-06):** a `DATABASE_URL` secret **is** configured, but it points at a
> Supabase project that is **unreachable** (psql connection error — "Network is unreachable",
> consistent with a paused free-tier project or stale host). The job is green only because the
> precheck skips. To get real enforcement, the secret must point at a **live** disposable project —
> follow the steps below, then confirm the CI warning disappears and the SQL files actually run.
>
> The stale staging project ref was briefly exposed in a public CI annotation during diagnosis
> (host only — **no password**). Low risk, but consider rotating the staging project's DB password
> or re-provisioning the project when you re-wire it.

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
- The skip-on-unreachable behaviour keeps a non-required job from becoming permanent red noise. The
  trade-off: a genuinely-down staging DB skips silently (with a warning) rather than failing. Once
  the secret points at a **stable** DB and you promote the job to **required**, consider changing
  `db-test.mjs` so a connection failure hard-fails — at that point a down DB *should* block merges.
- Consider making `rls-isolation` a **required** check once it's wired, so isolation regressions
  block merges.

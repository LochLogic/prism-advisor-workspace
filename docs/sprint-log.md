# Prism — Sprint Log

> Dated, append-only record of shipped sprints. The chat is cleared after each
> sprint, so this (plus `ROADMAP.md` and the working `TODO.md`) is the memory.
> Newest first. Each entry: what shipped, the PR, and the human deploy hand-off.

---

## 2026-06-07 — Sprint C2: CI quality gates
**PR:** [#16](https://github.com/LochLogic/prism-advisor-workspace/pull/16) · **Branch:** `feat/c2-ci-quality-gates`

Shipped (all in-repo; CI enforces on every PR):
- **ESLint gate** (`npm run lint`, wired into the required `ci` job). The app's
  sources share one runtime scope (bare-name globals), so `scripts/lint.mjs` lints
  the **esbuild-transformed concatenation** — cross-file refs resolve for `no-undef`
  and JSX intrinsics become string literals, so only real identifier typos / name
  collisions flag. `build-files.mjs` is the shared source-file list (build + lint).
  Verified: clean on current code; `no-undef` confirmed to fire on a bad identifier.
- **Supply-chain:** `npm audit --audit-level=critical` in `ci` + `.github/dependabot.yml`
  (weekly npm + github-actions PRs, grouped). App has no runtime npm deps, so this
  guards the build/test toolchain.
- **Playwright e2e** (`e2e/demo.spec.ts`, new non-required `e2e` job): 1-click demo
  lands on the roadmap, mobile-viewport render, and a **regression guard for the C1
  DOB-picker fix**. Served by a dependency-free static server (`scripts/serve.mjs`).
  Verified locally: 3/3 pass.
- **Deploy gating:** `.github/workflows/deploy.yml` — manual, confirm-gated `db push`
  + function deploy. `supabase/config.toml` now declares each function's `verify_jwt`
  so deploys are reproducible (repo = source of truth).
- **Migration 023** — moves the `015` billing cron onto the Vault `cron_secret`
  lookup, so no `CRON_SECRET` literal remains in any migration.

**Finding (flagged in TODO H4):** `config.toml` sets `generate-invoices.verify_jwt = false`.
If it was previously deployed JWT-gated, the monthly billing cron (x-cron-secret, no JWT)
would have been platform-401'd — worth checking whether invoices ever generated.

**Human hand-off:** TODO H3 (#1 promote `rls-isolation`/`e2e` to required; #3 add
`SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` secrets + `production` environment to
enable `deploy.yml`) and H4 (apply migration 023; the deploy workflow then replaces hand-deploys).

---

## 2026-06-07 — Sprint C1: pre-live hardening + two UI bug fixes
**PR:** [#15](https://github.com/LochLogic/prism-advisor-workspace/pull/15) · merged to `main`

UI fixes (frontend — live via Cloudflare on merge):
- **DOB picker on newly-added members** (`numbers-panel.jsx`): `DobSelects` discarded
  partial Month/Day/Year picks, so a fresh member's controlled selects reverted and a
  DOB could never be set (seeded members had full DOBs, masking it). Now holds partial
  state, commits upstream only once complete.
- **Double tooltip**: `FieldHint` rendered both a native `title` and the styled bubble.
  Dropped `title`; `aria-label` + bubble remain.

C1 hardening (code; **migrations 021 + 022 applied to live & test**, but **functions
not yet redeployed** — see C2 PR's H4 hand-off):
- **`log-error` rate limit** — per-IP (20/min) + global (600/min) token bucket
  (migration 021); throttled requests dropped silently (204).
- **Telemetry retention** — daily cron prunes `client_errors` (>30d) + stale buckets.
- **Error alerting** (the "nobody is told" fix) — `error-digest` function + migration
  022 cron clusters new `client_errors` hourly → `ALERT_WEBHOOK_URL`. Inert/cursor-frozen
  until the webhook is set. `client_errors` stays service-role only (no operator role
  exists; exposing cross-tenant errors to a firm admin would leak). Cron secret read
  from **Supabase Vault**, not embedded in SQL.
- **Invoice idempotency** — already guaranteed by `unique(client,period)` (012); function
  now distinguishes a 23505 duplicate-skip from a real failure.

**Outstanding human items:** TODO H1 (test the `@prismaw.com` inboxes), H2 (Supabase Pro +
secret rotation — the #1 blocker), and the C1 function deploys (folded into H4).

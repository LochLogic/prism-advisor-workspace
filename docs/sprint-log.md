# Prism — Sprint Log

> Dated, append-only record of shipped sprints. The chat is cleared after each
> sprint, so this (plus `ROADMAP.md` and the working `TODO.md`) is the memory.
> Newest first. Each entry: what shipped, the PR, and the human deploy hand-off.

---

## 2026-06-07 — C0 close-out + C3 client invite + C5 portal bundle split

Closed the remaining actionable **§C0** code-review items, shipped the **C3 client
connect / invite flow**, and split the **client portal into its own bundle** (C5).

**C0 — remaining code-review fixes:**
- **De-duplicated drift-prone logic.** Tiered-fee math extracted to
  `supabase/functions/_shared/fees.ts` (imported by `generate-invoices`; kept
  byte-equivalent to `calc-core.annualFeeForAum`, the frontend source of truth).
  The audit-action label map is now a single `AUDIT_ACTION_LABELS` in `db.jsx`,
  referenced by both the firm-admin feed (`advisor-dashboard.jsx`) and the printed
  compliance report (`store.jsx`) — was duplicated.
- **Monte Carlo RNG note.** Added an explicit comment at the LCG in `calc-core.cjs`:
  fine for an illustrative band, must not back an "exact" figure (swap to mulberry32
  if ever surfaced as precise).
- **Fuller `ProfileProvider` memoization** (the C5-backlog item). `retirementReadiness`,
  `goalsFunding`, `riskProfile`, and the context **value object** are now memoized
  (keyed on profile/activeClientId) so they don't recompute on unrelated parent renders.

**C3 — client connect / invite flow (closes the "no client portal access" gap):**
- **Migration 024** (`024_client_invite.sql`): invite columns on `clients`
  (`invite_code`/`invite_email`/`invited_at`/`claimed_at`, partial-unique index) +
  two SECURITY DEFINER RPCs mirroring `px_provision_firm`: `px_create_client_invite`
  (advisor/firm-admin generates a single-use code) and `px_claim_client` (client
  redeems it → binds `clients.auth_user_id = auth.uid()`, consumes the code).
- Advisor UI: an invite banner in the client modal Overview (live clients) — generates
  a `/login.html?claim=<code>` link, copies it, shows connection state.
- Client flow: `login.html` stashes the `claim` code through the magic-link round trip;
  a freshly-authenticated user with no DB record redeems it (`ClaimInvite` in `app.jsx`),
  then lands on the portal. `db.createClientInvite` / `db.claimClient` added.
- Bonus correctness: the portal now binds a signed-in client's `activeClientId` to
  their own household (the first real client-role path; previously only the advisor's
  "Client view" reached the portal).

**C5 — client portal as its own bundle entry:**
- Second esbuild entry `dist/portal.js` (served at `/portal` via `portal.html`), built
  from a client-only source subset — **excludes** advisor-dashboard, firm-admin,
  advisor-modal, bulk-import. **~365KB → ~236KB** for a client (~35% smaller) and no
  advisor/admin code in a client browser (attack-surface win). Portal page also drops
  the Plaid CDN `<script>` (unused there).
- Refactor to enable it: `PerfChart` → `components.jsx`; shared shell
  (`LoadingScreen`, `NotificationBell`, `AccountChip`, `SecurityModal`, `ErrorBoundary`)
  → new `shell.jsx`; new slim `portal-app.jsx` shell. `build-files.mjs` now exports
  `sourceFiles` + `portalFiles` + `allFiles` (lint union); `build.mjs` builds both;
  `app.jsx` routes real (non-demo) clients to `/portal`.

Verified: `npm run build` (both bundles) + `npm run lint` + `npm run test:calc` +
`npm run check` all green; advisor demo (advisor + client views + client modal) and the
portal bundle smoke-checked in preview (no console errors). e2e left to CI (clean port).

**Human deploy hand-off:**
- **⚙️ Run migration 024** (`024_client_invite.sql`) in the Supabase SQL editor to
  activate the invite/claim flow — until then the advisor "Invite to portal" button
  errors and clients can't claim. No secrets/money involved.
- `generate-invoices` was edited (now imports `_shared/fees.ts`, no behavior change) —
  picks up on the next gated function deploy (TODO H4); not urgent (logic identical).
- Stripe webhook retry-storm hardening (🟢) — still **deferred by decision** (needs a
  money-adjacent `stripe-webhook` edge redeploy). Repo intentionally left in sync.

---

## 2026-06-07 — Code review + C0 fixes (batches 1 & 2)

Full architecture + granular code review of the whole codebase (all 16 src modules,
10 edge functions, build pipeline, RLS migrations). Findings logged as **§C0 in
`TODO.md`** (first in line, ahead of C3+) and in the **ROADMAP "Code-review findings"
table**. Two batches of low-risk, frontend-only fixes shipped (no migrations/secrets/
money). Live via Cloudflare on merge.

**Batch 1 (PR #24):**
- Generated alerts used `priority:'medium'` vs the app's `'med'` → rendered "FYI"
  instead of "Watch" + dead `is-medium` class. (`advisor-dashboard.jsx`)
- Memoized the 600-run Monte Carlo `successBand` — was unmemoized in the
  `ProfileProvider` render body, re-running on every keystroke in the Numbers drawer.
  (`store.jsx`)
- Removed dead `reconcileAssets` (superseded by `assetComposition`). (`store.jsx`)
- Memoized demo cash-flows so `perfPeriodsData` doesn't bust each render.
  (`client-portal.jsx`)

**Batch 2 (PR #25):**
- **Post-checkout redirect (High)** — Stripe `success/cancel_url` returned to
  `/index.html` (marketing) after the `/app/` routing split, so the in-app billing
  toast handler never ran. `firm-admin.jsx` now passes `origin + '/app'` (fixed
  frontend-side to avoid a money-adjacent edge redeploy).
- **Save-on-switch data loss (Med)** — the load effect cancelled the 1.5s debounced
  profile save on client switch, dropping the last <1.5s of live-client edits.
  `store.jsx` now flushes the pending save before switch + on unmount.
- **KPI under-count on large books (Med)** — Book AUM / cash drag / counts were
  computed over the loaded 50-row roster page only. New `db.getBookTotals()`
  aggregates across all active clients (fallback to the loaded slice / demo).
  (`db.jsx`, `advisor-dashboard.jsx`)

Verified: `npm run build` + `npm run lint` + `npm run test:calc` green on both;
demo client portal + advisor KPIs smoke-checked in preview (no console errors).

**Still open in §C0 (next session):**
- Stripe webhook retry-storm hardening (🟢) — **deferred by decision; needs a
  money-adjacent `stripe-webhook` edge redeploy.** Repo intentionally left in sync
  with what's deployed.
- De-dup fee math (`calc-core` ↔ `generate-invoices`) + the audit-label map ×3 (🟢).

**Human hand-off:** none for what shipped. The webhook fix, when picked up, needs
the gated edge-function deploy (`deploy.yml`) with your go.

---

## 2026-06-07 — Sprint C3/C4: CSV import + wedge deepeners

Frontend only — no migrations, no secrets, no money. Live via Cloudflare on merge.

Shipped:
- **Bulk CSV client import** (C3, advisor) — `BulkImportModal` in `advisor-modal.jsx`:
  dependency-free CSV parser (quoted fields, embedded commas/newlines), auto-detected
  column mapping with **Wealthbox / Redtail / Orion** presets + a generic auto-detect,
  a live preview, then a create loop that reuses `createClient` + `saveProfile` (+ a
  placeholder account when AUM is mapped, via `upsertAccount`/`syncClientTotals`).
  Live-only (DB layer no-ops without real UUIDs). Buttons on the roster header and the
  empty-roster state. Sample export at `docs/samples/sample-clients.csv`.
- **Probability-of-success band** (C4, client) — surfaces the existing seeded
  `calc-core.monteCarlo` as a confidence band on the retirement-readiness card
  (success % + bear/median/bull range). Derived in `store.jsx` (`successBand`),
  rendered in `client-portal.jsx`. Per-client seed → stable figure.
- **Risk questionnaire → recommended mix + draft IPS** (C4) — new
  `calc-core.riskProfile` (score → band → strategic allocation; unit-tested).
  Client takes a 6-question questionnaire (`RiskProfileCard`, stored in
  `profile.risk.answers`); the band + equity/FI/cash mix feed the portal and the
  advisor Overview. Advisor "Draft IPS" prefills an acknowledgement for e-sign and
  "Print IPS" renders a full draft via `printIPSReport` for the vault.
- **One-click QBR packet** (C4, advisor) — `printQBRReport` assembles roadmap
  progress + retirement readiness + probability band + goals + protection +
  net-of-fee performance into a client-ready PDF. "QBR packet" button in the client
  modal header; gathers task states + performance on demand.

Verified: `npm run build` + `npm run lint` + `npm run test:calc` (incl. new
riskProfile tests) all green; client portal + advisor modal smoke-checked in the
demo (probability band, risk card, QBR generate, no console errors).

**Human hand-off:** none for these features. Standing pre-live blockers unchanged
(H2 Supabase Pro + secret rotation; H3 repo/host settings). White-label branding
(C3) was scoped this round but **not built** — see TODO C3 note.

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

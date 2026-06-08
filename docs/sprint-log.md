# Prism — Sprint Log

> Dated, append-only record of shipped sprints. The chat is cleared after each
> sprint, so this (plus `ROADMAP.md` and the working `TODO.md`) is the memory.
> Newest first. Each entry: what shipped, the PR, and the human deploy hand-off.

---

## 2026-06-08 — DocuSign real e-sign + Cloudflare Analytics CSP fix

Two items: legally-binding e-signature on top of acknowledgements (Tier-A "real e-sign"
integration), and a CSP fix so Cloudflare's auto-injected Web Analytics beacon stops
being blocked.

**DocuSign e-sign** (extends migration-017 acknowledgements with a second provider):
- **Migration 027** (`027_docusign_envelope.sql`): adds `provider` (`prism|docusign`,
  default `prism`), `envelope_id`, `envelope_status`, `sent_at` to `acknowledgements`;
  unique partial index on `envelope_id`; provider CHECK constraint. No new RLS — the
  existing select policies cover the new columns; all writes are by service-role functions.
- **`_shared/docusign.ts`**: JWT-grant auth (RS256 over the integration's RSA key via
  `npm:jsonwebtoken`), token exchange, and REST base resolution from `/oauth/userinfo`.
- **`docusign-envelope`** edge function (JWT-verified, advisor-triggered): confirms the
  caller may touch the ack via an RLS-scoped read, resolves the signer email
  (`clients.invite_email` → claimed auth user email), creates + sends an HTML-document
  envelope with a `/sig1/` anchor signature tab (email ceremony, not embedded), and
  stamps `provider/envelope_id/envelope_status/sent_at`. Audit: `ack.docusign_sent`.
- **`docusign-connect`** edge function (public, HMAC-verified over the raw body via
  `DOCUSIGN_CONNECT_HMAC_KEY`): DocuSign Connect webhook → on envelope `completed`, flips
  the ack to `acknowledged` (+ `signer_name` from the recipient). Audit: `ack.docusign_completed`.
- **Frontend**: `db.sendDocusignEnvelope(ackId)`; advisor modal gains a **DocuSign** button
  on pending acks (shows *Sent · awaiting signature* / *Viewed* / *Signed*); client portal
  shows a "check your email" note for DocuSign-provider acks instead of the type-name box.
- **config.toml + deploy.yml**: both functions registered (`docusign-envelope` verify_jwt=true,
  `docusign-connect` verify_jwt=false) and added to the manual deploy loop.
- **Security**: credentials (integration key, user/account ids, RSA private key) live **only**
  as Supabase Function secrets — never in the repo. `docs/DocuSign.txt` is git-ignored.
  Operator activation steps in **`docs/docusign-setup.md`** (migration → secrets → JWT consent
  → deploy → Connect webhook → smoke test).

**Cloudflare Web Analytics CSP fix** (`build.mjs`):
- Cloudflare's zone-injected beacon (`static.cloudflareinsights.com`) was blocked by the
  host-locked `script-src`. Added `https://static.cloudflareinsights.com` to `script-src`
  (host-allow-listed, not hashed — Cloudflare versions that script) and
  `https://cloudflareinsights.com` to `connect-src` (the RUM collection endpoint).
- Verified in `_site/_headers` after build; `npm run lint` + `node build.mjs` green.

**PR:** #30 (pending). **Ships live:** the CSP fix deploys with the static site on merge
(Cloudflare Workers Builds). **DocuSign stays inert** until the operator runs migration 027,
sets the `DOCUSIGN_*` secrets, grants JWT consent, deploys the two functions (manual
`deploy.yml`), and configures Connect — see `docs/docusign-setup.md` (now tracked in TODO H5).

---

## 2026-06-08 — C5 batch: deep-link routing + client uploads + retention/rollup

Three independently-shippable **§C5** items, plus the user's secret rotations recorded.

**Deep-linkable in-app routing** (closes the React-state-only nav gap):
- `ViewProvider` (`src/store.jsx`) now mirrors nav state ↔ URL hash on the advisor/admin
  app: `#/advisor` · `#/admin` · `#/client` · `#/client/<uuid>` · `#/client/<uuid>/p<phaseId>`.
  Initial state reads the hash (falls back to `localStorage`/default); a `replaceState`
  effect writes it (shareable URL, no history spam); a `hashchange` listener restores
  state from a pasted/edited link. Scoped off `window.__pxIsPortal` — the slim client
  portal is single-view, so routing is advisor-app only.
- `app.jsx`: a module-level `__pxHadDeepLink` capture stops the role-based view-homing
  effect from clobbering an explicit deep link on first load.
- `advisor-dashboard.jsx`: resolves the active client's *display* object from a deep-linked
  id once the roster loads (data already keys off `activeClientId`).
- Verified in browser preview: hash↔view sync both directions, `#/client/c001/p3` opens the
  client + consumes the phase, no console errors.

**Client-initiated uploads** (§C5):
- The portal document vault now lets **clients upload** (advisor-only **delete** preserved —
  advisor-shared files live under the same `<client_id>/` storage prefix, so clients get no
  delete). `db.uploadDocument` takes an `uploadedByRole` option; `DocumentVault` gates on a
  new `canUpload`; client-portal passes `firmId`/`advisorId`.
- **Migration 025** (`025_client_document_upload.sql`): adds the missing client **INSERT**
  policies on both `documents` and `storage.objects` (scoped to own `client_id` /
  `uploaded_by_role='client'`). *Correction:* the `documents` table had **no** client-insert
  policy — only the `uploaded_by_role` check value allowed 'client', so the prior
  "already-allowed path" assumption was wrong; uploads were impossible until this.

**Retention / rollup** (§C5 — bound the only-grow tables before a firm with history loads):
- **Migration 026** (`026_retention_rollup.sql`): `px_prune_audit_log()` deletes audit rows
  > **7 years** (margin over SEC 17a-4's 6-yr books-&-records floor); `px_rollup_balance_history()`
  keeps daily points for 24 months then collapses older history to one month-end row per
  account; monthly `pg_cron` job `prism-retention-rollup` (04:20 UTC, 1st). (`client_errors`
  already had 30-day retention from migration 021.)
- **Decision:** retention/rollup over native monthly partitioning. Partitioning is the textbook
  answer but a live-table rebuild-and-swap can't be exercised without a real Postgres and is
  risky to apply blind; the retention/rollup achieves the actual goal (bounded growth) in plain,
  reviewable SQL. Native partitioning noted as a future optimization if volumes demand it.

**Security rotations (done by user, recorded here):**
- Supabase **service-role key**, **access/personal token**, and **`CRON_SECRET`** rotated.
  ⚠️ Open verification: confirm the new `CRON_SECRET` was stored in **Supabase Vault**
  (`select vault.create_secret('<new>', 'cron_secret');`) — both cron jobs read it from Vault,
  so a skipped Vault step fails them silently. Stripe + Plaid keys still pending (TODO H2.2).
- **CI gating:** `rls-isolation` + `e2e` promoted to required checks on `main` (TODO H3 item closed).

**Decisions logged:** C4 AI assistant + H5 will target the **Gemini** API (not Anthropic) — user
already holds a Gemini key; nothing was built against a provider yet. E-sign provider = **DocuSign**.

**Human deploy:** run migrations **025** + **026** (and **024** if not yet applied). No
secrets/money in the migrations.

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

---

## 2026-06-07 — Human infra items closed (no code)
- **`ALERT_WEBHOOK_URL` set** (Supabase Edge Function secret → Discord webhook). C1 error alerting is now wired; `error-digest` flushes its backlog on first hourly run. *Caveat: Discord requires the `…/slack` URL variant to accept the `{text}` payload.*
- **Per-PR Cloudflare preview deploys enabled** — "Builds for non-production branches" checked on the Worker (confirmed by screenshot). Branches now get a Preview URL + PR comment.
- **Migrations 025 + 026 run** on live (client document uploads + retention/rollup cron).
- **Gemini API key received** for C4 AI assistant — recorded in Claude memory (outside repo); build deferred, not yet in Supabase secrets.

## 2026-06-07 — More human infra items closed (no code)
- **`GEMINI_API_KEY` stored** in Supabase Edge Function secrets (build still deferred). Unblocks C4 AI assistant.
- **Wildcard DNS `*.prismaw.com` live** — proxied CNAME `*` → `prismaw.com` + Worker route `*.prismaw.com/*`. Unblocks the custom-subdomain half of C3 white-label.
- **Microsoft OAuth instructions revised** — personal gmail Microsoft account has no Entra tenant and "create app outside a directory" is deprecated; H5 now routes through M365 Dev Program / free Azure tenant first.

---

## 2026-06-08 — Sprint C5-CSP: close `style-src 'unsafe-inline'`
The last CSP hole. **The roadmap/TODO premise was wrong** — it assumed dropping
`style-src 'unsafe-inline'` required migrating ~777 React `style={{}}` props. It did
not: React's `style={{}}` sets properties via the **CSSOM** (`el.style.x = y` /
`setProperty`), and **CSP does not gate CSSOM** — only `<style>` elements
(`style-src-elem`) and parsed `style=""` attributes / `setAttribute('style')`
(`style-src-attr`) are gated. Verified empirically with Playwright before touching app
code (CSSOM applied under `style-src 'self'`; only `setAttribute('style')` was blocked).

**The actual blocked surface (all fixed):**
- **8 static inline `<style>` blocks** (landing/login/signup/security/privacy/terms/dpa
  + the content-page template) → now **SHA-256-hashed at build time**, exactly like the
  inline-script hashes already were. `build.mjs` gained a parallel `<style>`-hash pass.
- **~90 inline `style=""` attributes** (31 in static HTML + content, ~60 in `store.jsx`'s
  print-report template literals) → **migrated to classes**. Print-report styles became a
  small fixed vocabulary in the new **`src/print.css`** plus utility classes; static-page
  attrs became per-page utility classes appended to each page's existing `<style>` block.
- **Print popup** (`store.jsx _openPrint`, a `window.open('')` + `document.write`) inherits
  the opener's CSP (verified), so its old inline `<style>` would have broken. Now it **links
  the same-origin `/src/print.css`** (`'self'` covers it) and prints on stylesheet `load`
  (CSP forbids an inline `onload=`, so the listener is attached from the opener).
- **Latent CRLF bug fixed:** the inline-hash passes hashed raw bytes, but the HTML parser
  normalizes CRLF→LF before the browser hashes — so on a CRLF checkout (Windows) every hash
  mismatched and the whole CSP broke. Hashes are now computed over LF-normalized bytes
  (no-op on the LF checkouts CI uses; correct on CRLF). This also hardened the pre-existing
  *script* hashing.

**CSP now:** `style-src 'self' <sha256 per inline style block> https://fonts.googleapis.com`
— no `'unsafe-inline'`. Both `script-src` and `style-src` are now hash-hardened.

**Guards added:** `check.mjs` asserts `style-src` has no `'unsafe-inline'`, allow-lists
inline styles by hash, and that **no served page contains a `style=""` attribute**.
`scripts/serve.mjs` (preview + e2e server) now applies the real `_headers` CSP, so e2e runs
under the production policy.

**Verification:** custom CSP-applying server + Playwright → **0 CSP violations across 10
served pages** (landing, login, signup, security, app, portal, a content page, privacy,
terms, dpa) and a **working print popup** (`print.css` loads, classes apply). `npm test`
(build + check + calc) green; lint clean; **e2e 3/3 green under the enforced CSP**. Visual
spot-check of landing + login screenshots = intact.

**Files:** `build.mjs` (style-hash pass, LF-normalize, copy + hash `print.css`, drop
`'unsafe-inline'`), `scripts/check.mjs` (style-src guards), `scripts/serve.mjs` (apply CSP),
`src/print.css` (new), `src/store.jsx` (print reports → classes + external sheet),
`landing.html`, `login.html`, `signup.html`, `security.html`, `content/pages.mjs`.

**Not touched:** the ~777 React `style={{}}` props (intentionally — CSSOM, CSP-exempt).

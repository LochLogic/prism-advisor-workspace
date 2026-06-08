# Clean-Room Code Review — 2026-06-08

A rigorous, four-pass review of the PRISM Advisor Workspace. Scope: the full
runtime — build system, client bundle (`src/*.jsx`), data-access layer, Supabase
RLS migrations (001–027), and the 12 Deno edge functions. `node_modules`, `dist`,
`_site`, and vendored libraries were excluded.

**Overall:** this is a mature, carefully-built codebase. RLS is the security
backbone and is applied consistently; edge functions verify Stripe signatures,
gate cron jobs with a constant-time secret, and resolve the acting advisor from a
JWT-bound client before touching the service role; XSS sinks all route through
`sanitizeHtml`/`escapeHtml`; the slim `/portal` bundle genuinely shrinks the
client attack surface. The findings below are the exceptions, not the rule.

Two findings rise to **CRITICAL** (a fail-open signature webhook and a forgeable
audit log), and both undermine the *compliance* positioning that is the product's
differentiator. They should be fixed before any production pilot with live client
data.

---

## Pass 1 — Architecture, State & Data Flow (the wide lens)

**Shape of the system.** A dependency-light SPA: source files concatenate (no
module system) into `dist/bundle.js` via `build.mjs` + esbuild, sharing one global
scope through `window.*` and bare-name globals. State is React context only
(`ProfileProvider`, `TaskProvider`, `ViewProvider`, `NotificationProvider`,
`ProspectProvider`) — no Redux/Zustand. Every byte of persistence and tenant
isolation lives in Supabase Postgres + RLS. This is a coherent, defensible choice
for the size of the app.

**Strengths**
- The identity model is consistent end-to-end: `authUser.id` = `advisors.id`
  (or `clients.id` for portal users), while `window.__pxAuthActor.id` = the auth
  `uid` used for `audit_log.actor_id`. Realtime filters, `getTasks`, `getClients`,
  and `alerts` subscriptions all key off the right one.
- `calc-core.cjs` is correctly extracted as the single source of truth for
  financial math, dual-mode (`module.exports` for Node tests, `window.PrismCalc`
  in the browser), and the heavy memoized derivations (`monteCarlo`,
  `retirementReadiness`) are keyed on real inputs in `store.jsx`.
- The debounced profile autosave in `ProfileProvider` is unusually careful: a
  `pendingSave` ref is flushed before a client switch and on unmount so the last
  <1.5 s of edits aren't dropped when the load effect cancels the timer.

**Structural concerns** (detailed as findings below)
- The phase library has **two parallel, conflicting schemas** (migration 001's
  per-firm white-label tables vs migration 005's global table that *replaces* the
  resolving view). The white-label feature documented in 001/README is silently
  dead. → **MAJOR M2**.
- Cross-file coupling via bare-name globals is load-order-fragile: `firm-admin.jsx`
  depends on `useStateAdv`/`useMemoAdv`/`RosterSkeleton`/`KpiTile`/
  `INVOICE_STATUS_TONE`/`AUDIT_ACTION_LABELS` all defined in
  `advisor-dashboard.jsx`. `build-files.mjs` pins the order, but nothing *enforces*
  it; a reordering breaks the build silently. (Acceptable given the documented
  architecture, but worth a lint guard.)
- `phasesData` is a module-level `let` that `auth.jsx` **reassigns** after the DB
  fetch — but `window.phasesData` (assigned once in `data.jsx`) and
  `advisor-modal.jsx`'s `const PHASES = phasesData.map(...)` (computed at module
  load) capture the *original* array and never update. → **MINOR**, latent only
  because the DB phases currently equal the JS defaults.

---

## Pass 2 — Logic, Bugs & Edge Cases (the deep lens)

- **Flagged-question reply thread is non-functional for live clients**: the UI
  keys off `q._dbId`, which `mapFlaggedQuestion` never sets. → **MAJOR M1**.
- **QBR / advisor-side retirement-readiness compute `annualExpenses` from
  `Object.values(profile.expenses)`**, which folds the `custom` *array* in as a
  `NaN→0` term and silently omits every custom expense line item — so the
  client-facing QBR PDF can show a *different* readiness verdict than the portal
  (which sums `custom` properly in `store.jsx`). → **MAJOR M5**.
- `monteCarlo` uses a tiny LCG (period 233,280). Correctly documented as
  illustrative-only and never surfaced as a precise probability — acceptable, but
  the 600-run band can alias on the short period. → MINOR/noted.
- `estateProjection` hard-codes `exempt = 13_990_000` (a single tax year's federal
  estate exemption, which sunsets). It's an overridable default, but stale-by-design
  for a forward-looking projection. → MINOR.
- `store.jsx` `update(path, value)` does a full `JSON.parse(JSON.stringify(prev))`
  deep clone of the entire profile on **every keystroke** in the Numbers drawer —
  O(n) over the whole household ledger per character. → MINOR (perf).
- After an async profile *load* completes, the persist effect re-fires (because it
  depends on `[profile]`) and schedules a redundant `saveProfile` of the
  just-loaded data 1.5 s later. Harmless but a wasted write + audit/version row.
  → MINOR.
- `NotificationProvider.seenIds` is an ever-growing `Set` (dedupe cache) with no
  eviction — a slow leak across a long-lived advisor session. → MINOR.
- Several `dbResolveQuestion`, `dbSnoozeAlert` calls don't `isUUID`-guard the id
  before `.eq('id', …)` (unlike their siblings). RLS still protects them; cosmetic
  inconsistency. → MINOR.

---

## Pass 3 — Security & Isolation

**The RLS model is the backbone and is applied with discipline.** Every tenant
table enables RLS; helper functions (`px_current_advisor_id/firm_id/client_id`,
`px_is_firm_admin`) are `security definer stable` and pinned to
`search_path = public, pg_temp` (migration 018). The firm→advisor→client policies
read correctly, the invite/claim handshake (024) is single-use + email-scoped +
idempotent, the document vault scopes Storage objects by the `client_id` path
segment (020/025), and acknowledgement *signing* is done only through a
`security definer` RPC that validates ownership and `status='pending'` (017) — a
client gets **no** direct `UPDATE` on acknowledgements.

Two exceptions break the model, plus one deployment dependency:

- **DocuSign Connect webhook fails open on signature verification.** → **CRITICAL C1**.
- **`audit_log` rows are forgeable and cross-tenant-injectable.** → **CRITICAL C2**.
- **Realtime tenant scoping depends on Supabase "Postgres Changes" RLS being
  enabled.** `subscribeAllMessages` subscribes to *all* INSERTs on `messages` and
  relies on the Realtime server applying each subscriber's SELECT policy. This is
  correct *if and only if* Realtime authorization/RLS is enabled for the
  publication. → **MAJOR M4** (verify, not necessarily a code defect).
- Plaid `access_token` is persisted in plaintext (`aggregation_items`). → **MAJOR M3**.

Good controls worth keeping: Stripe webhook `constructEventAsync` signature check;
`create-checkout-session` / `plaid-exchange-token` / `generate-invoices` /
`worm-export` all resolve the user from a JWT-bound anon client (RLS) *before*
using the service role, with admin-role checks where appropriate; `safeEqual`
constant-time cron-secret comparison; `log-error` is rate-limited (per-IP + global
token buckets, 021) and length-capped; CSP has no `unsafe-inline` and hashes every
inline script/style at build time.

---

## Pass 4 — Idiomatic Clean Code & Maintainability

- The dual phase schema (001 vs 005) is the largest cognitive-load trap: an
  operator running migrations in order ends up with `phase_library_platform`,
  `phase_library_firm`, **and** `phase_library`, where only the last is read. New
  contributors cannot tell which is authoritative. → tied to **M2**.
- `advisor-modal.jsx` is 2,101 lines and `store.jsx` 1,329; both would benefit
  from extraction (the print-report renderers in `store.jsx`, the per-tab bodies in
  the client modal), but they are internally consistent and well-commented.
- The demo/live branching (`isLive = window.db?.isUUID(clientId)`) is repeated in
  ~10 components. It works and is readable, but a single `useEntitySource` hook
  would remove a lot of duplicated `if (!isLive) { …local… } else { …db… }`.
- CSV export does not neutralize spreadsheet formula injection (a cell beginning
  `=`/`+`/`-`/`@`). Low risk under the current trust model (an advisor exporting
  their own book), but a one-line guard is cheap. → MINOR.
- Tab-load effects in the client modal use `[tab]`-only dependency arrays and read
  `client`/`accounts` via closure; they're guarded by `!== undefined` sentinels and
  a `client?.id` reset effect, so they're correct, but they read as fragile and
  trip `exhaustive-deps`. → MINOR.

---

## Status — all CRITICAL + MAJOR fixed (2026-06-08)

Resolved the same day on branch `harden/critical-major-2026-06-08`; see the
[sprint log](sprint-log.md) for the deploy hand-off (migrations 028–030, edge
deploy, Realtime-RLS verification).

| ID | Status | Where |
|----|--------|-------|
| C1 | ✅ Fixed | `docusign-connect` fails closed (HMAC) |
| C2 | ✅ Fixed | migration `028` `px_audit()` + drop `audit_insert_self`; `db.jsx` |
| M1 | ✅ Fixed | `_dbId` in `mapFlaggedQuestion`; demo thread local |
| M2 | ✅ Fixed | migration `029` rebuilds white-label; `auth.jsx`/`advisor-modal` staleness |
| M3 | ✅ Fixed | migration `030` Vault + `plaid-exchange-token` |
| M4 | ✅ Mitigated (verify) | client backstop in `advisor-dashboard.jsx`; **verify Realtime RLS at deploy** |
| M5 | ✅ Fixed | `calc-core.monthlyExpenseTotal()` shared everywhere |

MINOR/CLEANUP items remain open by design (low priority); the `window.phasesData`
/ `PHASES`-stale item was fixed as part of M2.

---

# Findings by impact

## CRITICAL

### C1 — DocuSign Connect webhook verifies signatures *fail-open*

- **File & Location:** `supabase/functions/docusign-connect/index.ts`, `verifyHmac()` (lines 26–44), invoked at line 57.
- **The Issue:** When `DOCUSIGN_CONNECT_HMAC_KEY` is unset, `verifyHmac` logs a
  warning and `return true` — i.e. it *accepts the request without verifying it*.
  The handler then resolves the acknowledgement solely by the attacker-supplied
  `envelopeId` and, using the **service role**, sets `status='acknowledged'`,
  `acknowledged_at`, and `signer_name` — the legally-meaningful "signed" state.
  Migration 027 even documents this endpoint as "HMAC-verified," but the code's
  default posture is the opposite. The acknowledgement table is otherwise
  hardened (clients can't UPDATE; the typed-name path is a `security definer` RPC),
  so this webhook is the *only* unauthenticated way to flip a record to "signed."
- **The Risk:** With the secret unset (the demo/default posture — and e-sign is
  already marked "activated (demo)"), anyone who can reach the public function and
  knows or guesses an envelope id can forge completion of a binding e-signature:
  an IPS, ADV, or fee disclosure shows as *signed by the client* with no real
  signature. For a product sold on a compliance-grade audit trail, a forged
  signature record is a material legal/regulatory exposure. The forged event is
  also written into `audit_log` as `ack.docusign_completed`, laundering it into the
  "immutable" trail.
- **The Fix (draft):** Fail **closed**. Treat a missing key as a hard error in
  production: `if (!key) { return json({ error: "signature verification not configured" }, 503); }`,
  gated behind an explicit, non-default `DOCUSIGN_ALLOW_UNVERIFIED=1` flag for local
  demo only. Keep the constant-time compare. As defense-in-depth, before flipping
  to `acknowledged`, confirm the row's `envelope_id` was set by `docusign-envelope`
  (i.e. `provider='docusign'` and `sent_at` present) so a webhook can only complete
  an envelope this system actually issued.

### C2 — `audit_log` rows are forgeable and cross-tenant-injectable

- **File & Location:** `supabase/migrations/006_audit_compliance.sql`, policy
  `audit_insert_self` (lines 41–44); writers in `src/db.jsx` `dbAudit()` (lines 30–49).
- **The Issue:** The only INSERT check is `actor_id = auth.uid()`. Every other
  column — `actor_role`, `action`, `summary`, `firm_id`, `client_id`, `metadata`,
  `entity_*` — is supplied by the **authenticated client** (the browser, via the
  anon key) and is unvalidated. Any signed-in user (including a portal *client*)
  can insert audit rows asserting `actor_role='admin'`, an arbitrary `summary`/
  `action`, and — critically — **another firm's `firm_id`**. Because
  `audit_select_admin` filters reads only by `firm_id = px_current_firm_id()`, a
  forged row with a victim firm's id surfaces in *that firm admin's* compliance
  feed.
- **The Risk:** The append-only "SEC 17a-3 audit trail" — the product's headline
  compliance claim — can be polluted with fabricated entries, false actor
  attributions, and cross-tenant noise injected into another firm's compliance
  view. This is integrity corruption of the record of record; it also means the
  trail cannot be relied upon in an actual examination. (Append-only protects
  existing rows from edits, but does nothing about forged *new* rows.)
- **The Fix (draft):** Stop letting clients write audit columns directly. Route all
  app-side audit writes through a `security definer` function
  (`px_audit(action, entity_type, entity_id, client_id, summary, metadata)`) that
  stamps `actor_id := auth.uid()` and derives `actor_role`/`actor_email`/`firm_id`
  from the caller's `advisors`/`clients` row — never from the request body —
  and verifies any supplied `client_id` belongs to the caller's firm. Then drop the
  permissive `audit_insert_self` policy (or restrict inserts to the function's
  context). The service-role edge functions already stamp these fields correctly
  and can keep their direct inserts.

## MAJOR

### M1 — Flagged-question reply thread is broken (missing `_dbId`)

- **File & Location:** `src/db.jsx` `mapFlaggedQuestion()` (lines 578–589) vs
  `src/advisor-dashboard.jsx` `FlaggedQuestion` (lines 213–230).
- **The Issue:** The reply component loads and sends exclusively via `q._dbId`
  (`getFlagMessages(q._dbId)`, `addFlagMessage(q._dbId, …)`), and both functions
  early-return when it's falsy. But `mapFlaggedQuestion` returns `{ id, clientId,
  timeAgo, quote, context, _clientName }` — it **never sets `_dbId`** (contrast
  `mapAlert`, which does: `_dbId: a.id` at db.jsx:710). So `q._dbId` is `undefined`
  for every live question: `loadMessages` returns before fetching (thread stays
  stuck on "Loading…"), and `sendReply` returns before any DB call (the Send button
  silently no-ops).
- **The Risk:** "Two-way flagged-question threads" is an advertised feature, and it
  does not work for any real client — the advisor can open the thread, type a reply,
  and nothing is sent or shown, with no error. Clients' flagged questions appear to
  go unanswered.
- **The Fix (draft):** Add `_dbId: q.id` to the object returned by
  `mapFlaggedQuestion` (mirroring `mapAlert`), or change the component to use
  `q.id`. Confirm the `flag_messages_advisor` RLS path (migration 004) by sending a
  reply end-to-end. (Demo `questionsData` will still no-op without a DB, which is
  acceptable — or give it local state like the other demo flows.)

### M2 — Per-firm phase white-label is dead; two conflicting phase schemas ship

- **File & Location:** `supabase/migrations/001_prism_schema.sql` (lines 127–158,
  271–300) vs `supabase/migrations/005_phase_library.sql` (lines 43–113).
- **The Issue:** Migration 001 builds the white-label machinery: `phase_library_platform`,
  `phase_library_firm`, the `phaselib_firm_write` admin RLS, and a
  `phase_library_resolved` view that COALESCEs firm overrides over platform
  defaults. Migration 005 then `drop view if exists phase_library_resolved` and
  recreates it reading a **new, global** `phase_library` table — with **no** join to
  `phase_library_firm` and no `firm_id` scoping (`using (true)`). The app
  (`db.jsx getPhases` → `auth.jsx mergePhasesWithDB`) reads only this resolved view.
  Net effect: the 001 override tables are orphaned, and the documented per-firm
  phase customization (README "Phase content can be FIRM-OVERRIDDEN (white-label)")
  silently does nothing.
- **The Risk:** A promised differentiator is non-functional; an operator running
  the migrations in order is left with three phase tables where only one is live,
  with no signal as to which is authoritative — a latent source of "why doesn't my
  firm's custom phase copy show up?" support load and future data drift. It also
  masks **M4-adjacent** latent bugs (see Pass 1) by keeping DB phases identical to
  the JS defaults.
- **The Fix (draft):** Decide the model explicitly. Either (a) recommit to
  white-label: rebuild `phase_library_resolved` on 005's `phase_library` LEFT JOIN
  a per-firm override table, restoring firm scoping; or (b) formally retire the
  white-label design: drop `phase_library_platform`/`phase_library_firm` and their
  policies in a new migration and update README/001's comments. Either way, ship one
  schema, and add a comment in 005 noting it supersedes 001's view.

### M3 — Plaid `access_token` stored in plaintext at rest

- **File & Location:** `supabase/functions/plaid-exchange-token/index.ts` (lines 78–81).
- **The Issue:** The exchanged Plaid `access_token` — a long-lived credential that
  reads the client's linked bank/brokerage balances — is written verbatim into
  `aggregation_items.access_token`. The table is (correctly) service-role-only, but
  the secret itself is unencrypted.
- **The Risk:** Any read access to that table or a database backup/dump yields live
  aggregation credentials for every linked household — a high-value secondary
  target after any DB compromise, and arguably in scope for the firm's own data
  obligations.
- **The Fix (draft):** Encrypt at rest. Store the token via Supabase Vault
  (`vault.create_secret`) or `pgsodium` and persist only the secret id, decrypting
  inside the edge function when a refresh is needed; or at minimum envelope-encrypt
  with a key held in function env (not the DB). Document the control in the
  go-live checklist alongside the existing object-lock/WORM note.

### M4 — Realtime tenant isolation depends on "Postgres Changes" RLS being enabled

- **File & Location:** `src/db.jsx` `subscribeAllMessages()` (lines 1071–1079);
  also the `alerts`/`flagged_questions`/`meetings`/`flag_messages` realtime
  publications (migrations 003, 004, 019).
- **The Issue:** `subscribeAllMessages` deliberately subscribes to **all** INSERTs
  on `messages` with no client-side tenant filter, "RLS scopes the stream." That is
  true only if Supabase Realtime authorization (RLS on `realtime.messages` / the
  publication) is actually enabled for the project — `alter publication … add
  table` (the migrations) makes a table *broadcast*, but RLS enforcement on the
  change feed is a separate project setting. If it is off, every advisor's browser
  receives every firm's message inserts.
- **The Risk:** Cross-tenant disclosure of message contents (and sender/client ids)
  over the realtime channel — a confidentiality breach that the row-fetch paths
  would never allow. This is the one place the app relies on a configuration outside
  the SQL in this repo to hold a tenant boundary.
- **The Fix (draft):** Treat it as a release gate: verify Realtime RLS is enforced
  (subscribe as advisor A, INSERT a message for advisor B's client via service role,
  confirm A receives nothing) and capture it in the rls-isolation CI suite. As
  defense-in-depth, have `subscribeAllMessages` drop payloads whose `client_id`
  isn't in the advisor's known roster, so a misconfiguration degrades to "no dot"
  rather than a leak.

### M5 — QBR / advisor readiness drop custom expenses → wrong client-facing numbers

- **File & Location:** `src/advisor-modal.jsx` `generateQBR` (line 1027) and the
  Overview readiness block (line 1235): `Object.values(pd.expenses || {}).reduce(
  (a, b) => a + (Number(b) || 0), 0) * 12`.
- **The Issue:** `profile.expenses` contains scalar categories **and** a `custom`
  *array* of `{label, amount}`. `Object.values` includes that array; `Number([...])`
  is `NaN` (→0), so every custom expense line item is silently excluded from the
  annual-expense base used for retirement readiness and the Monte Carlo withdrawal.
  `store.jsx`'s `totalExpenses` (the portal's source of truth) *does* include
  `custom`. So a household with custom expenses gets a **higher** readiness/funded
  ratio in the advisor's QBR PDF and Overview than in the client's own portal.
- **The Risk:** The client-facing Quarterly Business Review and the portal show
  divergent "are we on track?" verdicts and probability-of-success figures for the
  same household — a correctness and trust problem in exactly the numbers an
  advisory relationship is judged on.
- **The Fix (draft):** Compute the expense base the same way everywhere — sum the
  fixed keys plus `custom[].amount`, ideally by exposing a small shared helper from
  `calc-core.cjs` (e.g. `monthlyExpenseTotal(expenses)`) and calling it from
  `store.jsx`, `generateQBR`, and the Overview block so the three can't drift again.

## MINOR / CLEANUP

- **`window.phasesData` / `PHASES` go stale after the DB phase load.** `auth.jsx`
  reassigns the bare `phasesData` `let`, but `window.phasesData` (data.jsx:366) and
  `advisor-modal.jsx:5` `const PHASES` captured the original array at module load
  and never refresh. Benign today (DB == defaults; and M2 keeps them equal), but a
  trap if phases ever diverge. Recompute `PHASES` from `phasesData` at render, and
  drop or refresh `window.phasesData`.
- **CSV export lacks formula-injection neutralization** (`advisor-dashboard.jsx`
  `exportCSV`). Prefix cells beginning with `= + - @` with a `'`. Low risk under the
  advisor-exports-own-data trust model.
- **`store.jsx update()` deep-clones the whole profile per keystroke**
  (`JSON.parse(JSON.stringify(prev))`). Use a shallow path-copy (clone only the
  touched branch) to cut O(n) churn in the Numbers drawer.
- **Redundant post-load autosave.** The `[profile]`-keyed persist effect re-fires
  after an async load and schedules a no-op `saveProfile` (plus an audit + version
  row) 1.5 s later. Skip the save when the new profile equals what was just loaded
  (a ref flag, or compare against the loaded snapshot).
- **`NotificationProvider.seenIds` grows unbounded.** Cap it (e.g. keep the last N
  ids, or clear on channel resubscribe) to avoid a slow leak in long sessions.
- **`estateProjection` hard-codes the 2025 federal estate exemption** (13,990,000).
  Make it a dated assumption surfaced in the UI, or pull from a small constants
  table, so projections don't silently age.
- **`monteCarlo`'s LCG has a 233,280 period.** Fine for an illustrative band (and
  documented), but if an exact probability is ever surfaced, swap to mulberry32.
- **Missing `isUUID` guards** on `dbResolveQuestion`/`dbSnoozeAlert` ids — harmless
  (RLS protects) but inconsistent with the rest of `db.jsx`.
- **Hard deletes on `cash_flows`, `documents`, `crm_tasks`** (vs soft-delete/archive
  for `accounts`/`meetings`). If 17a-4 retention is meant to be uniform, these three
  contradict the "archived, never erased" claim; if not, document the distinction.
- **Bulk import issues N sequential `createClient` round-trips** with no batching —
  slow for large books and not transactional (a mid-run failure leaves a partial
  import). Consider a server-side batch RPC for imports over a threshold.
- **Cross-file bare-global coupling** (`firm-admin.jsx` ← `advisor-dashboard.jsx`)
  is load-order-fragile; add a lint assertion that the concatenation order in
  `build-files.mjs` is preserved, or move shared helpers (`KpiTile`, `useStateAdv`,
  `INVOICE_STATUS_TONE`) into a `shell`/`components` file that loads first.

---

## Suggested remediation order

1. **C1** (fail-closed DocuSign webhook) and **C2** (audit via `security definer`
   RPC) — both are small, surgical changes that close compliance-integrity holes.
2. **M4** verification — confirm Realtime RLS is enforced and add it to the
   rls-isolation CI gate; cheap insurance against a cross-tenant leak.
3. **M1** (`_dbId`) and **M5** (shared expense total) — one-line/one-helper fixes
   that restore advertised behavior and number-consistency.
4. **M3** (encrypt Plaid tokens) and **M2** (resolve the phase-schema split) —
   slightly larger, schedule before broad GA.
5. MINOR items as cleanup passes.

*Reviewer's note:* findings reflect the code as of commit `03b847a` on `main`.
RLS-dependent findings (C2 cross-tenant injection, M4 realtime) assume the project's
RLS settings match the SQL in `supabase/migrations`; spot-verify against the live
project before relying on this review for an audit.

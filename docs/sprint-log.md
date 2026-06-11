# Prism — Sprint Log

> Dated, append-only record of shipped sprints. The chat is cleared after each sprint,
> so this (plus [`ROADMAP.md`](ROADMAP.md) and the working [`TODO.md`](TODO.md)) is the
> durable memory. Newest first. Each entry: what shipped, the PR, and the human deploy
> hand-off.
>
> **Baseline reset 2026-06-08.** Everything built before this date is summarized in the
> single foundation entry below rather than logged sprint-by-sprint; the full
> per-sprint detail remains in git history (commits through `c2f299e`). New sprints
> append above this entry.

---

## 2026-06-10 (round 14) — Firm-admin CSV exports + audit filter · platform usage stats · pricing sanity check · client-accounts decision

PR #59. Build · smoke · calc · lint green. **No migration, no secrets, no money.**
One edge function changed (`platform-admin`) → gated `deploy.yml` run after merge.

**What shipped**
- **Firm admin — CSV companion exports** (the round-7 exam packet's "next when
  wanted"): Clients (+advisor +AUM +fee assignment), Invoices, and Audit CSVs; the
  audit CSV honours the same 90-day/12-month/full-history window selector as the
  exam packet and refetches up to 2,000 entries fresh. Formula-injection
  neutralization centralized as **`window.downloadCSV`** in `store.jsx` (the roster
  exporter in `advisor-dashboard.jsx` now reuses it).
- **Firm admin — audit-trail filter + load-more**: free-text filter over
  actor/action/detail on the loaded entries, plus a one-step deepen (100 → 500 on
  screen) with a pointer to the CSV/exam packet for full windows.
- **Platform admin — usage stats** (roadmap "next when wanted", rides round-13
  `px_events`): the firms table gains an **Activity · 30d** column (event count +
  last-event recency, "quiet" when none). Aggregated server-side in the
  `platform-admin` edge function's `overview` action; fully tolerant of migration
  041 not yet being applied (column just shows "quiet").
- **Pricing sanity check** written into ROADMAP (Pricing section): three-tier
  structure confirmed; infra ≈ $30–40/mo fixed, <$2/firm marginal, >95% gross
  margin. Watch-items: Growth $49 likely under the value-replaced anchor (test $79
  at list, keep $49 as founding-partner rate), tighten the free tier when billing
  turns on, clarify the household cap is per *firm*.
- **Client account-management decision** (Schwab/Vanguard granularity): **yes at
  account/custodian level, no at holdings level.** Queued as "Client portal accounts
  view (custodian-grouped)" — ROADMAP Tier C + TODO Claude queue. No build this
  round by design.

**Files:** `src/store.jsx`, `src/firm-admin.jsx`, `src/advisor-dashboard.jsx`,
`src/platform-admin.jsx`, `supabase/functions/platform-admin/index.ts`,
`docs/ROADMAP.md`, `docs/TODO.md`, `docs/ARCHITECTURE.md`.

---

## 2026-06-10 (round 13) — Security-advisor sweep · client PWA + push · product analytics · RLS index audit

Four workstreams in one batch. **Five hand-apply migrations (039–043)** —
039 was already run live mid-session (security_invoker on
`phase_library_resolved`, the advisor's one ERROR finding) and is committed
for the record. **One new edge function (`send-push`) deployed via the gated
workflow.**

**Security Advisor warning sweep (migration 040)** — pins `search_path` on the
8 functions migration 018's hardcoded list missed (6 trigger fns + the 036/038
definer RPCs); revokes anon EXECUTE from every definer RPC except
`px_brand_for_slug` (anon is the feature there: pre-login brand paint);
strips EXECUTE entirely from trigger/internal functions (incl. the live-only
`rls_auto_enable`); and revokes the PUBLIC/anon default-privilege auto-grant
for future functions. Remaining warnings are accepted-by-design: 0029 on the
authenticated RPCs (their contract), pg_net in public (no SET SCHEMA support),
and the leaked-password dashboard toggle (human queue).

**Client PWA + push** — the portal is installable (`/portal/manifest.webmanifest`,
`/portal-sw.js`, navy prism icons in `/icons`) and pushes on advisor activity:
new message, document request (rides the message path), and acknowledgement
sign requests. Pieces: `push_subscriptions` table (migration 042, identity
stamped by trigger, owner-only RLS) · `send-push` edge fn (advisor JWT →
tenant check → VAPID web-push via jsr @negrel/webpush, prunes 404/410
endpoints; VAPID secrets were synced 2026-06-10) · portal topbar gains a
bell "Turn on notifications" button (gesture-gated permission; silent
re-sync on returning visits). The SW deliberately has NO fetch/cache handler —
assets are hash-busted and a cache would serve stale bundles.

**Product analytics (migration 041)** — first-party `px_events` table +
`px_track()` definer RPC (px_audit pattern: identity stamped server-side,
client_id honoured only in-firm, append-only, admin-reads-own-firm).
Instrumented: `login`, `invite_created`, `invite_claimed`, `message_sent`,
`plan_updated`, `report_printed` (all 9 printers, kind in meta),
`push_subscribed`. `db.track()` is fire-and-forget and no-ops in demo or
pre-migration.

**RLS-predicate index coverage audit (migration 043)** — every policy
predicate in 001–042 cross-checked against every index; the migration header
records the full covered list. Gaps closed: `messages/documents/
acknowledgements/crm_tasks/fee_schedules/subscriptions(firm_id)` (the
firm-admin cross-firm reads the roadmap item called out),
`invoices/pending_ledger_changes(client_id)`, `crm_tasks(assigned_to, status)`.

**Hand-off (your queue):** paste migrations **040 → 041 → 042 → 043** in order
in the SQL editor (039 already applied); flip on **leaked-password protection**
in Auth settings. Push starts working the moment 042 is applied — code no-ops
gracefully until then.

---

## 2026-06-10 (round 12d) — Name model, address style + platform role control (founder feedback)

Founder feedback round two, same day. **One hand-apply migration (038) and a
gated edge redeploy** (`platform-admin` gained an action).

**Name editor restructured** — the account-chip editor is now [honorific
dropdown] [First name] [Last name] + credentials. Storage unchanged
(`full_name` stays the single column; boxes join on save, split on open —
last token = last name), so nothing else in the app had to move.

**"How clients address you" is now an explicit style** — new
`advisors.address_style` (`'first' | 'last' | 'formal'`, migration 038;
NULL = legacy derivation: honorific set → formal, else first). The account-menu
dropdown shows live previews from the actual name; `advisorFormalName` is
style-aware (plus new `advisorFirstName` helper). The honorific itself is now
purely the name prefix, picked inside the name editor.

**Latent bug fixed: real clients saw the DEMO advisor's name** — clients can't
read `advisors` under RLS, so the live portal's "review with …" copy fell back
to the mock ("Madeline Chen"). New `px_my_advisor()` security-definer RPC
(migration 038) returns exactly the display fields a client needs about their
own advisor; `db.getMyAdvisor` + portal `advisorDisplay` now prefer it. Firm
fallback also prefers the painted brand over the mock.

**Platform role control** — `platform-admin` edge fn gains `set_advisor_role`
(admin ⇄ advisor, service role, audit-logged `platform.set_advisor_role`); the
Platform view's firm rows gain an **Advisors** roster expander with Make firm
admin / Make advisor buttons. Founder's immediate self-upgrade documented in
TODO as a one-line SQL update (their early seat predates the platform tier).

---

## 2026-06-10 (round 12c) — Status-guard hotfix + name/rebrand editing (founder feedback)

Founder go-live feedback, same day. **One hand-apply migration (037), no edge
changes.**

**Bug: branding saves broke after 035** — 035's `px_guard_firm_status` trigger
ran `auth.role()` on every `firms` update; in the live project that call made
every browser-side firm update fail (branding save, and it would have hit the
036 Workflow toggle too). Migration 037 rewrites the guard defensively: the JWT
is only inspected when `status` actually changes, read via plain
`current_setting('request.jwt.claims')` (no auth-helper dependency, exceptions
swallowed to ''). Founder symptom: "save branding option for color and logo
don't work."

**Feature gap: identity editing** — (1) **Firm rename** (rebrand/acquisition):
the firm-admin Branding form gains a "Firm name" field; `db.updateFirmBrand`
accepts a non-empty `name`; the rename mirrors into `authUser.firms.name` so
the header/chip update without reload. Slug (portal subdomain) intentionally
stays immutable. (2) **Advisor name & credentials** (marriage/name changes):
the account-chip menu gains an "Edit name & credentials" editor → new
`db.updateAdvisorProfile` (advisors_update_self RLS, audit-logged
`advisor.profile`); `auth.jsx` now selects `credentials` so the editor
pre-fills.

**Also clarified (no code):** the "name your firm" screen only appears for auth
users with no DB record — the founder's email already held an early advisor
row, so sign-in landed in that firm; the rename field is the intended remedy.

---

## 2026-06-10 (round 12b) — Token savers + VAPID keypair (PWA-push unblock)

Sprint-value addendum to round 12. **No migration, no edge-function changes**
(no gated deploy; Cloudflare picks up the merge), but one gated **sync-secrets
run** after merge to push the new VAPID secrets to Supabase.

**AI token savers** — (1) `--quiet` / `PX_QUIET=1` mode in `scripts/check.mjs` +
`scripts/calc.test.mjs` and a new **`npm run test:quiet`**: failures + summary
counts only (~2 lines instead of ~280 per run; default stays verbose for
humans/CI). (2) New **`scripts/outline.mjs <file…|--all>`**: top-level
declarations, `window.*` exports, and line numbers for any source file, so big
files are navigated from a ~40-line outline + ranged reads instead of full
reads. Both recorded in CLAUDE.md ("Token savers") so future sessions reach for
them by default.

**Web-push VAPID keypair (human-queue item taken over)** — P-256 pair generated
locally (`node:crypto`, private key never printed/committed), stored as GitHub
Actions secrets `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
(`mailto:support@prismaw.com`), and the gated `sync-secrets.yml` workflow now
includes the three VAPID names → synced to Supabase edge secrets. The public key
is recorded on the Client-PWA TODO item (it's the client-side
`pushManager.subscribe` parameter). **Client PWA + push is now unblocked.**

**Platform-owner seeding guidance** — the TODO go-live block now spells out that
the `px_platform_owners` insert is a *copy* (a reference to an existing
auth.users row) and that the account needs an advisor/admin seat to see the
Platform tab (seed the existing advisor account, or sign up the dedicated
founder email + provision its workspace first).

---

## 2026-06-10 (round 12) — Platform-owner tier + ledger-edit approval gate

Two Claude-queue items shipped as one bundle. **Two hand-apply migrations (035, 036)
and one new edge function (`platform-admin`, deployed via the gated workflow)** —
the human hand-off is in TODO ("Round-12 go-live"). Everything degrades quietly
until the migrations land: no Platform tab, no Workflow toggle, client edits keep
saving directly. Build · lint · calc · smoke green; platform deep-link/denied
states and the Numbers drawer verified in the demo preview.

**Platform-owner dashboard (founder ask 2026-06-10)** — founder tier above firm
admin, built to the safe shape: zero RLS changes. Migration 035 adds the
`px_platform_owners` allowlist (RLS on, no policies → service-role only) and
`firms.status` (active|suspended, guarded by a trigger so a firm admin can't flip
it from the browser). New `platform-admin` edge function (JWT + allowlist check,
service role): `whoami` probe, `overview` (firms + plan/seats/Stripe status +
advisor/client counts), `provision_firm` (invite-or-link the firm admin),
`suspend_firm`/`reactivate_firm`, `set_plan` billing override — all audit-logged
as `platform.*`. New `src/platform-admin.jsx` view (advisor bundle only) on a
gated **Platform** topbar tab / `#/platform` route; suspended firms see a
"workspace paused" lock screen (data retained). `db.platformAdmin`; fn added to
`deploy.yml` + `config.toml` (verify_jwt on). Sign-in reads `firms.status` via a
separate non-fatal query so the un-migrated column can't break login.

**Advisor-approval commit gate for client ledger edits** — opt-in per-firm,
default OFF (new firm-admin "Workflow" section; `firms.ledger_approval_required`,
migration 036). When ON, a CLIENT's profile autosaves route into ONE open draft
row in `pending_ledger_changes` (repeated saves update in place; partial unique
index enforces one open draft per client). RLS: client inserts/edits/withdraws
only their own pending draft (can never set approved), advisor + firm admin read,
the client's advisor decides. The portal drawer carries a status strip (in
review · returned with the advisor's note · confirmed — informative, not
discouraging, per the tone rule) and the draft reloads as the client's working
copy. Advisor dashboard gains a "Client updates to review" inbox: section-level
diff vs the saved profile, **Approve & save** (writes through the advisor's own
RLS saveProfile → profile_versions + audit stay intact), **Return with note**.
Clients read the gate through the `px_ledger_gate()` security-definer RPC (they
can't see `firms`). New db surface: `getLedgerGate/setLedgerGate/getFirmLedgerGate/
getPendingLedgerChange(s)/submitLedgerChange/withdrawLedgerChange/reviewLedgerChange`.
All persists route through one `persistProfile` helper in `ProfileProvider` so
the debounce, flush, and unmount paths can't bypass the gate.

---

## 2026-06-10 (round 11) — Insight → action follow-through + UX polish

Four TODO items plus a founder-feedback fix, shipped as one bundle. **No migration,
no edge-function changes** (no gated deploy needed — Cloudflare picks up the static
bundle on merge). Build · lint · calc · smoke green; agenda hooks, 1040 tool buttons,
and housing coaching verified in the live demo preview. Migrations 033 + 034 were
hand-applied by the founder before this round — the live project is fully in sync.

**Founder bug: demo roadmap ignored the client's phase** — `TaskProvider`'s demo
fallback seeded a fixed mid-P05 progress for EVERY mock client, so a P01/P03
household's quick-view said one phase while the roadmap showed tasks complete
through P05. Replaced with phase-aware `demoTaskSeed(phase)` (earlier phases
complete, two tasks into the current one, nothing beyond; exported on window).
Live clients were never affected — their states come from `task_states`.

**Founder feedback: Current-Horizon subtask line** — the quick-view "Current
Horizon" tile now carries a second line: `done/total · next: <subtask>` (or
"phase complete"), loaded from the same sources as the roadmap (DB for live,
localStorage → phase-aware seed for demo).

**Founder feedback: archive confirmation front-and-center** — archiving a client now
raises a centered in-modal `alertdialog` overlay (icon, "nothing is deleted" retention
copy, Keep client / Archive client) instead of the old inline confirm buried at the
bottom of the Edit tab. Both the header Archive button and the Edit-tab button arm it.

**Insight → action hooks (advisor-POV review, top finding)** — new advisor-only
`InsightAction` component (calculators.jsx): one click turns a tool verdict into a
client-linked CRM task (`db.createTask`, audit-logged; demo mode → optimistic toast).
Wired to: coverage-gap verdict (gap + est. premium in the task detail), debt-vs-invest
(high-APR balances to prioritize), Roth-conversion window (annual amount + ages +
est. tax), and a compact per-observation "Task" button on every non-info 1040
observation. Hidden for clients — tools stay client-safe.

**Advisor-facing 1040 flags** — the client quick-view Overview gains a "1040 flags"
strip (marginal/effective rate + bracket headroom + top-3 non-info `tax1040Insights`
observations, computed from the loaded profile); `advPlanFlags` now carries the same
observations into the QBR's **Plan flags** section (`printQBRReport` renders top 3).

**Portal fee transparency — found already shipped (stale TODO)** — the client portal
has rendered approved/paid invoices with per-invoice download since 2026-05-29
(`Billing polish: branded invoice PDF + client invoice visibility`, client-portal.jsx
"Advisory invoices" card + `inv_client_read` RLS from migration 014). Item deleted.

**UX backlog (both FinFire-donor items)** — (1) Numbers-drawer housing: ratio
coaching strip (housing outflow vs take-home against the ~30% guideline, marker on
the track, On target / A bit high / Stretched) + field hints on payment/rent, home
value, mortgage balance, APR, and escrow; (2) roster swipe actions: left-swipe on a
mobile roster card reveals Quick view / Roadmap / Numbers (touch-only `px-swipe-actions`
strip; desktop table untouched).

**Ops** — Azure/Microsoft credentials landed in `docs/DocuSign.txt` (gitignored):
`MS_OAUTH_CLIENT_ID/SECRET/TENANT` set as GitHub repo secrets and synced to Supabase
via the gated workflow. **Remaining (your queue):** register the
`https://prismaw.com/oauth/microsoft/callback` redirect URI in the Azure app.

---

## 2026-06-09 (round 10) — Calendar sync (Google/Microsoft OAuth) + bulk-import RPC

The calendar wedge item plus the last open code-quality item, riding one migration
train. **Two hand-apply migrations queued (033, 034)** and **two new edge functions**
(`calendar-oauth`, `calendar-events`) deployed via the gated workflow. Build · lint ·
calc · smoke green.

**Calendar integration (Google + Microsoft)**
- **Migration 033 — `calendar_connections`**: per-advisor OAuth tokens; RLS enabled
  with ZERO policies (service-role only — tokens never cross the API boundary; do
  not add client-facing policies).
- **Edge fn `calendar-oauth`** (JWT): `auth_url` / `exchange` / `status` /
  `disconnect` (best-effort Google revoke). **Edge fn `calendar-events`** (JWT):
  `upcoming` (merged + sorted across providers; per-connection failures degrade to
  warnings), `freebusy` (busy blocks), `create` (push an event; refresh-token
  rotation persisted). Shared plumbing in `functions/_shared/calendar.ts`.
- **Callback page**: one static `oauth-callback.html` served at BOTH
  `/oauth/google/callback` and `/oauth/microsoft/callback` (build.mjs writes both;
  the page reads the provider from its own path, checks the sessionStorage CSRF
  `state`, calls `exchange` with the signed-in session, bounces back to `/app`).
  Its inline script + style are CSP-hashed like every other served page.
- **Frontend**: `db.getCalendarStatus / connectCalendar / disconnectCalendar /
  getCalendarEvents / createCalendarEvent`; a "This week" CalendarCard on the
  advisor dashboard sidebar (connect buttons → 7-day agenda; demo agenda in demo
  mode); scheduling a future meeting in the client preview auto-pushes it to the
  connected calendar(s) (fire-and-forget; "not_connected" is silent).
- **Secrets pipeline**: new gated `sync-secrets.yml` workflow pushes
  `GOOGLE_OAUTH_CLIENT_ID/SECRET` + `MS_OAUTH_CLIENT_ID/SECRET/TENANT` from GitHub
  repo secrets into Supabase edge secrets (skips empties; values never logged).
  Google repo secrets are set. **Microsoft creds never made it into
  docs/DocuSign.txt — re-add (human queue)**, and register the
  `/oauth/microsoft/callback` redirect URI in Azure.

**Bulk-import batch RPC (last open 2026-06-09 code-quality item)**
- **Migration 034 — `px_bulk_create_clients(jsonb)`**: SECURITY INVOKER (RLS does
  the authz; identity from the session, never the payload), one transaction per
  call — client insert + imported profile + placeholder AUM account + totals +
  `px_audit` per row, ≤500 rows/call.
- **Frontend**: CSV imports ≥20 rows go through the RPC in 200-row batches; if the
  RPC is missing (migration unapplied) the importer silently falls back to the
  existing per-row path.

**Human hand-off** (mirrored in TODO): apply migrations 033 + 034 in the SQL
editor; re-add the Azure/Microsoft credentials; add the Microsoft redirect URI;
the Sync edge secrets + deploy workflows handle the rest. Google is otherwise
live-ready end to end.

---

## 2026-06-09 (round 9) — Founder feedback batch: Numbers-drawer UX + prospect-flow fixes

Eleven direct founder-feedback items in one pass. Build · lint · calc · smoke green;
the drawer UX, prospect phase/chat/risk fixes, and estate sample chips verified in the
live demo preview. **No migration, no secrets, no money.** One **edge-function change**
(`ai-assist` gains `w2_extract`) — deployed via the gated `deploy.yml` workflow.

**Numbers drawer**
- **Leading-zero fix.** New module-scope `NumInput` (numbers-panel): renders `''` with
  a `0` placeholder instead of a literal 0, holds a local draft while editing, commits
  parsed numbers. `NumField` + every inline numeric input swept onto it.
- **Mortgage term + start year** (`housing.termYears` / `housing.startYear`, optional)
  with a scheduled-payoff readout (year N of term, payoff year).
- **Contributions & employer match: per-month/per-year toggle.** Display-only —
  storage stays annual (÷12 on display, ×12 on commit), so all calculators are untouched.
- **Multiple W-2s** — `taxes.w2s[]` (label + box1/box2 per earner/job; legacy single
  `taxes.w2` surfaces as the first entry). Combined Box 1 drives `w2Position` (right
  answer for a joint return); the bracket-headroom tool sums all W-2s too.
- **W-2 auto-import from upload** — advisor-side "Upload W-2" sends the image/PDF
  (base64, ≤4 MB) to the new `ai-assist` action `w2_extract` (Gemini, temperature 0,
  JSON response) → adds a pre-filled W-2 entry. Key stays server-side; advisor JWT only.
- **Protection owner is a dropdown** fed by the household members entered at the top
  of the drawer (legacy free-text values stay selectable).

**Prospect-flow bugs (all root-caused)**
- **"Started at phase 1, showed phase 5":** prospects had no `px_tasks` seed, so
  TaskProvider fell back to the demo household's mid-phase-5 `mockSeed()`. Now
  `createProspect` seeds completed-phases-before-the-chosen-start, and the mock seed is
  demo-only (prospects fall back to blank).
- **Pre-filled sample chat on prospects:** `demoMessages()` was the `MessageThread`
  demo seed for every non-UUID client. Prospect views now seed empty (portal + quick-view).
- **"Risk profile went away":** `ProfileProvider` initialized to `defaultProfile`
  (which includes a *completed sample questionnaire*) and swapped in the prospect's
  real profile only after the first paint — the sample band flashed, then vanished.
  Profile state now lazy-initializes from the right source, and prospects merge onto
  `emptyProfile`, never the demo sample.

**Other**
- **Estate readiness sample documents.** New `openEstateSample(key)` (store.jsx) opens
  an illustrative will / revocable trust / POA / healthcare directive / beneficiary
  review with an unmissable "SAMPLE — for discussion only, not a legal document" banner
  (`.sample-banner` in print.css; opens without forcing the print dialog via
  `_openPrint(..., { autoPrint: false })`). Portal estate chips without a linked vault
  doc now open the sample ("· sample" suffix); the drawer checklist gets "View sample"
  buttons on not-complete items.
- **HDHP spelled out** in the Phase-04 task label ("high-deductible health plan (HDHP)").
- **Archive discoverability:** the client quick-view header gains an "Archive" action
  (jumps to the Edit tab with the confirm row armed — the destructive click stays behind
  the confirm).

**Files:** `src/numbers-panel.jsx`, `src/store.jsx`, `src/client-portal.jsx`,
`src/advisor-modal.jsx`, `src/calculators.jsx`, `src/data.jsx`, `src/db.jsx`,
`src/print.css`, `supabase/functions/ai-assist/index.ts`.

---

## 2026-06-09 (round 8) — Document-request flow + prospect proposal packet

Two advisor-POV review items shipped together. Build · lint · calc · smoke green;
both verified in the live demo preview. **No migration, no secrets, no edge-function
change** — the merge to main is the whole deploy.

**1 · Document-request flow.** Advisors chase statements/trust docs constantly; the
vault only took unprompted uploads. Now: advisor opens a client's **documents** tab →
"Request document" (name + vault category) → the ask appears in the client portal's
Documents card as a highlighted card with a one-click **Upload** that pre-fills
title/category → the upload lands in the vault and auto-resolves the request (the
advisor can also "Mark received" for out-of-band delivery). *Design note:* the TODO
suggested leaning on the tasks table, but `crm_tasks` has no client RLS policy — so
requests ride on the **messages** table instead (clients already have read+insert,
migration 019): a request is an advisor message with context `doc-request:<category>`;
a resolution is a message with context `doc-request-done:<request id>`. Zero schema
change, the ask shows in the conversation thread for free (with friendly context
labels), and both lifecycle events are audit-logged (`document.request`,
`document.request_done`). New `db` methods: `getDocumentRequests`, `requestDocument`,
`resolveDocumentRequest`. UI lives in the shared `DocumentVault`, so the advisor
modal and the client portal both got it in one place.

**2 · Prospect proposal packet.** Proposal mode had no branded close-the-deal output.
New `printProposalPacket` (store.jsx, same print-shell/print.css pattern as the QBR)
behind a **Proposal packet** button on the prospect banner: today's snapshot (net
worth, invested, reserve, surplus — em-dash when not yet entered), retirement-readiness
verdict + Monte Carlo when numbers exist, the seven-horizon roadmap with the
prospect's starting phase marked, "what working together looks like" (onboarding /
ongoing cadence / fiduciary), and the fee schedule — the firm's first active schedule
with the estimated annual fee at the prospect's invested assets, or clearly-labelled
illustrative tiers (1.00%/0.75%/0.50%) when none exists yet.

**Files:** `src/db.jsx`, `src/components.jsx`, `src/store.jsx`, `src/client-portal.jsx`.

---

## 2026-06-09 (round 7) — Holistiplan-lite · exam packet · code-quality sweep · advisor-POV review

Three queued builds plus a product review, shipped as one package. Build · lint ·
calc · smoke green; both new features verified live in the demo preview. **No
migration, no secrets, no edge-function change** — everything rides existing storage
and RLS, so the merge to main is the whole deploy.

**1 · Tax-return insight (Holistiplan-lite).** `calc-core.tax1040Insights` (unit-tested,
13 new tests): keyed 1040 lines → deterministic observations — bracket position +
headroom (ordinary income backs out LTCG/qualified dividends), withholding vs. total
tax, standard-vs-itemized bunching, 0% LTCG harvesting room, interest/dividend drag,
IRMAA proximity (dated 2025 tiers, exported alongside `LTCG_ZERO_TOP_2025`), QCD at
70½+, SS provisional income. Captured in the Numbers drawer ("Import from your 1040",
`taxes.t1040`, AGI-only minimum, one-click "Use NN%" marginal-rate apply like the W-2
block) and rendered by a new Phase-04 **Tax-return insights** tool (`taxreturn`) with
client-safe tones (opportunity / watch / info). No OCR — keyed lines keep every
observation explainable.

**2 · Exam-ready compliance export.** Firm-admin compliance section gained a
window select (90d / 12mo / full) + **Exam packet** button → `printExamPacket`
(store.jsx, pure renderer): advisor roster, fee schedules, client inventory + fee
assignment, invoices, firm-wide acknowledgements with e-sign state (new
`db.getFirmAcknowledgements`), append-only audit trail (new `since` filter on
`db.getAuditLog`, 2,000-entry cap with truncation flag), retention statement.

**3 · Code-quality sweep — 10 of 11 cleared** (detail in ROADMAP): CSV
formula-injection guard; `update()` shallow path-copy (was a full deep clone per
keystroke); post-load autosave echo skipped; notification dedupe set capped;
`FEDERAL_ESTATE_EXEMPTION_2025` named/exported (EstateTool now reads it); monteCarlo
LCG → mulberry32 (an exact success % is surfaced, the agreed trigger); `isUUID`
guards; deletion policy documented as deliberate in db.jsx; estate doc dangling
pointer closed (vault delete fires `px:document-deleted`; ProfileProvider clears
matching `estate.*.documentId`); lint gained bundle-structure guards (src/ coverage ↔
build-files.mjs + portal-isolation assert). Remaining: bulk-import batch RPC,
deliberately migration-gated (TODO).

**4 · Advisor-POV walkthrough** — five findings queued in TODO, themed "every
analytic surface should end in a trackable next step": insight→action hooks,
document-request flow, advisor-facing 1040 flags, prospect proposal packet, portal
fee transparency. Full framing in ROADMAP ("Advisor-workflow review").

**Hand-off:** nothing — no migration, no secrets, no edge redeploy.

---

## 2026-06-09 (round 6) — W-2 import → parsed marginal rate (front-phase data play)

Closes the last open **front-phase data play** in the Claude queue: replaces the
hand-entered marginal rate with a figure parsed off the household's actual W-2.
Build · lint · calc · check green; new calc engine unit-tested. **No migration, no
secrets, no money** — profile is a JSON blob, so the new field rides existing storage.

**The thesis:** the marginal rate drove HSA / Roth / asset-location estimates but was a
hand-typed guess. A W-2 carries the two numbers that fix that — Box 1 (wages) and Box 2
(federal tax withheld) — and Box 1 *is* ordinary income, so it drops straight into the
existing `bracketPosition` engine. Smallest coherent slice: capture the two boxes, derive
the bracket, offer it as the rate. Folds into the fuller Holistiplan-lite 1040 layer later.

**What shipped**
- **`calc-core.w2Position({ box1, box2, filingStatus })`** — reuses `bracketPosition`
  to locate Box-1 wages in the 2025 federal brackets → a whole-percent `marginalRatePct`
  (the parsed figure), plus the effective federal `withholdingRate` (Box 2 / Box 1) as a
  reality-check. Pure/deterministic; filing status collapses to the two bracket tables
  we carry. Unit-tested (`scripts/calc.test.mjs`).
- **Numbers drawer W-2 capture** (`numbers-panel.jsx`, Planning & tax section): Box 1 +
  Box 2 fields → live "Box 1 lands in the **22%** bracket · withheld **15%** of wages"
  read-out + a one-click **Use NN%** button that writes the parsed rate to
  `taxes.marginalRate` (becomes a disabled **Applied** once set). Explicit, not silent.
- **Front-phase tie-in** (`calculators.jsx`): the Phase-04 Tax-Bracket Headroom tool now
  prefers the captured W-2 Box-1 wages as its income default over the ledger estimate.
- **Profile shape**: `taxes.w2 = { box1, box2 }` added to default + empty profiles;
  `mergeProfile` back-fills it on older profiles. No schema change.

**Verification:** browser-preview end-to-end — entered Box 1 $185k / Box 2 $28k → derived
22% + 15% withholding → "Use 22%" applied to the marginal-rate field → button went
"Applied". No console errors.

**Files:** `src/calc-core.cjs`, `src/numbers-panel.jsx`, `src/calculators.jsx`,
`src/store.jsx`, `scripts/calc.test.mjs`, `docs/TODO.md`, `docs/ARCHITECTURE.md`,
`docs/sprint-log.md`. Frontend auto-deploys on merge.

---

## 2026-06-09 (round 5) — Code-quality pass + front-phase parity finish

Closes the four 2026-06-09 architecture-inefficiency items and the whole
"Front-phase parity — finish the symmetry & wire the new tools through" TODO block.
Build · lint · calc · check green; new calc engines unit-tested. No migration.
**Carries an edge redeploy** (`generate-invoices` batch fix) via the gated deploy
workflow.

**Code-quality (all four 2026-06-09 items):**
- **Sign-in boot parallelized** (`auth.jsx`): `mergePhasesWithDB()` now starts before
  the advisors/clients role queries and is awaited only once a role is confirmed —
  one DB round-trip saved on every sign-in.
- **`generate-invoices` N+1 fixed**: balance_history is fetched in chunked
  (`in (client_ids)`, 25/chunk) + paginated (1000/page) batches up front, grouped by
  client, then filtered per client's own period end. Fee math untouched.
- **Pre-auth pages brand-themed**: new standalone `src/brand-boot.js` (login, signup,
  landing — loaded `defer` after the supabase client; copied + cache-busted by
  `build.mjs`). Paints cached → subdomain-slug brand as CSS vars; swaps the login/
  signup brand mark, name, and "Powered by Prism" sub via `data-brand-*` hooks; the
  pages' primary button / focus ring / mark now key off `var(--brand, var(--ink))`.
- **Brand cache trust closed**: both `store.jsx applyFirmBrand()` and `brand-boot.js`
  now whitelist-sanitize every brand input (cache, anon RPC, firm row): `#rrggbb`
  color only, `data:image/` logo ≤ 300 KB, length-capped name/slug, boolean-coerced
  attribution. Tampered localStorage can no longer inject arbitrary values.

**Front-phase parity (round 4 of the client-utility track):**
- **P01 · Net-worth trajectory** (`netWorthTrajectory` + `NetWorthTrajectoryTool`,
  key `networth`): year-by-year projection at today's pace, 5/10/20-yr stats, a real
  Sparkline, the "+1% saved" lever, and an honest rule — a negative net worth is not
  compounded at the investment return (digging out is linear; compounding starts at
  zero), with the crossing year surfaced.
- **P02 · Income runway** (`incomeRunway` + `IncomeRunwayTool`, key `incomerunway`):
  if income paused, months the reserve carries essentials; disability benefit
  (~60% default when a policy is on file) + elimination period modeled; client-safe
  tone ("Building · time on your side", never red).
- **Task hooks**: P03 gains "Model extra principal in the mortgage payoff
  accelerator" (p2t6), P06 gains "Review concentrated equity in the equity-comp
  planner" (p5t6) — the checklists now point at the round-3 tools.
- **SS loop closed** (`SSClaimingTool`): "Set the plan to claim at 62/67/70" buttons
  write the chosen age back into the Social Security income stream(s) —
  `startAge` = claim age, `monthlyAmount` = PIA × claiming factor, PIA back-filled
  for idempotent re-applies; creates the stream if none exists. Retirement readiness
  now reflects the claiming call.
- **Advisor reports**: QBR gains a "Plan flags" section (largest concentrated
  equity-comp position with tax-to-trim, projected first RMD); the IPS gains a
  conditional "Concentrated positions & distributions" section. Both fed by a shared
  `advPlanFlags()` in `advisor-modal.jsx`.

Calc-core: `netWorthTrajectory`, `incomeRunway` added + 13 unit tests. Phases 1–3
now carry 3 interactive tools each — full symmetry with 5–7.

**Human hand-off:** none new — migration 032 (round 4) is still the open item in
your queue. The `generate-invoices` redeploy rides the gated workflow with this ship.

---

## 2026-06-09 (round 4) — White-label branding + AI relationship assistant (Gemini)

Closes the top two items in Claude's TODO queue. Build · lint · calc · check green.
**Carries migration `032_firm_branding.sql`** (applied with the ship) and a **new edge
function `ai-assist`** (deployed, `verify_jwt = true`, uses the `GEMINI_API_KEY` secret).

**White-label branding (Tier A) — "no second portal" is now literally true:**
- **Brand engine** (`store.jsx`): `applyFirmBrand()` sets inline CSS custom properties
  on `<html>` (`--brand`, `--brand-hover`, `--accent`, `--accent-soft`, `--accent-line`)
  — inline beats every stylesheet rule incl. dark-theme overrides. `useFirmBrand()`
  hook re-renders topbars on resolution. Paint order: localStorage cache (instant,
  per-host) → subdomain slug → signed-in firm row (authoritative, re-caches).
- **Subdomain → brand resolution:** `{slug}.prismaw.com` resolves pre-auth via the new
  anon-callable `px_brand_for_slug()` SECURITY DEFINER fn (exposes only public branding
  columns). DNS was already in place.
- **Theming surface** (`styles.css`): new `--brand`/`--brand-hover` vars; brand mark,
  primary buttons, and the accent trio now key off them. Default = the Prism navy.
- **Topbars** (`app.jsx`, `portal-app.jsx`): firm logo (`.px-brand-logo`) + firm name
  replace the Prism mark when branded; portal shows "Client Portal · powered by Prism"
  unless the firm turns attribution off.
- **Firm-admin Branding section** (`firm-admin.jsx`): accent color picker, logo upload
  (PNG/JPEG/SVG/WebP ≤200 KB → **data URI** in `firms.logo_url` — deliberate: CSP
  `img-src 'self' data:` allows it with no storage bucket / signed-URL machinery),
  "powered by Prism" toggle, portal URL display.
- **Migration 032:** `firms.show_powered_by`, `firms_update_admin` RLS policy (admins
  could never write branding before — firms had only SELECT), `px_brand_for_slug()`.
- **db.jsx:** `getFirmBrand`, `updateFirmBrand` (audited `firm.brand`), `getBrandForSlug`.

**AI relationship assistant (Tier B) — rides the shipped messaging + CRM:**
- **Edge fn `ai-assist`** (Deno): advisor/admin JWT required; four actions —
  `draft_reply`, `household_summary`, `talking_points`, `attention` — each a guarded
  prompt (fiduciary back-office tone, no security recs, no return promises, drafts for
  the ADVISOR to review) over a ≤24 KB context the browser supplies from data it
  already holds under RLS. Calls Gemini (`gemini-2.0-flash`) server-side; the key never
  reaches the browser. Every call lands in the audit trail (`ai.assist`).
- **UI:** `AiAssistCard` (advisor-modal.jsx, advisor bundle only) — Household summary +
  Review talking points in the client quick-view Overview; "Who needs attention?" book
  triage in the dashboard sidebar; **AI draft** button in the advisor's message compose
  (`MessageThread` gains `aiContext`, advisor-side only) that drops a Gemini draft into
  the box for editing. Demo mode shows canned output so demos stay alive keyless.
- **db.jsx:** `aiAssist(action, context)` → `functions.invoke('ai-assist')`.

**Architecture review (same pass) — findings logged to ROADMAP code-quality backlog:**
sign-in serializes the phase fetch before role resolution (parallelizable RTT);
`generate-invoices` does an N+1 balance_history query per client (fine ≤150 households);
static login/landing pages stay Prism-branded pre-auth (bundle-only subdomain theming);
brand cache in localStorage is trusted until the authoritative row corrects it.

**Files:** `supabase/migrations/032_firm_branding.sql`, `supabase/functions/ai-assist/index.ts`,
`supabase/config.toml`, `src/db.jsx`, `src/store.jsx`, `src/auth.jsx`, `src/styles.css`,
`src/app.jsx`, `src/portal-app.jsx`, `src/firm-admin.jsx`, `src/components.jsx`,
`src/advisor-modal.jsx`, `src/advisor-dashboard.jsx`, docs.

---

## 2026-06-09 (round 3) — Front-phase parity COMPLETE: the full ranked backlog + its data builds

Closes both the **Front-phase tool parity** and **Client-data builds that unlock tools**
TODO items in one ship. Build · lint · calc (118 assertions) · check all green; all six
new tools verified rendering with correct live values via browser-preview DOM checks,
zero console errors. Frontend auto-deploys on merge. **No migration** (profile is a JSON
blob — new fields are JSON, not columns), **no secrets, no money.**

**Six new tools (one calc-core fn each, all unit-tested):**
- **Phase 03 — Mortgage payoff accelerator** (`mortgagePayoff`) — extra principal → months
  and interest saved, regular vs. accelerated amortization. Completes the P03 debt pair.
- **Phase 04 — HDHP vs. PPO break-even** (`hdhpVsPpo`) — total annual cost of each plan
  incl. the HSA tax advantage (employer contribution + tax saved on contributions), with
  the break-even claims level. **Answers flagged q03.**
- **Phase 05 — Mega-Backdoor Roth capacity** (`megaBackdoorCapacity`) — after-tax 401(k)
  room under the §415(c) limit ($70k / $77.5k 50+), gated on a plan-allows toggle.
  **Answers flagged q02.**
- **Phase 06 — Equity-comp concentration** (`equityCompConcentration`) — single-stock
  concentration %, embedded gain, and the cap-gains tax to trim to target vs. fully exit.
- **Phase 07 — RMD projector** (`rmdProjection`, IRS Uniform Lifetime divisors) — first
  RMD at 73, lifetime RMDs + tax drag; makes Roth-ladder urgency tangible.
- **Phase 07 — Social Security claiming age** (`socialSecurityClaiming`) — 62/67/70
  monthly + lifetime (nominal & PV) and the 62-vs-70 break-even age.

**Data builds (the plays that unlocked the tools):**
- **SS PIA capture** — `pia` field on `social_security` income streams (numbers-panel,
  with an inline hint); feeds the claiming optimizer.
- **Equity-comp fields** — `equityComp[]` on the profile (ticker / type / vested value /
  cost basis / unvested), captured in a new numbers-panel section; demo seeded with an
  NVDA position (~13% concentration) so the planner shows real output.
- **Plaid balance-freshness "as of" indicator** — the advisor accounts table now shows
  when each balance was last set, flagging linked (Plaid) balances stale >7d and manual
  entries >120d, raising trust in every projection built on them.

Wiring: `calc-core.cjs` (+6 fns, RMD divisor table, SS factor helper), `calculators.jsx`
(+6 tools, registry), `data.jsx` (phase `calcs` arrays — P06 migrated off legacy
`calc`/`calc2`), `store.jsx` (profile fields + `equityConcentration` derived), `numbers-panel.jsx`
(PIA + equity-comp capture), `advisor-modal.jsx` (freshness indicator), `calc.test.mjs` (+33 assertions).

## 2026-06-09 (round 2) — Front-phase parity: Freedom Date + Debt-vs-Invest

Second client-utility round, same review. Build · lint · calc · check · e2e ·
rls-isolation all green; both tools verified via DOM in a browser preview (the
screenshot renderer was hung that session — DOM checks were authoritative). Frontend
auto-deploys on merge. **No migration, no secrets, no money.**

**What shipped**
- **Phase 01 — Freedom Date.** New `calc-core.yearsToIndependence()` — years until
  invested assets reach the FIRE number (≈ 25× spending) at a 5% real return + flat
  annual saving. The tool shows years/Freedom age, progress, and a **"+1% of take-home
  saved → months sooner"** lever (derived by re-running the calc with a higher
  contribution). Pure motivation from data on file; inclusive early-journey tone.
- **Phase 03 — Pay down or invest?** New `calc-core.debtVsInvest()` — per-debt verdict
  comparing the **guaranteed, tax-free** payoff return (the APR) against an expected
  after-tax investment return, with a dead-band toss-up zone. Makes the phase's own
  6–7%-crossover rationale interactive; graceful empty state when no debts are on file.
- **Chip ↔ hero gap.** Trimmed ~12px more (chip bottom-margin 10→2, hero top-padding
  4→0) for a tighter top; placement/right-alignment unchanged. Mobile row unchanged.

Both new functions unit-tested (`scripts/calc.test.mjs`). Wiring: `data.jsx` phase 01
`calcs += freedomdate`, phase 03 `calcs += debtvinvest`; registered in `calculators`.

**Files:** `src/calc-core.cjs`, `src/calculators.jsx`, `src/data.jsx`, `src/styles.css`,
`scripts/calc.test.mjs`, `docs/ROADMAP.md`, `docs/TODO.md`, `docs/ARCHITECTURE.md`.

---

## 2026-06-09 — Client-utility tools: coverage gap + bracket headroom (front-phase parity)

Acts on a clean-room review of the client side (2026-06-09). PR #40
(squash-merged to `main`, `e813a0e`). Build · lint · calc · check · e2e ·
rls-isolation all green; both tools verified in a browser preview. Frontend
auto-deploys on merge. **No migration, no secrets, no money.**

**The thesis:** phases 5–7 carried 2–4 interactive tools each; phases 1–4 had one
apiece — yet those are the earliest-journey households who most need engagement.
This brings two of the thin front phases up toward parity, in the Roth-window vein
(one specific, dollar-denominated, advisor-hooked number from data already on file).

**What shipped**
- **Phase 02 — Income-Protection / Coverage-Gap tool.** Promotes the existing
  `lifeCoverageGap` from a passive "Protection & estate" card to an interactive tool
  (adjustable income multiple + coverage in place) and adds `termLifePremium`, a
  rough age-banded monthly-cost estimate (clearly illustrative, not a quote).
  Constructive tone — gold "room to strengthen," never alarming red.
- **Phase 04 — Tax-Bracket Headroom tool.** New shared `calc-core.bracketPosition()`
  engine reusing `FED_BRACKETS_2025`: marginal rate, blended effective rate, the
  household's dollars per band ("you are here"), and the **headroom** to the next
  bracket — the space the Roth-conversion + contribution-order tools fill. Built once,
  reusable. Both new functions unit-tested (`scripts/calc.test.mjs`).
- **Advisor chip polish.** The advisor/Request-meeting pill was a floated overlay
  clipping the hero on the right; moved above the hero, right-aligned, hero lifted a
  few px to reclaim space. Mobile full-width row unchanged.

**Wiring:** `data.jsx` phase 02 `calcs += coveragegap`, phase 04 `calcs += brackets`;
registered in the `calculators` registry. ROADMAP + TODO carry the ranked
**front-phase parity** backlog (Freedom Date, debt-vs-invest, HDHP break-even,
Mega-Backdoor, RMD, SS optimizer) and the data-build dependencies.

**Files:** `src/calc-core.cjs`, `src/calculators.jsx`, `src/data.jsx`,
`src/client-portal.jsx`, `src/styles.css`, `scripts/calc.test.mjs`, `docs/ROADMAP.md`,
`docs/TODO.md`, `docs/ARCHITECTURE.md`.

---

## 2026-06-08 — Planning depth: decumulation & contribution intelligence (Tier B)

Advanced the **deeper-planning-intelligence priority track** (ROADMAP Tier B), building on
the bespoke Asset Location optimizer. Three new pure, unit-tested engines in `calc-core.cjs`,
each surfaced as an advisor tool driven entirely by data already on file:

- **Contribution Priority** (`contributionWaterfall`) — sequences the year's savings in the
  canonical order (full employer match → HSA → IRA/Roth → 401(k) max → taxable), capped by
  each account's remaining room; flags capacity too thin to capture the full match (free
  money left on the table). On Phase 04.
- **Withdrawal Sequencing** (`withdrawalSequence`) — year-by-year tax-efficient draw order
  (taxable → tax-deferred → tax-free Roth) netting guaranteed income, grossing up for tax;
  reports longevity, lifetime tax, and after-tax value at the horizon. *Deliberately drops a
  "vs. proportional $ saved" headline — under a flat rate that comparison is deferral-timing
  dominated and can invert, so claiming it would mislead.* On Phase 07.
- **Roth Conversion Window** (`rothConversionWindow`) — sizes conversions in the low-income
  gap years (retirement → RMD age 73) to fill a target bracket's headroom, using a dated
  `FED_BRACKETS_2025` table (standard deduction + ordinary bands, MFJ/single). On Phase 07.

Supporting changes: `client-portal.jsx` now resolves a phase `calcs: [...]` array (any number
of tools) alongside legacy `calc`/`calc2`; `data.jsx` wires the new tools + milestone tasks
into Phases 04/07; `styles.css` themes bare `<select>` controls for the dark palette (the
bracket picker). Verified in browser preview against the demo household; full `npm test`
(build + smoke + 40+ calc assertions) green.

Also folded in two previously-staged repo aids: **`docs/ARCHITECTURE.md`** (condensed repo
map to cut re-exploration cost across chat clears) and **`CLAUDE.md`** (session-start
directive to read the map first). No schema, secrets, or money touched — purely client-side.

**PR:** _(this sprint)_ · **Deploy:** auto-merge → Cloudflare live; no human hand-off required.

---

## 2026-06-08 — Foundation baseline (everything shipped to date)

The starting point for the reset. Prism is a mature, multi-tenant RIA workspace —
advisor command center + firm admin + client portal — on a hardened foundation. What's
built and live as of this baseline:

**Core product**
- The seven-horizon ("Wealth Horizons") lifecycle roadmap with per-phase milestones +
  interactive calculators; advisor roster/KPIs; firm-admin revenue + fee schedules +
  invoicing; client portal. Financial math centralized in the dual-mode, unit-tested
  `calc-core.cjs` (incl. retirement readiness, Monte Carlo, Modified-Dietz net-of-fee
  performance, fee tiers).
- Multi-tenant Postgres + **RLS** (firm → advisor → client) on every shared table,
  Storage object RLS, append-only audit trail, soft-deletes for the 17a-4 record.

**Wedge build-out (W1–W6)**
- Fixed-income streams + retirement-readiness engine; goal-based planning; unified
  two-way realtime advisor↔client messaging + advisor inbox; document vault (Supabase
  Storage); insurance/protection + estate capture; reconciling managed-vs-held-away
  asset composition. Demo/live parity (`isUUID` gating) and tone/inclusivity lens
  applied throughout.

**Adoption unlocks & wedge deepeners**
- Bulk CSV client import (Wealthbox/Redtail/Orion mappers); prospect/proposal mode
  (run an unsaved household through the roadmap → one-click convert); client
  invite/claim flow; probability-of-success band; risk questionnaire → draft IPS;
  one-click QBR packet; real **DocuSign** e-sign on acknowledgements (activated on the
  demo account).

**Hardening, infra & quality**
- CSP with **no `unsafe-inline`** on both `script-src` and `style-src` (build-time
  hashing + inline-style → class migration); slim `/portal` bundle (~35% smaller, no
  advisor code in a client browser); deep-link hash routing; ⌘K command palette;
  minified CSS.
- CI: build + lint (`no-undef` over the esbuild concatenation) + `npm audit` +
  Dependabot + calc tests + `check.mjs` deploy-artifact assertions, with
  **`rls-isolation` and `e2e` promoted to required checks**. Gated manual
  deploy workflow for migrations + edge functions. Per-PR Cloudflare preview deploys.
- Error capture + hourly alert digest; `log-error` rate-limit + retention; audit /
  balance_history retention + rollup. Client-initiated document uploads.
- **All CRITICAL + MAJOR findings** from the 2026-06-06 and 2026-06-08 clean-room
  reviews resolved (fail-closed DocuSign webhook, non-forgeable audit RPC, flagged-
  question thread fix, phase white-label backend rebuild, Plaid token in Vault,
  Realtime defense-in-depth, single expense-total helper).
- Legal/trust surface (Privacy/Terms/DPA/Security) drafted + counsel-reviewed (v1);
  entity formed (LeMay Ventures LLC, CO); support inboxes live.

**Migration high-water mark:** `031_advisor_honorific.sql` — all migrations through
`031` are applied on the live project, the gated edge functions (`docusign-connect`,
`plaid-exchange-token`) are deployed, and Realtime-RLS scoping + the `CRON_SECRET`
Vault entry are verified. Repo and live project are in sync.

**Known-open (carried into the reset, not regressions):** the forward tracks in
[`ROADMAP.md`](ROADMAP.md) and the code-quality backlog (MINOR/CLEANUP items left open
by design). Nothing CRITICAL or MAJOR is outstanding.

---

## 2026-06-08 — UX polish + asset-location planning depth (post-reset)

First sprint after the baseline reset. PR #37 (squash-merged to `main`,
`6f62ba7`). Build · lint · calc · check · e2e · rls-isolation all green; verified
in a browser preview. Frontend auto-deploys on merge. **No migration, no secrets,
no money.**

**What shipped**
- **Pages open at the top.** New views/clients reset window scroll on navigation
  (`src/app.jsx`). The body is the scroller and the topbar is `position: sticky`, so
  a freshly-rendered view was inheriting the prior page's scroll position and opening
  mid-scroll. Reset on every view switch, and on a client switch only while on the
  portal (so opening a client's Numbers drawer from the advisor view doesn't jump the
  roster). A phase deep-link still re-scrolls itself ~150ms after mount and wins.
- **Client quick-view modal no longer clips "View roadmap."** Widened to 720px
  (`.px-modal-client` in `styles.css`), header actions wrap, and the 8-tab row scrolls
  instead of forcing a horizontal scrollbar on the whole modal (`src/advisor-modal.jsx`).
- **Roth wired into the model.** New `profile.retirement.rothBalance` (jsonb,
  `mergeProfile`-backfilled; editable in the Numbers panel; counted in
  `retirementAssets`). The Asset Location tool's tax-free sleeve is now HSA + Roth, not
  HSA + 0 (the long-standing `roth = 0` stub). (`src/store.jsx`, `src/numbers-panel.jsx`)
- **Bespoke asset-location table.** New `calc-core.assetLocationPlan()` places the
  household's *actual* dollars across the three sleeves, fit to their `riskProfile`
  strategic allocation — tax-inefficient assets (bonds/TIPS, REIT) shelter into
  tax-deferred/tax-free first, tax-efficient broad equity + international anchor
  taxable. Replaces the static rule-of-thumb model (kept as the fallback for
  blank/prospect clients). Unit-tested (`scripts/calc.test.mjs`). This is the first
  increment of the C4 tax-return-insight / planning-depth track; more depth is wanted
  (see ROADMAP Tier B).

**Files:** `src/app.jsx`, `src/advisor-modal.jsx`, `src/styles.css`, `src/store.jsx`,
`src/numbers-panel.jsx`, `src/calc-core.cjs`, `src/calculators.jsx`,
`scripts/calc.test.mjs`.

---

## 2026-06-11 — Round 15: portal accounts view + LinkedIn launch kit

Build · lint · calc · check all green; verified in a browser preview (demo client
view). **No migration, no secrets, no money** — accounts reads ride the existing
`accounts_client_read` RLS policy (migration 002).

**What shipped**
- **Client portal "Your accounts" card (custodian-grouped).** Read-only,
  account-level card in the client roadmap (above the Conversation thread):
  accounts grouped by custodian with per-group subtotals, type labels
  (`window.db.ACCOUNT_TYPE_LABELS`), grand total, and an as-of stamp from the
  newest `as_of`/`updated_at`. Holdings stay partner-gated by design (ROADMAP
  Tier C decision, 2026-06-10). Demo mode renders from `accountsData`; hidden
  when a household has no accounts on file. (`src/client-portal.jsx`)
- **"Something look different?" → conversation hook.** The card's footer button
  fires a `px:prefill-message` window event; `MessageThread` (components.jsx)
  listens, prefills the compose box with a gentle starter, scrolls the thread
  into view, and focuses the textarea. Reusable from any future card.
- **LinkedIn company-page launch kit** (`docs/marketing/`): brand-exact logo
  (400×400) + banner (2256×382 @2x) PNGs generated by the new
  `scripts/linkedin-assets.mjs` (Playwright render, brand navy `#1c2e4a`, the
  app's prism mark), plus `linkedin-launch-kit.md` — page-setup fields, About
  description, and the first-ever company post draft. Queued in your TODO.

**Files:** `src/client-portal.jsx`, `src/components.jsx`,
`scripts/linkedin-assets.mjs`, `docs/marketing/*`, `docs/TODO.md`.

---

## 2026-06-11 — Round 16: faceted brand rollout + Phase-01 document actions

PRs #61–#63 merged + this batch. Build · lint · calc · check green; portal
behavior verified in browser preview. **No migration, no secrets, no money** —
documents ride the existing acknowledgements flow (migration 017) and the
`_openPrint` plumbing.

**What shipped**
- **Faceted brand identity everywhere.** New tetrahedron mark (brand navy
  `#1c2e4a`, teal/green/blue facets) replaced the old outline triangle in:
  favicons on all 11 HTML pages, `og-image.png`, portal PWA icons (192/512,
  maskable-safe), app topbar brand chip, loading/setup screens, portal topbar,
  landing nav + footer, login/signup, legal page headers. Single source
  `scripts/brand-mark.mjs`; `scripts/brand-assets.mjs` regenerates site assets;
  `scripts/linkedin-assets.mjs` the LinkedIn kit. Monochrome `Icons.Prism`
  intentionally kept in icon (non-logo) contexts. High-res masters + a
  LinkedIn-specific banner (no mark, wordmark shifted right for LinkedIn's
  logo-overlay framing) live in `branding/` with their generators.
- **Account dropdown widened** (240px rest / 340px while editing name &
  credentials; was 186px — PR #62).
- **Phase 01 milestone actions (client portal).** Cash-flow-worksheet milestone
  gained a **Numbers panel** button (opens the household ledger drawer, next to
  Discuss-with-advisor). Fiduciary-disclosure and IPS milestones gained
  **View sample** buttons → printable sample documents (`PLANNING_SAMPLES` in
  `store.jsx`, same pattern as `ESTATE_SAMPLES`) with "your advisor sends the
  firm's official version" banners. Task schema: `panel: 'numbers'` and
  `doc: 'fiduciary' | 'ips'` flags in `phasesData`.
- **Advisor "Draft disclosure" prefill** (ClientPreviewModal, next to Draft
  IPS) — prefills a fiduciary-disclosure acknowledgement the advisor edits into
  the firm's own language, then sends for in-portal e-sign or escalates to
  DocuSign (both flows pre-existing). This is the "advisor populates their own
  version" path for both documents.

**Files:** `src/{icons,data,store,client-portal,advisor-modal,app,shell,portal-app}.jsx`,
`scripts/brand-*.mjs`, `scripts/linkedin-assets.mjs`, `branding/*`, HTML pages,
`og-image.png`, `icons/portal-*.png`, `docs/marketing/*`, `docs/TODO.md`.

## 2026-06-11 - Round 17: no-em-dash rule + OG metadata mojibake fix

**PRs:** #65 (pages + content), #66 (deploy retrigger), #67 (src sweep). All merged, all checks green, LIVE.

- **New foundational style rule (CLAUDE.md):** never use em-dashes anywhere
  (copy, titles, UI strings, docs, commit messages). Titles use
  "Prism | X"; prose uses comma, colon, period, or spaced hyphen " - ".
  Triggered by founder preference plus a real bug: HTML pages on disk held
  double-encoded em-dashes ("a-circumflex" mojibake) that LinkedIn's Post
  Inspector surfaced in the live og:title / og:description.
- **#65:** swept all 11 public HTML pages + `content/pages.mjs`; repaired the
  mojibake (page titles now "Prism | The Advisor Workspace"); also fixed the
  corrupted ellipsis in `oauth-callback.html`.
- **#66:** empty retrigger commit; the Cloudflare Workers build flaked twice
  (once on the PR branch, once on the main merge commit). If prod looks stale
  after a green merge, check the Workers Builds check-run on the main commit.
- **#67 (side task):** removed remaining em-dashes from all `src/` files.
- Verified live: `prismaw.com` serves the clean title/OG tags.

**Human hand-off:** run https://prismaw.com through LinkedIn Post Inspector to
bust the share-preview cache (also picks up the round-16 OG image). The
existing launch post keeps its old snapshot unless deleted and re-shared.

**Files:** `CLAUDE.md`, 11 root HTML pages, `content/pages.mjs`, `src/*`.

## 2026-06-11 - Round 18: phase-copy polish, two new planning samples, platform last-login

**PR:** (round-18 batch). Frontend + one edge-function change (platform-admin).

- **Two new planning samples** in `PLANNING_SAMPLES` (`store.jsx`):
  `obligations` - "Recurring Obligations & Minimums Schedule" wired to Phase 02
  milestone 4 (Document recurring obligations + minimums), and `liability` -
  "Complete Liability Schedule" wired to Phase 03 milestone 1. Both tasks also
  gained Discuss-with-advisor buttons (`doc:` + `tool:'discuss'` in `data.jsx`).
- **Copy spell-outs:** Phase 02 milestone 1 now reads "Treasury money market
  fund (MMF)" and gained a Discuss button; tool titles spell out
  "High-deductible health plan (HDHP) vs. PPO break-even" and "Required minimum
  distribution (RMD) projector"; the Roth Conversion Window hint spells out RMDs.
  (Phase 04 milestone 1 already spelled out HDHP in the task label.)
- **"Open tool" → "See tool below":** advanced-tool milestones (Phase 05 m5/m6,
  Phase 06 m4/m6, Phase 07, Phase 03 m6) now show a quiet ghost-styled pointer
  (`.px-task-act.is-ghost`) since the tool is already rendered on the page;
  click still scrolls + flashes the tool.
- **Platform admin - Last login column:** `platform-admin` edge fn `overview`
  now returns `last_login_at` per firm (latest `login` px_event, no time window
  so idle firms show a date instead of "quiet"); dashboard table gained the
  column ("never" when analytics is off). Requires edge-fn deploy via the gated
  `deploy.yml` workflow.
- **More mojibake repaired:** landing/login/signup still had double-encoded
  middots, ®, curly quotes, and the password-bullet placeholder; all normalized.

**Where the adjustment options live (founder Q):** firm rename = Firm Admin →
Branding (updateFirmBrand accepts `name`); advisor name/honorific/credentials/
address style = account chip dropdown (top right); client household data =
Numbers panel ("Update numbers" / "Your numbers"); plan/seat overrides =
platform admin (#/platform).

**Files:** `src/{data,store,client-portal,calculators,platform-admin}.jsx`,
`src/styles.css`, `supabase/functions/platform-admin/index.ts`,
`landing|login|signup.html`, `docs/*`.

## 2026-06-11 - Round 19: portal honors advisor address style in chip + hero

Small fix batch. Build · check · calc green; verified in browser preview
(demo advisor renders as "Ms. Chen" in both spots). **No migration, no
secrets, no money.**

- **Portal advisor chip + hero now use the styled name.** Both rendered
  `advisorDisplay.fullName` ("Cory Lemay") instead of `advisorDisplay.name`,
  which applies the advisor's chosen address style via `advisorFormalName`
  (honorific + address_style, e.g. "Mr. Lemay"). Every other portal surface
  already used the styled name. Printed reports (performance/scheduler)
  intentionally keep the full legal name. (`src/client-portal.jsx`)
- **Marketing logo candidates** added to `docs/marketing/` (`logo.jpg`,
  `logo2.png`) - founder-supplied, parked with the LinkedIn kit assets.

**Founder Q answered (admin role):** both provisioning paths (self-serve
migration 008, platform `provision_firm`) DO auto-set the firm's first
advisor as `role='admin'`; the founder's own early row predates that and is
plain `advisor`, so no Admin tab. Fix is already queued in TODO ("Give
yourself the firm-admin role"): one SQL line, or the Platform tab's
per-firm Advisors roster role toggle.

**Files:** `src/client-portal.jsx`, `docs/marketing/*`, `docs/sprint-log.md`.

---
<!-- New sprints append above this line, newest first. -->

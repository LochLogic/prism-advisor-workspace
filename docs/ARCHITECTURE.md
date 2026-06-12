# PRISM Advisor Workspace | Architecture Map

> **Purpose:** condensed router for AI/dev work. Tells you *which* file owns a
> concern and what it exports - not every line. Read the named file for deep logic.
> **Last synced:** 2026-06-11 round-23 sprint (smart Retirement goal · Asset-Location what-if · milestone doc gates · advisor playbook · encrypted SSN store + `client-identifiers` edge fn · `src/paperwork.jsx` custodian-paperwork POC · Help drawer + build-time guides). **Regenerate when:** `build-files.mjs`
> load order changes, a `src/*` file is added/split, or `window.db`/`PrismCalc` gain methods.

---

## 1. What this is

A single-tenant-per-firm B2B SaaS for RIAs (registered investment advisors): an
advisor command center + a client roadmap portal. React via **window-globals + esbuild
concat** (no module bundler - files share one global scope; cross-file refs are bare
names assigned to `window`). Backend = **Supabase** (Postgres + RLS + Edge Functions).
Static hosting = **Cloudflare Workers**. See [memory: project-architecture].

## 2. Runtime model (critical to understand before editing src/)

- **No imports/exports between `src/*` files.** They concatenate in the order in
  `build-files.mjs` into one scope. A file uses `Foo` from an earlier file directly,
  and publishes its own surface via `window.Foo = Foo` (or `Object.assign(window, {...})`).
- **Two bundles, one source pool** (`build.mjs`):
  - `dist/bundle.js` → `/app` - advisor/admin app (all files).
  - `dist/portal.js` → `/portal` - slim client portal; **excludes** advisor-modal,
    advisor-dashboard, firm-admin, platform-admin (smaller payload + smaller client attack surface).
- **Load order = dependency order.** Adding a file means editing `build-files.mjs`
  (single source of truth, also consumed by the linter so they can't drift).
- **Demo mode:** if Supabase CDN fails or `px_demo` flag set, auth is bypassed,
  advisor role granted, mock data from `data.jsx` used. `window.db.isUUID(id)`
  gates real-DB writes vs. in-memory demo state throughout.

## 3. File tree (tracked, node_modules omitted)

```
build.mjs              concat src in load order → esbuild JSX/minify → dist/ + _site/ deploy dir;
                       also renders docs/guides/*.md → window.__pxGuides (ADVISOR bundle only)
                       + printable /guides/<slug>/ pages (round 23 Help/training)
build-files.mjs        SINGLE SOURCE OF TRUTH for src load order (sharedFiles/sourceFiles/portalFiles)
index|landing|login|signup|portal.html   entry HTML pages (marketing + app shells)
dpa|privacy|security|sla|terms.html      static legal pages
wrangler.jsonc         Cloudflare Workers config
playwright.config.ts   e2e config

src/
  error-reporter.js    window.__pxReportError - captures errors → log-error edge fn
  supabase-client.js   window.__sb = supabase client (null if CDN fails → demo mode)
  brand-boot.js        standalone pre-auth brand paint (login/signup/landing only - NOT in the bundles/build-files.mjs; copied + cache-busted by build.mjs)
  portal-sw.js         portal service worker (push notifications only, NO fetch cache - NOT bundled; copied by build.mjs to /portal-sw.js, scope /portal/)
  icons.jsx            window.Icons - Lucide-style SVG set
  data.jsx             domain mock data + phasesData/advisor; the 7 Wealth-Horizons phases
                       (task flags incl. `requiresDoc` doc gates, round 23) + `advisorPlaybook`
                       (per-phase firm script defaults; firm overrides are a planned table)
  calc-core.cjs        window.PrismCalc - ALL financial math (pure, also unit-tested)
  db.jsx               window.db - the entire Supabase data-access layer (~60 methods)
  store.jsx            React context providers (Profile/Task/View/Notification) + print/* + fmt helpers
  auth.jsx             window.AuthProvider/useAuth - session, role detection, sign-out
  components.jsx       shared UI: Modal, Avatar, Sparkline, MilestoneAchievedModal, Toast, NumInput
                       (round 22: NumInput is THE numeric input - leading-zero-safe; raw
                       `<input type="number">` over number state is a known trap, don't reintroduce)
  shell.jsx            chrome shared by BOTH bundles: LoadingScreen, NotificationBell, AccountChip, 2FA, ErrorBoundary
  calculators.jsx      basic + advanced advisor tools; `calculators` registry keyed by phase `calc`/`calcs`;
                       `InsightAction` (round 11) - advisor-only "Add to agenda" hook turning tool verdicts into CRM tasks
  numbers-panel.jsx    window.NumbersDrawer - household ledger editor (DOB picker, accounts, cashflows;
                       round 23: per-member encrypted SSN capture via db.*Identifier*, advisor-only reveal)
  client-portal.jsx    window.ClientPortal - View B: client roadmap, phase cards, Discuss-with-Advisor;
                       PhaseCard enforces `requiresDoc` milestone gates (advisor override audited)
  paperwork.jsx        custodian account-paperwork POC (round 23): buildPaperworkPayload + PaperworkModal
                       + PAPERWORK_ADAPTERS (Quik! blanks list) - ADVISOR bundle only, loads before advisor-modal;
                       payload exports Quik! Execute-shaped FormFields (docs/quik-field-taxonomy.md)
  advisor-modal.jsx    NewClientModal + ClientPreviewModal (advisor bundle only; quick view carries the
                       advisor playbook card + Paperwork button, round 23)
  advisor-dashboard.jsx window.AdvisorDashboard - View A: KPIs, roster, alerts, flagged-Q inbox
  firm-admin.jsx       window.FirmAdminDashboard - advisor mgmt, firm clients, fee schedules, audit log, ledger-gate toggle
  platform-admin.jsx   window.PlatformOwnerDashboard - founder tier (#/platform): firm overview, provision/suspend, plan overrides
  app.jsx              window.App - advisor entry: auth gate, topbar, view switch, Help drawer
                       (searchable window.__pxGuides + /guides/<slug>/ printable link)
  portal-app.jsx       window.PortalApp - slim client entry (/portal bundle)
  styles.css / print.css   hand-authored CSS (print.css = report/invoice print layout)

portal-manifest.webmanifest   PWA manifest (copied to /portal/manifest.webmanifest); icons/ = portal PNG icons

supabase/
  migrations/001-044   schema evolution (names are self-describing; 001 = base schema;
                       044 = client_identifiers, service-role-only encrypted SSN store)
  functions/           Edge Functions (Deno) - see §6
  functions/_shared/   auth.ts, cors.ts, docusign.ts, calendar.ts (provider plumbing), fees.ts (canonical BACKEND fee math)
  tests/               integration.sql, rls_isolation.sql (tenant-isolation proofs)
  config.toml

scripts/
  check.mjs            smoke-asserts the dist/ deploy artifact post-build
  lint.mjs             custom linter (resolves bare cross-file globals via build-files.mjs;
                       also asserts src/ coverage ↔ build-files.mjs + portal isolation)
  calc.test.mjs        zero-dep unit tests over calc-core.cjs (--quiet → failures + count only)
  outline.mjs          file outline (declarations + window.* exports + line numbers) - AI token saver
  db-test.mjs / rls-test.mjs   run supabase/tests/*.sql
  publish-due.mjs / gsc-digest.mjs / seo-check.mjs / build-whitepaper.mjs / serve.mjs   ops/SEO/content

content/pages.mjs      static SEO/intent pages rendered to HTML at build
docs/                  ROADMAP (forward), TODO (live board), sprint-log (baseline), WHITEPAPER  [see memory]
docs/guides/           advisor help guides (markdown source → Help drawer + printable PDF pages)
e2e/demo.spec.ts       Playwright smoke
.github/workflows/     ci, deploy, scheduled-publish, seo-digest, seo-health
```

## 4. Key export surfaces (the contracts you'll call)

**`window.db`** (`src/db.jsx`) - Supabase data layer. Method groups:
- Clients: `getClients, getBookTotals, createClient, updateClient, archiveClient, updateClientNotes, createClientInvite, claimClient, mapClient, syncClientTotals`
- Accounts/ledger: `getAccounts, upsertAccount, deleteAccount, getCashFlows, addCashFlow, deleteCashFlow`
- Profile: `getProfile, saveProfile, getProfileVersions`
- Tasks/flags: `getTaskStates, upsertTask, getFlaggedQuestions, flagQuestion, resolveQuestion, getFlagMessages, addFlagMessage`
- Alerts/meetings: `getAlerts, snoozeAlert, getMeetings, logMeeting, requestMeeting, updateMeetingStatus, deleteMeeting`
- Firm/billing: `getAdvisors, getFirmClients, getFeeSchedules, createFeeSchedule, getInvoices, updateInvoiceStatus, getSubscription`
- Compliance: `getAcknowledgements, getFirmAcknowledgements (firm-wide, round 7), createAcknowledgement, signAcknowledgement, sendDocusignEnvelope, audit, getAuditLog ({limit, clientId, since})`
- Messaging/docs: `getMessages, sendMessage, markMessagesRead, getUnreadMessageClients, getDocuments, uploadDocument, getDocumentUrl, deleteDocument, getDocumentRequests, requestDocument, resolveDocumentRequest` (doc requests ride on `messages` via `context='doc-request:<cat>'` / `'doc-request-done:<id>'` - crm_tasks has no client RLS, messages do; zero schema change, audit-logged)
- Misc: `getPhases, getBalanceHistory, getBookBalanceHistory, getTasks/createTask/updateTask/deleteTask, isUUID, timeAgo`
- Analytics/push (round 13): `track(event, {clientId, meta})` → `px_track` RPC
  (migration 041; fire-and-forget, no-ops in demo/pre-migration);
  `savePushSubscription/removePushSubscription` (push_subscriptions, migration 042).
  Advisor-authored sendMessage / requestDocument / createAcknowledgement also
  fan out to the `send-push` edge fn (fire-and-forget `_pushToClient`). Events
  instrumented: login (auth.jsx), invite_created/claimed, message_sent,
  plan_updated, report_printed (store.jsx printers), push_subscribed (portal-app).
- Branding/AI (2026-06-09): `getFirmBrand, updateFirmBrand, getBrandForSlug` (anon RPC
  `px_brand_for_slug`, migration 032), `aiAssist(action, context)` → `ai-assist` edge fn
- Calendar (round 10): `getCalendarStatus, connectCalendar(provider), disconnectCalendar,
  getCalendarEvents(days), createCalendarEvent` → `calendar-oauth`/`calendar-events` edge
  fns (tokens server-side only, `calendar_connections` migration 033); `bulkCreateClients`
  → `px_bulk_create_clients` RPC (migration 034; importer falls back per-row if missing)
- Platform tier (round 12): `platformAdmin(action, payload)` → `platform-admin` edge fn
  (px_platform_owners allowlist, migration 035; `whoami` is the cheap owner probe;
  round 12d added `set_advisor_role` admin⇄advisor)
- Identity (rounds 12c/d): `updateAdvisorProfile` (own name/honorific/credentials/
  address_style; advisors_update_self RLS), `getMyAdvisor` (px_my_advisor RPC,
  migration 038 - a CLIENT's advisor display fields; clients can't read `advisors`),
  `updateFirmBrand` also accepts a non-empty `name` (firm rename). Client-facing
  advisor reference = `advisorFormalName({honorific, fullName, addressStyle})`
  (data.jsx) - 'first' | 'last' | 'formal'; NULL style = legacy derivation.
- Ledger approval gate (round 12, migration 036): `getLedgerGate` (px_ledger_gate RPC  - 
  client-safe), `setLedgerGate/getFirmLedgerGate` (firms.ledger_approval_required),
  `getPendingLedgerChange(clientId)`, `submitLedgerChange` (one open draft per client,
  upserted in place), `withdrawLedgerChange`, `getPendingLedgerChanges` (advisor inbox),
  `reviewLedgerChange(row, advisorId, approve, note)` (approve = saveProfile then close).
  All methods no-op/return null until the migration is applied.
- Encrypted identifiers (round 23, migration 044): `getIdentifiers(clientId)` →
  `[{member_id, kind, last4, updated_at}]`, `setIdentifier(clientId, memberId, value, kind)`,
  `revealIdentifier` (ADVISOR-only, audit-logged server-side), `clearIdentifier` - all via
  the `client-identifiers` edge fn (AES-GCM, IDENTIFIER_ENC_KEY; table is service-role-only,
  no RLS grants). The full value NEVER enters profile JSON / prints / exports / AI contexts.
  Demo no-ops; `{error:'not_configured'}` until migration + secret + fn deploy land.

**`window.PrismCalc`** (`src/calc-core.cjs`) - pure financial math (frontend copy; backend
copy is `functions/_shared/fees.ts`): `monthlyExpenseTotal, buildValueSeries, modifiedDietz,
perfPeriods, debtPayoffMonths, hsaProjection, monteCarlo, rothLadder, estateProjection, tlh,
retirementReadiness, goalFunding, retirementGoalLink + resolveGoal (round 23 - a
'retirement'-type goal's funding auto-links to IRA+401k+Roth balances; EVERY goal consumer
must resolve through it), annualFeeForAum, lifeCoverageGap, assetComposition,
riskProfile, RISK_ALLOCATIONS, assetLocationPlan` · planning-depth (Tier B):
`contributionWaterfall, withdrawalSequence, rothConversionWindow, FED_BRACKETS_2025` ·
client-utility: `bracketPosition` (shared bracket-headroom engine), `w2Position`
(W-2 Box-1/Box-2 capture → parsed marginal rate via `bracketPosition` + effective
withholding rate; front-phase tax-data play, round 6), `termLifePremium`
(illustrative coverage-cost estimate), `yearsToIndependence` (Freedom-Date horizon),
`debtVsInvest` (pay-down-vs-invest crossover verdict) · front-phase parity (2026-06-09):
`mortgagePayoff` (P03 accelerator), `hdhpVsPpo` (P04 plan break-even), `megaBackdoorCapacity`
(P05 after-tax 401k room), `rmdProjection` + `RMD_UNIFORM_DIVISORS` (P07 RMDs at 73),
`ssBenefitFactor` + `socialSecurityClaiming` (P07 62/67/70 optimizer), `equityCompConcentration`
(P06 single-stock risk + tax-to-diversify) · parity finish (round 5): `netWorthTrajectory`
(P01 year-by-year projection; negative balances not compounded), `incomeRunway` (P02
reserve-months-of-essentials with disability benefit + elimination period).
⚠ Client returns are NET of advisory fees, advisor GROSS [see memory: performance-net-of-fees].
⚠ `FED_BRACKETS_2025`, `RMD_UNIFORM_DIVISORS`, the §415(c) mega-backdoor limit, and SS
credit/reduction factors are dated assumptions - reindex annually (like `estateProjection`'s exemption).
Profile JSON gained `equityComp[]` (concentrated positions) and a `pia` field on `social_security`
income streams; captured in `numbers-panel.jsx`. Round 6 added `taxes.w2 = { box1, box2 }`;
round 9 superseded it with `taxes.w2s[]` ({id,label,box1,box2} per earner/job - the legacy
single `w2` is surfaced as the first entry until first edit; COMBINED box1 drives
`w2Position`). Round 9 also added `housing.termYears`/`housing.startYear` (optional;
scheduled-payoff readout) and made `insurance[].owner` a member-name dropdown.
No migration - profile is a JSON blob. Round 7 added `taxes.t1040` (keyed 1040 lines)
→ `tax1040Insights` (Holistiplan-lite observation engine; dated companions
`LTCG_ZERO_TOP_2025`, `IRMAA_TIER1_2025`, plus `FEDERAL_ESTATE_EXEMPTION_2025` now
named/exported) rendered by the Phase-04 `taxreturn` tool. `monteCarlo`'s RNG is
mulberry32 (seeded, deterministic). Vault document deletion fires a
`px:document-deleted` window event; ProfileProvider clears matching
`estate.*.documentId` links.

**`store.jsx`** (via `Object.assign(window,…)`): providers `ProfileProvider/useProfile`,
`TaskProvider/useTasks`, `ViewProvider/useView`, `NotificationProvider/useNotifications`,
`useTheme`; report printers `printClientReport, printMilestoneReport, printComplianceReport, printExamPacket
(firm books-&-records, round 7), printPerformanceReport, printInvoiceReport,
printQBRReport, printIPSReport, printProposalPacket (prospect close-the-deal print,
round 8 - button on the portal prospect banner)`; `openEstateSample(key)` (round 9  - 
illustrative will/trust/POA/directive/beneficiary-review discussion documents, bannered
not-legal-advice, `.sample-banner` in print.css, no auto-print); helpers
`escapeHtml, sanitizeHtml, fmt$, fmtPct, fmtN, emptyProfile, mergeProfile,
downloadCSV` (round 14 - shared formula-injection-safe CSV download; used by the
roster export and the firm-admin Clients/Invoices/Audit CSVs).
Also `ProspectProvider/useProspects` - unsaved "prospect-" households → one-click convert.
Round 9: `createProspect` seeds `px_tasks`/`px_open` to the chosen starting phase;
prospect profiles load/merge on `emptyProfile` (never the demo sample - ProfileProvider
lazy-inits from the right source so no demo-data flash); prospect views suppress
`demoMessages()`.
Also white-label brand engine: `applyFirmBrand(brand)` (inline `--brand`/`--accent*` CSS vars
on `<html>` + `window.__pxBrand` + 'px:brand' event), `useFirmBrand()` hook; boot paints
cached → subdomain-slug → (auth.jsx) authoritative firm row. Every brand input (cache /
anon RPC / firm row) is whitelist-sanitized before paint or re-cache (`_sanitizeBrand`;
mirrored in `src/brand-boot.js` for the pre-auth pages).

**`auth.jsx`**: `AuthProvider, useAuth`. Sets `window.__pxAuthActor = {id, role, email, firm_id}`.

## 5. Primary data flows

1. **Boot:** HTML loads vendor React + `dist/(bundle|portal).js` → `App`/`PortalApp`
   mounts → `AuthProvider` resolves `__sb` session → role (advisor/client/admin) →
   `ViewProvider` reads hash route (`#/advisor|admin|client/:clientId`) → renders View.
2. **Advisor edits client:** AdvisorDashboard/advisor-modal → `window.db.*` →
   Supabase (RLS-scoped by firm_id) → `audit()` append-only log. Demo mode → in-memory.
3. **Client roadmap:** ClientPortal → `useTasks` (TaskProvider) → `db.upsertTask` /
   `db.flagQuestion`; flagged Qs surface in advisor's inbox via Realtime channel
   (NotificationProvider subscribes to `__sb` realtime).
4. **Ledger → projections:** NumbersDrawer edits profile/accounts → ProfileProvider
   recomputes via `PrismCalc` → drives calculators + numbers panels.
5. **Billing:** `generate-invoices` edge fn (admin JWT, service role) → invoices table →
   `printInvoiceReport`; Stripe subscription state via `stripe-webhook` → subscriptions.
6. **Compliance/retention:** every mutation → `audit_log`; `worm-export` edge fn (SEC
   17a-4) dumps 24h of audit_log → private Storage bucket on schedule.
7. **Errors:** any thrown error → `__pxReportError` → `log-error` edge fn → client_errors
   → `error-digest` edge fn clusters → Slack webhook.

## 6. Edge Functions (`supabase/functions/`)

| Function | Role |
|---|---|
| `create-checkout-session` | Advisor → Stripe subscription Checkout for their firm |
| `stripe-webhook` | Stripe events → subscriptions table (service role) |
| `generate-invoices` | Admin → draft quarterly advisory-fee invoices |
| `docusign-connect` | DocuSign webhook → mark acknowledgement signed |
| `docusign-envelope` | Advisor → escalate acknowledgement into DocuSign envelope |
| `plaid-create-link-token` / `plaid-exchange-token` | Plaid Link → import account balances |
| `worm-export` | SEC 17a-4 audit-log retention export → private bucket |
| `ai-assist` | Advisor JWT → Gemini (server-side key): draft_reply / household_summary / talking_points / attention / w2_extract (round 9 - base64 image/PDF ≤4 MB via `file`, JSON box extraction) |
| `platform-admin` | Founder JWT checked against px_platform_owners → service-role firm administration: whoami / overview (incl. 30-day px_events usage per firm, round 14) / firm_detail / provision_firm / suspend_firm / reactivate_firm / set_plan (all audit-logged `platform.*`) |
| `calendar-oauth` | Advisor JWT → Google/Microsoft calendar connect lifecycle (auth_url / exchange / status / disconnect); tokens → `calendar_connections` (service-role only) |
| `calendar-events` | Advisor JWT → upcoming / freebusy / create across connected calendars; auto token refresh. Callback pages: `/oauth/{google,microsoft}/callback` (one `oauth-callback.html`, written twice by build.mjs) |
| `send-push` | Advisor JWT → web-push to a client's installed portal (PWA); tenant-checked, VAPID server-side, prunes dead endpoints |
| `client-identifiers` | Advisor-or-self JWT → encrypted SSN/ITIN/EIN store (round 23): list / set / reveal (advisor-only) / clear; AES-256-GCM with `IDENTIFIER_ENC_KEY`, tenancy enforced in code, set/reveal/clear audit-logged; `not_configured` until migration 044 + secret land |
| `log-error` | Public sink for client error reporter |
| `error-digest` | Cluster new client_errors → Slack alert |
| `health` | Pipeline liveness probe |
| `_shared/` | `auth` (constant-time secret cmp), `cors`, `docusign` (JWT grant), `fees` (canonical backend fee math) |

## 7. Commands

```
npm run build      # concat src → esbuild → dist/ + _site/
npm test           # build + check (smoke) + test:calc
npm run lint       # custom global-scope linter
npm run test:calc  # calc-core unit tests
npm run test:db    # integration.sql
npm run test:rls   # rls_isolation.sql (tenant isolation)
npm run test:e2e   # playwright
```
CI required checks: `ci + Cloudflare Workers Builds + rls-isolation + e2e` [see memory: ci-merge-gating].

## 8. Gotchas

- Editing a `src/*` file's exports = update `window.*` assignment AND check `build-files.mjs` load order (a file can only use names from files **above** it).
- `phasesData` is mutated in place after DB fetch (white-label per firm) - don't freeze it at module load; recompute phase options at call time.
- Frontend `PrismCalc` and backend `_shared/fees.ts` are **parallel** fee implementations - change both together.
- Portal bundle must never reference advisor-only files (advisor-modal/dashboard/firm-admin) or the `/portal` build breaks.
- White-label theming = inline CSS custom properties on `<html>` (`--brand`,
  `--brand-hover`, `--accent`, `--accent-soft`, `--accent-line`) - inline beats every
  stylesheet rule incl. dark theme. Firm logos are **data URIs** in `firms.logo_url`
  (≤200 KB; CSP `img-src` allows `data:` but no external hosts - don't switch to a
  storage URL without a CSP change).
- Phase → tools: each phase in `data.jsx` carries `calcs: [...]` (preferred, any count) or legacy `calc`/`calc2`, keying into the `calculators` registry; `client-portal.jsx` resolves either form. Add a tool = register it in `calculators` + reference its key from a phase.

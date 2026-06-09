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

<!-- New sprints append above this line, newest first. -->

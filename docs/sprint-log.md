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

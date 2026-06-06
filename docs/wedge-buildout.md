# Prism — Wedge Build-Out Sprint Plan

> **A deliberate amendment to the ROADMAP "don't over-build" principle.**
> Created 2026-06-06. The standing roadmap says *resist net-new features; let design partners decide.*
> This plan adds a hard counter: **we will build what makes the wedge coherent and demonstrably valuable to the client relationship.** The line is redrawn, not erased:
>
> - **Build now** = anything that deepens the client-facing planning + collaboration layer (the wedge). This is where the value the customer pays for actually lives.
> - **Still defer** = backend parity with incumbents (holdings-level attribution, custodian feeds, object-lock WORM). These remain design-partner-gated per ROADMAP Phase 2.

---

## End-state vision

> **A solo / small fee-only RIA runs their entire client-facing relationship in Prism — no second portal, no separate CRM.**

When the client logs in they see:
1. **Their whole financial picture** — managed + held-away accounts, real estate, insurance, estate documents, income composition, the people in the household.
2. **A living roadmap that honestly answers "am I on track?"** — goal-based, projection-backed, not a static checklist.
3. **A real two-way conversation** with their advisor — a unified thread, not scattered task flags.
4. **Documents** to review, e-sign, and download — the signed IPS actually lives somewhere.
5. **Performance** they can read.

The advisor sees a **complete household**, a **single unified inbox** (questions + messages + meeting requests + tasks due), **goal tracking**, and an **on-track verdict per client** — and can drive the whole relationship without leaving the tool.

**Exit criteria for "end-state":** every captured field surfaces somewhere (no dead inputs); the roadmap renders a defensible on-track verdict from real household data; advisor and client can hold a threaded conversation; a document can be uploaded → reviewed → signed → downloaded; demo and live parity holds for all new surfaces.

---

## Architecture enablers (why this is cheaper than it looks)

- **The profile is a `jsonb` blob** (`profiles.data`) and `mergeProfile` backfills new keys. → **Planning inputs (goals, insurance, fixed-income streams, retirement detail) need NO migration.** Add a key, it just works on old profiles.
- **New shared/audited entities** (messages, documents) → relational tables with RLS + audit, following the `acknowledgements`/`crm_tasks` pattern already in the repo.
- **Realtime + audit + RLS scaffolding already exists** (Sprint 12/13). New tables plug into it.
- **calc-core.cjs is pure + unit-tested** → new projection math goes there and gets tests for free.

---

## Sprint sequence (by value × dependency)

### THEME 1 — Planning that answers "are we on track?" *(the core value)*

#### Sprint W1 — Fixed-income streams + retirement-readiness engine ✅ SHIPPED (main)
The roadmap promises retirement/drawdown guidance but has no projection that uses the household. This makes Phase 6 real and gives every client the one answer they pay for.

| | |
|---|---|
| **Build** | • Fixed-income streams: pension / Social Security / annuity, each with `monthlyAmount`, `startAge`, `colaPct`, owner (member).<br>• Retirement-readiness engine in `calc-core.cjs`: combines members' ages, invested assets, contribution rate, expenses, and streams → a funded-ratio + "on track / gap" verdict + a depletion-age estimate.<br>• Surface an **"On track" verdict card** on the client portal hero and the advisor roster + client modal Overview. |
| **Data** | `profile.incomeStreams[]` (jsonb, no migration). Reuse `members`, `planningAge`, `retireAt`. |
| **Surfaces** | `calc-core.cjs`, `store.jsx` (derived `retirementReadiness`), `numbers-panel.jsx` (streams editor), `client-portal.jsx` (verdict card), `advisor-dashboard.jsx` + `advisor-modal.jsx` (verdict). |
| **Tests** | `calc.test.mjs`: streams with start-age delay, COLA, zero-asset, over-funded, gap cases. |
| **DoD** | A household with SS at 67 + a pension shows a defensible funded ratio + verdict on both roles; FinFire `FixedIncomeEditor` ported + re-skinned. |

#### Sprint W2 — Goal-based planning ✅ SHIPPED (main)
Goal tracking is the heart of client value ("are we on track for college / the house / retirement"). Today there's only a single retirement age.

| | |
|---|---|
| **Build** | • `goals[]`: type (retirement/education/home/custom), target amount, target date, current funding, monthly contribution, linked phase.<br>• Per-goal progress + on-track math (required vs. actual run-rate) in `calc-core.cjs`.<br>• **Goals panel** in the client portal (progress rings) and advisor modal (edit + nudge); optional link of a goal to a roadmap phase. |
| **Data** | `profile.goals` upgraded from `{age, retireAt}` to `{ age, retireAt, items: [...] }` (jsonb; `mergeProfile` keeps back-compat). |
| **Surfaces** | `calc-core.cjs`, `store.jsx`, `numbers-panel.jsx` / a dedicated Goals editor, `client-portal.jsx`, `advisor-modal.jsx`. |
| **Tests** | goal funding math: on-pace, behind, overfunded, past-due. |
| **DoD** | A client can see "College — 62% funded, on pace" and the advisor can adjust the target/contribution and see it reflow. |

### THEME 2 — Collaboration depth *(the actual differentiator)*

#### Sprint W3 — Unified two-way messaging + advisor inbox
Collaboration is the wedge, and today it's the thinnest part — only per-task flags. Add a real thread.

| | |
|---|---|
| **Build** | • `messages` table (per client, threaded, RLS firm→advisor→client, realtime, audited).<br>• **Client portal**: a persistent conversation thread (not just per-task flags); existing flag/question flows post into it with phase context.<br>• **Advisor unified inbox**: merge flagged questions + messages + meeting requests + tasks-due into one prioritized stream with deep-links (extends the existing notification bell + questions inbox).<br>• Co-built **meeting agenda**: items the client/advisor add before a confirmed meeting. |
| **Data / infra** | **Migration 019**: `messages` (+ RLS + realtime publication + audit triggers). |
| **Surfaces** | `db.jsx`, `client-portal.jsx`, `advisor-dashboard.jsx` (inbox), `advisor-modal.jsx` (thread tab), realtime in `app.jsx`. |
| **Tests** | `rls_isolation.sql`: a client sees only their own thread; cross-firm denied. Edge/integration smoke for post+read. |
| **DoD** | Advisor and client exchange messages in real time; the advisor inbox shows one merged, deep-linked stream; tenant isolation proven in CI. |

### THEME 3 — Completeness & trust *(whole-picture)*

#### Sprint W4 — Document vault
The product captures an e-signature but the signed IPS / statements / tax docs live nowhere. Close the loop.

| | |
|---|---|
| **Build** | • Private Supabase **Storage bucket** (`client-documents`, RLS-scoped) + `documents` table (metadata, owner, category, linked acknowledgement).<br>• Advisor **upload**; client **review + download**; link an acknowledgement to a stored document so e-sign attaches to a real file.<br>• Categories: IPS, statement, tax, estate, disclosure, other. |
| **Data / infra** | **Migration 020**: `documents` table + Storage bucket + RLS policies + audit. |
| **Surfaces** | `db.jsx`, `advisor-modal.jsx` (Documents tab), `client-portal.jsx` (Documents card). |
| **Tests** | RLS: client downloads only their docs; upload writes audit row. |
| **DoD** | Advisor uploads an IPS, requests acknowledgement on it, client downloads + signs; record is immutable + audited. |

#### Sprint W5 — Risk & protection capture (the rest of the "whole picture")
A real financial plan includes protection + estate readiness. Capture (not advise) to complete the picture and feed Phases 1 & 6.

| | |
|---|---|
| **Build** | • **Insurance**: life / disability / LTC — carrier, coverage amount, premium, owner.<br>• **Estate checklist**: will, revocable trust, POA, healthcare directive, beneficiary review — status + last-reviewed date.<br>• A **"Protection & estate" view** (client + advisor) summarizing coverage gaps vs. simple guidelines (e.g. life coverage vs. income multiple) — capture + light coaching, no underwriting.<br>• Wire **retirement contribution detail** (`employerMatchPct`, deferrals, limits — already in the model, currently un-editable) into the Numbers panel and the Phase 1/4 task coaching. |
| **Data** | `profile.insurance[]`, `profile.estate{}` (jsonb, no migration). |
| **Surfaces** | `store.jsx`, `numbers-panel.jsx`, `client-portal.jsx`, `advisor-modal.jsx`, Phase-1/4 calculators. |
| **Tests** | coverage-gap helpers in `calc.test.mjs`. |
| **DoD** | No dead fields remain; coverage + estate status show on both roles; Phase 1 "Protection" framing is backed by real data. |

#### Sprint W6 — Coherence, parity & hardening
Make it all hang together and not regress.

| | |
|---|---|
| **Build** | • **Asset truth model**: formalize "managed (AUM) vs. held-away" instead of two divergent totals — net worth composed of managed accounts + explicitly-flagged held-away balances; retire the reconciliation *warning* in favor of a correct *composition*.<br>• **Demo/live parity**: seed every new surface (streams, goals, messages, documents, insurance) in demo so the sales demo shows the full story.<br>• **Accessibility + mobile** pass on all W1–W5 surfaces.<br>• **Test coverage**: RLS for new tables in CI, calc tests for new engines, one live UAT pass of the new flows. |
| **DoD** | One number for assets that reconciles by construction; demo tells the complete end-state story; new surfaces pass a11y/mobile; CI green incl. new RLS + calc tests. |

---

## Sequencing rationale

1. **W1–W2 first** — the on-track verdict + goals are the value clients can *feel*; they also exercise the richer household model just shipped (members/ages/income), so nothing is wasted.
2. **W3 next** — collaboration is the literal differentiator; it's higher-effort (new table + realtime + inbox merge) so it follows the quick planning wins.
3. **W4–W5** — completeness/trust; W4 (documents) unblocks a credible compliance story, W5 fills the last picture gaps.
4. **W6** — the integration/hardening sprint that turns "features shipped" into "coherent product."

## What stays deferred (discipline preserved)
- Holdings-level aggregation / per-security attribution (Plaid Investments) — **partner-gated**.
- Custodian/Schwab/Fidelity feeds — **partner-gated**.
- Object-lock WORM (true 17a-4) — **infra, human-gated**.
- External calendar sync (Google/Outlook/Calendly) — nice-to-have, not wedge-critical.

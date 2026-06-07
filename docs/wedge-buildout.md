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

#### Sprint W3 — Unified two-way messaging + advisor inbox ✅ SHIPPED (main; needs migration 019)
> Delivered: a persistent realtime advisor↔client thread (`messages` table, migration 019), a `MessageThread` component used in both the client portal ("Conversation") and the advisor client modal (Messages tab), advisor mark-read on open, and a **roster unread dot** so the advisor knows who's waiting. **Lightened from spec (follow-on):** merging flagged questions / tasks-due / meeting-requests into one stream, and co-built meeting agendas — the thread + existing questions inbox coexist for now. **Activation:** run `supabase/migrations/019_messaging.sql` (demo works without it; live messaging needs it).
Collaboration is the wedge, and today it's the thinnest part — only per-task flags. Add a real thread.

| | |
|---|---|
| **Build** | • `messages` table (per client, threaded, RLS firm→advisor→client, realtime, audited).<br>• **Client portal**: a persistent conversation thread (not just per-task flags); existing flag/question flows post into it with phase context.<br>• **Advisor unified inbox**: merge flagged questions + messages + meeting requests + tasks-due into one prioritized stream with deep-links (extends the existing notification bell + questions inbox).<br>• Co-built **meeting agenda**: items the client/advisor add before a confirmed meeting. |
| **Data / infra** | **Migration 019**: `messages` (+ RLS + realtime publication + audit triggers). |
| **Surfaces** | `db.jsx`, `client-portal.jsx`, `advisor-dashboard.jsx` (inbox), `advisor-modal.jsx` (thread tab), realtime in `app.jsx`. |
| **Tests** | `rls_isolation.sql`: a client sees only their own thread; cross-firm denied. Edge/integration smoke for post+read. |
| **DoD** | Advisor and client exchange messages in real time; the advisor inbox shows one merged, deep-linked stream; tenant isolation proven in CI. |

### THEME 3 — Completeness & trust *(whole-picture)*

#### Sprint W4 — Document vault + passive realtime messaging ✅ SHIPPED (main; needs migration 020)
> Delivered: a private Supabase Storage bucket (`client-documents`) + `documents` table (migration 020, RLS firm→advisor→client), a shared `DocumentVault` component used in the advisor client modal (Documents tab — upload/delete) and the client portal (Documents card — review/download via short-lived signed URLs), an acknowledgement→document link so e-sign can attach to a real file, and `demoDocuments()` for demo parity. **Plus the passive-realtime follow-on:** `subscribeAllMessages` wired at the dashboard so the roster unread dot lights live without a modal open. **Activation:** run `supabase/migrations/020_documents.sql` (creates the table, bucket, and Storage RLS; demo works without it).

The product captures an e-signature but the signed IPS / statements / tax docs live nowhere. Close the loop. **Also folds in the W3 follow-on:** the advisor roster should light up a new-message indicator in realtime, without any modal open (today the `MessageThread` only subscribes while its tab is mounted, and the roster unread dot only refreshes when a preview modal closes — see [[arch-review-w1-w4]]).

| | |
|---|---|
| **Build** | • Private Supabase **Storage bucket** (`client-documents`, RLS-scoped) + `documents` table (metadata, owner, category, linked acknowledgement).<br>• Advisor **upload**; client **review + download**; link an acknowledgement to a stored document so e-sign attaches to a real file.<br>• Categories: IPS, statement, tax, estate, disclosure, other.<br>• **Passive realtime messaging (W3 follow-on):** an advisor-scoped `subscribeAllMessages(onInsert)` channel (RLS already scopes rows to the advisor's book) wired at the dashboard level, so the roster unread dot + a subtle toast appear live on a new client message — no modal required. Reuses the existing realtime infra; complements (does not replace) `getUnreadMessageClients()` for the initial paint. |
| **Data / infra** | **Migration 020**: `documents` table + Storage bucket + RLS policies + audit. (Messaging needs no new migration — 019 already publishes `messages` to realtime.) |
| **Surfaces** | `db.jsx` (documents + `subscribeAllMessages`), `advisor-modal.jsx` (Documents tab), `client-portal.jsx` (Documents card), `advisor-dashboard.jsx` (realtime unread subscription). |
| **Tests** | RLS: client downloads only their docs; upload writes audit row. Realtime: a client INSERT flips the roster dot without a refresh. |
| **DoD** | Advisor uploads an IPS, requests acknowledgement on it, client downloads + signs; record is immutable + audited. A new client message lights the roster dot live while the advisor sits on the dashboard. |

#### Sprint W5 — Risk & protection capture (the rest of the "whole picture") ✅ SHIPPED (main; no migration)
> Delivered: `profile.insurance[]` (life/disability/LTC — carrier/owner/coverage/premium) + `profile.estate{}` (will/trust/POA/healthcare-directive/beneficiaries — status + last-reviewed), all jsonb (no migration; `mergeProfile` backfills). `lifeCoverageGap()` in calc-core (income×10 + debts − liquid, vs. existing life coverage; 5 tests) → derived `lifeCoverageGap`/`lifeCoverage`/`estateProgress` in store. Numbers panel gains a **Protection** editor + **Estate readiness** checklist, and the previously-dead **retirement-detail fields** (`employerMatchPct`, 401k/IRA contributed+limit) are now editable. Client portal **Protection & estate card** (journey-aware — "Well protected" / "Room to strengthen", never alarming red); advisor modal overview **Protection & estate summary** (unsoftened, shows the coverage gap). Also fixed the advisor-side inline readiness/age to read `dateOfBirth` (W4 DOB model) via `advMemberAge`.

A real financial plan includes protection + estate readiness. Capture (not advise) to complete the picture and feed Phases 1 & 6.

| | |
|---|---|
| **Build** | • **Insurance**: life / disability / LTC — carrier, coverage amount, premium, owner.<br>• **Estate checklist**: will, revocable trust, POA, healthcare directive, beneficiary review — status + last-reviewed date.<br>• A **"Protection & estate" view** (client + advisor) summarizing coverage gaps vs. simple guidelines (e.g. life coverage vs. income multiple) — capture + light coaching, no underwriting.<br>• Wire **retirement contribution detail** (`employerMatchPct`, deferrals, limits — already in the model, currently un-editable) into the Numbers panel and the Phase 1/4 task coaching. |
| **Data** | `profile.insurance[]`, `profile.estate{}` (jsonb, no migration). |
| **Surfaces** | `store.jsx`, `numbers-panel.jsx`, `client-portal.jsx`, `advisor-modal.jsx`, Phase-1/4 calculators. |
| **Tests** | coverage-gap helpers in `calc.test.mjs`. |
| **DoD** | No dead fields remain; coverage + estate status show on both roles; Phase 1 "Protection" framing is backed by real data. |

#### Sprint W6 — Coherence, parity & hardening ✅ SHIPPED (main; no migration)
> Delivered: `assetComposition()` in calc-core (5 tests) — the AUM-vs-typed *warning* is retired for a correct *composition* ("managed + held-away = total", with the one genuine error case — managed materially exceeding the reported total — kept as a stale-data flag). Surfaced on the client portal (composition strip) and advisor modal overview, replacing the old reconciliation note. Demo parity: the flagship demo household's taxable balance was tuned so its total invested exceeds managed AUM, showing a real held-away split in the demo (insurance/estate already seeded in W5; messages/documents seeded in W3/W4). a11y: aria-labels on the icon-only document/composition controls. CI hardening: the RLS isolation test now covers `messages` (019) + `documents` (020) cross-tenant boundaries (guarded so it skips if those migrations aren't applied to the test DB). check.mjs → 34 assertions; calc → 77 tests.

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

## Tone & inclusivity principle (added 2026-06-06)
Client-facing verdicts must **inform without discouraging**. Someone young or early in their journey should never be told they're "at risk" or that a goal is "past due" in alarming red — that's both demoralizing and inaccurate when decades of compounding lie ahead. Concretely:
- The retirement-readiness card reframes a low funded ratio as **"Building · time on your side"** for early-journey households (age < 40 or > 25 years to retirement), with copy that names time + steady saving as the advantage. Honest numbers (e.g. "13% funded") still show.
- Goal states stay constructive on the client side — no red; "past due" reads as "needs attention" paired with an actionable next step.
- **The advisor's own view keeps the unsoftened verdict** — advisors get the truth; clients get the truth with encouragement.
Apply this lens to every future client-facing surface.

## What stays deferred (discipline preserved)
- Holdings-level aggregation / per-security attribution (Plaid Investments) — **partner-gated**.
- Custodian/Schwab/Fidelity feeds — **partner-gated**.
- Object-lock WORM (true 17a-4) — **infra, human-gated**.
- External calendar sync (Google/Outlook/Calendly) — nice-to-have, not wedge-critical.

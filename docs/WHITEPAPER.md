# Prism Advisor Workspace
### A factsheet & positioning paper for marketing development

*Document purpose: a single, accurate source for website copy, sales decks, one-pagers, and outreach. Everything below reflects what is actually built and live. Items still in development are marked **(roadmap)** so marketing never overstates.*

---

## 1. One-liner & elevator pitch

**One-liner:** Prism is the lifecycle-planning workspace where RIAs build coordinated client plans, run their book, and keep a compliance-grade record - in one place.

**Elevator pitch:** Most advisory firms stitch together a planning tool, a CRM, a portfolio reporter, a billing system, and a pile of spreadsheets. Prism unifies the relationship: a guided seven-phase financial roadmap clients actually engage with, an advisor command center for the whole book, and a firm-admin layer for revenue and compliance - built on a multi-tenant, row-level-secured foundation with an append-only audit trail from day one.

---

## 2. Who it's for

- **Primary:** independent and small/mid-size **RIAs** (1–50 advisors) who want planning + CRM + reporting + billing without integrating five vendors.
- **Buyer personas:** the **solo advisor** (wants to look institutional without the overhead), the **growing practice** (needs workflow + scale), and the **firm administrator / CCO** (needs oversight, billing, and an audit trail).
- **The client** is a first-class user too - Prism is one of the few advisor tools where the *client-facing* experience is a feature, not an afterthought.

---

## 3. The core idea - "Wealth Horizons"

Prism organizes every household's financial life into a **seven-phase lifecycle roadmap**, advanced collaboratively with the advisor:

1. **Foundation** - stabilize cash flow and the household ledger
2. **Liquidity Reserve** - build the protective cash cushion
3. **Liability Optimization** - retire high-cost debt (avalanche)
4. **Tax-Advantaged Foundations** - maximize the HSA and sheltered space
5. **Retirement Sleeve Construction** - asset location across accounts
6. **Capital Deployment** - taxable investing, tax-loss harvesting, Monte Carlo
7. **Legacy & Drawdown** - Roth-conversion ladders and estate structuring

Each phase carries **milestones** and **interactive tools**, so the plan is a living thing the client returns to - not a PDF that dies in an inbox.

---

## 4. What it does (capabilities)

### Planning & analysis
**25 advisor-grade interactive tools** embedded across the seven phases - each household's roadmap carries 3–6. The set spans cash-flow, freedom-date and net-worth trajectory, liquidity reserve and income runway, debt avalanche / debt-vs-invest / mortgage-payoff, HSA, tax-bracket headroom, HDHP-vs-PPO, **tax-return (1040) insights**, **asset location**, contribution-priority and mega-backdoor capacity, **Monte Carlo retirement projection**, **tax-loss harvesting**, equity-comp concentration, **Roth-conversion ladder & window**, withdrawal sequencing, RMD projection, Social-Security claiming-age optimization, and **estate & generational** modeling. Every analytic surface ends in a trackable next step ("Add to agenda" / "Task"), not a read-out.

### AI relationship assistant
A guardrailed **Gemini-backed assistant** (key held server-side, every call audited): AI message-draft in the advisor's compose box, household summary + review talking points in the client quick-view, and a "who needs attention?" book-triage on the dashboard. Output is always a draft the advisor owns.

### Client experience
A branded client portal: the live roadmap, real-time portfolio summary, two-way **secure messaging** and "discuss with your advisor" threads on any milestone, a **document vault** (advisor-requested uploads + shared files), a request-a-meeting flow, and self-serve **performance and milestone reports**.

### Advisor command center
Client roster (searchable, sortable, paginated, CSV export), an **intelligent alert engine** (cash drag, stale relationships), a **flagged-question inbox** with two-way reply threads, and a per-client workspace spanning accounts, meeting log, tasks, interaction timeline, and performance.

### CRM & workflow
Tasks with priorities, due dates, and **cross-advisor assignment**; one-click **review cadences**; a **client pipeline board** (lead → onboarding → active → review-due); **prospect / proposal mode** (model an unsaved household, print a proposal packet, one-click convert to a client); **calendar sync** (Google + Microsoft OAuth, tokens server-side, a week-ahead agenda on the dashboard, scheduled meetings auto-pushed to the connected calendar); **bulk CSV client import**; and a unified interaction timeline.

### Account aggregation
**Plaid** account linking and a daily **balance-history** time-series that powers performance and billing. *(Custodian file/API feeds - Schwab/Fidelity/Yodlee/Flinks - and holdings-level data are **roadmap**.)*

### Performance reporting
**Time-weighted return** (Modified Dietz) across standard periods, **benchmark-relative** comparison, account-mix breakdown, a portfolio-value chart, and a branded **client-facing PDF**.

### Billing - two engines
- **SaaS subscriptions** for the firm (Stripe Checkout + webhooks).
- **Advisory-fee billing** for clients: tiered/flat **fee schedules**, **frequency-aware automated invoicing** (monthly/quarterly/annual) driven by a scheduled job, an approval workflow, branded **invoice PDFs**, and a firm **revenue dashboard** (projected ARR + realized fees).

### Compliance & trust
An **append-only audit trail** of every material action, **records-retained-not-erased** soft deletes, **immutable profile versioning**, a **nightly archive** of the audit trail to private storage, per-client **and firm-wide exam-ready compliance export** (books-&-records packet over a chosen audit window), real **DocuSign e-signature** on acknowledgements, and optional **two-factor authentication** - all designed around SEC Rule 17a-3 / 17a-4 principles.

### Onboarding & growth
A **demo-first landing page** (prospects explore a fully populated workspace with no signup), **true self-serve signup** that provisions a firm and its first admin automatically, **client invite / claim**, **white-label branding** (firm accent color + logo + optional "powered by Prism", applied across the advisor app and client portal), and sign-in via Google, password, or magic link.

---

## 5. Why it's different

- **The client side is real.** Engagement lives where the relationship lives - clients use the roadmap, ask questions in-context, and pull their own reports.
- **Compliance is the foundation, not a bolt-on.** Row-level security, an append-only audit trail, and retention were there from the first migration - not retrofitted.
- **One workspace, not five integrations.** Planning, CRM, aggregation, performance, and billing share one data model and one login.
- **Institutional feel for any size firm.** A solo advisor presents like a large RIA - including full **white-label branding** of both the advisor app and the client portal.
- **Lean, fast, and private.** A minified single-bundle app on a global edge CDN, with an enforced Content-Security-Policy, self-hosted libraries, and no third-party trackers.

---

## 6. Security & compliance posture (for the "trust" page)

- **Multi-tenant isolation** via Postgres row-level security - every advisor sees only their book; firm admins see only their firm.
- **Authentication:** email/password, magic link, Google OAuth, and **TOTP multi-factor** with assurance-level enforcement.
- **Audit trail:** append-only, immutable, with a firm-admin viewer and a nightly off-table archive.
- **Records retention:** soft-deletes (records archived, never erased) aligned to 17a-4; immutable profile version history.
- **Transport & app hardening:** HTTPS-only with HSTS, an enforced CSP, sanitized rendering, and a CI gate on every change.

*Honest framing for legal review:* Prism provides the **tooling** designed around SEC 17a-3/17a-4 record-making and retention principles; full regulatory compliance is a function of the firm's configuration, a WORM/object-lock storage tier, and the firm's own supervisory procedures.

---

## 7. Packaging & pricing (as presented today)

| Plan | Who | Price (indicative) |
|---|---|---|
| **Solo** | Independent advisor getting started | Free in preview · up to 25 households |
| **Growth** | Growing practices with a full book | **$49 / advisor / mo** · up to 150 households · aggregation, performance, calendar sync, AI assist, white-label branding, priority support |
| **Enterprise** | Multi-advisor firms with compliance teams | **From $99 / advisor / mo** · annual, 5-seat min · unlimited households, firm-admin, billing automation, exam-ready export · WORM object-lock & SSO *(roadmap)* |

*Pricing is indicative during preview; the public funnel currently captures interest and provisions free workspaces.*

---

## 8. Proof points / facts marketing can cite

- Seven-phase planning framework with **25 embedded interactive tools**.
- **Multi-tenant** architecture with row-level security across every table.
- **Append-only audit trail** + nightly compliance archive + exam-ready books-&-records export.
- **Time-weighted (Modified Dietz)** performance with benchmark comparison.
- **Automated advisory-fee billing** with frequency-aware invoicing.
- **White-label branding** across the advisor app and client portal.
- **Calendar sync** (Google + Microsoft) and a guardrailed **AI relationship assistant**.
- **Self-serve onboarding** + a no-signup live demo.
- Runs on a **global edge CDN** with an **enforced Content-Security-Policy**.

---

## 9. Suggested messaging pillars

1. **"Your clients' wealth, refracted into seven horizons."** - the planning narrative.
2. **"Compliance-grade from the first click."** - trust & audit narrative.
3. **"One workspace. Not five subscriptions."** - consolidation/value narrative.
4. **"See it before you sign up."** - the demo-led funnel.

---

## 10. Honest "not yet" list (keep out of public claims until shipped)

Custodian data feeds (Schwab/Fidelity/Yodlee/Flinks), holdings-level / per-security performance attribution, live market-data benchmarks, Calendly integration (Google + Microsoft calendar sync *is* live), a Zapier / public API, a client PWA with push, SSO/SAML, and object-lock WORM storage are **on the roadmap** and should be described as "coming" rather than available.

---

*Prepared as an internal marketing source. Keep claims aligned to the "what it does" and "facts" sections; route anything in §10 through product before publishing.*

# Prism — Product & Go-to-Market Roadmap

> **Canonical, forward-looking roadmap.** Baseline reset 2026-06-08.
> Shipped history lives in [`sprint-log.md`](sprint-log.md); the live working board
> (what's actively queued) is [`TODO.md`](TODO.md). This file is the *direction* — the
> vision, the open tracks, and how they're sequenced. It carries no checked-off history.

---

## North star

**Onboard a first paying design-partner RIA**, then the next few.

Prism is the **client-facing planning & relationship layer** — a living seven-horizon
roadmap each client logs into, plus two-way collaboration that keeps the relationship
alive between quarterly meetings. That is the one thing only Prism does well, and it
leads in every surface (marketing, demo, sales) within the first ten seconds.

The product is mature and the security posture is strong. Revenue is now gated by
**trust, distribution, and infrastructure — not by features.** Building is not gated:
we add genuinely valuable work with intent, every item tied to customer value or the
wedge.

---

## Positioning — the wedge

Prism touches five mature categories (planning, CRM, aggregation, performance,
billing). It cannot out-build the incumbents in all five and **does not try to.**

- **Lead with the wedge, everywhere.** The roadmap + a live collaboration thread is
  the lead and the differentiator.
- **Aggregation / performance are "good enough + integrates," not "beats Orion."**
  Prism sits *alongside* a firm's custodian/performance stack, removing a losing
  comparison instead of inviting it.
- **Deepen on demand only.** Holdings-level aggregation and per-security attribution
  get built **when a design partner asks**, never speculatively.
- **ICP: solo & small fee-only RIAs** (XYPN/NAPFA-style, ~50–150 households). They
  feel tool-sprawl most, can't afford enterprise suites, and value the
  client-experience angle.

## Distribution — the motion

- **Design partners → primary, now.** Personally recruit **3–5 RIAs** — warm network
  first, then XYPN / NAPFA / Kitces / advisor LinkedIn / r/CFP. Free white-glove
  onboarding in exchange for feedback + a named testimonial + logo. One real advisor
  outweighs a hundred drip pages. *(Playbook: [`design-partner-kit.md`](design-partner-kit.md),
  [`first-outreach-plan.md`](first-outreach-plan.md).)*
- **Founder-led POV content** (LinkedIn + a short newsletter) — the one active channel;
  also a trust signal. *(Drafts: [`founder-content-starter.md`](founder-content-starter.md).)*
- **SEO → secondary.** Keep the automated drip pages + GSC digest running (near-zero
  marginal cost); it is not the growth engine.

## Pricing — the model

Flat per-advisor, tiered by a household cap. No metering, no overage billing.

| Tier | Price | Household cap |
|---|---|---|
| Solo | $0 (preview) | Up to 25 |
| Growth | $49 / advisor / mo | Up to 150 |
| Enterprise | From $99 / advisor / mo (annual, 5-seat min) | Unlimited |

Keep "free preview, pricing indicative" until design partners reveal
willingness-to-pay. Anchor on *value replaced* ("one tool instead of five"). Offer
annual billing for cashflow.

---

## Where we are (the foundation)

A mature, coherent product on a hardened foundation:
- The full seven-horizon planning experience (advisor command center + firm admin +
  client portal), built on multi-tenant RLS with an append-only audit trail.
- The wedge built to coherence: retirement-readiness + goals, two-way realtime
  messaging, a document vault, protection/estate capture, and a reconciling asset
  model.
- Adoption unlocks shipped: bulk CSV import, prospect/proposal mode, client
  invite/claim, real DocuSign e-sign.
- Hardened: CSP with no `unsafe-inline` (script + style), slim `/portal` bundle, RLS
  isolation + e2e as required CI checks, retention/rollup on growth tables, and every
  CRITICAL + MAJOR finding from two clean-room reviews resolved.

Detail of everything shipped is in [`sprint-log.md`](sprint-log.md) and git history.
We are **pre-first-paying-advisor**: gated on infrastructure and distribution, not
features.

---

## Forward tracks

Sequenced to the north star: pre-live hardening/activation first (see
[`TODO.md`](TODO.md) deploy block + human queue), then the adoption unlocks that turn
a demo into a "yes," then depth and reach.

### Tier A — Adoption unlocks (what makes an RIA move)
- **White-label branding — SHIPPED 2026-06-09** (migration 032 + brand engine).
  Firm accent color + logo + optional "powered by Prism" attribution, set in a
  firm-admin Branding section; applied at boot via cached → subdomain-slug
  (`px_brand_for_slug`, anon) → authoritative firm-row resolution, painted as inline
  CSS vars (`--brand` et al.) over both bundles. *Open refinement: the static
  login/landing pages stay Prism-branded pre-auth (theming lives in the app/portal
  bundles); brand the login page when a partner asks.*
- **Calendar integration** (Google / Outlook two-way sync, free/busy) — removes a
  rip-and-replace objection. *Needs OAuth apps (human queue).*
- **Zapier / public API** — connect Prism to the rest of a firm's stack.

### Tier B — Wedge deepeners (retire a paid tool)
- **Deeper planning intelligence — the priority track.** The advisor wants planning
  *depth* to keep growing. Shipped 2026-06-08: (1) the Asset Location optimizer's
  **bespoke** placement of real dollars (fit to risk allocation, sheltering
  tax-inefficient assets first, counting Roth); (2) **Contribution Priority** — the
  savings waterfall (match → HSA → IRA/Roth → 401(k) max → taxable, capped by room,
  flags missed match); (3) **Withdrawal Sequencing** — tax-efficient decumulation draw
  order with longevity + after-tax-at-horizon; (4) **Roth Conversion Window** — sizing
  conversions to bracket headroom in the pre-RMD low-income years (dated
  `FED_BRACKETS_2025`). All from data already on file. *Next when wanted:* RMD modeling
  at 73, IRMAA/ACA-cliff awareness in the conversion sizer, and a bracket-aware
  (vs. flat-rate) lifetime-tax comparison to make the sequencing dollar-value claim
  robust enough to surface.
- **Front-phase tool parity — client-utility track (2026-06-09 review).** Phases 5–7
  carry 2–4 interactive tools each; phases 1–4 had one apiece, yet those are the
  earliest-journey households who most need engagement. Shipped 2026-06-09: (1)
  **Income-Protection / Coverage-Gap** in Phase 02 — `lifeCoverageGap` promoted from a
  passive card to an interactive tool with a rough term-premium estimate
  (`termLifePremium`); (2) **Tax-Bracket Headroom** in Phase 04 — a shared
  `bracketPosition` engine (reuses `FED_BRACKETS_2025`) showing marginal/effective rate
  and the headroom that frames the Roth-conversion + contribution-order decisions.
  Also shipped 2026-06-09 (round 2): (3) **Phase 01 "Freedom Date"** — years-to-
  independence vs. the FIRE number with a "+1% saved → months sooner" lever
  (`yearsToIndependence`); (4) **Phase 03 Debt-vs-Invest crossover** — per-debt
  pay-down-vs-invest verdict, guaranteed APR vs. expected after-tax return
  (`debtVsInvest`). **Shipped 2026-06-09 (round 3 — the full ranked backlog + its data plays):**
  - **Phase 03 — mortgage-payoff accelerator** (`mortgagePayoff`) — extra principal →
    time + interest saved; the remaining half of the Phase 03 debt pair.
  - **Phase 04 — HDHP-vs-PPO break-even** (`hdhpVsPpo`) and **Phase 05 — Mega-Backdoor
    Roth capacity** (`megaBackdoorCapacity`) — close the flagged-question → self-serve-tool
    loop, answering q03 and q02 directly.
  - **Phase 07 — RMD projector** (`rmdProjection`, IRS Uniform Lifetime divisors; makes
    Roth-ladder urgency tangible) and **Social Security claiming-age optimizer**
    (`socialSecurityClaiming`; 62/67/70 PV + break-even age).
  - **Phase 06 — equity-comp planner** (`equityCompConcentration`) — single-stock
    concentration, embedded gain, and the cap-gains tax to trim or fully diversify.
  - **Cross-cutting data plays — shipped:** Social Security PIA capture (`pia` on SS
    income streams), equity-comp fields (`equityComp[]`), and a Plaid balance-freshness
    ("as of") indicator on the advisor accounts table. *Still open:* tax-return/W-2
    import to replace the hand-entered marginal rate (folds into Holistiplan-lite below).
  *Phases 1–4 now carry 2–3 interactive tools each, at parity with 5–7.*
  **Round 4 (2026-06-09) — symmetry finished & tools wired through:** (1) **Phase 01
  net-worth trajectory** (`netWorthTrajectory`) — where today's savings pace leads,
  year by year, with the "+1% saved" lever and an honest no-compounding-while-negative
  rule; (2) **Phase 02 income runway** (`incomeRunway`) — if income paused, how long
  the reserve carries essentials, with a disability benefit + elimination period
  (mirrors the P03 debt pair); (3) phase-checklist task hooks for the mortgage-payoff
  accelerator (P03) and equity-comp planner (P06); (4) the **SS claiming optimizer now
  feeds the plan** — one click writes the chosen claim age back into the Social
  Security income stream (`startAge` + rescaled `monthlyAmount` from PIA), so
  retirement readiness reflects the call; (5) **QBR + IPS print renderers** carry the
  concentrated-equity position and the projected first RMD as plan flags. P01–P03 now
  hold 3 tools each, P02 2+runway — full front/back symmetry.
- **Tax-return insight (Holistiplan-lite)** — drop a 1040 → planning observations in
  the roadmap + portal. High willingness-to-pay; differentiating inside a client
  portal. Pairs naturally with the planning-depth track above.
- **AI relationship assistant (Gemini) — SHIPPED 2026-06-09** (`ai-assist` edge fn,
  advisor-JWT-gated, key server-side only, every call audited). Four surfaces: AI
  draft in the advisor's message compose, household summary + review talking points
  in the client quick-view, and "who needs attention?" book triage on the dashboard.
  Guardrailed prompts (fiduciary back-office tone; no security recommendations or
  return promises; output is a draft the advisor owns). *Next when wanted:* draft
  replies on flagged questions, a QBR-narrative generator for the print packet, and
  cost/latency telemetry once a design partner uses it in anger.

### Tier C — Reach & retention
- **Client PWA + push** — installable client portal + push on new
  message/task/document. *Needs a VAPID keypair (human queue).*
- **Exam-ready compliance export** — one-click books-&-records packet (audit log +
  acknowledgements + WORM) for SEC/state exams.

### Trust & control
- **Advisor MFA (TOTP)** — enforce in the advisor auth path (Supabase Auth supports
  it). *May need a Supabase Auth toggle.*
- **Advisor-approval commit gate for client ledger edits** — today a client's
  Numbers-drawer edits auto-save straight into the shared profile (a lightweight
  undo + revert-all is the current safety net). Add an opt-in **draft → review →
  approve** flow: client edits stage as a pending changeset; the advisor approves
  per-field or wholesale before they mutate the plan. Schema-touching (lean on
  `007_versioning_crm`); ship behind a per-firm toggle, **default OFF** to preserve
  frictionless co-editing.

### Observability & scale
- **Product analytics** — first-party activation events (login, invite, message,
  plan-update, report) into a small events table; answers "is the design partner
  actually using it."
- **RLS-predicate index coverage audit** — confirm `advisor_id`/`firm_id`/`client_id`
  (esp. the firm-admin cross-firm read) are indexed so RLS doesn't force seq scans as
  tables grow.
- **Uptime monitor** on `health` + the app (human queue).

### Depth on demand (partner-gated — build only when a partner asks)
- **Holdings-level aggregation** (Plaid Investments) → real performance attribution.
- **Object-lock WORM archive** (S3 Object Lock) → makes the 17a-4 claim literally true.
- **Module refactor** — split `advisor-modal.jsx` (~2,100 lines) and `store.jsx`
  (~1,300, esp. the print-report renderers) into load-ordered modules.

### Code-quality backlog (open by design, low priority)
*The 2026-06-09 architecture-inefficiency pass (sign-in phase-fetch serialization,
`generate-invoices` N+1, un-themed pre-auth pages, brand cache trust) shipped in full
2026-06-09 round 5 — see `sprint-log.md`. Pre-auth branding = `src/brand-boot.js`
(standalone, login/signup/landing); the cache + anon-RPC brand inputs are now
whitelist-sanitized in both the bundles and the boot script.*

From the 2026-06-08 clean-room review — cleanup passes, none blocking:
- CSV export formula-injection neutralization (prefix `= + - @` cells).
- `store.jsx update()` — shallow path-copy instead of whole-profile deep clone per
  keystroke.
- Skip the redundant post-load autosave (the `[profile]`-keyed effect re-fires after
  an async load).
- Cap `NotificationProvider.seenIds` (unbounded dedupe set leaks over long sessions).
- Surface `estateProjection`'s hard-coded 2025 federal estate exemption as a dated
  assumption (or pull from a constants table).
- Swap the `monteCarlo` LCG for mulberry32 **if** an exact probability is ever
  surfaced (fine as an illustrative band today).
- Add `isUUID` guards on `dbResolveQuestion`/`dbSnoozeAlert` for consistency.
- Resolve soft-vs-hard-delete inconsistency (`cash_flows`/`documents`/`crm_tasks` hard
  delete vs archive elsewhere) for a uniform 17a-4 story — or document the distinction.
- Bulk import: server-side batch RPC for imports over a threshold (today N sequential
  round-trips, non-transactional).
- Lint/build guard asserting the `build-files.mjs` concatenation order (cross-file
  bare-global coupling is load-order-fragile).

### UX backlog (optional, low)
- Roster swipe actions / richer mobile detail (cards already shipped).
- Housing ratio coaching + field hints/tooltips (FinFire donors — confirm they fit
  the advisor voice before porting).
- **Guardrail:** protect the high-value paths in any future refactor — 1-click demo,
  notification/alert deep-linking, inline question replies, single-screen client
  portal, deep-link routing, and ⌘K command palette.

### Monetize & scale GTM
- Live trial → paid flow; finalize pricing from design-partner signal.
- Scale the one channel that converts; keep SEO compounding underneath.

---

## Standing principle

**Build with intent.** Net-new feature work is a normal part of growth, not gated
behind design partners. The discipline is *intentionality*: every feature ties to
customer value or the wedge, and we don't add breadth for its own sake. Trust,
distribution, and infrastructure gate *revenue* — they no longer gate *building*.
Client-facing verdicts must **inform without discouraging** (early-journey households
see "Building · time on your side," never "at risk"); the advisor view stays
unsoftened.

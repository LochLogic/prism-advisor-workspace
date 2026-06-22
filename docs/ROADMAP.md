# Prism | Product & Go-to-Market Roadmap

> **Canonical, forward-looking roadmap.** Baseline reset 2026-06-08.
> Shipped history lives in [`sprint-log.md`](sprint-log.md); the live working board
> (what's actively queued) is [`TODO.md`](TODO.md). This file is the *direction* - the
> vision, the open tracks, and how they're sequenced. It carries no checked-off history.

---

## North star

**Onboard a first paying design-partner RIA**, then the next few.

Prism is the **client-facing planning & relationship layer** - a living seven-horizon
roadmap each client logs into, plus two-way collaboration that keeps the relationship
alive between quarterly meetings. That is the one thing only Prism does well, and it
leads in every surface (marketing, demo, sales) within the first ten seconds.

The product is mature and the security posture is strong. Revenue is now gated by
**trust, distribution, and infrastructure - not by features.** Building is not gated:
we add genuinely valuable work with intent, every item tied to customer value or the
wedge.

---

## Positioning - the wedge

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

## Distribution - the motion

- **Design partners → primary, now.** Personally recruit **3–5 RIAs** - warm network
  first, then XYPN / NAPFA / Kitces / advisor LinkedIn / r/CFP. Free white-glove
  onboarding in exchange for feedback + a named testimonial + logo. One real advisor
  outweighs a hundred drip pages. *(Playbook: [`design-partner-kit.md`](design-partner-kit.md),
  [`first-outreach-plan.md`](first-outreach-plan.md).)*
- **Founder-led POV content** (LinkedIn + a short newsletter) - the one active channel;
  also a trust signal. *(Drafts: [`founder-content-starter.md`](founder-content-starter.md).)*
- **SEO → secondary.** Keep the automated drip pages + GSC digest running (near-zero
  marginal cost); it is not the growth engine.

## Pricing - the model

Flat per-advisor, tiered by a household cap. No metering, no overage billing.

| Tier | Price | Household cap |
|---|---|---|
| Solo | $0 (preview) | Up to 25 |
| Growth | $49 / advisor / mo | Up to 150 |
| Enterprise | From $99 / advisor / mo (annual, 5-seat min) | Unlimited |

Keep "free preview, pricing indicative" until design partners reveal
willingness-to-pay. Anchor on *value replaced* ("one tool instead of five"). Offer
annual billing for cashflow.

### Pricing sanity check (2026-06-10)

**Cost model.** Fixed infra ≈ **$30–40/mo total** once Supabase Pro lands ($25
Supabase + ~$5 Cloudflare + domain); marginal cost per additional firm is **< $2/mo**
(storage/egress are trivial at 50–150 households; Gemini is pay-per-use pennies;
web-push is free; Stripe takes 2.9% + 30¢ of revenue; Plaid/DocuSign are usage-priced
and only when live). Gross margin at Growth pricing is **>95%** - the model is not
cost-constrained at any plausible scale.

**Is three tiers right?** Yes - free anchor → core → enterprise is the standard,
legible shape, and the structure needs no change. Three watch-items on the *numbers*:
1. **Growth $49 is likely underpriced** against the "value replaced" anchor
   (Holistiplan ~$82/advisor/mo, RightCapital ~$140, eMoney $300+, Wealthbox $59+).
   If Prism retires even one of those, $79 reads as a bargain. Plan: keep $49 as a
   *founding-partner rate* for design partners, test $79 as the list price when
   charging starts.
2. **Solo free at ≤25 households can be a forever home** - a brand-new XYPN solo can
   sit under 25 households for a year+. Fine *now* (the free preview is the pipeline),
   but when billing turns on, tighten free to ~10 households or a 90-day trial.
3. **Enterprise's 5-seat × $99 floor (~$495/mo)** is deliberately above the solo/small
   ICP - keep it as the anchor tier, don't market it.
Also clarify in copy: the household cap is **per firm**, not per advisor (per-advisor
pricing + a per-advisor cap would double-meter).

**Decision:** structure unchanged; price points revisit on design-partner
willingness-to-pay signal (already the plan). No code change - Stripe prices are set
at go-live.

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

### Tier A - Adoption unlocks (what makes an RIA move)
- **White-label branding - SHIPPED 2026-06-09** (migration 032 + brand engine).
  Firm accent color + logo + optional "powered by Prism" attribution, set in a
  firm-admin Branding section; applied at boot via cached → subdomain-slug
  (`px_brand_for_slug`, anon) → authoritative firm-row resolution, painted as inline
  CSS vars (`--brand` et al.) over both bundles. *Open refinement: the static
  login/landing pages stay Prism-branded pre-auth (theming lives in the app/portal
  bundles); brand the login page when a partner asks.*
- **Calendar integration - SHIPPED 2026-06-09 (round 10).** Google + Microsoft OAuth
  connect (tokens server-side only in RLS-sealed `calendar_connections`), week-ahead
  agenda card on the advisor dashboard, scheduled meetings auto-pushed to the
  connected calendar(s); `freebusy` action available server-side. Migration 033
  applied + both providers' creds synced 2026-06-10 - only the Azure redirect-URI
  registration remains (human queue). *Open refinements: a
  free/busy picker inside the meeting scheduler; inbound sync of externally
  created events into Prism meetings.*
- **Zapier / public API** - connect Prism to the rest of a firm's stack.

### Tier B - Wedge deepeners (retire a paid tool)
- **Deeper planning intelligence - the priority track.** The advisor wants planning
  *depth* to keep growing. Shipped 2026-06-08: (1) the Asset Location optimizer's
  **bespoke** placement of real dollars (fit to risk allocation, sheltering
  tax-inefficient assets first, counting Roth); (2) **Contribution Priority** - the
  savings waterfall (match → HSA → IRA/Roth → 401(k) max → taxable, capped by room,
  flags missed match); (3) **Withdrawal Sequencing** - tax-efficient decumulation draw
  order with longevity + after-tax-at-horizon; (4) **Roth Conversion Window** - sizing
  conversions to bracket headroom in the pre-RMD low-income years (dated
  `FED_BRACKETS_2025`). All from data already on file. *Next when wanted:* RMD modeling
  at 73, IRMAA/ACA-cliff awareness in the conversion sizer, and a bracket-aware
  (vs. flat-rate) lifetime-tax comparison to make the sequencing dollar-value claim
  robust enough to surface.
- **Front-phase tool parity - client-utility track (2026-06-09 review).** Phases 5–7
  carry 2–4 interactive tools each; phases 1–4 had one apiece, yet those are the
  earliest-journey households who most need engagement. Shipped 2026-06-09: (1)
  **Income-Protection / Coverage-Gap** in Phase 02 - `lifeCoverageGap` promoted from a
  passive card to an interactive tool with a rough term-premium estimate
  (`termLifePremium`); (2) **Tax-Bracket Headroom** in Phase 04 - a shared
  `bracketPosition` engine (reuses `FED_BRACKETS_2025`) showing marginal/effective rate
  and the headroom that frames the Roth-conversion + contribution-order decisions.
  Also shipped 2026-06-09 (round 2): (3) **Phase 01 "Freedom Date"** - years-to-
  independence vs. the FIRE number with a "+1% saved → months sooner" lever
  (`yearsToIndependence`); (4) **Phase 03 Debt-vs-Invest crossover** - per-debt
  pay-down-vs-invest verdict, guaranteed APR vs. expected after-tax return
  (`debtVsInvest`). **Shipped 2026-06-09 (round 3 - the full ranked backlog + its data plays):**
  - **Phase 03 - mortgage-payoff accelerator** (`mortgagePayoff`) - extra principal →
    time + interest saved; the remaining half of the Phase 03 debt pair.
  - **Phase 04 - HDHP-vs-PPO break-even** (`hdhpVsPpo`) and **Phase 05 - Mega-Backdoor
    Roth capacity** (`megaBackdoorCapacity`) - close the flagged-question → self-serve-tool
    loop, answering q03 and q02 directly.
  - **Phase 07 - RMD projector** (`rmdProjection`, IRS Uniform Lifetime divisors; makes
    Roth-ladder urgency tangible) and **Social Security claiming-age optimizer**
    (`socialSecurityClaiming`; 62/67/70 PV + break-even age).
  - **Phase 06 - equity-comp planner** (`equityCompConcentration`) - single-stock
    concentration, embedded gain, and the cap-gains tax to trim or fully diversify.
  - **Cross-cutting data plays - shipped:** Social Security PIA capture (`pia` on SS
    income streams), equity-comp fields (`equityComp[]`), and a Plaid balance-freshness
    ("as of") indicator on the advisor accounts table. *Still open:* tax-return/W-2
    import to replace the hand-entered marginal rate (folds into Holistiplan-lite below).
  *Phases 1–4 now carry 2–3 interactive tools each, at parity with 5–7.*
  **Round 4 (2026-06-09) - symmetry finished & tools wired through:** (1) **Phase 01
  net-worth trajectory** (`netWorthTrajectory`) - where today's savings pace leads,
  year by year, with the "+1% saved" lever and an honest no-compounding-while-negative
  rule; (2) **Phase 02 income runway** (`incomeRunway`) - if income paused, how long
  the reserve carries essentials, with a disability benefit + elimination period
  (mirrors the P03 debt pair); (3) phase-checklist task hooks for the mortgage-payoff
  accelerator (P03) and equity-comp planner (P06); (4) the **SS claiming optimizer now
  feeds the plan** - one click writes the chosen claim age back into the Social
  Security income stream (`startAge` + rescaled `monthlyAmount` from PIA), so
  retirement readiness reflects the call; (5) **QBR + IPS print renderers** carry the
  concentrated-equity position and the projected first RMD as plan flags. P01–P03 now
  hold 3 tools each, P02 2+runway - full front/back symmetry.
- **Tax-return insight (Holistiplan-lite) - SHIPPED 2026-06-09 (round 7).** Key
  1040 lines captured in the Numbers drawer (AGI is the only required line) →
  `tax1040Insights` (calc-core, unit-tested) → a Phase-04 **Tax-return insights**
  tool rendering deterministic, line-explainable observations: bracket position +
  headroom, withholding vs. total tax, standard-vs-itemized bunching, 0% LTCG
  harvesting room, interest/dividend tax drag, IRMAA proximity, QCD eligibility,
  SS provisional income. No OCR/upload - keyed lines keep every observation
  auditable in a client meeting. Advisor-facing flags (quick-view + QBR) shipped
  2026-06-10 round 11. *Next when wanted:* a PDF-upload parse, state tax, and
  per-member returns (the 1040 is per *return* - one joint return for MFJ - so a
  household-member dropdown only becomes meaningful for married-filing-separately;
  if wanted, `taxes.t1040` becomes `t1040s[]` keyed by member, like `w2s[]`).
- **AI relationship assistant (Gemini) - SHIPPED 2026-06-09** (`ai-assist` edge fn,
  advisor-JWT-gated, key server-side only, every call audited). Four surfaces: AI
  draft in the advisor's message compose, household summary + review talking points
  in the client quick-view, and "who needs attention?" book triage on the dashboard.
  Guardrailed prompts (fiduciary back-office tone; no security recommendations or
  return promises; output is a draft the advisor owns). *Next when wanted:* draft
  replies on flagged questions, a QBR-narrative generator for the print packet, and
  cost/latency telemetry once a design partner uses it in anger.

### Advisor-workflow review (2026-06-09) - the "so what" gap - ALL FIVE RESOLVED
A seat-of-the-advisor walkthrough (prospect → onboard → plan → meet → bill → comply)
found the product strong on *diagnosis* and thin on *follow-through*. Five findings:
(1) **insight → action hooks - SHIPPED 2026-06-10 (round 11):** advisor-only
`InsightAction` ("Add to agenda") on the coverage-gap, debt-vs-invest, and
Roth-window verdicts plus a per-observation "Task" hook on every non-info 1040
observation - one click creates a client-linked CRM task; (2) **document-request
flow - SHIPPED round 8**; (3) **advisor-facing 1040 flags - SHIPPED 2026-06-10
(round 11):** a "1040 flags" strip in the client quick-view (marginal/effective/
headroom + top non-info observations) and the same observations carried into the
QBR's Plan flags; (4) **prospect proposal packet - SHIPPED round 8**;
(5) **portal fee transparency - was already live** (client invoice card with
download shipped 2026-05-29; the finding was stale). The standing theme: every
analytic surface should end in a trackable next step, not a read-out.

### Industry-advisor feedback (2026-06-11, rounds 22-23) - the practitioner meeting tracks
A working session with an industry advisor produced five UI fixes (shipped round 22:
milestone-to-tool links in P03/P06, P06 tool reorder, promoted Numbers-panel section
headers, the leading-zero input fix app-wide, RMD spelled out at remaining first
mentions) plus seven design items. **All seven were green-lit and built in round 23**
(PR #74) - per-item status below; the only open ends are the human-queue setup steps
(migration 044, IDENTIFIER_ENC_KEY, the gated edge deploy) and the Quik! business blanks:

1. **Retirement as a goal vs. a first-class concept - SHIPPED round 23**
   (`calc-core.resolveGoal`: a retirement-type goal's "Saved so far" reads live
   IRA + 401(k) + Roth balances everywhere; read-only linked field + auto
   contribution prefill in the drawer). Original thinking: The
   goal-type dropdown offers "Retirement", but retirement is already first-class
   (target retirement age, the retirement-readiness card, the whole Retirement-assets
   section) - so a hand-made retirement goal double-tracks the plan and its "Saved so
   far" ignores the very accounts that exist for it. **Recommendation:** keep the type
   but make it smart - when a goal's type is Retirement, auto-link "Saved so far" to
   the household's retirement balances (IRA + 401(k) + Roth; read-only, kept in sync)
   exactly like the round-20 cash-reserve account linking, and pre-fill the monthly
   contribution from the contributions section. Alternative considered: drop the
   option and point to the readiness card; rejected because clients think in one
   goal list. Small build once the call is confirmed with a design partner.
2. **Phase 05 Asset Location tool - add human interaction - SHIPPED round 23**
   (the (a) what-if lever + (b) InsightAction hook below; (c) custom-allocation
   override remains the open refinement). Original thinking: it was a read-out
   (placement table + a static alpha band); the advisor's note "the tool doesn't do
   anything" is fair. **Recommendation, in order:** (a) a what-if lever - move a
   dollar amount between taxable / tax-deferred / tax-free and watch the placement
   and estimated tax drag re-fit live (calc `assetLocationPlan` already takes the
   three balances, so this is mostly UI); (b) the shipped `InsightAction` "Add to
   agenda" hook on the placement verdict, matching the other advanced tools; (c)
   later, a custom-allocation override vs. the risk-band default.
3. **Documentation gates on phase milestones - SHIPPED round 23** (exactly the
   shape below; pilots live on P01 IPS / P03 liability schedule / P07 estate docs;
   next candidates gate on e-sign state rather than vault presence).
   "Clients should not advance to later
   stages without the required paperwork on file." **Shape:** a `requiresDoc:
   '<vault category>'` flag on milestone tasks; the checkbox locks ("Waiting on:
   statement upload") until a vault document of that category exists for the client,
   with an advisor override that writes an audit entry (fiduciary work can't hard-block
   on a PDF). Rides the existing document-request flow and vault categories - likely
   zero schema change since gate state is derivable. First candidates: liability
   schedule (P03), IPS/fiduciary acknowledgement (P01, could key off e-sign state
   instead), trust + beneficiary documents (P07).
4. **Advisor CX roadmap (the firm's playbook) - PHASES 1-2 SHIPPED (1: round 23, 2: sprint 27b)**
   (P1: default `advisorPlaybook` in data.jsx + the advisor-only per-phase card in the
   client quick-view. P2: firm-admin authoring via `firm_playbooks` [migration 045],
   deep-merged over the defaults by `mergePlaybook`, audit-logged; the quick-view card
   renders the firm's authored script with a "Customized" chip. **Phase 3 below remains the
   forward track.**). Firms run a per-phase advisor
   playbook - questions to ask, timelines to set client expectations, documents to
   gather, what comes next - to keep advisors on script and let the firm manage
   quality. This is the advisor-side mirror of the client phases and a true
   wedge-deepener (it sells to the *firm*). **Phasing:** (1) DONE - a default Prism
   playbook as an advisor-only per-phase card in the client quick-view; (2) DONE -
   firm-admin authoring (`firm_playbooks`, per-phase fields, audit-logged) so each firm
   white-labels its own CX; (3) NEXT - roll playbook completion into a firm-admin quality
   view (on-script % per advisor).
5. **SSN capture in the Numbers panel - BUILT round 23** (founder overrode the
   default-no on 2026-06-11: "this will be solidly needed for prefilling account
   docs"). Shipped exactly on the safe path: migration 044 `client_identifiers`
   (service-role-only, no RLS grants), the `client-identifiers` edge fn (AES-256-GCM
   via `IDENTIFIER_ENC_KEY`, tenancy in code, set/reveal/clear audit-logged,
   reveal advisor-only), per-member capture in the drawer with last4-only display.
   Goes live after the human-queue setup steps. The original guardrails, which
   still bind any future change: full SSNs must never enter the profile JSON blob (it reaches both
   browsers, persists in profile_versions history, prints, and AI-assist contexts).
   If/when a partner needs it for account paperwork: a separate `client_identifiers`
   table with column encryption (pgsodium/Vault), service-role-only reads via a
   dedicated edge function, last-4 display everywhere, full value released only into
   a signed paperwork flow, every reveal audit-logged, excluded from demo and AI
   surfaces. Only worth building *together with* item 6, which is what would consume it.
6. **Custodian paperwork automation (Schwab/Fidelity) - POC SHIPPED round 23**
   (`src/paperwork.jsx`: profile → account-opening field map, the quick-view
   Paperwork modal showing prefilled/gated/missing per registration type, JSON
   payload export, and the in-product Quik!-adapter blanks checklist; the live
   adapter waits on the business blanks in TODO). Background: the advisor's "quick" is
   **Quik!** (Efficient Technology's forms engine) - the de-facto account-paperwork
   library both Schwab Advisor Services and Fidelity Institutional run on;
   "G-numbers" are Schwab firm/master-account identifiers that prefill those forms.
   Prism already holds the household data and has DocuSign envelope plumbing
   (`docusign-envelope` / `docusign-connect`). **Track (partner-gated):** (1) research
   the Quik! Forms API (form library + prefill + e-sign hand-off is exactly their
   product) - DONE 2026-06-12 from public docs, see
   [quik-field-taxonomy.md](quik-field-taxonomy.md); (2) map the Prism profile to the
   common account-opening field sets - first pass shipped: the paperwork payload emits
   Execute-shaped FormFields in Quik!'s `<n><role>.<Base>` taxonomy, unverified names
   flagged for dictionary confirmation; (3)
   route signatures through the existing DocuSign integration (validated: Quik!'s
   DocuSign Self Service model returns the signable PDF for exactly this).
   **UX shape (decided 2026-06-12):** advisors choose an action package ("Open
   account", "Transfer assets in", "Update beneficiaries", "Money movement"), not a
   raw form - each resolves to a QuikFormID bundle generated in one Execute call
   (`PAPERWORK_PACKAGES` in paperwork.jsx); a form-search fallback covers the long
   tail. Advisor flow: pick package → readiness check → Create (edge fn, server-side
   SSN release) → PDF preview → DocuSign envelope → signed docs to vault, satisfying
   `requiresDoc` milestone gates. The differentiator to build toward: the planning
   session suggests the paperwork (open retirement goal with no IRA → IRA-opening
   package; P07 estate milestones → beneficiary package).
   **Adapter tiers (decided 2026-06-12; stubs live in `PAPERWORK_ADAPTERS`):** the
   action-package UX is transport-agnostic, so fulfillment is tiered:
   *Tier 1 - Quik! + DocuSign:* the only track startable without a custody
   relationship; covers Schwab + Fidelity + Pershing in one integration and remains
   the long-tail fallback (trusts, maintenance forms, odd transfers) forever.
   *Tier 2 - custodian-direct SSO + prefill* (Schwab Advisor Center digital
   onboarding via the OpenView Gateway partner program; Fidelity Wealthscape via
   Integration Xchange + the firm's "User Access Request Form for Integration
   Services"): the Wealthbox-shaped handoff - client approves natively, no envelope,
   no NIGO, accounts open in minutes. Gated on a design partner's custody
   relationship; their custodian picks which adapter is built first. The same
   partnership unlocks custody read APIs (balances/positions) - coordinate with the
   holdings-aggregation item.
   *Tier 3 - headless onboarding APIs* (Schwab Digital Account Open / Wealthscape
   onboarding+funding APIs): enterprise agreements, only worth it once enough firms
   custody at one custodian through Prism. Needs a design partner
   with a live Schwab or Fidelity relationship to test against - high "open the
   account from the planning session" wedge value when one asks.
7. **Training & onboarding content - PHASE 1 SHIPPED round 23** (the
   recommendation below, built: `docs/guides/advisor-onboarding.md` "first 30
   days" guide → searchable in-app Help drawer + printable `/guides/<slug>/`
   page; next: more guides, per-surface walkthrough clips). The shape:
   author once in markdown (`docs/guides/`), render twice - (a) a
   searchable in-app Help drawer, (b) downloadable searchable PDFs via the
   `build-whitepaper.mjs` pipeline pattern - so the PDF is always an artifact, never
   hand-maintained. Spine it on a "first 30 days" advisor onboarding checklist;
   short per-surface walkthrough clips later.

### Tier C - Reach & retention
- **Client PWA + push - SHIPPED 2026-06-10 (rounds 12b + 13).** Installable client portal
  (`portal-manifest.webmanifest`, `portal-sw.js`) with web-push on new message / document
  request / acknowledgement (VAPID server-side, `push_subscriptions` migration 042, the
  `send-push` edge fn fan-out, `PushSetupButton` in portal-app). VAPID keypair set round
  12b. *Next when wanted:* push on task/plan changes, richer notification deep-links.
- **Exam-ready compliance export - SHIPPED 2026-06-09 (round 7).** One-click
  books-&-records packet from the firm-admin compliance section, with a 90-day /
  12-month / full-history audit window: advisor roster, fee schedules, client
  inventory + fee assignment, invoices, every acknowledgement with its e-sign
  state (firm-wide query, new `db.getFirmAcknowledgements`), the append-only
  audit trail (up to 2,000 entries, truncation flagged), and a retention
  statement. **CSV companions SHIPPED 2026-06-10 (round 14):** Clients (+fee
  assignment), Invoices, and windowed Audit CSVs from the firm-admin view, plus an
  audit-trail filter + load-more (100 → 500 on screen). Formula-injection
  neutralization centralized as `downloadCSV` (store.jsx). *Next when wanted:*
  per-client packets.
- **Client portal accounts view (custodian-grouped) - SHIPPED 2026-06-11 (round 15,
  PR #60).** A read-only "Your accounts" card in the client portal, grouped by custodian
  with balances, a single total, and an as-of stamp, plus a "Something look different?
  Ask {advisor}" hook that prefills the message thread (`px:prefill-message`). Reads ride
  the `accounts_client_read` RLS policy off data already on file (`accounts.custodian`,
  `type`, `balance`, `as_of`). **Scope held:** account/custodian granularity *yes*;
  holdings-level granularity *no* - that stays in the partner-gated holdings-aggregation
  track (a losing comparison vs. custodian apps the client already has).

### Trust & control
- **Advisor MFA (TOTP)** - enforce in the advisor auth path (Supabase Auth supports
  it). *May need a Supabase Auth toggle.*
- **Advisor-approval commit gate for client ledger edits - SHIPPED 2026-06-10
  (round 12).** Opt-in per-firm toggle (firm-admin "Workflow" section, default OFF).
  When on, a client's Numbers-drawer saves route into ONE open draft row
  (`pending_ledger_changes`, migration 036 - repeated autosaves update in place);
  the draft is also what reloads, so the client's working copy survives review.
  The advisor sees a "Client updates to review" inbox on the dashboard with a
  section-level diff, and **Approve & save** writes the profile through the
  advisor's own RLS path (profile_versions + audit intact) while **Return with
  note** sends it back with a message the client sees in the drawer. Advisor edits
  are never gated. *Next when wanted:* per-field approval, realtime nudge on new
  drafts.
- **Platform-owner dashboard - SHIPPED 2026-06-10 (round 12).** Founder tier above
  firm admin (founder ask 2026-06-10), built to the safe shape: no RLS policy was
  touched - a `px_platform_owners` allowlist (migration 035, service-role-only) gates
  the new `platform-admin` edge function, and a gated `#/platform` view in the
  advisor bundle renders it. Day-one actions: firm overview (plan/seats/Stripe
  status/advisor + client counts), provision a firm (Supabase invite or link to an
  existing account, lands as firm admin), suspend/reactivate (advisor workspace
  locks behind a "workspace paused" screen; a trigger stops a firm admin
  un-suspending themself), and billing overrides (plan + seats). Every action is
  audit-logged as `platform.*`. **Platform usage stats SHIPPED 2026-06-10 (round
  14):** the firms table carries a 30-day activity column (event count + last-event
  recency) aggregated from `px_events` in the `platform-admin` overview action  - 
  tolerant of migration 041 not yet being applied. *Next when wanted:* read-only
  client drill-in, Stripe subscription override.

### Observability & scale
- **Product analytics - SHIPPED 2026-06-10 (round 13).** First-party activation events
  (login, invite created/claimed, message, plan-update, report, push_subscribed, and
  `portal_opened` added round 26b) into `px_events` via the `px_track` RPC (migration 041);
  `db.track` is fire-and-forget and no-ops in demo. Surfaced as the platform-admin 30-day
  activity column (round 14). *Next when wanted:* a funnel/retention view.
- **RLS-predicate index coverage audit - DONE 2026-06-10 (round 13, migration 043).**
  `advisor_id`/`firm_id`/`client_id` predicate indexes added (esp. the firm-admin
  cross-firm read) so RLS doesn't force seq scans as tables grow.
- **Uptime monitor** on `health` + the app (human queue).

### Depth on demand (partner-gated - build only when a partner asks)
- **Holdings-level aggregation** (Plaid Investments) → real performance attribution.
- **Object-lock WORM archive** (S3 Object Lock) → makes the 17a-4 claim literally true.
- **Module refactor** - split `advisor-modal.jsx` (~2,100 lines) and `store.jsx`
  (~1,300, esp. the print-report renderers) into load-ordered modules.

### Code-quality backlog (open by design, low priority)
*The 2026-06-09 architecture-inefficiency pass (sign-in phase-fetch serialization,
`generate-invoices` N+1, un-themed pre-auth pages, brand cache trust) shipped in full
2026-06-09 round 5 - see `sprint-log.md`. Pre-auth branding = `src/brand-boot.js`
(standalone, login/signup/landing); the cache + anon-RPC brand inputs are now
whitelist-sanitized in both the bundles and the boot script.*

**2026-06-09 round 7 cleared the 2026-06-08 clean-room list** - shipped: CSV
formula-injection neutralization; `store.jsx update()` shallow path-copy; post-load
autosave echo skipped; `seenIds` capped (500/evict-to-400); estate exemption hoisted
to a named, exported, dated constant (`FEDERAL_ESTATE_EXEMPTION_2025`); `monteCarlo`
LCG → mulberry32 (the tool surfaces an exact success %, which was the trigger);
`isUUID` guards on `dbResolveQuestion`/`dbSnoozeAlert`; soft-vs-hard-delete
distinction documented as deliberate in `db.jsx` (deletions of working data are
themselves audited; books-and-records artifacts never hard-delete); lint now has
bundle-structure guards (src/ coverage ↔ `build-files.mjs`, portal-isolation
assert - the practical form of the load-order guard).

Still open: *(none - the bulk-import batch RPC shipped 2026-06-09 round 10:
`px_bulk_create_clients`, migration 034, transactional 200-row batches with a
per-row fallback while the migration is pending.)*

### UX backlog (optional, low)
- ~~Roster swipe actions~~ - SHIPPED 2026-06-10 (round 11): left-swipe on a mobile
  roster card reveals quick view / roadmap / numbers (touch-only; desktop table
  untouched).
- ~~Housing ratio coaching + field hints~~ - SHIPPED 2026-06-10 (round 11), FinFire
  donors ported to the Numbers drawer: housing-cost-vs-take-home strip with the
  ~30% guideline marker (On target / A bit high / Stretched) + hints on all five
  housing fields.
- **Guardrail:** protect the high-value paths in any future refactor - 1-click demo,
  notification/alert deep-linking, inline question replies, single-screen client
  portal, deep-link routing, and ⌘K command palette.

### Monetize & scale GTM
- Live trial → paid flow; finalize pricing from design-partner signal.
- Scale the one channel that converts; keep SEO compounding underneath.

### Clean-room GTM review (2026-06-21)
A fresh-eyes pass across client perception, advisor perception, workflow, value, and
marketing.

**Shipped (rounds 26 + 26b + 26c + 26d):** the four surface fixes - fabricated
testimonials pulled for an honest founder/design-partner band, wedge-first hero, per-firm
pricing legibility, a "what your clients see" portal preview; then the **client-voice
copy pass** on all seven phase descriptions + rationales (advisor register → smart-friend
voice, substance and numbers kept), the **founder-band hand-hold softened** (dropped the
"I import your households on a call" over-commitment), and **`portal_opened` analytics** so
client return-cadence is finally measurable (the SIGNED_IN-only `login` event undercounted
it; prod had 0 client logins recorded); then the **non-linear roadmap** (26c, below).
**Round 26d (2026-06-22)** finished the client-voice pass into the `tasks[].label`
milestone text across all seven phases, made the **paperwork-details KYC nudge dismissible**
(keyed to the missing-set signature so it re-surfaces only when the gaps change - the last
open seam from the round-25 CX review), and shipped a **client portal guide** through the
existing guides pipeline (audience-marked so the printable reads "Client guide").

**Non-linear roadmap - SHIPPED 2026-06-21 (round 26c).** A pre-build review found the
end-state I'd sketched was over-built: the phase "lock" was already only an `opacity:.55`
dim (not a true gate), `activePhase` is *computed* from milestone completion (a good live
signal, not something to replace with manual focus management), and `current_phase` is an
**existing advisor-set field the portal ignored**. So the shipped design is lighter and
lower-risk than the original sketch (no schema change, no new advisor UI, sequence/
methodology kept, no error-prone "not yet relevant" relevance heuristics):
- The harsh `is-locked` phase dim is gone. Phases past the working horizon now render as
  **"Ahead"** - fully visible and **explorable** (the head opens like any other), just
  gently set apart (a small "Ahead" chip, dashed node, `opacity:.82`). Forward-looking,
  never discouraging.
- The **working horizon** = `max(activePhase + 1, current_phase)`. So a household the
  advisor has placed in a later phase (the 56-year-old with an estate need) sees *all*
  the relevant horizons in-play, never faded - the advisor's existing `current_phase`
  dropdown finally drives the portal. Defaults (`current_phase` 0) reproduce the prior
  next-phase boundary shape, so nothing regresses for existing clients.
- Kept intact: the computed "Now" highlight, milestone celebrations, `requiresDoc`
  document gates (a *separate* mechanism - those still gate), per-phase progress, the
  seven-horizon sequence. Only the discouraging *progression lock* was removed.
- *Future option (not built):* let the advisor mark more than one phase "in focus" and a
  data-driven relevance hint - deferred until a partner asks; today's `current_phase`
  lever covers the real cases without the risk of a wrong "not relevant" claim.

**Still open:**
- **Depth-vs-wedge discipline (strategy, not a build)** - much planning depth (Monte
  Carlo, Roth ladders, asset location, RMD, SS, equity-comp, 1040) shipped pre-partner,
  against "deepen on demand only", and invites the incumbent comparison the wedge avoids.
  Decide consciously whether to keep extending it. *(The related accuracy-liability piece
  is now handled: the dated federal tax figures were folded into one `TAX_FACTS`
  "as-of / review-by" module in calc-core with a CI year-roll guard, shipped sprint 27.)*

---

## Standing principle

**Build with intent.** Net-new feature work is a normal part of growth, not gated
behind design partners. The discipline is *intentionality*: every feature ties to
customer value or the wedge, and we don't add breadth for its own sake. Trust,
distribution, and infrastructure gate *revenue* - they no longer gate *building*.
Client-facing verdicts must **inform without discouraging** (early-journey households
see "Building · time on your side," never "at risk"); the advisor view stays
unsoftened.

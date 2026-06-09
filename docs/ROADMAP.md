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
- **White-label branding** — firm logo, accent color, optional "powered by Prism,"
  and per-firm custom subdomain. Makes "no second portal" literally true. *Backend is
  partway there: the per-firm phase-override resolution was rebuilt (`phase_overrides`
  + resolved view) and `*.prismaw.com` DNS exists. Remaining: load firm brand at auth
  → CSS-var theming + logo slot, a firm-admin brand settings/upload form, and
  per-firm subdomain → brand resolution.*
- **Calendar integration** (Google / Outlook two-way sync, free/busy) — removes a
  rip-and-replace objection. *Needs OAuth apps (human queue).*
- **Zapier / public API** — connect Prism to the rest of a firm's stack.

### Tier B — Wedge deepeners (retire a paid tool)
- **Deeper planning intelligence — the priority track.** The advisor wants planning
  *depth* to keep growing. First increment shipped 2026-06-08: the Asset Location
  optimizer now produces a **bespoke** placement of the household's real dollars
  (fit to their risk allocation, sheltering tax-inefficient assets first) and counts
  Roth. Build on this: tax-aware withdrawal sequencing, Roth-conversion windows tied
  to bracket headroom, and per-account contribution optimization — all from data
  already on file.
- **Tax-return insight (Holistiplan-lite)** — drop a 1040 → planning observations in
  the roadmap + portal. High willingness-to-pay; differentiating inside a client
  portal. Pairs naturally with the planning-depth track above.
- **AI relationship assistant (Gemini)** — draft replies, summarize a household,
  generate review talking points, flag "who needs attention." Rides on the shipped
  messaging + CRM; runs server-side (edge function) so the key never reaches the
  browser. *Key already in Supabase secrets.*

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

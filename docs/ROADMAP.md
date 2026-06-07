# Prism — Product & Go-to-Market Roadmap

> **Canonical roadmap. Supersedes the prior sprint plan.** Last updated 2026-06-07.
> Dated shipped-sprint history lives in [`sprint-log.md`](sprint-log.md); live working board (Claude vs human queues) is [`TODO.md`](TODO.md).
> The feature build is mature and revenue is gated by trust, focus, distribution, and infrastructure — but *building* is no longer gated (see Standing principle). This roadmap is sequenced for **onboarding a first paying advisor**, with a wedge-expansion track (added 2026-06-06) for the features that make an RIA switch.

---

## Code-review findings (2026-06-07) — **first in line, ahead of all feature work**

From a full architecture + granular code review. These are sequenced ahead of C3/C4/C5; live working items are tracked in [`TODO.md`](TODO.md) §C0. Frontend-only fixes are shippable immediately; the checkout/webhook items touch the billing flow (edge-function redeploy + money-adjacent — confirm before deploy).

| Finding | Sev | Status |
|---|---|---|
| Post-checkout `success_url` → `/index.html` (marketing) instead of `/app/`; billing toast handler never runs | 🔴 High | ⬜ TODO C0 |
| Debounced profile save cancelled on client switch → last <1.5s of edits lost (`store.jsx:151-186`) | 🟡 Med | ⬜ TODO C0 |
| KPI / Book-AUM totals computed over the 50-row first page only → under-count for big books (`advisor-dashboard.jsx:817`) | 🟡 Med | ⬜ TODO C0 |
| Monte Carlo (`runs:600`) ran unmemoized in `ProfileProvider` → fired every keystroke | 🟡 Med | ✅ 2026-06-07 (`useMemo`) |
| Generated-alert `priority:'medium'` vs app's `'med'` → mislabeled "FYI", dead CSS class | 🟢 Low | ✅ 2026-06-07 |
| Stripe webhook returns 400 on permanent errors → ~3-day retry storm | 🟢 Low | ⬜ TODO C0 |
| Demo cash-flows array identity busts `perfPeriodsData` memo each render | 🟢 Low | ✅ 2026-06-07 |
| Dead code `reconcileAssets` (superseded by `assetComposition`) | 🟢 Low | ✅ 2026-06-07 (removed) |
| Drift-prone duplication: fee math (calc-core ↔ generate-invoices) + audit-label map ×3 | 🟢 Low | ⬜ TODO C0 |
| Fuller `ProfileProvider` memoization (readiness/goals/risk + context value) | 🟢 Low | ⬜ C5 |

**What the review found healthy:** report layer escapes all interpolated user content; `sanitizeHtml` is escape-then-allowlist; build emits per-file SHA-256 CSP hashes with no script `unsafe-inline`; RLS is tenant-scoped per firm/advisor; soft-deletes preserve the 17a-4 trail; audit/error writes are fire-and-forget. Security posture is the strongest part of the codebase.

---

## Positioning — the wedge (resolves Blocker 4)

Prism touches five mature product categories (planning, CRM, aggregation, performance, billing). It cannot out-build the incumbents in all five as a solo product, so it **does not try to.**

**Prism is the client-facing planning & relationship layer** — the living seven-horizon roadmap plus two-way client collaboration. That is the differentiator and the lead in every surface.

Operating principles:
- **Lead with the wedge, everywhere.** Marketing, demo, and sales open on the roadmap + a live collaboration thread — the one thing only Prism does well — within the first 10 seconds.
- **Position aggregation/performance as "good enough + integrates," not "beats Orion."** Prism sits *alongside* a firm's custodian/performance stack, not as a replacement. This removes a losing comparison instead of inviting it.
- **Deepen on demand only.** Holdings-level aggregation and per-security attribution get built **when a design partner asks**, never speculatively.
- **ICP: solo & small fee-only RIAs** (XYPN/NAPFA-style). They feel tool-sprawl most, can't afford enterprise suites, and value the client-experience angle — exactly the wedge.

---

## Distribution — the motion (resolves Blocker 5)

SEO is automated and compounding, but it is the *slowest* channel and cannot be the primary one.

- **SEO → secondary.** Keep the automated drip pages + GSC digest running (near-zero marginal cost); stop treating it as the growth engine.
- **Design partners → primary, now.** Personally recruit **3–5 RIAs** — warm network first, then where the ICP gathers (XYPN, NAPFA, the Kitces community, advisor LinkedIn, r/CFP). Offer free white-glove onboarding in exchange for feedback + a named testimonial + logo. One real advisor outweighs a hundred drip pages.
- **One active channel:** founder-led POV content (LinkedIn + a short newsletter). Cheapest fit for a solo founder, and it doubles as a trust signal — a name and a point of view behind the product.
- **FinFire as a feeder.** It already links up to Prism; "graduate from DIY to an advisor" is a natural top-of-funnel if it gets any traffic.

---

## Pricing — the model (resolves Blocker 6)

**Decision: flat per-advisor pricing, tiered by a household cap. No metering, no overage billing.**

Chosen for maximum hands-off operation + transparency without hurting marketing. Metered/overage models were rejected — they require usage tracking and produce surprise invoices (the opposite of hands-off). A static household cap is enforced once, reads honestly ("up to N households"), and loosely bounds the per-account aggregation cost that would otherwise erode margin on a flat plan.

| Tier | Price | Household cap |
|---|---|---|
| Solo | $0 (preview) | Up to 25 |
| Growth | $49 / advisor / mo | Up to 150 |
| Enterprise | From $99 / advisor / mo (annual, 5-seat min) | Unlimited |

- **No "unlimited clients + aggregation at $49"** — that was a margin trap; replaced by the Growth cap.
- **Keep "free preview, pricing indicative"** until design partners reveal willingness-to-pay. Anchor on *value replaced* ("one tool instead of five"), not cost-plus. Do price discovery before committing hard numbers.
- Offer annual billing for cashflow.

---

## Phased plan

### Phase 0 — "Can an advisor legally say yes?"
The unlock gate. Mostly **not code**.

| Item | Status |
|---|---|
| Trust surface: Privacy, Terms, DPA, Security pages | ✅ Done (drafts) |
| Compliance language de-risked to "designed-around" capability framing | ✅ Done |
| Wedge reframe in marketing copy (landing leads with roadmap + collaboration) | ✅ Done |
| Pricing model set to household-tier, no metering | ✅ Done |
| Name/form the legal entity; fill legal placeholders (mailing address, governing-law state) | ✅ Done — *LeMay Ventures LLC* (CO) |
| Stand up privacy@ / legal@ / security@ inboxes (built + round-trip tested) | ✅ Done |
| Counsel review of the legal drafts before live customers | ✅ Done (v1) |
| Infra → production grade: Supabase Pro (PITR/backups), rotate Supabase token + Stripe/CRON secrets, decide live Stripe/Plaid keys | ⬜ **Human — #1 hard blocker** |

### Phase 1 — Design partners
| Item | Status |
|---|---|
| Recruit 3–5 ICP RIAs (warm network → XYPN/NAPFA/Kitces/LinkedIn) | ⬜ |
| Stand up founder-led content channel (LinkedIn + newsletter) | ⬜ |
| Make the demo open onto a populated roadmap | ✅ Done (lands on client roadmap) |
| RLS tenant-isolation tests in a DB-enabled CI job (harness shipped: `npm run test:rls`) | ◐ Harness done; wire to CI |
| Calculator unit tests | ✅ Done (`npm run test:calc`, 39 tests) |
| Tighten CSP — remove `'unsafe-inline'` (externalize inline handlers + React styles → nonces/hashes) | ⬜ |

### UX refinements backlog (from the 2026-06 click-path review)
Quick wins #1–#3 shipped (edit-numbers from the client modal, new-advisor onboarding + sample household, "Quick view" modal labeling). Remaining:
| Item | Priority | Notes |
|---|---|---|
| **Unify fee setup** | ✅ Done | Inline "Assign schedules to clients" table in the admin Revenue view (Sprint 2.5). |
| **Preserve the high-value paths (guardrail)** | 🟢 Keep | Don't regress: 1-click demo, notification/alert deep-linking, inline question replies, single-screen client portal, and the now-fixed mobile experience. Treat these as protected UX in any future refactor. |
| Roster → richer mobile detail / swipe actions (optional) | 🟢 Low | Cards shipped; could add quick actions. |
| KPI sparklines: make advisor Book-AUM trend live | ✅ Done | Data-driven Book-AUM sparkline from balance_history / demo (Sprint 2.7). |
| **Housing model — Core (rent/own + equity)** | ✅ Done (2026-06) | Ported from FinFire v2: rent/own toggle, home value/mortgage/APR/escrow, principal/interest/escrow split bar, home equity → net worth, mortgage principal → savings rate. Re-skinned to the institutional palette. |
| Housing — ratio coaching | 🟢 Low | Housing-to-income ratio bar with the 30% guideline + verdict (on target / a bit high / high), and a debt double-counting guard that warns when a mortgage is also listed under Liabilities. Consumer-grade; confirm it fits the advisor voice before porting. Exists in FinFire `components-v2.jsx`. |
| Housing — field hints/tooltips | 🟢 Low | The inline `hint=` explainer text on each Numbers field (APR, escrow, etc.). Friendly for self-serve clients; may be too hand-holdy for an advisor-mediated tool. |
| Fixed-income streams (pension / Social Security) | 🟢 Low | Add per-stream fixed income with a start age, feeding retirement-readiness math. Exists in FinFire `profile-v2.jsx` / `components-v2.jsx` (`FixedIncomeEditor`). Larger change; pair with any future FIRE/retirement-projection work. |
| Housing — multiple properties (2nd home / rental) | ✅ Done (2026-06) | `profile.properties[]` — second homes / rentals, each with value/mortgage/payment + a second-home-vs-rental toggle. Each property's **equity (value − mortgage) rolls into net worth**; rentals show net monthly cash flow per-card (deliberately *not* folded into household surplus, to avoid double-counting rental income already in take-home). UI is a quiet "Add property" affordance (Liabilities pattern) so it stays invisible for single-residence households. Built for the later-stage, asset-heavy ICP who commonly hold rentals/second homes. APR/escrow detail intentionally omitted on extra properties — that "forced savings" teaching detail stays on the primary residence only. |

### Sprint 2 — Advisor Workflow & Efficiency ✅ (2026-06)
- 2.5 Unify fee setup — inline client→schedule assignment in the admin Revenue view.
- 2.6 CRM depth — due/overdue tasks now surface in the notification bell (deep-linked); +1 cadence preset. (Cross-advisor assignment + cadences were already shipped in migrations 007/014.)
- 2.7 Advisor Book-AUM live sparkline — real firm-book trend.

### Sprint 3 — Client Value & Compliance ✅ (2026-06)
- 3.8 In-portal interactive performance view — value chart + time-weighted (Modified Dietz) period returns inline in the client portal (also in the demo).
- 3.9 Client acknowledgements / e-sign — **migration 017** (`acknowledgements` table + `px_sign_acknowledgement` RPC). Advisor requests from the client modal; client reviews & signs in the portal; immutable record + audit trail. **⚙️ Run migration 017 to activate.**

### Sprint 4 — Maintainability & Scale ✅ (2026-06)
- 4.10 Refactor `advisor-dashboard.jsx` (2,665 → 955 lines): extracted modals → `src/advisor-modal.jsx`, firm admin → `src/firm-admin.jsx`. Pure code-move (shared bundle scope, no behavior change); advisor + client + modal verified in demo. *Admin view is a pure move but demo can't reach it — quick live sanity-check recommended.*
- 4.11 Virtualized roster — **deferred**: pagination (50/page + Load more) already bounds the rendered DOM; true windowing is unnecessary in the no-deps architecture unless a firm reports slowness.
- 4.12 Roster swipe actions — skipped (optional).

### Phase 2 — Depth on demand
| Item | Status |
|---|---|
| Holdings-level aggregation (Plaid Investments) → real performance attribution — **only when a partner asks** | ⬜ |
| Object-lock WORM archive (S3 Object Lock) → makes the 17a-4 claim literally true | ⬜ |
| Refactor the 2,488-line `advisor-dashboard.jsx` into load-ordered modules | ⬜ |

### Phase 3 — Monetize + scale GTM
| Item | Status |
|---|---|
| Live trial → paid flow; finalize pricing from design-partner signal | ⬜ |
| Scale the one active channel that converted; keep SEO compounding underneath | ⬜ |

---

## Wedge expansion — what makes an RIA switch (2026-06-06 clean-room review)

Full analysis in [`clean-room-review-2026-06-06.md`](clean-room-review-2026-06-06.md).
An RIA today stitches together planning (RightCapital/eMoney), CRM (Wealthbox/Redtail),
portfolio/performance (Orion/Black Diamond), tax (Holistiplan), and risk (Nitrogen).
To make one *switch*, Prism must (1) remove the cost of moving in, (2) be visibly
better at the client-facing layer, and (3) retire at least one paid tool.

### Tier A — Adoption unlocks (without these, RIAs won't move)
| Item | Why it's switch-critical |
|---|---|
| ~~**Bulk client import** (CSV + Wealthbox/Redtail/Orion mappers)~~ — ✅ shipped 2026-06-07 (`BulkImportModal`; sample at `docs/samples/`) | #1 blocker to a "yes" — nobody hand-keys 150 households. |
| **White-label branding** (firm logo, accent color, custom subdomain) | Table stakes for a client-facing tool; makes "no second portal" literally true. *Scoped: big-but-not-drastic; schema (`firms.brand_color`/`logo_url`) already exists. See TODO C3.* |
| **Prospect / proposal mode** (run a prospect through a sample roadmap pre-signing) | Turns the wedge into a closing tool — the most direct "why switch." |
| **Client connect / invite flow** | *Gap surfaced 2026-06-07:* advisor-created client rows have no `auth_user_id` link, so clients can't yet reach their own portal. Tier-A for any client-facing launch. See TODO C3. |
| **Core integrations** (Google/Outlook calendar, real e-sign, Zapier/API) | Each removes a rip-and-replace objection. |

### Tier B — Wedge deepeners (visible client value; retire a tool)
| Item | Notes |
|---|---|
| ~~**Probability-of-success on the client roadmap**~~ — ✅ shipped 2026-06-07 | Monte Carlo confidence band on the retirement-readiness card (success % + bear/median/bull). |
| ~~**Risk questionnaire → auto-drafted IPS**~~ — ✅ shipped 2026-06-07 | `riskProfile` calc → client questionnaire → strategic allocation; advisor "Draft IPS" (e-sign) + "Print IPS". |
| ~~**One-click review packet (QBR generator)**~~ — ✅ shipped 2026-06-07 | `printQBRReport`: roadmap + readiness + net-of-fee performance + goals + protection, from existing data. |
| **Tax-return insight (Holistiplan-lite)** | "Drop the 1040 → planning observations in the roadmap + portal." High willingness-to-pay; differentiating inside a client portal. |
| **AI relationship assistant (Opus)** | Draft replies, summarize a household, generate review talking points, flag "who needs attention." Rides on the messaging + CRM already shipped. |

### Tier C — Reach & retention
| Item | Notes |
|---|---|
| **Client PWA + push** | Clients live on mobile; push on new message/task/document. |
| **Exam-ready compliance export** | One-click books-&-records packet (audit log + acknowledgements + WORM) for SEC/state exams. |
| **Client-initiated uploads** | `documents.uploaded_by_role` already allows `'client'`. |

**If forced to pick five:** bulk import · white-label · prospect mode · tax-return insight · AI assistant.

---

## Foundation hardening (from the 2026-06-06 review)

The product is mature; these close the gaps that bite the day a design partner is live.

| Item | Sev | Area |
|---|---|---|
| ~~Rate-limit + retention-prune the public `log-error` endpoint~~ — ✅ done 2026-06-07 (migration 021: per-IP+global token bucket + daily prune cron). *Function redeploy pending (TODO H4).* | 🟢 | InfoSec / Backend |
| Supabase Pro (PITR/backups) + rotate Supabase/service-role/Stripe/CRON secrets before live data | 🔴 | InfoSec / Scale (existing Phase-0 blocker) |
| Error alerting (capture exists; nobody is told) — ◐ built 2026-06-07 (migration 022 + `error-digest` hourly cron → `ALERT_WEBHOOK_URL`). Needs the webhook set + function deployed (TODO H3/H4). *No in-app dashboard: cross-tenant errors stay service-role only; the alert goes to the operator.* | 🟡 | Monitoring |
| ~~Wire the RLS-isolation CI job (set `DATABASE_URL` to a disposable project — see [docs/rls-ci-wiring.md](rls-ci-wiring.md))~~ — ✅ done 2026-06-07: wired via session pooler; RLS tests enforce in CI. Remaining: promote to a required check | 🟢 | QA / InfoSec |
| Per-PR Cloudflare preview deploys | 🟡 | DevOps |
| Gate `supabase db push` + edge-function deploy in CI so the repo can't drift from live — ◐ shipped 2026-06-07 (`deploy.yml` manual confirm-gated job + `supabase/config.toml` declaring per-function `verify_jwt`). Needs repo secrets to run (TODO H3). | 🟡 | DevOps |
| ~~ESLint + `npm audit`/Dependabot in CI~~ — ✅ done 2026-06-07 (`npm run lint` over the esbuild-transformed concatenation in the required `ci` job; `npm audit --audit-level=critical`; `dependabot.yml`). | 🟢 | Frontend / InfoSec |
| Enforce advisor MFA (TOTP) | 🟡 | InfoSec |
| Privacy-respecting product analytics (activation events: login, invite, message, plan-update, report) | 🟡 | Monitoring |
| Uptime monitor on `health` + app | 🟡 | Monitoring |
| ~~Playwright e2e over the protected high-value paths~~ — ✅ done 2026-06-07 (`e2e/demo.spec.ts`: 1-click demo, mobile render, DOB-fix regression guard; non-required `e2e` CI job — promote to required once proven, TODO H3). | 🟢 | QA |
| Split the client portal into its own bundle entry (payload + attack surface) | 🟡 | Frontend / Code-Opt / InfoSec |
| ~~Verify invoice-generation idempotency (no double-billing on cron retry)~~ — ✅ done 2026-06-07 (confirmed `unique(client,period)` constraint; `generate-invoices` now distinguishes a 23505 duplicate-skip from a real failure). | 🟢 | Backend |
| Deep-linkable in-app routing (`/app#/client/:id/tab`) | 🟡 | Click-pathing |
| `⌘K` client + action command palette | 🟢 | UX |
| Retention/partitioning for audit / `client_errors` / `balance_history` | 🟡 | Database |
| Minify `styles.css`; verify RLS-predicate index coverage | 🟢 | Code-Opt / Database |
| Close `style-src 'unsafe-inline'` via inline-styles → classes migration | 🟡 | InfoSec / UI |

---

## Standing principle
**Build with intent.** The "resist net-new features" stance is eased — net-new
feature work is a normal part of growth, **not** gated behind design partners by
default. The discipline that remains is *intentionality*: every feature ties to
customer value or the wedge, and we don't add breadth for its own sake. Trust,
focus, distribution, and infrastructure still gate *revenue* — but they no longer
gate *building*. When asked "what's next," propose and build genuinely valuable
features; keep each one purposeful.

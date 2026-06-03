# Prism — Product & Go-to-Market Roadmap

> **Canonical roadmap. Supersedes the prior sprint plan.** Last updated 2026-06-02.
> The feature build is mature; the path to revenue is now trust, focus, distribution, and infrastructure — not more features. This roadmap is sequenced for **onboarding a first paying advisor**, not for shipping features.

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
| Name/form the legal entity; fill legal placeholders (mailing address, governing-law state) | ⬜ **Human** |
| Stand up privacy@ / legal@ / security@ inboxes | ⬜ **Human** |
| Counsel review of the legal drafts before live customers | ⬜ **Human** |
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
| **Unify fee setup** | 🟡 Med | Admin defines fee schedules in one place; advisors assign per-client in another (client modal → Edit tab). Add inline "assign to clients" right after creating a schedule, or allow assignment from the admin client list. |
| **Preserve the high-value paths (guardrail)** | 🟢 Keep | Don't regress: 1-click demo, notification/alert deep-linking, inline question replies, single-screen client portal, and the now-fixed mobile experience. Treat these as protected UX in any future refactor. |
| Roster → richer mobile detail / swipe actions (optional) | 🟢 Low | Cards shipped; could add quick actions. |
| KPI sparklines: make advisor Book-AUM trend live (needs firm-level time series) | 🟢 Low | Client roadmap trend is already live; advisor-side deferred until aggregate history exists. |

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

## Standing principle
Resist building net-new features. The product is past the point where more features move the needle. Revenue is gated by trust, focus, distribution, and infrastructure — let design partners' real needs decide what gets built next.

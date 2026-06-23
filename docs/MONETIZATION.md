# Prism | Monetization & Strategy

> **Living strategy doc.** Companion to [`ROADMAP.md`](ROADMAP.md) (product direction)
> and [`WHITEPAPER.md`](WHITEPAPER.md) (positioning). This file holds the *business model*
> menu: how Prism could make money, and the deeper analysis behind the paths worth pursuing.
> It is meant to grow - append findings, log decisions, and revise the numbers as real
> signal arrives.
>
> **Last reviewed:** 2026-06-22 (exploratory monetization pass).
> **Update triggers:** any pricing change, the first paying partner, any partner or
> investor conversation, a custodian/TAMP/aggregator inbound, or a material ICP/ACV
> learning. When you update, add a line to the Changelog at the bottom.

---

## How to use this doc

1. **The two governing facts** frame every path - read them first.
2. **The landscape** is the full menu (six families) at a glance.
3. **Deep dives** go where the leverage is: license/white-label, bootstrap-vs-raise, and
   embedded finance.
4. **Gaps to close** lists the trust/compliance artifacts that gate institutional deals.
5. **Decisions log** + **Changelog** keep this honest over time.

Nothing here is a forecast. The dollar figures are *illustrative scenarios* with their
assumptions stated, meant to size the shape of each path, not predict it.

---

## The two governing facts

**1. We are pre-first-paying-advisor.** Revenue is gated by trust, distribution, and
infrastructure, not features (see ROADMAP north star). This matters because *nearly every
high-value path below is worth far more after 3-5 paying, retained design partners.*
Pre-proof we sell potential; post-proof we sell a de-risked asset. That proof point is the
single cheapest, highest-return thing we can manufacture, and almost every other option
compounds off it.

**2. The cost structure is abnormal, in our favor.** Fixed infra is roughly $40/mo, gross
margin is >95%, and the product was built largely with AI rather than a burn-rate
engineering team. A normal wealthtech startup *must* raise because building is expensive.
Prism does not. That flips the usual logic: **raising capital is a choice about speed, not
a survival requirement** - which makes the "operate it" and "license it" paths genuinely
viable where they would not be for most startups.

---

## The landscape - six families

| Family | What it is | Control | Upside ceiling | Verdict |
|---|---|---|---|---|
| **A. Run it** | Bootstrapped per-advisor SaaS (current track) | Full | Capped by small ICP + low ACV | Default spine; generates the proof everything needs |
| **B. Fund it** | Angel/pre-seed, then maybe VC | Med to low | High *only* with ACV expansion or bigger TAM | Angel post-proof = useful; VC math does not clear on $49 seats alone |
| **C. License it** | White-label the platform to a distributor | Medium | High - one deal = hundreds/thousands of seats | **The sleeper.** Highest leverage per unit of new build |
| **D. Embed finance** | Monetize flows: payments, AUM bps, account-opening | Med-high | Very high - the ACV multiplier | The lever that makes B and E *big* instead of modest |
| **E. Sell it** | Acquisition (asset sale now, or build-to-sell) | Exit | Tracks ARR at time of sale | Selling now leaves value on the table; harvest after proof |
| **F. Adjacent** | Services, the AI-build playbook, data | Full | Low (services) to narrative-gold (playbook) | Bridge cash + best fundraising/partner story |

**The throughline:** A, then C in parallel, fund the ceiling-changing bets (D) selectively,
harvest via E. Do **not** raise (B) to sell more $49 seats - raise, if at all, to fund the
bets that change the ceiling.

---

## Deep dive 1: License / white-label (family C) - the sleeper

We already built the three hard prerequisites: white-label branding, multi-tenant RLS
isolation, and a compliance-grade posture (append-only audit, 17a-3/4-aligned retention).
That means we can sell the **rails to someone who already owns distribution**, instead of
retailing $49 seats one firm at a time.

*A reusable pitch outline (XYPN primary, Altruist variant) lives in
[`marketing/white-label-pitch.md`](marketing/white-label-pitch.md).*

### Why the leverage is real

At founder-led retail, ~1,500 paying seats is close to a decade of selling into slow,
trust-driven RIAs. A **single** white-label contract with a network of that size lands the
same seat count in one signature. The hard part (the brandable, multi-tenant, audited
platform) is already done - the marginal cost of an additional firm is under $2/mo.

### Target list (best-fit first)

| Tier | Target type | Named examples | Pitch hook | Watch-out |
|---|---|---|---|---|
| **1 - best fit** | Advisor membership / community networks | XYPN, NAPFA | Our ICP *is* their member. Private-label Prism as a member benefit / preferred tech | They curate many tools; want neutrality and member pricing |
| **1 - best fit** | Modern small-RIA custodian | Altruist | Planning + client-portal layer that deepens advisor stickiness on their custody | Simultaneously a competitor; may prefer to build or buy outright |
| **2 - strong** | RIA roll-ups / aggregators | Carson Group, Mariner, Mercer, Wealth Enhancement, Savant, Hightower, Focus firms | They acquire many small RIAs and crave one unified stack; Carson already sells tech+coaching to a partner network (direct analog) | Long procurement; may have incumbent tooling |
| **2 - strong** | TAMPs wanting a planning/portal layer | GeoWealth, AssetMark, Adhesion, SMArtX, Brookstone, Envestnet | "Add the client-facing wedge to your platform without a build" | Bigger ones (Envestnet) are slow and partly competitive |
| **3 - reach** | Broker-dealers / hybrid RIAs going fee-only | LPL, Commonwealth, Cambridge | Advisor-tech differentiator for recruiting + retention | Enterprise sales cycle; heavy diligence (SOC 2, SSO) |
| **3 - reach** | Adjacent software lacking planning | CRMs / fintechs without a planning module | OEM the planning + portal engine under their brand | They may view it as core IP to own, not license |

Channel-but-not-buyer note: **Kitces / AdvisorTech** is media and curation, not an
acquirer - but it is the credibility and distribution channel that warms every name above.
A favorable mention is a force multiplier, not a contract.

### Deal structures (commercial models)

| Model | Shape | Best when |
|---|---|---|
| **Wholesale per-seat** | Partner pays a discounted seat rate (e.g. ~40-60% of $49, so ~$20-30/seat/mo), brings distribution + tier-1 support | Network has many seats and its own support org |
| **Platform fee + per-seat** | Fixed annual platform/license fee plus a smaller per-seat rate | Partner wants predictable cost, you want a revenue floor |
| **Rev-share / bps** | Share of the partner's advisor-tech revenue, or bps on assets on platform | Partner monetizes advisors directly; aligns to their growth |
| **Flat enterprise license** | One annual fee for unlimited seats in the network | Large, stable network that hates per-seat accounting |
| **Build-to-suit + license** | Paid integration/customization up front, then ongoing license | Custodian/TAMP needs deep integration (SSO, data feeds) |

### Illustrative size

Wholesale at $20/seat/mo (≈40% of retail; partner carries distribution + support):

- 300-seat network (a mid TAMP slice or an XYPN cohort) -> **~$72k ARR** from one contract.
- 1,500-seat network -> **~$360k ARR** from one contract.

Either dwarfs a year of founder-led retail selling at the same effort.

### What to protect in any deal

- **No early IP/source exclusivity** and **no perpetual exclusivity** - keep the right to
  sell direct and to other partners.
- **You own the data model and roadmap.** Customization is a paid layer, not a fork.
- **Term + renewal + price escalator**; a pilot/LOI before a multi-year commitment.
- **Source-code escrow** is a reasonable ask from a large partner (key-person risk) - grant
  it narrowly rather than handing over source.

---

## Deep dive 2: Bootstrap vs raise - illustrative 24-month model

**Shared assumptions.** Growth $49/seat/mo ($588/seat/yr) is the modal paid plan; founding
partners locked at $49. Avg ICP firm ≈ 1.6 seats. Fixed infra ~$45/mo, marginal ~$2/firm/mo,
Stripe ~3%; treat gross margin ~95% (COGS is negligible). Billing turns on ~Month 6 after
the first design partners validate. Month 0 = 2026-06 (pre-revenue, where we are now).

### Path A - bootstrap (no outside capital)

Founder-led sales, design-partner motion, content as the one active channel.

| Milestone | Paying seats | Subscription ARR | Notes |
|---|---|---|---|
| Month 6 | 0 | $0 | Still preview; billing turns on |
| Month 9 | ~8 | ~$4.7k | First founding partners convert |
| Month 12 | ~16 | ~$9.4k | Referrals + content compounding slowly |
| Month 18 | ~42 | ~$24.7k | Repeatable motion forming |
| Month 24 | ~85 | ~$50k | MRR ~$4.2k; ~95% of it profit |

**Reality:** cash-positive almost immediately (costs are trivial), but the absolute dollars
are small and the climb is slow because ACV is low and RIA buying cycles are long. This is
a legitimate profitable indie-SaaS trajectory; it is not, by itself, a venture outcome.

### Path B - raise (~$400k pre-seed at Month 9, post-proof, ~15-20% dilution)

Capital deployed to: modest founder salary (work full-time), one contract growth/BD person,
one contract engineer for the embedded-finance + SSO/SOC 2 prep, and paid pilots.

| Milestone | Paying seats | Subscription ARR | Plus |
|---|---|---|---|
| Month 12 | ~30 | ~$17.6k | Active white-label BD pipeline |
| Month 18 | ~90 | ~$52.9k | Target: 1 white-label LOI/pilot |
| Month 24 | ~220 | ~$129k | Target: 1 signed white-label deal (~$120-300k ARR) -> blended **~$250-430k ARR** |

Burn ~$350k over 18 months; runway is tight, so this path commits you to either landing the
white-label deal (default-alive) or raising again.

### The honest punchline

Subscription ARR alone differs by maybe 2-3x between the two paths at 24 months - **and the
raise version is still not venture-scale.** A small raise does not meaningfully out-sell
$49 seats, because distribution is the bottleneck either way. The raise only "wins" if the
capital buys a **ceiling-changing bet**: a white-label deal (deep dive 1) or the
embedded-finance ACV lever (deep dive 3). So:

> **Don't raise to sell more subscriptions. Raise (if at all) to fund the white-label BD
> and the embedded-finance build - the things that change the ceiling.**

| | Bootstrap | Raise |
|---|---|---|
| ARR @ 24mo (subscription) | ~$50k | ~$129k |
| Equity kept | 100% | ~80-85% |
| Founder pay | none/minimal | modest salary |
| Ceiling / optionality | capped without D or C | funds the shot at C and D |
| Primary risk | slow; founder burnout/runway | burn + must land the big bet |

---

## Deep dive 3: Embedded finance (family D) - the ACV multiplier

The custodian-paperwork track, the DocuSign plumbing, and the advisory-fee billing engine
already in the product create optionality to monetize *flows*, not just subscriptions. This
is what turns a $49/mo tool into venture-scale ACV.

- **Take-rate on advisory-fee billing.** We already generate the invoices; add a payments
  rail (ACH/card pull) and take a cut - Stripe-for-advisors. The fee billing already runs;
  the rail is the new piece.
- **AUM-based pricing.** Bps on assets on platform, the industry-native model. A single
  AUM-priced relationship can exceed a year of seat revenue.
- **Account-opening / money-movement facilitation.** The "open the account from the planning
  session" wedge (Quik! + custodian adapters, already POC'd in `paperwork.jsx`). Facilitation
  fees, or simply the stickiness that justifies a higher seat price.

**Trade-off:** more build and more regulatory surface (money movement, custody-adjacent), so
this is partner-gated - build it *with* a design partner who needs it. But it is the lever
that lifts the *high* end of both the raise path and any acquisition.

*(Cross-reference: ROADMAP "Custodian paperwork automation" item 6 and the adapter tiers.)*

---

## Gaps to close before institutional conversations

Selling *to* or *through* an institution (custodian, TAMP, aggregator, broker-dealer) raises
the diligence bar above what retail RIAs ask. Current state:

| Artifact | Status | Notes |
|---|---|---|
| Multi-tenant isolation (RLS) | **Strong** | RLS on every table; rls-isolation is a required CI check |
| Append-only audit + retention | **Strong** | 17a-3/4-aligned; nightly archive; exam-ready export |
| Transport/app hardening | **Strong** | HTTPS/HSTS, enforced CSP, no unsafe-inline |
| MFA / encrypted identifiers | **Have** | TOTP; AES-256-GCM client identifiers |
| White-label branding | **Have** | Firm accent + logo across app and portal |
| **SOC 2 Type II** | **GAP** | The single most-requested artifact for institutional deals; not started. Plan a path (auditor + ~6-12mo observation) before serious enterprise talks |
| **SSO / SAML** | **GAP** | On the WHITEPAPER "not yet" list; table-stakes for enterprise/custodian buyers |
| Formal uptime SLA + status page | **Partial** | Uptime monitor is in the ROADMAP human queue; no published SLA/status page yet |
| Third-party pen test / attestation | **GAP** | Institutions want an independent security review on file |
| DPA + data-residency answers | **GAP** | Need a data-processing agreement template and a clear data-location story |
| WORM / object-lock storage | **Partial** | On ROADMAP (partner-gated); needed to make the 17a-4 claim literally true |
| Cyber insurance + BCP | **GAP** | Standard vendor-diligence checklist items |

**Sequencing note:** none of these block a *membership-org* or *pilot* deal, but SOC 2 and
SSO will surface fast in any custodian or large-aggregator conversation. Start the SOC 2
clock early - it is the longest pole. The full plain-language plan for both lives in
[`SOC2-SSO-READINESS.md`](SOC2-SSO-READINESS.md).

---

## Decisions log

*(Append decisions here as they are made - date, decision, rationale.)*

- **2026-06-22** - Strategy stance affirmed: A (bootstrap) is the spine and proof engine; C
  (white-label) is the highest-leverage parallel track to probe now; raise only to fund C/D,
  not to sell more subscriptions. No commitment yet to any specific partner or raise.
- **2026-06-22** - SSO approach decided (Supabase-native SAML first, WorkOS when breadth or
  SCIM is needed; paid Enterprise add-on, built on a committed deal). See
  [`SOC2-SSO-READINESS.md`](SOC2-SSO-READINESS.md).
- **2026-06-22** - SOC 2 document cache started in a private repo
  (`LochLogic/prism-compliance`, DRAFT) while the auditor/platform engagement is deferred;
  public site will only describe the posture (a Trust page), never host the documents.

## Open questions

- Which custodian relationship(s) do the first design partners actually use? (Decides which
  embedded-finance / paperwork adapter is worth building first, and which custodian is a
  natural white-label/partner target.)
- Willingness-to-pay signal: does $49 hold, or does the "value replaced" anchor support $79
  at list? (Set at Stripe go-live.)
- Founder appetite: lifestyle-profitable indie SaaS vs. venture swing vs. build-to-sell? The
  three imply different default paths and should be a conscious choice, not a drift.

---

## Changelog

- **2026-06-22** - Doc created. Initial landscape (six families) + deep dives on
  white-label, bootstrap-vs-raise, and embedded finance; gaps-to-close inventory.

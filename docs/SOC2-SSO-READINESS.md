# Prism | SOC 2 & SSO readiness track

> **Living readiness doc.** The plain-language plan for the two trust artifacts that gate
> institutional deals (custodians, TAMPs, aggregators, larger firms): a **SOC 2** report and
> **single sign-on (SSO)**. Companion to [`MONETIZATION.md`](MONETIZATION.md) (the
> "Gaps to close" section points here).
>
> **Last reviewed:** 2026-06-22.
> **Update triggers:** any move on SOC 2 (pick a platform, engage an auditor, finish a
> phase), any SSO build decision, or the first institutional buyer who asks for either.
> Log progress in the Changelog at the bottom.

---

## Why this exists, in one breath

A solo RIA buying Prism asks "does it work and is my data safe?" An institution buying
Prism, or putting it in front of its whole network, asks a much harder question: "prove it,
with paperwork, and let my IT department control the logins." SOC 2 is the proof. SSO is the
login control. Neither is hard to understand; both take lead time, and SOC 2 is the longest
pole in the whole monetization plan. This doc makes both a fast "yes" when a partner asks.

The good news up front: Prism's actual security is already strong (row-level isolation, an
audit trail, encryption, multi-factor login, a CI gate on every change). Most of the work
below is **writing down what we do and proving it runs**, not building new security.

---

# Part 1 - SOC 2

## What SOC 2 is, in plain terms

SOC 2 is a report written by an independent accounting firm that says, in effect, "we
examined this company's security controls and they hold up." It is the standard trust
credential for business software in the US. You do not "pass or fail" a multiple-choice
test; an auditor reviews how you actually run the system and writes up what they found.

It is built around five possible topics (the "trust criteria"): **Security** (the core one,
always included), **Availability** (uptime), **Confidentiality**, **Processing Integrity**,
and **Privacy**. You choose which to include. Most companies start with **Security only**,
sometimes adding Availability and Confidentiality.

## Type I vs Type II - and which we need

- **Type I** says the controls are *designed* correctly at a single point in time. Faster
  and cheaper. Useful as an early "we are on the path" signal.
- **Type II** says the controls actually *operated* correctly over a period of time (usually
  3 to 12 months of observation). This is what serious institutional buyers want.

**Plan:** aim for Type II (Security criterion first), and consider getting a Type I along the
way so there is something concrete to show buyers while the Type II observation window runs.

## Where Prism already stands (the strong foundation)

These map directly onto SOC 2 Security controls and are largely already in place:

| Control area | Status | What we already have |
|---|---|---|
| Access isolation | **Strong** | Postgres row-level security on every table; `rls-isolation` is a required CI check |
| Login security | **Strong** | Multi-factor (TOTP), Google OAuth, magic link; least-privilege via RLS |
| Encryption | **Strong** | HTTPS with HSTS in transit; encryption at rest; AES-256-GCM for sensitive identifiers |
| Change management | **Strong** | Everything ships through Git + pull request + four required CI checks; nothing reaches production unreviewed |
| Audit logging | **Strong** | Append-only, immutable audit trail of material actions + a nightly off-table archive |
| Data retention / disposal | **Good** | Records-retained-not-erased soft deletes, retention rollups, immutable profile versions |
| Backups | **Good** | Supabase managed backups (need a documented restore test - see gaps) |

This is an unusually good starting point. An auditor will recognize the CI gate and the audit
trail as real, demonstrable controls, not slideware.

## The gaps - mostly paperwork and routine, not technology

This is where the work is. Almost all of it is **documenting policies and running a few
recurring routines**, which feels heavy for a one-person company but is exactly what an
auditor looks for.

| Gap | What it means in plain terms | Effort |
|---|---|---|
| Written security policies | A short set of documents: acceptable use, access control, change management, incident response, business continuity, vendor management, data classification, risk assessment. Templates exist in every compliance platform | Medium (the bulk) |
| Annual risk assessment | Write down "here are our risks and what we do about them," once a year | Low |
| Vendor register | List your sub-processors (Supabase, Cloudflare, Stripe, Google/Gemini, DocuSign, Plaid) and keep their own SOC 2 reports on file | Low |
| Access reviews | Every quarter, confirm who has access to what and remove anyone who should not. Save the evidence | Low, recurring |
| Onboarding / offboarding | A written procedure for granting and removing access (applies even to a single contractor) | Low |
| Security awareness training | One short annual training, even for a team of one | Low |
| Background check | On the founder and any contractor with access | Low, one-time |
| Endpoint security | The work laptop has disk encryption, screen lock, and anti-malware, and that is documented | Low |
| Secrets handling | Document how API keys/secrets are stored (Supabase secrets, GitHub Actions) and rotated | Low |
| Penetration test | An independent firm tries to break in, once a year, and gives you a report | Medium (outsourced) |
| Incident response plan | A written "if something goes wrong, here is who does what," plus one practice run | Low |
| Business continuity / disaster recovery | A written recovery plan plus an actual test that a backup restores | Low to medium |
| Uptime monitoring + status page | Automated uptime checks with alerting, and ideally a public status page (also satisfies the Availability criterion) | Low (already on the ROADMAP human queue) |
| Customer-facing trust materials | A security/trust page, a published sub-processor list, and a data-processing agreement (DPA) template buyers can sign | Low |

## The path - five phases

**Phase 0 - decide and equip (about 2 to 4 weeks).** Decide the scope (recommend Security
only to start). Pick a compliance-automation platform - Vanta, Drata, or Secureframe are the
common choices. These connect to the stack (Supabase, Cloudflare, GitHub, the laptop) and
continuously watch the controls and collect evidence, which is what makes SOC 2 feasible for
a tiny team. Buy the supporting basics (a password manager, an endpoint-security tool, a
background check).

**Phase 1 - readiness assessment (about 2 to 4 weeks).** The platform scans the stack and
produces a gap list (it will look like the table above). This tells us exactly what is left.

**Phase 2 - remediation (about 6 to 10 weeks, the real work).** Adopt the policy templates,
turn on the missing routines (access reviews, vendor register, training, endpoint checks),
write the incident-response and continuity plans, run a backup-restore test, and wire up
uptime monitoring. Most of this is a few focused weeks of writing and configuration.

**Phase 3 - Type I audit (optional, about 3 to 5 weeks).** Engage a licensed CPA firm for a
point-in-time Type I. This produces a report to show buyers immediately, while the Type II
clock runs.

**Phase 4 - Type II observation + report (3 to 6+ months, then the audit).** The platform
quietly collects evidence over the observation window; then the auditor reviews it and issues
the Type II report.

**Rough overall timeline:** audit-ready in about 3 to 4 months, a Type I in about 4 months,
and a Type II report roughly 7 to 12 months from a standing start.

## What it costs (ballpark, year one)

- Compliance-automation platform: roughly $7k to $25k per year (startup tiers are at the
  lower end).
- Auditor (CPA firm): Type I roughly $5k to $15k; Type II roughly $12k to $40k.
- Penetration test: roughly $5k to $15k.
- Supporting tools (password manager, endpoint security, background check, training):
  roughly $1k to $3k.

**All-in year one is realistically $20k to $60k, plus meaningful founder time.** A tiny
single-product company can land near the lower end.

## The honest solo-founder reality

The technical controls are mostly done. The friction is the *organizational* controls -
policies, training, background checks, access reviews - which feel odd for a company of one
but auditors still require. Budget the time, lean hard on the automation platform's templates,
and do not gold-plate: Security-criterion-only, one product, one environment, is the smallest
honest scope.

**Important nuance:** SOC 2 does not have to fully block the first institutional deal. A
completed readiness assessment, a started Type II, and a signed "bridge letter" describing
the in-progress report is often enough for a buyer to proceed. The requirement is that we
have credibly **started**, well before the conversation.

## SOC 2 decisions to make now

1. Do we commit to starting the readiness rails (pick a platform) *before* the first
   custodian/aggregator conversation, rather than after? (Recommended: yes - it is the long
   pole.)
2. Scope: Security only to start? (Recommended: yes; add Availability later if a buyer asks.)
3. Budget approval for the year-one range above.

---

# Part 2 - SSO (single sign-on)

## What SSO is and why institutions demand it

SSO lets a firm's staff log in to Prism using their existing company identity - their Okta,
Microsoft Entra (Azure AD), or Google Workspace account - instead of a separate Prism
password. The firm's IT team controls who has access and can switch it off the instant
someone leaves.

Institutions treat this as non-negotiable because it gives them: instant offboarding (cut one
account, lose access everywhere), no password sprawl, central control, and a clean audit
trail. In any custodian, aggregator, or larger-firm procurement, "do you support SSO?" is a
checkbox that can stop a deal cold.

There are two related pieces, often confused:

- **SSO (the login):** the firm's identity provider vouches for the user. The standard is
  SAML 2.0 (and its modern cousin OIDC). This is the piece almost everyone means.
- **SCIM (provisioning):** the firm's directory automatically creates and disables Prism
  accounts as staff join and leave. A separate, larger piece. Only big networks need it;
  build it later, when one asks.

## Build options

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **Supabase-native SAML** | Prism already runs on Supabase Auth, which supports SAML 2.0 SSO as an add-on | No new vendor; same login/session model we already use | Per-customer setup is on us; check current availability/pricing at build time; SCIM not necessarily covered |
| **WorkOS** | A purpose-built "SSO and directory sync in a box" used by many B2B apps | Fastest path to all major identity providers plus SCIM; a self-serve admin portal for customers; usage-priced (often free under a threshold) | A new vendor to integrate alongside Supabase Auth |
| **Auth0 / Stytch** | Full auth platforms with SSO | Mature | More migration risk since Supabase Auth is already in place |

**Recommendation:** default to **Supabase-native SAML** for the first one-off enterprise or
white-label deal if it covers that customer's identity provider; reach for **WorkOS** when we
need several providers quickly or SCIM provisioning. Do not migrate off Supabase Auth.

## How it fits Prism

SSO slots into the existing advisor login path (Supabase Auth), which already enforces
multi-factor. For an enterprise tenant, SSO replaces the password; we map the firm's identity
provider to the firm tenant and keep the existing row-level `firm_id` isolation underneath, so
nothing about data separation changes. (Note: the ROADMAP already lists "Advisor MFA (TOTP)" -
SSO is its enterprise sibling on the same auth path.)

## Effort and sequencing

- Core SSO with Supabase or WorkOS is roughly **1 to 3 weeks** of build and testing for the
  first identity provider. Each additional customer is then mostly configuration plus a test.
- SCIM (auto-provisioning) is a separate, larger effort - build only when a large network
  needs it.
- **Sequencing rule:** build SSO when a signed or strongly committed deal requires it, not
  speculatively. Gate it behind the **Enterprise tier and charge for it** - an "SSO add-on"
  is industry-normal and expected. The point of this doc is that the design is already
  decided, so it is a fast yes when asked.

## SSO decisions (decided 2026-06-22)

1. **Decided:** default approach is **Supabase-native SAML first, WorkOS when breadth or
   SCIM is needed.** This lets us truthfully answer "yes, we support SSO" with minimal effort
   until a deal actually exercises it.
2. **Decided:** SSO is an **Enterprise-tier paid add-on, built on a committed deal, not ahead
   of one.** Design is settled (above) so the build is a fast yes, not a research project.

---

## Combined sequencing

- **Start SOC 2 readiness early and in parallel** - it is the long pole, the early phases are
  low-effort, and "we have started" is itself the thing buyers need to hear. The biggest
  recurring routines (access reviews, training) cost little once set up.
- **Defer the SSO build until a deal needs it**, but keep the decision pre-made (this doc) so
  it is a one-to-three-week yes rather than a research project mid-negotiation.
- Net: SOC 2 is the calendar driver; SSO is fast and demand-triggered.

## Open questions

- Which compliance-automation platform (Vanta / Drata / Secureframe)? Pricing and startup
  programs differ; pick on a quick demo round.
- Does the first likely institutional partner mandate Type II up front, or accept Type I +
  bridge letter? (Decides how hard to push the observation window.)
- Which identity provider does the first enterprise/white-label customer use? (Decides whether
  Supabase-native SAML covers it or we reach for WorkOS.)

## Changelog

- **2026-06-22** - Doc created. Plain-language SOC 2 path (foundation, gaps, five phases,
  cost, solo-founder reality) + SSO options/sequencing + combined plan.
- **2026-06-22** - SSO approach decided: Supabase-native SAML first, WorkOS when breadth or
  SCIM is needed; SSO is a paid Enterprise add-on built on a committed deal.

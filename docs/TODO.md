# Prism | Working TODO

> **The live board, not the historical record.** This file holds only what is still open.
> The moment an item ships, delete it from here: [`ROADMAP.md`](ROADMAP.md) keeps the
> forward vision and [`sprint-log.md`](sprint-log.md) the dated shipped history. If it's
> done, it should *leave* this file.

**How to read this board**
- Two queues. **🤖 Claude's queue** is work I can take end-to-end inside the repo.
  **🧑 Your queue** is everything I can't reach: money, credentials, external accounts,
  legal, dashboard toggles.
- Each queue is grouped by goal, newest priority first, and every item is independently
  shippable. Deep background for any item lives in [`ROADMAP.md`](ROADMAP.md).
- **🔴 = a hard blocker for onboarding the first paying advisor.** Everything else is
  sequenced behind those.

**Project facts:** ref `phabxcijbbphfxvjedfj` · domain `prismaw.com` · prod audited
2026-06-22 (repo migrations `001-045` applied, 17 repo edge functions ACTIVE). Sprint 28
(2026-06-23) added migration `046` (`api_keys`) + two edge functions (`api-keys`,
`public-api`). Sprint 29 (2026-06-27) adds migrations `047` (`px_ledger_draft_alert`
trigger) + `048` (`webhooks`) and one new edge function (`webhooks`), with edits to
`platform-admin` / `ai-assist` / `public-api` / `docusign-connect`; Claude-applied +
gated-deployed on merge, so repo = live again (18 repo edge functions).

---

# 🤖 Claude's queue

## Ready to build now
These need nothing from you. Say the word on any one and I ship it.

- [ ] **More in-app guides** *(pipeline is one markdown file per guide → searchable Help
  drawer + printable `/guides/<slug>/`).* Live now (6): advisor onboarding, client portal,
  firm-admin, integrations & API, compliance & exams, **planning tools** (sprint 29).
  Next candidates: per-surface walkthrough clips. Pick one and I write it.

## Build when unblocked
The code is understood; each waits on one external thing.

- [ ] **Quik! paperwork adapter** *(waits on the Quik! business blanks in your queue).*
  Implements `PAPERWORK_ADAPTERS.quik.submit(payload)` so the in-product Paperwork modal
  becomes a live filing flow. The payload already emits Execute-shaped `quik.formFields`
  ([`quik-field-taxonomy.md`](quik-field-taxonomy.md)); the adapter is an edge function
  (`POST /qfe/execute/pdf` + server-side SSN release), then signatures route through the
  existing DocuSign flow (one audit trail).
  - **UX is locked** (founder-approved 2026-06-12): advisors pick an *action package*
    (open account / ACAT in / beneficiaries / ACH) from `PAPERWORK_PACKAGES`, not a raw
    form; form search is the long-tail fallback.
  - **Build only when UAT credentials land:** resolve each package slot to a real Form ID
    against live `GET /forms/search` results, then build the picker (multi-select →
    Create → PDF preview → DocuSign routing → vault + doc-gate close). Missing fields are
    not a blocker: Quik! fields stay editable per recipient inside DocuSign, so the client
    completes their own fields in the envelope.
  - **Tier 1 only for now** (Quik! + DocuSign): the one track startable without a custody
    relationship, and the long-tail fallback forever. Tier 2 (custodian-direct SSO/prefill)
    and Tier 3 (headless onboarding APIs) stay as stubs in `PAPERWORK_ADAPTERS`, gated on a
    design partner's custodian. Full rationale: [`ROADMAP.md`](ROADMAP.md) item 6.
- [ ] **Stripe webhook retry-storm hardening** *(waits on your go for a gated
  `stripe-webhook` redeploy; money-adjacent, deferred by decision).* Today `stripe-webhook`
  returns HTTP 400 on any exception, so Stripe retries for ~3 days even on permanently
  unprocessable events. Fix: return **200** for permanent/unprocessable cases, reserve
  **4xx/5xx** for genuinely retryable ones. The repo is intentionally left in sync with
  what's deployed until you greenlight the redeploy.

## Build when a partner signals
Cheap edits, but they should be triggered by a real partner moment, not done speculatively.

- [ ] **Swap the founder band for a real testimonial.** The "Built in the open" founder
  band on the landing page is the honest placeholder. Replace it the moment a design
  partner hits a genuine "this is useful" moment (ask for the quote *then*, not before).
- [ ] **Client-voice copy, phase 3 (optional).** Phase descriptions, rationales, and
  milestone labels are already client-voiced. The last advisor-register copy lives in the
  planning-tool surfaces (`calculators.jsx`). Soften only if a partner flags it as too
  technical; the advisor view stays unsoftened by design.

---

# 🧑 Your queue

Things I genuinely can't do: they cost money, need your identity/credentials, or live in
dashboards I can't reach. **🔴 = a hard blocker for the first live client.**

## 1. Gate the first live client (do these first)

- [ ] 🔴 **Upgrade Supabase to Pro + enable PITR / daily backups.** This is the #1
  blocker. The free tier auto-pauses after 7 idle days and has no backups or connection
  headroom: non-negotiable before any real client data. *(Service-role key, access token,
  and `CRON_SECRET` are already rotated; while you're in there, confirm the new
  `CRON_SECRET` is in Vault.)*
- [ ] 🔴 **Rotate the remaining secrets.** Before any live data, set fresh values for
  Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and Plaid (`PLAID_CLIENT_ID`,
  `PLAID_SECRET`, plus `PLAID_ENV`). Set each in **both** Supabase → Edge Functions →
  Secrets **and** GitHub Actions secrets.
- [ ] 🔴 **Decide live vs. test keys** for Stripe and Plaid (do real money + account
  aggregation flow for design partners, or stay in sandbox?). Tell me the call and I flip
  the env config; this also sets `STRIPE_PRICE_GROWTH` to the live or test price.
- [ ] 🔴 **Enable leaked-password protection.** Supabase → Authentication → password
  settings → turn on the HaveIBeenPwned check (Pro-plan feature, pairs with the Pro
  upgrade above). Confirmed still off in the 2026-06-22 Security Advisor; it's the one
  Auth-side toggle left. *(The advisor also flags some `SECURITY DEFINER` RPCs + `pg_net`
  in public as WARN: those are by design and reviewed. No action.)*
- [ ] 🔴 **Run one full live smoke pass** (demo can't exercise these paths). In a real
  session: sign up → provision firm → add a client → request + e-sign an acknowledgement →
  as **admin** create/assign a fee schedule → run billing → approve an invoice → check the
  audit trail. Then repeat the advisor + client steps once on your phone (desktop + mobile,
  light + dark).

## 2. Quick setup (a few minutes each)

- [ ] **Finish Microsoft calendar (one Azure click).** In the Azure app registration, add
  the redirect URI `https://prismaw.com/oauth/microsoft/callback` (Web platform), the
  Microsoft twin of the Google one. Creds are already set as repo secrets and synced to
  Supabase, so this is the only step left to make the Microsoft provider live.
- [ ] **Verify Auth URLs.** Supabase Auth → **Site URL** = `https://prismaw.com`; redirect
  allow-list includes `prismaw.com/**` and `www.prismaw.com/**`; Google provider enabled
  with the production redirect URI registered in Google Cloud.
- [ ] **Save the `IDENTIFIER_ENC_KEY`** into your password manager. I generated and printed
  it once in the 2026-06-12 chat; it encrypts stored SSNs. Losing it orphans those values
  (re-enterable, never recoverable). *This is the only human step left from the round-23
  SSN work.*
- [ ] **Confirm your founder accounts.** A prod `admin`-role advisor row and a
  `px_platform_owners` row both exist; confirm both point at the account you actually sign
  in with, so the firm-admin and Platform tabs resolve for you. (Roles flip from the
  Platform tab's Advisors roster, no SQL needed.)

## 3. Turn on when a partner is ready to pay

- [ ] **Stripe go-live.**
  - Switch Stripe to live mode; create the live **Growth** price → set `STRIPE_PRICE_GROWTH`.
  - Register the live webhook at
    `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook` for
    `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`; set `STRIPE_WEBHOOK_SECRET`.
  - Tell me to redeploy `create-checkout-session` + `stripe-webhook` (`--no-verify-jwt`).
  - Reflect the per-firm household tiers in the live products (Solo ≤25 / Growth ≤150 /
    Enterprise unlimited).
  - Smoke test: test card `4242 4242 4242 4242` → plan flips to "Growth · active", webhook
    delivery returns 200. Then repeat once on live mode with a real card and refund.
- [ ] **DocuSign production promotion** (only when signing real client paperwork). Promote
  the DocuSign account to production, go-live the integration key, swap
  `DOCUSIGN_OAUTH_BASE` → `account.docusign.com`, update `DOCUSIGN_REST_BASE`, recreate the
  Connect webhook + HMAC. Sequence with the live-keys decision. Runbook:
  [`docusign-setup.md`](docusign-setup.md).
- [ ] **Toggle TOTP factor support** in Supabase → Authentication → Providers. Advisor MFA
  is fully built (enrollment in the account menu, aal2 enforcement in `auth.jsx`, the
  sign-in challenge card in `login.html`, and recovery via the Platform tab's "Reset 2FA").
  This toggle is the only step left to make it live. It is also the on-ramp for enterprise
  SSO later (same auth path, see [`SOC2-SSO-READINESS.md`](SOC2-SSO-READINESS.md)).

## 4. Trust track for institutional deals (long lead, start early)

The full plan is [`SOC2-SSO-READINESS.md`](SOC2-SSO-READINESS.md). None of this blocks a
solo-RIA or pilot deal, but SOC 2 and SSO surface fast in any custodian, TAMP, aggregator,
or larger-firm conversation, and **SOC 2 is the longest pole in the whole plan**.

- [ ] **Start SOC 2 readiness (Phase 0 decisions).** The technical controls are already
  strong; the work is mostly policy + routine. Three decisions unlock the rails:
  - **Pick a compliance-automation platform** (Vanta / Drata / Secureframe) on a quick demo
    round. This is what makes SOC 2 feasible for a tiny team: it watches the stack and
    collects evidence continuously.
  - **Confirm scope:** Security (Common Criteria) only to start, Type II target, with a
    Type I along the way as something concrete to show buyers. (Recommended.)
  - **Approve the year-one budget:** realistically ~$20k-60k all-in (platform + auditor +
    pen test + supporting tools), landing near the low end for a single-product solo.
  - Then: buy the basics (password manager, endpoint security, background check) and let
    the platform run its readiness scan. *I can draft the full policy set + control matrix
    into the private `LochLogic/prism-compliance` repo on your word, so Phase 2 is mostly
    review, not writing.*
- [ ] **SSO is pre-decided, build only on a committed deal (no action now).** Approach is
  settled: Supabase-native SAML first, WorkOS when you need breadth or SCIM; sold as a paid
  Enterprise add-on. Logged here so it's a 1-3 week "yes" when a deal needs it, not a
  research project. Nothing to do until then.

## 5. Unblock the paperwork adapter (Quik! / custodian)

These business blanks unlock the Tier-1 Quik! adapter in Claude's queue. The in-product POC
already runs (quick view → Paperwork); these make it file for real.

- [ ] **Open a Quik! Forms API relationship.** Contact sales@quikforms.com / quikforms.com.
  Ask for **UAT access first**, then get: customer id + API key, and the per-form field
  dictionaries (`GET /forms/fields`) so I can confirm the field names currently flagged
  unverified.
- [ ] **Gather custodian routing ids.** Your (or a design partner's) Schwab **G-number**
  (master account) and/or Fidelity firm id, from a real custody relationship.
- [ ] **Pick the first form set** (e.g. Schwab Individual / Joint / IRA new-account). Tell
  me which and I map the field dictionaries to the Prism profile.
- [ ] **Confirm e-sign routing.** Quik!'s built-in e-sign vs. Prism's existing DocuSign
  envelope flow. *(I recommend our DocuSign flow: one audit trail.)*

## 6. Distribution & GTM (the actual growth work)

- [ ] **Fill in the prospect tracker.** The template now ships at
  [`docs/samples/prospect-tracker.csv`](samples/prospect-tracker.csv) (~50 rows, warm-
  weighted, source mix pre-stubbed). Populate it with real names, weighted toward warm
  intros.
- [ ] **Recruit 3-5 design-partner RIAs.** Warm network first, then XYPN / NAPFA / Kitces /
  advisor LinkedIn / r/CFP. Offer free white-glove onboarding in exchange for feedback + a
  named testimonial + logo. Playbooks: [`design-partner-kit.md`](design-partner-kit.md),
  [`first-outreach-plan.md`](first-outreach-plan.md).
- [ ] **Stand up the founder content channel** (LinkedIn + a short newsletter). I draft;
  you own the account, voice, and publish. Drafts:
  [`founder-content-starter.md`](founder-content-starter.md).
- [ ] **Bust LinkedIn's share-preview cache.** Run `https://prismaw.com` through the
  [Post Inspector](https://www.linkedin.com/post-inspector/) so new shares pick up the
  clean title ("Prism | The Advisor Workspace") and current OG image. *(The already-
  published launch post keeps its old snapshot; delete + re-share it if you want the new
  branding there.)*
- [ ] **Probe the white-label angle when a network conversation opens.** The pitch outline
  is ready ([`marketing/white-label-pitch.md`](marketing/white-label-pitch.md), XYPN-
  primary with an Altruist variant); it's the highest-leverage parallel track per the
  [`MONETIZATION.md`](MONETIZATION.md) deep dive. No build needed, the three prerequisites
  (white-label branding, multi-tenant RLS, per-firm isolation) already shipped.

## 7. Provisioning & monitoring

- [ ] **Provision the object-lock WORM bucket** (full 17a-4 immutability). The
  `worm-export` dual-write is built and deployed, dormant until configured, and never
  blocks the existing private archive. Steps:
  - Create an S3-compatible bucket with **Object Lock enabled** in **COMPLIANCE** mode + a
    default ~6-year retention (AWS S3, Backblaze B2, or Wasabi).
  - Create scoped, write-only credentials.
  - Set these Supabase Edge Function secrets: `WORM_S3_BUCKET`, `WORM_S3_KEY_ID`,
    `WORM_S3_SECRET`, `WORM_S3_REGION` (default `us-east-1`), `WORM_S3_ENDPOINT` (non-AWS
    only), `WORM_S3_RETAIN_DAYS` (default 2192 ≈ 6y), `WORM_S3_RETAIN_MODE` (default
    `COMPLIANCE`).
  - The next nightly run writes locked copies, no redeploy. *(Until then the security page
    honestly shows object-lock as "In progress".)*
- [ ] **Stand up an uptime monitor** (UptimeRobot / Cloudflare) pinging the `health` edge
  function + the app URL, alerting to your email. A public status page on top of it also
  satisfies the SOC 2 **Availability** control, so it does double duty with the trust track.

## 8. Optional / as-needed

- [ ] *(Optional)* Drop a **scrubbed CRM export** (Wealthbox / Redtail / Orion CSV) into
  `docs/samples/` so I build the import mappers against real data shapes.
- [ ] Finish the **GSC search-digest** setup: add the service account to the Search Console
  property + set the `GSC_SA_KEY` repo secret.
- [ ] **Delete the orphan `clever-endpoint` edge function** (prod audit 2026-06-22). It's
  an ACTIVE function sourced from `log-error.ts`: the original `log-error` deploy under
  Supabase's auto-generated name, left behind on redeploy. A harmless duplicate, not in the
  repo or `deploy.yml`. Remove it from the Supabase dashboard (Edge Functions) to keep
  live = repo. Cosmetic only.

---

*When a section empties, delete its heading. When the whole queue is gone, the ROADMAP
remains.*

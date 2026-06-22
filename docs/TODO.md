# Prism | Working TODO (live, item-deletable)

> **The working board, not the historical record.** Delete an item the moment it's
> done - [`ROADMAP.md`](ROADMAP.md) holds the forward vision and [`sprint-log.md`](sprint-log.md)
> the shipped history. If it's done here, it should *leave* here.
>
> Two sections: **🤖 Claude's queue** (I can do end-to-end in the repo) and **🧑 Your
> queue** (money, credentials, external accounts, legal, host/dashboard settings I
> can't reach).
>
> Baseline reset 2026-06-08. The gated edge deploy is done, and Realtime-RLS + the
> `CRON_SECRET` Vault entry are verified. **Prod audit 2026-06-22:** all repo migrations
> `001-044` are applied (verified by object existence - the ledger is intentionally
> unmanaged, so `list_migrations` is empty by design), and all 17 repo edge functions are
> ACTIVE - the repo and the live project are in sync.

---

# 🤖 Claude's queue

Sequenced to the north star - onboard a first paying advisor. Each item is
independently shippable; full descriptions in [`ROADMAP.md`](ROADMAP.md).

- [ ] **Advisor MFA (TOTP)** - enforce in the advisor auth path. *↔ may need a
  Supabase Auth toggle (your queue).*
- [ ] **Zapier / public API.**

### Round-23 follow-on build items (the meeting tracks all shipped; these are the nexts)
- [ ] **Quik! adapter** - implement `PAPERWORK_ADAPTERS.quik.submit(payload)` the
  moment the business blanks (your queue) exist; the payload already emits
  Execute-shaped `quik.formFields` ([quik-field-taxonomy.md](quik-field-taxonomy.md)),
  so the adapter is an edge fn: POST /qfe/execute/pdf + SSN release server-side,
  then route signatures through the existing DocuSign flow (Self Service model).
  **UX design locked (2026-06-12, founder-approved):** advisors pick an ACTION
  package, not a form - `PAPERWORK_PACKAGES` in paperwork.jsx is the contract
  (open account / ACAT in / beneficiaries / ACH), with form search as the
  long-tail fallback. Build the picker (multi-select, Create, PDF preview,
  DocuSign routing, vault + doc-gate close) only when UAT credentials land,
  against real `GET /forms/search` results - resolve package slots to Form IDs
  then. Missing fields are not blockers: Quik! fields can stay editable per
  recipient inside DocuSign, so the client completes their own fields in the
  envelope. Later wedge: the planning session suggests the package (phase
  milestones / goals → preselected paperwork). **Adapter tiers (2026-06-12):**
  Quik! = Tier 1 (start now, long-tail fallback forever); custodian-direct
  SSO + prefill (Schwab digital onboarding / Wealthscape Integration Xchange)
  = Tier 2, stubs + blanks lists in `PAPERWORK_ADAPTERS`, gated on the design
  partner's custody relationship (their custodian goes first); headless
  onboarding APIs = Tier 3 at scale. Full rationale in ROADMAP item 6.
- [ ] **More guides** - the pipeline (docs/guides → Help drawer + printable page) is one
  markdown file per guide. *(Shipped: advisor onboarding [round 23], client portal guide
  [round 26d], firm-admin guide [sprint 27a]. Next candidates: per-surface walkthrough
  clips, or a compliance/exam-prep guide if a partner asks.)*
- [ ] **Stripe webhook retry-storm hardening** (C0) - `stripe-webhook` returns HTTP
  400 for any exception → Stripe retries ~3 days even for unrecoverable cases. Return
  200 for permanent/unprocessable, 4xx/5xx only for retryable. *↔ money-adjacent;
  deferred by decision - needs the gated `stripe-webhook` edge redeploy with your go.
  Repo intentionally left in sync with what's deployed.*
### Round-26 clean-room GTM review follow-ons (2026-06-21)
- [ ] **Replace the founder band with a real testimonial** the moment a design partner
  hits a "this is genuinely useful" moment (kit: ask then, not before). The "Built in the
  open" founder band is the honest placeholder until then.
- [ ] **Client-voice copy - phase 3 (optional)** - phase descriptions + rationales
  (round 26b) and the `tasks[].label` milestone text (round 26d) are now client-voiced,
  substance and numbers kept. The remaining advisor-register copy lives in the
  planning-tool surfaces (`calculators.jsx`); soften only if a partner flags it.

*Shipped 2026-06-22 and removed from this board (sprint 27c, no migration / no secrets /
no money): **CX playbook phase 3** - the firm-admin "CX quality" section (on-script % per
advisor), closing the round-23 CX-playbook track. On-script % is derived honestly from
CADENCE (`clients.last_meeting_at`, the one playbook promise with a digital footprint):
per-advisor adherence table + a playbook-coverage strip (book-by-phase vs. which phases the
firm has scripted). Reads the existing firm-admin `clients` RLS path - no new migration/method.*

*Shipped 2026-06-22 and removed from this board (round 26d, no migration / no secrets /
no money): the **KYC paperwork-details nudge is now dismissible** (keyed to the
missing-set signature, so it returns on its own if the gaps change - the "stuck at 17/18
forever" seam, last open item from the round-25 CX review); the **`tasks[].label`
milestone text is client-voiced** across all seven phases (the round-26b prose pass
finished into the checklist); and a **client portal guide** ships through the existing
guides pipeline (`docs/guides/client-portal-guide.md`). Also confirmed already-live and
removed from ROADMAP: the **custodian-grouped portal accounts view** shipped round 15
(PR #60) - the queue entry was stale.*

*Shipped 2026-06-21 and removed from this board: (26b) the client-voice copy pass on phase
descriptions + rationales, and "instrument the wedge" (`portal_opened` event); (26c) the
**non-linear roadmap** - the phase lock is gone, phases past the working horizon render
"Ahead" (explorable, not gated), and the advisor's existing `current_phase` extends the
in-play range (the near-retiree fix). No schema change; future multi-focus / relevance-hint
options deferred to a partner ask (see ROADMAP). Migrations 040-043 verified live in prod
(px_events/px_track/push_subscriptions/RLS indexes all present); the full migration +
go-live human queue was reconciled against prod in the 2026-06-22 audit (see below).*

*Partner-gated depth (holdings aggregation, object-lock WORM, module refactor) lives in
ROADMAP and is built only when a partner asks - not queued here.*

---

# 🧑 Your queue

Things I genuinely can't do - they cost money, need your identity/credentials, or live
in dashboards I can't reach. **Bold = the hard blockers gating any live client.**
Project ref: `phabxcijbbphfxvjedfj` · Domain: `prismaw.com`.

### Round-12/13 go-live setup - VERIFIED APPLIED 2026-06-22 (prod audit)
- [x] ~~**Apply migrations 035 → 044**~~ *(all verified present in prod 2026-06-22:
  035/036 ledger+platform, **037** status-guard fix (guard reads `request.jwt.claims`,
  not `auth.role()`), **038** `advisors.address_style` + `px_my_advisor` RPC, 039
  security_invoker view, 040-043 px_events/px_track/push_subscriptions/RLS indexes, 044
  `client_identifiers`. The earlier "apply 037+038 in the SQL editor" item was stale -
  they were applied back at go-live, the checkbox just never got ticked.)*
- [x] ~~**Give yourself the firm-admin role**~~ *(appears done - an `admin`-role advisor
  exists in prod. Confirm it's your primary account; the Platform tab's Advisors roster
  flips roles without SQL from here.)*
- [x] ~~**Seed yourself as platform owner**~~ *(appears done - `px_platform_owners` has a
  row in prod, so the Platform tab resolves. Confirm the seeded uid is the account you
  actually sign in with.)*
- [ ] **Enable leaked-password protection** - Supabase → Authentication → password
  settings (HaveIBeenPwned check; Pro-plan feature, pairs with the Pro upgrade below).
  Confirmed still disabled in the 2026-06-22 Security Advisor; it's the one Auth-side
  toggle left. *(The advisor also flags several `SECURITY DEFINER` RPCs + `pg_net` in
  public as WARN - those are by design: the RLS helper functions and client-facing RPCs
  must be SECURITY DEFINER, reviewed in the clean-room passes. No action.)*

### Finish Microsoft calendar setup - one Azure click left
- [ ] In the Azure app registration, add the redirect URI
  `https://prismaw.com/oauth/microsoft/callback` (Web platform) - the Microsoft
  twin of the Google one you already registered. *(Creds are in: the Azure
  client/tenant/secret are set as repo secrets and synced to Supabase as of
  2026-06-10 - both providers are otherwise live-ready.)*

### Infrastructure to production grade - **the #1 hard blocker**
- [ ] **Upgrade Supabase to Pro + enable PITR / daily backups.** Free tier auto-pauses
  after 7 days idle and has no backups/connection headroom. Non-negotiable before live
  client data. *(Supabase service-role key, access token, and `CRON_SECRET` already
  rotated - verify the new `CRON_SECRET` is in Vault, see deploy block step 5.)*
- [ ] **Rotate the remaining secrets** before any live data: Stripe
  (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, and decide live vs test
  `STRIPE_PRICE_GROWTH`) and Plaid (`PLAID_CLIENT_ID` / `PLAID_SECRET`, set
  `PLAID_ENV`). Set new values in **Supabase → Edge Functions → Secrets** *and* GitHub
  Actions secrets.
- [ ] **Decide live vs test keys** for Stripe and Plaid (whether real money/aggregation
  flows for design partners). Say the word and I'll flip the env config.

### Stripe go-live - when a partner is ready to pay
- [ ] Switch Stripe to live mode; create the live **Growth** price → `STRIPE_PRICE_GROWTH`.
- [ ] Register the live webhook → `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook`
  for `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`; set `STRIPE_WEBHOOK_SECRET`.
- [ ] Redeploy `create-checkout-session` + `stripe-webhook` (--no-verify-jwt).
- [ ] Reflect the household-tier pricing (Solo ≤25 / Growth ≤150 / Enterprise
  unlimited) in the live Stripe products.
- [ ] Smoke test: test card `4242 4242 4242 4242` → plan flips to "Growth · active",
  webhook delivery returns 200. Repeat once on live mode with a real card, then refund.

### Auth & domains - verify before live
- [ ] Supabase Auth → **Site URL** = `https://prismaw.com`; redirect allow-list
  includes `prismaw.com/**` (+ www). Google provider enabled with the production
  redirect URI registered in Google Cloud.

### Monitoring
- [ ] **Stand up an uptime monitor** (UptimeRobot / Cloudflare) pinging the `health`
  edge function + the app URL, alerting to your email.

### External credentials that unblock my feature work
Each drops into Supabase Edge Function secrets (or tell me the channel) and I build
against it:
- [ ] *(Optional)* a **scrubbed CRM export** (Wealthbox/Redtail/Orion CSV) in
  `docs/samples/` so the import mappers are built against reality.
- [ ] **DocuSign production promotion** - only when going live with real signatures:
  promote the DocuSign account to production + go-live the integration key, swap
  `DOCUSIGN_OAUTH_BASE` → `account.docusign.com`, update `DOCUSIGN_REST_BASE`,
  recreate the Connect webhook + HMAC. Sequence with the live-keys decision. Runbook:
  [`docusign-setup.md`](docusign-setup.md).
- [ ] *(If MFA is built)* toggle TOTP factor support in Supabase → Authentication →
  Providers.

### One live smoke pass - demo can't reach these
- [ ] In a real session: sign up → provision firm → add a client → request + e-sign an
  acknowledgement → **admin**: create/assign a fee schedule → run billing → approve an
  invoice → check the audit trail. Repeat the advisor + client steps once on your phone
  (desktop + mobile, light + dark).

### Distribution & GTM - the actual growth work
- [ ] **Build a ~50-row prospect tracker**, weighted toward warm intros.
- [ ] **Recruit 3–5 design-partner RIAs** - warm network first, then XYPN / NAPFA /
  Kitces / advisor LinkedIn / r/CFP. Free white-glove onboarding for feedback +
  testimonial + logo. *(Playbook: [`design-partner-kit.md`](design-partner-kit.md),
  [`first-outreach-plan.md`](first-outreach-plan.md).)*
- [ ] **Stand up the founder content channel** (LinkedIn + newsletter). I can draft;
  you own the account, voice, and publish. *(Drafts: [`founder-content-starter.md`](founder-content-starter.md).)*
- [ ] **Bust LinkedIn's share-preview cache** - run `https://prismaw.com` through
  the [Post Inspector](https://www.linkedin.com/post-inspector/) so new shares
  pick up the round-17 clean title ("Prism | The Advisor Workspace") and the
  round-16 OG image. Note: the already-published launch post keeps its old
  snapshot; delete + re-share it if you want the new branding there.

### Round-23 setup - DONE 2026-06-12 (Claude-applied with your authorization)
- [x] ~~Migration 044~~ applied via the Management API and verified (RLS on,
  zero policies, zero anon/authenticated grants - service-role only).
- [ ] **Save the `IDENTIFIER_ENC_KEY`** Claude generated into your password
  manager - it was printed once in the 2026-06-12 chat session. Losing it
  orphans stored SSN values (re-enterable, never recoverable). *This is the
  only piece left for a human.*
- [x] ~~Gated edge deploy~~ run 27424899440 green; `client-identifiers` ACTIVE.
  The SSN rows in the Numbers panel and the Paperwork modal's gated fields are
  LIVE for real clients now.

*Operating-model change (2026-06-12, your call): repo migrations are now
Claude-applied to prod via the Management API after PR merge - the PR is the
approval gate. `db push` stays forbidden (unmanaged ledger).*

### Round-23 business blanks - unlocks the Quik!/custodian adapter (POC is in-product: quick view → Paperwork)
*Taxonomy research done 2026-06-12 from public docs ([quik-field-taxonomy.md](quik-field-taxonomy.md)):
naming convention + role list mapped, payload now exports Execute-shaped FormFields,
e-sign Self Service model validated for our DocuSign flow. The blanks below still gate the live adapter.*
- [ ] **Quik! Forms API relationship** - sales@quikforms.com / quikforms.com:
  customer id + API key (ask for UAT access first), and the per-form field
  dictionaries (GET /forms/fields) to confirm the names flagged unverified.
- [ ] **Custodian routing ids** - the firm's Schwab G-number (master account)
  and/or Fidelity firm id, from your (or a design partner's) custody relationship.
- [ ] **Pick the first form set** - e.g. Schwab Individual/Joint/IRA new-account;
  tell me and I map the field dictionaries.
- [ ] **E-sign routing decision** - Quik!'s built-in e-sign vs. Prism's existing
  DocuSign envelope flow (I recommend our DocuSign flow: one audit trail).

### Optional / as-needed
- [ ] Finish the **GSC search-digest** setup (add the service account to the Search
  Console property + `GSC_SA_KEY` repo secret).
- [ ] **Delete the orphan `clever-endpoint` edge function** (prod audit 2026-06-22):
  an ACTIVE function sourced from `log-error.ts` - the original `log-error` deploy under
  Supabase's auto-generated name, left behind when it was redeployed as `log-error`.
  Harmless duplicate, not in the repo or `deploy.yml`. Remove from the Supabase dashboard
  (Edge Functions) to keep live = repo. Cosmetic only.

---

*When a section empties, delete its heading. When the whole queue is gone, the
ROADMAP remains.*

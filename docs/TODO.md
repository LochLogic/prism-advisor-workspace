# Prism | Working TODO (live, item-deletable)

> **The working board, not the historical record.** Delete an item the moment it's
> done - [`ROADMAP.md`](ROADMAP.md) holds the forward vision and [`sprint-log.md`](sprint-log.md)
> the shipped history. If it's done here, it should *leave* here.
>
> Two sections: **🤖 Claude's queue** (I can do end-to-end in the repo) and **🧑 Your
> queue** (money, credentials, external accounts, legal, host/dashboard settings I
> can't reach).
>
> Baseline reset 2026-06-08. All migrations through `034` are applied, the gated edge
> deploy is done, and Realtime-RLS + the `CRON_SECRET` Vault entry are verified - the
> repo and the live project are in sync.

---

# 🤖 Claude's queue

Sequenced to the north star - onboard a first paying advisor. Each item is
independently shippable; full descriptions in [`ROADMAP.md`](ROADMAP.md).

- [ ] **Advisor MFA (TOTP)** - enforce in the advisor auth path. *↔ may need a
  Supabase Auth toggle (your queue).*
- [ ] **Zapier / public API.**

### Round-23 follow-on build items (the meeting tracks all shipped; these are the nexts)
- [ ] **CX playbook phase 2** - firm-admin authoring of the per-phase playbook
  (`firm_playbooks` table, deep-merged over the data.jsx defaults; framework
  comment in data.jsx documents the contract). Phase 3 = quality view.
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
- [ ] **More guides** - portal guide for clients, firm-admin guide; the pipeline
  (docs/guides → Help drawer + printable page) is one markdown file per guide.
- [ ] **KYC nudge dismissibility** (round-25 CX review, last remaining seam):
  make the portal "Account paperwork details" card dismissible (or threshold
  it) - a household stuck at 17/18 over one field sees it forever. The other
  two seams (paperwork-modal click-through, drawer auto-expand/scroll) shipped
  round 25b along with the wide drawer + section jump nav.
- [ ] **Stripe webhook retry-storm hardening** (C0) - `stripe-webhook` returns HTTP
  400 for any exception → Stripe retries ~3 days even for unrecoverable cases. Return
  200 for permanent/unprocessable, 4xx/5xx only for retryable. *↔ money-adjacent;
  deferred by decision - needs the gated `stripe-webhook` edge redeploy with your go.
  Repo intentionally left in sync with what's deployed.*
### Round-26 clean-room GTM review follow-ons (2026-06-21)
- [ ] **Replace the founder band with a real testimonial** the moment a design partner
  hits a "this is genuinely useful" moment (kit: ask then, not before). The "Built in the
  open" founder band is the honest placeholder until then.
- [ ] **Client-voice copy - phase 2 (optional)** - the descriptions + rationales were
  warmed 2026-06-21 (round 26b). The remaining jargon lives in `tasks[].label` milestone
  text ("Open laddered HYSA / Treasury MMF, 4-tier", "Execute backdoor Roth if above
  phase-out") and the planning-tool copy; soften the client-visible task labels next if a
  partner flags them.

*Shipped 2026-06-21 and removed from this board: (26b) the client-voice copy pass on phase
descriptions + rationales, and "instrument the wedge" (`portal_opened` event); (26c) the
**non-linear roadmap** - the phase lock is gone, phases past the working horizon render
"Ahead" (explorable, not gated), and the advisor's existing `current_phase` extends the
in-play range (the near-retiree fix). No schema change; future multi-focus / relevance-hint
options deferred to a partner ask (see ROADMAP). Migrations 040-043 verified live in prod
(px_events/px_track/push_subscriptions/RLS indexes all present) - the round-13 "apply
040-043" human item below is stale.*

*Partner-gated depth (holdings aggregation, object-lock WORM, module refactor) lives in
ROADMAP and is built only when a partner asks - not queued here.*

---

# 🧑 Your queue

Things I genuinely can't do - they cost money, need your identity/credentials, or live
in dashboards I can't reach. **Bold = the hard blockers gating any live client.**
Project ref: `phabxcijbbphfxvjedfj` · Domain: `prismaw.com`.

### Round-13 - SQL-editor pastes + one Auth toggle (code is LIVE 2026-06-10)
- [x] ~~**Apply migrations 040 → 041 → 042 → 043**~~ *(verified live in prod 2026-06-21:
  `px_events` + `px_track`, `push_subscriptions`, and the RLS-predicate indexes all
  present. The `portal_opened` analytics event ships against them.)*
- [ ] **Enable leaked-password protection** - Supabase → Authentication → password
  settings (HaveIBeenPwned check; Pro-plan feature, pairs with the Pro upgrade below).
  Clears the last actionable Security Advisor warning.

### Round-12 go-live - SQL-editor pastes (shipped 2026-06-10, code is LIVE)
- [x] ~~Apply migrations 035 + 036~~ *(done 2026-06-10)*
- [ ] **Apply migrations 037 + 038** in the Supabase SQL editor, in order:
  [`037_firm_status_guard_fix.sql`](../supabase/migrations/037_firm_status_guard_fix.sql)  - 
  fixes the 035 status-guard trigger that broke every `firms` update from the
  browser (your "save branding stopped working" report); branding saves, the
  firm-rename field, and the Workflow toggle all start working.
  [`038_advisor_address_style.sql`](../supabase/migrations/038_advisor_address_style.sql)  - 
  adds `advisors.address_style` (how clients address you: first / last /
  honorific+last) and the `px_my_advisor` RPC so real client sessions see their
  actual advisor's name in the portal (they previously fell back to the demo
  advisor - latent bug, fixed in round 12d).
- [ ] **Give yourself the firm-admin role** - your early advisor row is role
  `advisor`. Easiest now: one SQL line  - 
  `update advisors set role = 'admin' where email = '<your email>';`
  (then reload). From then on the Platform tab's per-firm **Advisors** roster
  has Make firm admin / Make advisor buttons, so role changes never need SQL again.
- [ ] **Seed yourself as platform owner** (one row; the auth uid is in
  Supabase → Authentication → Users):
  `insert into px_platform_owners (auth_user_id, email) values ('<auth-uid>', '<email>');`
  Then the **Platform** tab appears in that account's advisor topbar (or deep-link `#/platform`).
  *Which account:* the allowlist row is a **copy** (a reference to the auth user - the
  account itself isn't moved or changed). The account must also hold an advisor/admin
  seat, because the Platform tab lives in the advisor app. Easiest: seed your existing
  advisor account's uid. If you'd rather keep a dedicated founder identity with the
  unused email: sign up with it, complete the "name your firm" step (gives it a
  sandbox firm + admin seat), then copy THAT account's uid into the insert.

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
- [ ] **Create the Prism company LinkedIn page** - everything you need is in
  [`marketing/linkedin-launch-kit.md`](marketing/linkedin-launch-kit.md): logo +
  banner PNGs (same folder), page-setup fields, the About description, and the
  first-ever post draft. Attach product screenshots to the post and reshare from
  your personal profile. *Round-16 assets: banner = the LinkedIn-specific
  `branding/prism-banner-linkedin-2256.png` (no mark - LinkedIn overlays the page
  logo there; wordmark pre-shifted right); logo = `branding/prism-logo-400.png`.
  Masters + generators (`make-*.mjs`, SVGs) live in `branding/`.*
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

---

*When a section empties, delete its heading. When the whole queue is gone, the
ROADMAP remains.*

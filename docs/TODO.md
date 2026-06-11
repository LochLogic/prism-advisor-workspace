# Prism — Working TODO (live, item-deletable)

> **The working board, not the historical record.** Delete an item the moment it's
> done — [`ROADMAP.md`](ROADMAP.md) holds the forward vision and [`sprint-log.md`](sprint-log.md)
> the shipped history. If it's done here, it should *leave* here.
>
> Two sections: **🤖 Claude's queue** (I can do end-to-end in the repo) and **🧑 Your
> queue** (money, credentials, external accounts, legal, host/dashboard settings I
> can't reach).
>
> Baseline reset 2026-06-08. All migrations through `034` are applied, the gated edge
> deploy is done, and Realtime-RLS + the `CRON_SECRET` Vault entry are verified — the
> repo and the live project are in sync.

---

# 🤖 Claude's queue

Sequenced to the north star — onboard a first paying advisor. Each item is
independently shippable; full descriptions in [`ROADMAP.md`](ROADMAP.md).

- [ ] **Advisor MFA (TOTP)** — enforce in the advisor auth path. *↔ may need a
  Supabase Auth toggle (your queue).*
- [ ] **Zapier / public API.**
- [ ] **Stripe webhook retry-storm hardening** (C0) — `stripe-webhook` returns HTTP
  400 for any exception → Stripe retries ~3 days even for unrecoverable cases. Return
  200 for permanent/unprocessable, 4xx/5xx only for retryable. *↔ money-adjacent;
  deferred by decision — needs the gated `stripe-webhook` edge redeploy with your go.
  Repo intentionally left in sync with what's deployed.*
*Partner-gated depth (holdings aggregation, object-lock WORM, module refactor) lives in
ROADMAP and is built only when a partner asks — not queued here.*

---

# 🧑 Your queue

Things I genuinely can't do — they cost money, need your identity/credentials, or live
in dashboards I can't reach. **Bold = the hard blockers gating any live client.**
Project ref: `phabxcijbbphfxvjedfj` · Domain: `prismaw.com`.

### Round-13 — SQL-editor pastes + one Auth toggle (code is LIVE 2026-06-10)
- [ ] **Apply migrations 040 → 041 → 042 → 043** in the Supabase SQL editor, in order
  (039 you already ran live on 2026-06-10 — the file is committed for the record):
  [`040_security_advisor_hardening.sql`](../supabase/migrations/040_security_advisor_hardening.sql) —
  search_path pins + anon-EXECUTE revokes (the Security Advisor warning sweep);
  [`041_product_events.sql`](../supabase/migrations/041_product_events.sql) —
  `px_events` + `px_track` (analytics writes silently no-op until applied);
  [`042_push_subscriptions.sql`](../supabase/migrations/042_push_subscriptions.sql) —
  push subscription storage (portal push starts working the moment this lands);
  [`043_rls_index_coverage.sql`](../supabase/migrations/043_rls_index_coverage.sql) —
  RLS-predicate index gap-fill.
- [ ] **Enable leaked-password protection** — Supabase → Authentication → password
  settings (HaveIBeenPwned check; Pro-plan feature, pairs with the Pro upgrade below).
  Clears the last actionable Security Advisor warning.

### Round-12 go-live — SQL-editor pastes (shipped 2026-06-10, code is LIVE)
- [x] ~~Apply migrations 035 + 036~~ *(done 2026-06-10)*
- [ ] **Apply migrations 037 + 038** in the Supabase SQL editor, in order:
  [`037_firm_status_guard_fix.sql`](../supabase/migrations/037_firm_status_guard_fix.sql) —
  fixes the 035 status-guard trigger that broke every `firms` update from the
  browser (your "save branding stopped working" report); branding saves, the
  firm-rename field, and the Workflow toggle all start working.
  [`038_advisor_address_style.sql`](../supabase/migrations/038_advisor_address_style.sql) —
  adds `advisors.address_style` (how clients address you: first / last /
  honorific+last) and the `px_my_advisor` RPC so real client sessions see their
  actual advisor's name in the portal (they previously fell back to the demo
  advisor — latent bug, fixed in round 12d).
- [ ] **Give yourself the firm-admin role** — your early advisor row is role
  `advisor`. Easiest now: one SQL line —
  `update advisors set role = 'admin' where email = '<your email>';`
  (then reload). From then on the Platform tab's per-firm **Advisors** roster
  has Make firm admin / Make advisor buttons, so role changes never need SQL again.
- [ ] **Seed yourself as platform owner** (one row; the auth uid is in
  Supabase → Authentication → Users):
  `insert into px_platform_owners (auth_user_id, email) values ('<auth-uid>', '<email>');`
  Then the **Platform** tab appears in that account's advisor topbar (or deep-link `#/platform`).
  *Which account:* the allowlist row is a **copy** (a reference to the auth user — the
  account itself isn't moved or changed). The account must also hold an advisor/admin
  seat, because the Platform tab lives in the advisor app. Easiest: seed your existing
  advisor account's uid. If you'd rather keep a dedicated founder identity with the
  unused email: sign up with it, complete the "name your firm" step (gives it a
  sandbox firm + admin seat), then copy THAT account's uid into the insert.

### Finish Microsoft calendar setup — one Azure click left
- [ ] In the Azure app registration, add the redirect URI
  `https://prismaw.com/oauth/microsoft/callback` (Web platform) — the Microsoft
  twin of the Google one you already registered. *(Creds are in: the Azure
  client/tenant/secret are set as repo secrets and synced to Supabase as of
  2026-06-10 — both providers are otherwise live-ready.)*

### Infrastructure to production grade — **the #1 hard blocker**
- [ ] **Upgrade Supabase to Pro + enable PITR / daily backups.** Free tier auto-pauses
  after 7 days idle and has no backups/connection headroom. Non-negotiable before live
  client data. *(Supabase service-role key, access token, and `CRON_SECRET` already
  rotated — verify the new `CRON_SECRET` is in Vault, see deploy block step 5.)*
- [ ] **Rotate the remaining secrets** before any live data: Stripe
  (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, and decide live vs test
  `STRIPE_PRICE_GROWTH`) and Plaid (`PLAID_CLIENT_ID` / `PLAID_SECRET`, set
  `PLAID_ENV`). Set new values in **Supabase → Edge Functions → Secrets** *and* GitHub
  Actions secrets.
- [ ] **Decide live vs test keys** for Stripe and Plaid (whether real money/aggregation
  flows for design partners). Say the word and I'll flip the env config.

### Stripe go-live — when a partner is ready to pay
- [ ] Switch Stripe to live mode; create the live **Growth** price → `STRIPE_PRICE_GROWTH`.
- [ ] Register the live webhook → `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook`
  for `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`; set `STRIPE_WEBHOOK_SECRET`.
- [ ] Redeploy `create-checkout-session` + `stripe-webhook` (--no-verify-jwt).
- [ ] Reflect the household-tier pricing (Solo ≤25 / Growth ≤150 / Enterprise
  unlimited) in the live Stripe products.
- [ ] Smoke test: test card `4242 4242 4242 4242` → plan flips to "Growth · active",
  webhook delivery returns 200. Repeat once on live mode with a real card, then refund.

### Auth & domains — verify before live
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
- [ ] **DocuSign production promotion** — only when going live with real signatures:
  promote the DocuSign account to production + go-live the integration key, swap
  `DOCUSIGN_OAUTH_BASE` → `account.docusign.com`, update `DOCUSIGN_REST_BASE`,
  recreate the Connect webhook + HMAC. Sequence with the live-keys decision. Runbook:
  [`docusign-setup.md`](docusign-setup.md).
- [ ] *(If MFA is built)* toggle TOTP factor support in Supabase → Authentication →
  Providers.

### One live smoke pass — demo can't reach these
- [ ] In a real session: sign up → provision firm → add a client → request + e-sign an
  acknowledgement → **admin**: create/assign a fee schedule → run billing → approve an
  invoice → check the audit trail. Repeat the advisor + client steps once on your phone
  (desktop + mobile, light + dark).

### Distribution & GTM — the actual growth work
- [ ] **Build a ~50-row prospect tracker**, weighted toward warm intros.
- [ ] **Recruit 3–5 design-partner RIAs** — warm network first, then XYPN / NAPFA /
  Kitces / advisor LinkedIn / r/CFP. Free white-glove onboarding for feedback +
  testimonial + logo. *(Playbook: [`design-partner-kit.md`](design-partner-kit.md),
  [`first-outreach-plan.md`](first-outreach-plan.md).)*
- [ ] **Stand up the founder content channel** (LinkedIn + newsletter). I can draft;
  you own the account, voice, and publish. *(Drafts: [`founder-content-starter.md`](founder-content-starter.md).)*
- [ ] **Create the Prism company LinkedIn page** — everything you need is in
  [`marketing/linkedin-launch-kit.md`](marketing/linkedin-launch-kit.md): logo +
  banner PNGs (same folder), page-setup fields, the About description, and the
  first-ever post draft. Attach product screenshots to the post and reshare from
  your personal profile.

### Optional / as-needed
- [ ] Finish the **GSC search-digest** setup (add the service account to the Search
  Console property + `GSC_SA_KEY` repo secret).

---

*When a section empties, delete its heading. When the whole queue is gone, the
ROADMAP remains.*

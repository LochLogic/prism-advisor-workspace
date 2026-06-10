# Prism — Working TODO (live, item-deletable)

> **The working board, not the historical record.** Delete an item the moment it's
> done — [`ROADMAP.md`](ROADMAP.md) holds the forward vision and [`sprint-log.md`](sprint-log.md)
> the shipped history. If it's done here, it should *leave* here.
>
> Two sections: **🤖 Claude's queue** (I can do end-to-end in the repo) and **🧑 Your
> queue** (money, credentials, external accounts, legal, host/dashboard settings I
> can't reach).
>
> Baseline reset 2026-06-08. All migrations through `032` are applied, the gated edge
> deploy is done, and Realtime-RLS + the `CRON_SECRET` Vault entry are verified — the
> repo and the live project are in sync except migrations `033`/`034` (below).

---

# 🤖 Claude's queue

Sequenced to the north star — onboard a first paying advisor. Each item is
independently shippable; full descriptions in [`ROADMAP.md`](ROADMAP.md).

- [ ] **Advisor MFA (TOTP)** — enforce in the advisor auth path. *↔ may need a
  Supabase Auth toggle (your queue).*
- [ ] **Product analytics events** — first-party activation events (login, invite,
  message, plan-update, report) into a small events table.
- [ ] **RLS-predicate index coverage audit** (`advisor_id`/`firm_id`/`client_id`,
  esp. the firm-admin cross-firm read).
- [ ] **Client PWA + push** — installable portal + push on new message/task/document.
  *↔ blocked-by-you: VAPID keypair.*
- [ ] **Advisor-approval commit gate for client ledger edits** — opt-in draft → review
  → approve flow (pending changeset; per-firm toggle, default OFF). Schema-touching;
  lean on `007_versioning_crm`.
- [ ] **Zapier / public API.**
- [ ] **Stripe webhook retry-storm hardening** (C0) — `stripe-webhook` returns HTTP
  400 for any exception → Stripe retries ~3 days even for unrecoverable cases. Return
  200 for permanent/unprocessable, 4xx/5xx only for retryable. *↔ money-adjacent;
  deferred by decision — needs the gated `stripe-webhook` edge redeploy with your go.
  Repo intentionally left in sync with what's deployed.*
- [ ] **Insight → action hooks** (2026-06-09 advisor-POV review, top finding) — the
  planning tools diagnose but mostly dead-end: only the SS claiming optimizer writes
  back to the plan. Add a lightweight "Add to agenda / create task" affordance to the
  high-verdict tools (coverage gap, Roth window, debt-vs-invest, 1040 observations)
  so a tool finding becomes a tracked next step the advisor owns.
- [ ] **Advisor-facing 1040 flags** (advisor-POV review; extends the round-7 tax
  feature) — surface the top `tax1040Insights` observations in the client quick-view
  and as QBR plan flags, so the advisor sees what the client's roadmap tool shows.
- [ ] **Portal fee transparency** (advisor-POV review, small) — approved/paid
  invoices never surface client-side. Show them in the client portal (vault or a
  small billing card) — a fiduciary trust signal.
- [ ] **UX backlog** (optional) — roster swipe actions; housing ratio coaching + field
  hints (FinFire donors).

*Partner-gated depth (holdings aggregation, object-lock WORM, module refactor) lives in
ROADMAP and is built only when a partner asks — not queued here.*

---

# 🧑 Your queue

Things I genuinely can't do — they cost money, need your identity/credentials, or live
in dashboards I can't reach. **Bold = the hard blockers gating any live client.**
Project ref: `phabxcijbbphfxvjedfj` · Domain: `prismaw.com`.

### Apply migrations 033 + 034 — **gates calendar sync + fast bulk import**
- [ ] Run [`033_calendar_connections.sql`](../supabase/migrations/033_calendar_connections.sql)
  then [`034_bulk_create_clients.sql`](../supabase/migrations/034_bulk_create_clients.sql)
  in the Supabase SQL editor (hand-applied, the operating model). Until then both
  fail gracefully: the calendar card's connect flow errors politely, and CSV
  imports fall back to the existing per-row path.

### Finish Microsoft calendar setup — **Google is live-ready, Microsoft isn't**
- [ ] **Re-add the Azure credentials** — the Microsoft block (client ID, secret,
  tenant/directory ID) never made it into `docs/DocuSign.txt` (only Google +
  DocuSign are in the saved file). Drop them in again and say the word, or set
  GitHub repo secrets `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`,
  `MS_OAUTH_TENANT` yourself — the gated **Sync edge secrets** workflow pushes
  whatever is present to Supabase.
- [ ] In the Azure app registration, add the redirect URI
  `https://prismaw.com/oauth/microsoft/callback` (Web platform) — the Microsoft
  twin of the Google one you already registered.

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
- [ ] **VAPID keypair** (web-push) → unblocks **client PWA push**. I can generate the
  pair and hand you the split if you'd rather.
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

### Optional / as-needed
- [ ] Finish the **GSC search-digest** setup (add the service account to the Search
  Console property + `GSC_SA_KEY` repo secret).
- [ ] Pick a **product-analytics** approach (own events table vs. a thin tool).

---

*When a section empties, delete its heading. When the whole queue is gone, the
ROADMAP remains.*

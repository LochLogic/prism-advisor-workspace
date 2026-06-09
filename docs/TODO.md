# Prism — Working TODO (live, item-deletable)

> **The working board, not the historical record.** Delete an item the moment it's
> done — [`ROADMAP.md`](ROADMAP.md) holds the forward vision and [`sprint-log.md`](sprint-log.md)
> the shipped history. If it's done here, it should *leave* here.
>
> Two sections: **🤖 Claude's queue** (I can do end-to-end in the repo) and **🧑 Your
> queue** (money, credentials, external accounts, legal, host/dashboard settings I
> can't reach).
>
> Baseline reset 2026-06-08. All migrations through `031` are applied, the gated edge
> deploy is done, and Realtime-RLS + the `CRON_SECRET` Vault entry are verified — the
> repo and the live project are in sync.

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
- [ ] **Calendar integration (Google/Outlook)** — two-way sync, free/busy.
  *↔ blocked-by-you: OAuth apps.*
- [ ] **Zapier / public API.**
- [ ] **Stripe webhook retry-storm hardening** (C0) — `stripe-webhook` returns HTTP
  400 for any exception → Stripe retries ~3 days even for unrecoverable cases. Return
  200 for permanent/unprocessable, 4xx/5xx only for retryable. *↔ money-adjacent;
  deferred by decision — needs the gated `stripe-webhook` edge redeploy with your go.
  Repo intentionally left in sync with what's deployed.*
- [ ] **Bulk-import batch RPC** (last open code-quality item) — server-side batch
  insert for CSV imports over a threshold (today N sequential round-trips,
  non-transactional). Deliberately deferred 2026-06-09: needs a hand-applied
  migration (`px_bulk_create_clients`), so it ships when a migration is queued
  anyway. *(The other ten 2026-06-09 code-quality items shipped in round 7.)*
- [ ] **Insight → action hooks** (2026-06-09 advisor-POV review, top finding) — the
  planning tools diagnose but mostly dead-end: only the SS claiming optimizer writes
  back to the plan. Add a lightweight "Add to agenda / create task" affordance to the
  high-verdict tools (coverage gap, Roth window, debt-vs-invest, 1040 observations)
  so a tool finding becomes a tracked next step the advisor owns.
- [ ] **Document-request flow** (advisor-POV review) — advisors chase statements /
  trust docs constantly; the vault only takes unprompted uploads. Advisor requests a
  named document → client portal shows the ask → upload lands in the vault and
  resolves the request. Lean on the existing tasks + documents tables.
- [ ] **Advisor-facing 1040 flags** (advisor-POV review; extends the round-7 tax
  feature) — surface the top `tax1040Insights` observations in the client quick-view
  and as QBR plan flags, so the advisor sees what the client's roadmap tool shows.
- [ ] **Prospect proposal packet** (advisor-POV review) — prospect mode has no
  branded close-the-deal output. One-click print: roadmap preview, readiness snapshot,
  fee schedule, "what working together looks like." Reuses the print renderers.
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

### Apply migration 032 (white-label branding) — **gates the new Branding section**
- [ ] Run [`supabase/migrations/032_firm_branding.sql`](../supabase/migrations/032_firm_branding.sql)
  in the Supabase SQL editor (the operating model — migrations are hand-applied).
  Until then: the firm-admin Branding form saves fail gracefully (no `firms` update
  policy yet) and subdomain pre-auth branding no-ops (`px_brand_for_slug` missing).
  Everything else in the 2026-06-09 round-4 ship works without it; the `ai-assist`
  edge function deploy is independent and handled via the gated deploy workflow.

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
- [ ] **Google + Microsoft OAuth apps** → unblocks **calendar integration**. Google:
  Cloud Console → enable Calendar API → OAuth consent (External) → Web-app client →
  redirect `https://prismaw.com/oauth/google/callback`; hand me Client ID + secret.
  Microsoft (lower priority): needs a free Entra tenant first (M365 Dev Program or
  free Azure) → App registration (multi-tenant) → `Calendars.ReadWrite` +
  `offline_access`; hand me app/client/tenant ids + secret. Scopes are read/write
  calendar + offline only.
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

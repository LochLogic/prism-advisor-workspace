# Prism — Working TODO (live, item-deletable)

> **This is the working board, not the historical record.** Delete an item the moment
> it's done — the [ROADMAP](ROADMAP.md) and [clean-room review](clean-room-review-2026-06-06.md)
> keep the permanent history. If it's checked off here, it should *leave* here.
>
> Two queues: **🤖 Claude** (I can do end-to-end in the repo) and **🧑 You** (needs a
> human — money, credentials, external accounts, legal, repo/host settings I can't reach).
> Items that cross queues are tagged `↔ blocked-by-you` / `↔ unblocks-Claude` so we don't deadlock.
>
> Last sorted: 2026-06-07.

---

## ✅ Just shipped — verify, then delete this block
Sprint **C3 — Prospect / proposal mode** (see [sprint-log](sprint-log.md)). Build + lint + check + calc + e2e (3/3) green; verified in a browser (new prospect → roadmap shows seeded numbers + auto horizon progress; banner Convert/Discard; convert gated in demo with a toast; roster PROSPECT badge; discard cleans up; no console errors). **Static-only — no migration, no secrets, no deploy gating.**
- **Prospect / proposal mode — ✅** — `ProspectProvider` (`src/store.jsx`, mounted in `app.jsx`) manages unsaved `prospect-<ts>` households entirely on the existing non-UUID client machinery (profile + horizon progress in `localStorage`, namespaced `px_prospects:<advisorId|demo>`). `NewProspectModal` (`advisor-modal.jsx`) with a "Use sample numbers" fill; roster **New prospect** button + gold PROSPECT badge (prospects excluded from book KPIs); advisor-only proposal banner in `client-portal.jsx` with **Convert to client** (live-only: `createClient`+`saveProfile`+replay milestones, then splices into the live roster) and **Discard**.

---

# 🤖 Claude's queue

Sequenced to the roadmap's goal — *onboard a first paying advisor* — pre-live hardening first, then the adoption unlocks that turn a demo into a "yes," then depth and polish. Each sprint is independently shippable.

### C0 — Code-review fixes (2026-06-07) — **FIRST IN LINE, ahead of C3+**
From the full architecture+granular code review (2026-06-07). **Batches 1 & 2 shipped** (PRs #24, #25): alert-priority, Monte-Carlo memo, dead-code, demo-flows memo, post-checkout redirect, save-on-switch flush, book-wide KPI totals. **Batch 3 shipped** (fee/label dedup → `_shared/fees.ts` + single `AUDIT_ACTION_LABELS`, RNG note, fuller `ProfileProvider` memoization). See [sprint-log](sprint-log.md). Only this remains:

- [ ] **Stripe webhook retries on permanent errors.** `stripe-webhook/index.ts:76-78` returns HTTP 400 for *any* exception → Stripe retries ~3 days even for unrecoverable cases (e.g. unknown firm). Return 200 for permanent/unprocessable, 4xx/5xx only for retryable; log a `checkout.session.completed` with no resolvable `firmId`. *↔ money-adjacent — **deferred 2026-06-07 by decision**; needs the gated `stripe-webhook` edge redeploy (H4) with a human go. Repo is intentionally left in sync with what's deployed.*

### C3 — Adoption unlocks (Tier A — without these, RIAs won't move)
- [ ] **White-label branding** — firm logo + accent color + optional "powered by Prism", driven off a `firms` settings row; client portal reads it. Custom-subdomain rendering is code; the DNS half is H5. *↔ blocked-by-you (subdomain only).*
  *Scoped 2026-06-07: **big but not drastic** — the schema already carries `firms.brand_color` + `firms.logo_url` (migration 001). The work is (1) load the firm brand at auth and expose it on a context, (2) drive `--gold`/`--ink` CSS vars + a logo slot from it (the app already themes via CSS vars), (3) a firm-admin settings form + logo upload to Storage. ~1 focused sprint; no migration needed. Per-firm subdomains are a separate, smaller follow-on once `*.prismaw.com` DNS exists (H5).*

### C4 — Wedge deepeners (Tier B — retire a paid tool)
- [ ] **Tax-return insight (Holistiplan-lite)** — upload a 1040 → planning observations into the roadmap + portal. High willingness-to-pay.
- [ ] **AI relationship assistant (Gemini)** — draft replies, household summaries, review talking points, "who needs attention." Rides on the shipped messaging + CRM. Runs server-side (Edge Function) so the key never reaches the browser. *Gemini API key received 2026-06-07 (H5); build deferred by your call until we pick this up — set `GEMINI_API_KEY` in Supabase secrets when we start.*

### C5 — Perf, InfoSec & UX polish
- [ ] **Audit RLS-predicate index coverage** (`advisor_id`/`firm_id`/`client_id`, esp. the firm-admin cross-firm read). *(Was bundled with "minify `styles.css`", which shipped 2026-06-08.)*
- [ ] **Product analytics events** — first-party activation events (login, invite, message, plan-update, report) into a small events table; answers "is the design partner actually using it."
- [ ] **Advisor MFA (TOTP)** — enforce in the advisor auth path (Supabase Auth supports it). *↔ may need a Supabase Auth setting toggle (H2).*
- [ ] **Exam-ready compliance export** — one-click books-&-records packet (audit log + acknowledgements + WORM).
- [ ] **Client PWA + push** — installable client portal + push on new message/task/document. *↔ blocked-by-you: VAPID keys (H5).*

---

# 🧑 Your queue

These are the things I genuinely can't do — they cost money, need your identity/credentials, or live in dashboards I can't reach. I've written each with enough depth to act cold. **Bold = the hard blockers gating any live client.**

### H2 — **Infrastructure to production grade** *(the #1 hard blocker — nothing live until this is done)*
1. **Upgrade Supabase to Pro.** Free tier has no PITR, no real backups, no connection headroom. In the Supabase dashboard → Settings → Billing → upgrade the project. Then enable **PITR / daily backups** (Database → Backups).
2. **Rotate the remaining secrets before any live data touches the project** (current values have been in a dev repo/history). ✅ **Done 2026-06-08:** Supabase **service-role key**, **access/personal token**, and **`CRON_SECRET`** rotated (see [sprint-log](sprint-log.md)). ⚠️ *Verify the new `CRON_SECRET` was also stored in Supabase Vault* — `select vault.create_secret('<new CRON_SECRET>', 'cron_secret');` — both cron jobs (`022` error-digest + `015`/`023` billing) read it from Vault, so if that step was skipped they fail silently. Still to rotate:
   - **Stripe** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (and decide live vs test `STRIPE_PRICE_GROWTH`).
   - **Plaid** `PLAID_CLIENT_ID` / `PLAID_SECRET` (+ set `PLAID_ENV`).
   After rotating these, set the new values in **Supabase → Edge Functions → Secrets** *and* in the GitHub Actions secrets (H3). Tell me when done and I'll redeploy functions against the new values if needed.
3. **Decide live keys.** Choose whether Stripe and Plaid go live now or stay in test/sandbox for design partners. This decides whether real money/aggregation flows — say the word and I'll flip the env config.
4. *(If C5 MFA needs it)* toggle TOTP factor support on in Supabase → Authentication → Providers.

### H3 — Repo & host settings I can't touch
> ✅ **`ALERT_WEBHOOK_URL` set 2026-06-07** (Discord webhook). ⚠️ *Verify the URL ends in `/slack`* — Discord's plain webhook rejects the `{ "text": ... }` payload `error-digest` sends; only the `…/slack` variant accepts it. The first hourly `error-digest` run flushes the backlog; if no alert arrives, the `/slack` suffix is the likely cause.
> ✅ **Per-PR Cloudflare preview deploys enabled 2026-06-07** ("Builds for non-production branches" checked, confirmed by screenshot). Branches now get a stable Preview URL + PR comment.
1. **Stand up an uptime monitor.** Free UptimeRobot/Cloudflare check pinging the `health` edge function + the app URL, alerting to your email. ~5 minutes; I can't create the account.

### H5 — External credentials that unblock my feature work
Each one directly unblocks a 🤖 item; drop them into Supabase Edge Function secrets (or tell me the value channel) and I'll build against them:
- ✅ **Gemini API key — received + stored 2026-06-07.** Now in Supabase → Edge Functions → Secrets as `GEMINI_API_KEY`. **Build deferred by your call** — when we start C4 I'll read it server-side (Edge Function, never reaches the browser). *To-do on your side: set a spend cap / budget alert in Google Cloud.* Unblocks **C4 AI assistant**.
- **Google + Microsoft OAuth apps** → unblocks the calendar half of Tier-A integrations (two-way meeting sync, free/busy). Two separate apps:
  - **Google:** [Google Cloud Console](https://console.cloud.google.com/) → create a project → enable the **Google Calendar API** → **OAuth consent screen** (External; add yourself + design-partner advisors as test users while unverified) → **Credentials → Create OAuth client ID → Web application**. Authorized redirect URI: `https://<your-app-domain>/oauth/google/callback` (tell me the exact path you want and I'll wire it). Hand me the **Client ID + Client secret** + the scopes you approved.
  - **Microsoft:** ⚠️ *Your personal `@gmail.com` Microsoft account has **no Entra directory/tenant**, and Microsoft has **deprecated creating app registrations outside a directory** ("The ability to create applications outside of a directory has been deprecated" — screenshot 2026-06-07). So **before** registering the app you must first **get a free tenant**. Two free options:*
    1. *[**M365 Developer Program**](https://developer.microsoft.com/microsoft-365/dev-program) — free sandbox tenant with a `*.onmicrosoft.com` domain (renews while in use). Simplest for a calendar integration; or*
    2. *[**Sign up for Azure (free tier)**](https://azure.microsoft.com/free/) — creates a default Entra directory you can register apps in (no spend needed for app registration).*
    *Once you have a tenant, sign into [Entra admin center](https://entra.microsoft.com/) **with that tenant's account** (not the gmail one) → **App registrations → New registration**. **Supported account types:** pick **"Accounts in any organizational directory and personal Microsoft accounts"** (multi-tenant) if design-partner advisors will use their own work/personal Microsoft accounts — single-tenant only lets your own tenant's users sign in. Then **Certificates & secrets → New client secret** → **API permissions → Microsoft Graph → delegated `Calendars.ReadWrite` + `offline_access`**. Redirect URI: `https://www.prismaw.com/oauth/microsoft/callback`. Hand me the **Application (client) ID + secret value + directory (tenant) ID**.*
    *(Microsoft calendar is lower-priority than Google for most RIAs — fine to skip until a design partner actually needs Outlook sync.)*
  - *Scopes are read/write calendar + offline (refresh-token) access only — no mail/contacts. I store refresh tokens server-side, never in the browser.*
- **DocuSign — ✅ ACTIVATED 2026-06-08 (demo account).** Built and turned on end-to-end: migration 027 run · `DOCUSIGN_*` secrets set (incl. `DOCUSIGN_CONNECT_HMAC_KEY`) · JWT consent granted · `docusign-envelope` + `docusign-connect` deployed · DocuSign Connect webhook configured (REST v2.1 / SIM / Envelope Signed-Completed + Recipients data / HMAC). Advisors can send legally-binding envelopes from the client modal. Runbook: [`docusign-setup.md`](docusign-setup.md).
  - *Remaining (only when going live with real signatures): promote the DocuSign account to production + go-live the integration key, then swap `DOCUSIGN_OAUTH_BASE` → `account.docusign.com` and update `DOCUSIGN_REST_BASE` — sequence with the H2.3 live-keys decision.*
- ✅ **Wildcard DNS `*.prismaw.com` — done 2026-06-07.** Proxied CNAME `*` → `prismaw.com` + Worker route pattern `*.prismaw.com/*` added (confirmed by screenshots). Universal TLS covers the one wildcard level. **Unblocks the custom-subdomain half of C3 white-label** — when we build C3, I'll add the per-firm subdomain → firm-brand resolution. *⚠️ Quick check on your side: hit `https://anything.prismaw.com` and confirm it resolves to the app (not an SSL/525/1014 error). If `*.prismaw.com` 1014s, the Worker route needs the wildcard hostname added under a custom-hostnames/SaaS config — tell me what you see.*
- **VAPID keypair** (web-push) → unblocks **C5 client PWA push**. I can generate the pair and hand you the public/private split if you'd rather.
- *(Optional, helps C3)* a **real CRM export file** (Wealthbox/Redtail/Orion CSV, scrubbed) dropped in `docs/samples/` so the import mappers are built against reality, not a guess.

### H6 — Distribution & GTM *(can't be coded; the actual growth work)*
1. **Recruit 3–5 design-partner RIAs** — warm network first, then XYPN / NAPFA / Kitces / advisor LinkedIn / r/CFP. Offer free white-glove onboarding for feedback + a named testimonial + logo. This is the primary motion; one real advisor outweighs the SEO drip.
2. **Stand up the founder-led content channel** — LinkedIn POV posts + a short newsletter. I can draft posts/outlines on request; you own the account, the voice, and hitting publish.

---

*When a queue empties, delete its heading too. When everything's gone, delete this file — the roadmap remains.*

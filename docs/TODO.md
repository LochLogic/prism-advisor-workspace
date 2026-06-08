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
Sprint **C5 batch** (see [sprint-log](sprint-log.md)). Build + lint + calc + check green; routing + client-upload UI verified in the browser preview (no console errors).
- **Deep-linkable in-app routing** — `#/advisor` · `#/admin` · `#/client/<id>` · `#/client/<id>/p<phaseId>` synced both ways in `ViewProvider` (advisor app only; portal is single-view). Bookmark/share/support links now work; verified hash↔view sync + phase deep-link.
- **Client-initiated uploads** — clients can now upload in the portal document vault (advisor-only delete preserved). Code: `db.uploadDocument` role param, `DocumentVault` upload gate, portal wiring. **Needs migration 025** for the RLS insert path (the `documents` table had no client-INSERT policy — the old "already-allowed" note was wrong).
- **Retention / rollup** — **migration 026**: 7-yr audit_log prune (> SEC 17a-4's 6yr) + balance_history monthly rollup (daily for 24mo, then month-end per account), monthly pg_cron. (Chose retention/rollup over an unverifiable in-place partition rebuild — see migration header.)
- **⚙️ Human deploy — run two migrations** (no secrets/money): **025** (`025_client_document_upload.sql`) activates client uploads — *until then a client upload attempt will fail RLS*; **026** (`026_retention_rollup.sql`) installs the retention/rollup cron. *(Migration 024 from last sprint still needs running too if not yet done — invite/claim depends on it.)*

---

# 🤖 Claude's queue

Sequenced to the roadmap's goal — *onboard a first paying advisor* — pre-live hardening first, then the adoption unlocks that turn a demo into a "yes," then depth and polish. Each sprint is independently shippable.

### C0 — Code-review fixes (2026-06-07) — **FIRST IN LINE, ahead of C3+**
From the full architecture+granular code review (2026-06-07). **Batches 1 & 2 shipped** (PRs #24, #25): alert-priority, Monte-Carlo memo, dead-code, demo-flows memo, post-checkout redirect, save-on-switch flush, book-wide KPI totals. **Batch 3 shipped** (fee/label dedup → `_shared/fees.ts` + single `AUDIT_ACTION_LABELS`, RNG note, fuller `ProfileProvider` memoization). See [sprint-log](sprint-log.md). Only this remains:

- [ ] **Stripe webhook retries on permanent errors.** `stripe-webhook/index.ts:76-78` returns HTTP 400 for *any* exception → Stripe retries ~3 days even for unrecoverable cases (e.g. unknown firm). Return 200 for permanent/unprocessable, 4xx/5xx only for retryable; log a `checkout.session.completed` with no resolvable `firmId`. *↔ money-adjacent — **deferred 2026-06-07 by decision**; needs the gated `stripe-webhook` edge redeploy (H4) with a human go. Repo is intentionally left in sync with what's deployed.*

### C3 — Adoption unlocks (Tier A — without these, RIAs won't move)
- [ ] **White-label branding** — firm logo + accent color + optional "powered by Prism", driven off a `firms` settings row; client portal reads it. Custom-subdomain rendering is code; the DNS half is H5. *↔ blocked-by-you (subdomain only).*
  *Scoped 2026-06-07: **big but not drastic** — the schema already carries `firms.brand_color` + `firms.logo_url` (migration 001). The work is (1) load the firm brand at auth and expose it on a context, (2) drive `--gold`/`--ink` CSS vars + a logo slot from it (the app already themes via CSS vars), (3) a firm-admin settings form + logo upload to Storage. ~1 focused sprint; no migration needed. Per-firm subdomains are a separate, smaller follow-on once `*.prismaw.com` DNS exists (H5).*
- [ ] **Prospect / proposal mode** — run an unsaved prospect through a sample seven-horizon roadmap before they sign; "convert to client" promotes it. Turns the wedge into a closing tool.

### C4 — Wedge deepeners (Tier B — retire a paid tool)
- [ ] **Tax-return insight (Holistiplan-lite)** — upload a 1040 → planning observations into the roadmap + portal. High willingness-to-pay.
- [ ] **AI relationship assistant (Gemini)** — draft replies, household summaries, review talking points, "who needs attention." Rides on the shipped messaging + CRM. Runs server-side (Edge Function) so the key never reaches the browser. *↔ blocked-by-you: needs the Gemini API key in H5.*

### C5 — Perf, InfoSec & UX polish
- [ ] **Close `style-src 'unsafe-inline'`** — *deferred as its own dedicated sprint (scoped 2026-06-08).* This is the last CSP hole, but it is **not** a quick win: there are **~777 inline `style={{…}}` attributes across 9 source files** (`shell.jsx`, `firm-admin.jsx`, `app.jsx`, `calculators.jsx`, `client-portal.jsx`, `advisor-modal.jsx`, `numbers-panel.jsx`, `components.jsx`, `advisor-dashboard.jsx`). CSP nonces/hashes **do not** cover inline `style=` attributes (only `<style>` elements), so dropping `'unsafe-inline'` requires migrating **every** one of those to classes/CSS-vars — and the dynamic ones (computed bar widths, colors) can't simply move to a static class. A partial migration delivers **zero** CSP benefit (the directive can't be tightened until the last one is gone) while adding real visual-regression risk. So this needs a focused pass with full visual verification, not a tack-on. Lower risk than a `script-src` hole (which is already hardened). Until then, `check.mjs` keeps enforcing the `script-src` hardening.
- [ ] **Minify `styles.css`** (esbuild, free win) + **audit RLS-predicate index coverage** (`advisor_id`/`firm_id`/`client_id`, esp. the firm-admin cross-firm read).
- [ ] **`⌘K` command palette** — jump-to-client + actions; highest-leverage advisor-UX add at 150 households.
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
1. **Set `ALERT_WEBHOOK_URL`** (Supabase → Edge Functions → Secrets) to any endpoint accepting a Slack-style `{ "text": ... }` POST. This is the **last wire** on the C1 error alerting. `error-digest` is now deployed and verified (returns `{"configured":false}` until this is set); it stays **inert and won't advance its cursor** until then, so nothing is lost in the meantime. Once set, the first run flushes the backlog.
   - **No Slack? Easiest free option = Discord.** Make a server (or use one you have) → Server Settings → Integrations → Webhooks → New Webhook → Copy URL, then **append `/slack` to the URL**. Discord's `/slack` endpoint natively accepts the `{ "text": ... }` payload `error-digest` already sends — zero code change. (`https://discord.com/api/webhooks/<id>/<token>/slack`)
   - Other `{text}`-compatible sinks: a Zapier/Make/Pipedream "Catch Hook" (→ email/SMS/anywhere), or a tiny Cloudflare Worker you own. *(Microsoft Teams and ntfy use different payload shapes — those would need a small code tweak, so skip them unless you specifically want them.)*
2. **Enable per-PR Cloudflare preview deploys.** ⚠️ *Not on by default* — this project deploys via **Cloudflare Workers Builds** (not Pages), which by default builds **only** the production branch. To get a shareable preview URL + PR comment per branch: Cloudflare dashboard → your Worker → **Settings → Build → Branch control** → enable **"Builds for non-production branches."** Workers then auto-creates a stable per-branch Preview URL (`wrangler versions upload`, not promoted to prod) and posts it as a comment on each PR. Lets us both see a branch live before merge. (Refs: [Workers preview URLs](https://developers.cloudflare.com/workers/configuration/previews/), [build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).)
3. **Stand up an uptime monitor.** Free UptimeRobot/Cloudflare check pinging the `health` edge function + the app URL, alerting to your email. ~5 minutes; I can't create the account.

### H5 — External credentials that unblock my feature work
Each one directly unblocks a 🤖 item; drop them into Supabase Edge Function secrets (or tell me the value channel) and I'll build against them:
- **Gemini API key** (Google AI Studio → "Get API key") → unblocks **C4 AI assistant**. *Decision 2026-06-08: the AI assistant targets the **Gemini** API, not Anthropic (you already have a Gemini key).* Nothing is built against a provider yet, so this is a clean choice. Drop the key in as `GEMINI_API_KEY`; I'll build the assistant against the Gemini API (a server-side Edge Function so the key never reaches the browser). Set a spend cap / budget alert in Google Cloud.
- **Google + Microsoft OAuth apps** → unblocks the calendar half of Tier-A integrations (two-way meeting sync, free/busy). Two separate apps:
  - **Google:** [Google Cloud Console](https://console.cloud.google.com/) → create a project → enable the **Google Calendar API** → **OAuth consent screen** (External; add yourself + design-partner advisors as test users while unverified) → **Credentials → Create OAuth client ID → Web application**. Authorized redirect URI: `https://<your-app-domain>/oauth/google/callback` (tell me the exact path you want and I'll wire it). Hand me the **Client ID + Client secret** + the scopes you approved.
  - **Microsoft:** [Entra ID / Azure portal](https://entra.microsoft.com/) → **App registrations → New registration** (single-tenant is fine to start) → **Certificates & secrets → New client secret** → **API permissions → Microsoft Graph → delegated `Calendars.ReadWrite` + `offline_access`**. Redirect URI: `https://<your-app-domain>/oauth/microsoft/callback`. Hand me the **Application (client) ID + secret + tenant ID**.
  - *Scopes are read/write calendar + offline (refresh-token) access only — no mail/contacts. I store refresh tokens server-side, never in the browser.*
- **DocuSign account** (your chosen e-sign provider) → unblocks real e-signature on top of the existing acknowledgements (today they're click-to-acknowledge, not legally-binding signatures). Steps: create a **DocuSign developer account** ([developers.docusign.com](https://developers.docusign.com/)) → **Apps & Keys → Add App / Integration Key** → generate an **RSA keypair** (for JWT/service-to-service auth, so signatures can be sent without a human in the loop) → grant **consent** once for the integration → note your **Integration Key (client ID), User ID (API username), Account ID, and the base URI** (demo vs prod). Hand me those + the private key (via a secret channel, not the repo). I'll build send-for-signature + status-webhook + store the completed PDF in the existing document vault. *When you're ready for live (not demo) signatures, the account needs to be promoted to production and the integration key go-live'd — flag me and we'll sequence it with the live-keys decision (H2.3).*
- **Wildcard DNS** (`*.prismaw.com` → the app) → unblocks the custom-subdomain half of **C3 white-label**. In your DNS provider (Cloudflare, since the app's already there): add a **CNAME** (or proxied A/AAAA) record, **name `*`**, target = the app's existing hostname/Worker route, **proxied (orange cloud) ON**. Then in the Worker, add a **route/custom domain** matching `*.prismaw.com` so wildcard hosts hit the app. TLS: Cloudflare's universal cert covers one wildcard level (`*.prismaw.com`) automatically; deeper nesting (`*.*.`) would need Advanced Certificate Manager — not needed here. Once it resolves, tell me and I'll add the per-firm subdomain → firm-brand resolution. *Logo/color white-label does **not** need this; only per-firm subdomains (e.g. `acme.prismaw.com`) do.*
- **VAPID keypair** (web-push) → unblocks **C5 client PWA push**. I can generate the pair and hand you the public/private split if you'd rather.
- *(Optional, helps C3)* a **real CRM export file** (Wealthbox/Redtail/Orion CSV, scrubbed) dropped in `docs/samples/` so the import mappers are built against reality, not a guess.

### H6 — Distribution & GTM *(can't be coded; the actual growth work)*
1. **Recruit 3–5 design-partner RIAs** — warm network first, then XYPN / NAPFA / Kitces / advisor LinkedIn / r/CFP. Offer free white-glove onboarding for feedback + a named testimonial + logo. This is the primary motion; one real advisor outweighs the SEO drip.
2. **Stand up the founder-led content channel** — LinkedIn POV posts + a short newsletter. I can draft posts/outlines on request; you own the account, the voice, and hitting publish.

---

*When a queue empties, delete its heading too. When everything's gone, delete this file — the roadmap remains.*

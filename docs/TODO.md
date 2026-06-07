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
- **DOB dropdowns on newly-added members** — fixed in [numbers-panel.jsx](../src/numbers-panel.jsx) (`DobSelects` now holds partial Month/Day/Year picks in local state instead of discarding them until complete). Verified in demo: a 3rd member's DOB now persists.
- **Double tooltip on field hints** — fixed in [numbers-panel.jsx](../src/numbers-panel.jsx) (`FieldHint` no longer sets a native `title`; the styled bubble + `aria-label` remain). Verified: no `.px-hint` carries a `title`.
- *Not yet committed/pushed.* When you're happy with both, that's the only thing left before deleting this block.

---

# 🤖 Claude's queue

Sequenced to the roadmap's goal — *onboard a first paying advisor* — pre-live hardening first, then the adoption unlocks that turn a demo into a "yes," then depth and polish. Each sprint is independently shippable.

### C2 — Quality gates in CI
*Cheap guards that stop a silent regression on the no-types, bare-globals codebase.*
- [ ] **ESLint in CI** — `no-undef` against a `window`-globals allow-list (catches the typo'd-identifier failure mode the bare-name architecture invites) + basic rules; wire into the existing `ci` workflow.
- [ ] **`npm audit` / Dependabot** — add the audit step + a Dependabot config.
- [ ] **Playwright e2e over the protected paths** — 1-click demo, notification deep-link, inline reply, single-screen portal, mobile. Run against the demo build in CI.
- [ ] **Gate deploys in CI** — manual-approval job that runs `supabase db push` + edge-function deploy so the repo stops drifting from live. *↔ blocked-by-you: needs the CI secrets in H3.*
- [ ] **Move the `015` billing cron off its embedded secret** — re-schedule the `prism-monthly-invoices` job to read `cron_secret` from Supabase Vault (same pattern as `022`), so no `CRON_SECRET` literal lives in any migration. *↔ depends on H2 having stored the Vault secret.*

### C3 — Adoption unlocks (Tier A — without these, RIAs won't move)
- [ ] **Bulk client import** — CSV importer + column mapper UI, plus preset mappers for Wealthbox / Redtail / Orion exports. The #1 blocker to a "yes." *Cheaper if you drop a real sample export into `/docs/samples/` — see H5.*
- [ ] **White-label branding** — firm logo + accent color + optional "powered by Prism", driven off a `firms` settings row; client portal reads it. Custom-subdomain rendering is code; the DNS half is H5. *↔ blocked-by-you (subdomain only).*
- [ ] **Prospect / proposal mode** — run an unsaved prospect through a sample seven-horizon roadmap before they sign; "convert to client" promotes it. Turns the wedge into a closing tool.

### C4 — Wedge deepeners (Tier B — retire a paid tool)
- [ ] **Probability-of-success band** — surface the existing `calc-core.monteCarlo` as a confidence band on the retirement horizon. Low effort, high expectation-match.
- [ ] **One-click QBR packet** — assemble roadmap + net-of-fee performance + goals + protection into a client-ready PDF from data already in the system. Builds on the existing `print*Report` generators.
- [ ] **Tax-return insight (Holistiplan-lite)** — upload a 1040 → planning observations into the roadmap + portal. High willingness-to-pay.
- [ ] **Risk questionnaire → draft IPS** — client-facing risk profiling feeds the roadmap and drops a draft IPS into the vault for e-sign (vault + acknowledgements already exist).
- [ ] **AI relationship assistant (Opus)** — draft replies, household summaries, review talking points, "who needs attention." Rides on the shipped messaging + CRM. *↔ blocked-by-you: needs the Anthropic API key in H5.*

### C5 — Perf, InfoSec & UX polish
- [ ] **Close `style-src 'unsafe-inline'`** — migrate pervasive inline `style={{…}}` → utility classes / CSS vars, then drop `'unsafe-inline'` from `style-src` and let `check.mjs` enforce it (last CSP hole).
- [ ] **Split the client portal into its own bundle entry** — cuts the client payload *and* the attack surface a client browser sees. esbuild multi-entry.
- [ ] **Retention / partitioning migrations** — `audit`, `client_errors`, `balance_history` only grow; add a retention/rollup policy (partition by month) before a firm with history loads in.
- [ ] **Minify `styles.css`** (esbuild, free win) + **audit RLS-predicate index coverage** (`advisor_id`/`firm_id`/`client_id`, esp. the firm-admin cross-firm read).
- [ ] **Deep-linkable in-app routing** — `/app#/client/:id/tab` over the current React-state/sessionStorage nav; unlocks bookmark/share/support links.
- [ ] **`⌘K` command palette** — jump-to-client + actions; highest-leverage advisor-UX add at 150 households.
- [ ] **Product analytics events** — first-party activation events (login, invite, message, plan-update, report) into a small events table; answers "is the design partner actually using it."
- [ ] **Advisor MFA (TOTP)** — enforce in the advisor auth path (Supabase Auth supports it). *↔ may need a Supabase Auth setting toggle (H2).*
- [ ] **Client-initiated uploads** — surface the already-allowed `documents.uploaded_by_role = 'client'` path in the portal.
- [ ] **Exam-ready compliance export** — one-click books-&-records packet (audit log + acknowledgements + WORM).
- [ ] **Client PWA + push** — installable client portal + push on new message/task/document. *↔ blocked-by-you: VAPID keys (H5).*

---

# 🧑 Your queue

These are the things I genuinely can't do — they cost money, need your identity/credentials, or live in dashboards I can't reach. I've written each with enough depth to act cold. **Bold = the hard blockers gating any live client.**

### H1 — Legal & entity unlock *(Phase 0 — nearly closed)*
- [x] Entity formed — *LeMay Ventures LLC*, in good standing in Colorado.
- [x] V1 counsel review done (you plan a second pass — apply any wording deltas to `terms.html` / `privacy.html` / `dpa.html` / `security.html` / `sla.html` when you have them; flag me and I'll edit).
- [ ] **Test the inboxes.** `privacy@` / `legal@` / `security@prismaw.com` are built but unverified — send a round-trip test to each (and confirm they're actually monitored) before a customer reads those addresses in the legal pages.

### H2 — **Infrastructure to production grade** *(the #1 hard blocker — nothing live until this is done)*
1. **Upgrade Supabase to Pro.** Free tier has no PITR, no real backups, no connection headroom. In the Supabase dashboard → Settings → Billing → upgrade the project. Then enable **PITR / daily backups** (Database → Backups).
2. **Rotate every secret before any live data touches the project** (the current values have been in a dev repo/history):
   - Supabase **service-role key** and **access/personal token** (Settings → API / Account → Tokens).
   - **Stripe** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (and decide live vs test `STRIPE_PRICE_GROWTH`).
   - **Plaid** `PLAID_CLIENT_ID` / `PLAID_SECRET` (+ set `PLAID_ENV`).
   - `CRON_SECRET` (regenerate; it guards the billing cron **and** the new hourly error-digest cron). ⚠️ The **old** value is still hard-coded in `015_cron_billing.sql` (committed before this was a concern) — rotating `CRON_SECRET` neutralizes that embedded value. The new error-digest cron (`022`) instead reads the secret from **Supabase Vault**, so after rotating you must store it once: `select vault.create_secret('<new CRON_SECRET>', 'cron_secret');`. (C2-cleanup will move the `015` billing cron onto the same Vault lookup so no secret is embedded anywhere.)
   After rotating, set the new value in **Supabase → Edge Functions → Secrets**, in **Vault** (`cron_secret`, per above), *and* in the GitHub Actions secrets (H3). Tell me when done and I'll redeploy functions against the new values.
3. **Decide live keys.** Choose whether Stripe and Plaid go live now or stay in test/sandbox for design partners. This decides whether real money/aggregation flows — say the word and I'll flip the env config.
4. *(If C5 MFA needs it)* toggle TOTP factor support on in Supabase → Authentication → Providers.

### H3 — Repo & host settings I can't touch
1. **Promote the RLS-isolation job to a required check.** It's wired and green (session pooler); GitHub → repo Settings → Branches → `main` rule → add `rls-isolation` to required status checks. (It's the most security-relevant test we have.)
2. **Set `ALERT_WEBHOOK_URL`** (Supabase → Edge Functions → Secrets) to a Slack incoming-webhook URL (or any endpoint accepting a `{ "text": ... }` POST). This is the **last wire** on the C1 error alerting — the `error-digest` function is built and scheduled hourly, but stays **inert and won't advance its cursor** until this is set, so nothing is lost in the meantime. Once set, the first run flushes the backlog.
3. **Add the CI secrets for C2:** the rotated H2 secrets as GitHub Actions repo secrets, so the gated `db push` + function-deploy job can run.
4. **Enable per-PR Cloudflare preview deploys.** Cloudflare Pages → project → Settings → Builds & deployments → turn on preview deployments for non-production branches. Lets us both see a branch live before merge.
5. **Stand up an uptime monitor.** Free UptimeRobot/Cloudflare check pinging the `health` edge function + the app URL, alerting to your email. ~5 minutes; I can't create the account.

### H4 — Run the pending migrations / deploys *(until C2 gates them in CI)*
Migrations and edge functions currently deploy **by hand**, so the live DB can lag the repo. The repo is now at migration **022**; per our notes **017–022 may be unapplied** on live. Once H2 is done:
1. Run `supabase db push` (or apply `017_acknowledgements` → `022_error_digest` in order) against the live project. This activates acknowledgements/e-sign, hardening, messaging, the document vault, **the log-error rate-limit + telemetry retention (021), and the error-digest cron (022)**.
2. Deploy the touched/new edge functions so live matches the repo:
   - `supabase functions deploy log-error --no-verify-jwt --project-ref phabxcijbbphfxvjedfj` (now rate-limited)
   - `supabase functions deploy generate-invoices --project-ref phabxcijbbphfxvjedfj` (honest skip/fail counting)
   - `supabase functions deploy error-digest --project-ref phabxcijbbphfxvjedfj` (new — the alerting)
3. Confirm `CRON_SECRET` and (for alerting) `ALERT_WEBHOOK_URL` are set in Edge Function secrets before the crons fire.
> This whole item disappears once I finish **C2's deploy-gating job** — at that point CI owns it. Flag me when you want it prioritized.

### H5 — External credentials that unblock my feature work
Each one directly unblocks a 🤖 item; drop them into Supabase Edge Function secrets (or tell me the value channel) and I'll build against them:
- **Anthropic API key** → unblocks **C4 AI assistant**. (Use a scoped key; set a spend cap.)
- **Google + Microsoft OAuth apps** (client id/secret, redirect URIs) → unblocks the calendar half of Tier-A core integrations.
- **An e-sign provider account** (DocuSign / Dropbox Sign) → unblocks real e-signature on top of the existing acknowledgements.
- **Wildcard DNS** (`*.prismaw.com` → the app) → unblocks the custom-subdomain half of **C3 white-label**. Logo/color work doesn't need this; only per-firm subdomains do.
- **VAPID keypair** (web-push) → unblocks **C5 client PWA push**. I can generate the pair and hand you the public/private split if you'd rather.
- *(Optional, helps C3)* a **real CRM export file** (Wealthbox/Redtail/Orion CSV, scrubbed) dropped in `docs/samples/` so the import mappers are built against reality, not a guess.

### H6 — Distribution & GTM *(can't be coded; the actual growth work)*
1. **Recruit 3–5 design-partner RIAs** — warm network first, then XYPN / NAPFA / Kitces / advisor LinkedIn / r/CFP. Offer free white-glove onboarding for feedback + a named testimonial + logo. This is the primary motion; one real advisor outweighs the SEO drip.
2. **Stand up the founder-led content channel** — LinkedIn POV posts + a short newsletter. I can draft posts/outlines on request; you own the account, the voice, and hitting publish.

---

*When a queue empties, delete its heading too. When everything's gone, delete this file — the roadmap remains.*

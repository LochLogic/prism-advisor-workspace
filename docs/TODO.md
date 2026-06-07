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
Sprint C3/C4 (frontend only — no migrations/secrets/money). See [sprint-log](sprint-log.md).
- **Bulk CSV client import** (C3) — `BulkImportModal` + Wealthbox/Redtail/Orion presets; roster + empty-state buttons. Sample at `docs/samples/sample-clients.csv`. *Live-only — needs a real signed-in firm to exercise end-to-end.*
- **Probability-of-success band** (C4) — Monte Carlo confidence band on the client retirement card.
- **Risk questionnaire → draft IPS** (C4) — client questionnaire → strategic allocation; advisor "Draft IPS" (e-sign) + "Print IPS".
- **One-click QBR packet** (C4) — `printQBRReport` from the client modal header.
- *Not yet committed/pushed.* Build + lint + calc tests green. When you're happy, commit/PR and delete this block.

---

# 🤖 Claude's queue

Sequenced to the roadmap's goal — *onboard a first paying advisor* — pre-live hardening first, then the adoption unlocks that turn a demo into a "yes," then depth and polish. Each sprint is independently shippable.

### C0 — Code-review fixes (2026-06-07) — **FIRST IN LINE, ahead of C3+**
From the full architecture+granular code review (2026-06-07). Do these before any C3/C4/C5 work. Frontend-only items are shippable now; the checkout + webhook items touch the billing flow (edge functions → redeploy via H4, money-adjacent — confirm before deploying).

**High**
- [ ] **Post-checkout redirect lands on the marketing page.** `create-checkout-session/index.ts:87-88` builds `success_url: ${origin}/index.html?billing=success`, but `build.mjs:49-50` routes the **landing page to `/index.html`** and the **app to `/app/`**. After a successful Stripe checkout the advisor lands on marketing, and the `?billing=success`/`cancel` toast handler in `firm-admin.jsx:76-86` (which lives in the app) never runs. Fix: edge function should target `${origin}/app/?billing=…` (or the caller passes an app-based URL). *↔ money-adjacent — confirm before deploy.*

**Medium**
- [ ] **Debounced profile edits can be silently lost on client switch.** `store.jsx:176-186` debounces the DB save 1.5s; the load effect at `store.jsx:151-152` `clearTimeout`s the pending save on every `activeClientId` change. Editing a live client's numbers then switching clients within 1.5s drops those last edits. Fix: flush the pending save before switching (and on unmount).
- [ ] **KPI / Book-AUM totals under-count for books > 50 clients.** `dbGetClients` paginates 50/page (`db.jsx:61`); the dashboard computes `totalAUM`, cash drag, counts, and `generatedAlerts` over only the loaded slice (`advisor-dashboard.jsx:817-825`, `:735`). Headline numbers are wrong until the advisor pages through everyone. Fix: aggregate server-side (or a dedicated totals query). The firm-admin view already does this right via the unpaginated `getFirmClients`.
- [x] **Monte Carlo re-runs on every keystroke.** ~~`successBand` (`store.jsx:335-338`) ran `monteCarlo({runs:600})` unmemoized in the `ProfileProvider` render body — fired on every keystroke in the Numbers drawer.~~ **Shipped 2026-06-07** — wrapped in `useMemo`. *(The other derived metrics — `retirementReadiness`, `goalsFunding`, `riskProfile`, and the context `value` object — are still recomputed each render; a fuller memoization pass remains, see C5.)*

**Low / cleanup**
- [x] **Alert priority string mismatch.** ~~Generated alerts used `priority: 'medium'` (`advisor-dashboard.jsx:744,759`) while the app uses `'med'` — so they rendered as "FYI" instead of "Watch" and got the dead `is-medium` CSS class.~~ **Shipped 2026-06-07.**
- [ ] **Stripe webhook retries on permanent errors.** `stripe-webhook/index.ts:76-78` returns HTTP 400 for *any* exception → Stripe retries ~3 days even for unrecoverable cases (e.g. unknown firm). Return 200 for permanent/unprocessable, 4xx/5xx only for retryable; log a `checkout.session.completed` with no resolvable `firmId`. *↔ money-adjacent — confirm before deploy.*
- [x] **Demo flows array identity busts a memo each render.** ~~`client-portal.jsx:425-430` called `window.demoCashFlows()` inline and fed it as a `useMemo` dep, recomputing `perfPeriodsData` every render for demo clients.~~ **Shipped 2026-06-07** (memoized).
- [x] **Dead code: `reconcileAssets`.** ~~`store.jsx:113` — defined + window-exported but never consumed (superseded by `assetComposition`).~~ **Shipped 2026-06-07** (removed).
- [ ] **De-duplicate drift-prone logic.** Tiered-fee math exists twice (`calc-core.annualFeeForAum` ↔ `generate-invoices/index.ts:annualFee`) and the audit-action label map exists 3× (`store.jsx`, `advisor-dashboard.jsx:AUDIT_ACTION_LABELS`, `db.jsx`). The edge function can't import the `.cjs`, but a shared `_shared/fees.ts` + a single label map would stop the drift. (Fee dup is already comment-flagged.)
- [ ] **`monteCarlo` RNG quality note** (`calc-core.cjs:109`) — tiny LCG (period 233,280), fine for an illustrative band but don't back a "precise" figure with it. No action unless a number is presented as exact.

### C3 — Adoption unlocks (Tier A — without these, RIAs won't move)
- [ ] **White-label branding** — firm logo + accent color + optional "powered by Prism", driven off a `firms` settings row; client portal reads it. Custom-subdomain rendering is code; the DNS half is H5. *↔ blocked-by-you (subdomain only).*
  *Scoped 2026-06-07: **big but not drastic** — the schema already carries `firms.brand_color` + `firms.logo_url` (migration 001). The work is (1) load the firm brand at auth and expose it on a context, (2) drive `--gold`/`--ink` CSS vars + a logo slot from it (the app already themes via CSS vars), (3) a firm-admin settings form + logo upload to Storage. ~1 focused sprint; no migration needed. Per-firm subdomains are a separate, smaller follow-on once `*.prismaw.com` DNS exists (H5).*
- [ ] **Prospect / proposal mode** — run an unsaved prospect through a sample seven-horizon roadmap before they sign; "convert to client" promotes it. Turns the wedge into a closing tool.
- [ ] **Client connect / invite flow** — *gap surfaced 2026-06-07.* An advisor-created `clients` row has a null `auth_user_id`; nothing currently links a client's sign-in to their household, so the client portal is only reachable via the advisor's "Client view." Need an invite (email magic-link / claim code) that sets `clients.auth_user_id = auth.uid()` on first sign-in (mirror of `px_provision_firm`). Tier-A for any real client-facing launch.

### C4 — Wedge deepeners (Tier B — retire a paid tool)
- [ ] **Tax-return insight (Holistiplan-lite)** — upload a 1040 → planning observations into the roadmap + portal. High willingness-to-pay.
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

### H2 — **Infrastructure to production grade** *(the #1 hard blocker — nothing live until this is done)*
1. **Upgrade Supabase to Pro.** Free tier has no PITR, no real backups, no connection headroom. In the Supabase dashboard → Settings → Billing → upgrade the project. Then enable **PITR / daily backups** (Database → Backups).
2. **Rotate every secret before any live data touches the project** (the current values have been in a dev repo/history):
   - Supabase **service-role key** and **access/personal token** (Settings → API / Account → Tokens).
   - **Stripe** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (and decide live vs test `STRIPE_PRICE_GROWTH`).
   - **Plaid** `PLAID_CLIENT_ID` / `PLAID_SECRET` (+ set `PLAID_ENV`).
   - `CRON_SECRET` (regenerate; it guards the billing cron **and** the new hourly error-digest cron). ⚠️ The **old** value is still hard-coded in `015_cron_billing.sql` (committed before this was a concern) — rotating `CRON_SECRET` neutralizes that embedded value. Both cron jobs (`022` error-digest and, as of **migration 023**, the `015` billing cron) now read the secret from **Supabase Vault**, so after rotating you must store it once: `select vault.create_secret('<new CRON_SECRET>', 'cron_secret');`. No `CRON_SECRET` literal remains in any migration going forward (the old value still sits in `015`'s history, which rotation neutralizes).
   After rotating, set the new value in **Supabase → Edge Functions → Secrets**, in **Vault** (`cron_secret`, per above), *and* in the GitHub Actions secrets (H3). Tell me when done and I'll redeploy functions against the new values.
3. **Decide live keys.** Choose whether Stripe and Plaid go live now or stay in test/sandbox for design partners. This decides whether real money/aggregation flows — say the word and I'll flip the env config.
4. *(If C5 MFA needs it)* toggle TOTP factor support on in Supabase → Authentication → Providers.

### H3 — Repo & host settings I can't touch
1. **Promote the test jobs to required checks.** `rls-isolation` is green (session pooler) and the new `e2e` job runs the demo smoke + DOB regression. GitHub → repo Settings → Branches → `main` rule → add `rls-isolation` (now) and `e2e` (once you've seen a few green runs) to required status checks.
2. **Set `ALERT_WEBHOOK_URL`** (Supabase → Edge Functions → Secrets) to a Slack incoming-webhook URL (or any endpoint accepting a `{ "text": ... }` POST). This is the **last wire** on the C1 error alerting. `error-digest` is now deployed and verified (returns `{"configured":false}` until this is set); it stays **inert and won't advance its cursor** until then, so nothing is lost in the meantime. Once set, the first run flushes the backlog.
3. **Enable per-PR Cloudflare preview deploys.** Cloudflare Pages → project → Settings → Builds & deployments → turn on preview deployments for non-production branches. Lets us both see a branch live before merge.
4. **Stand up an uptime monitor.** Free UptimeRobot/Cloudflare check pinging the `health` edge function + the app URL, alerting to your email. ~5 minutes; I can't create the account.

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

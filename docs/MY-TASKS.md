# Cory's To-Do — the single human task list

Everything across the roadmap that needs **you** (accounts, dashboards, secrets, legal, decisions, deploys), pulled from `YOUR-CHECKLIST.md`, `post-review-sprints.md`, and the GTM plans. Detailed commands live in those docs — this is the one place to track *what's yours*.

Legend: 🔴 do before test users · 🟡 when a partner's ready to pay · 🟢 optional/decision · ⏸ parked · 🚀 the actual goal.

---

## ✅ Already done
- Rotated the exposed Supabase token; ran migrations through **017**; deployed the 7 Edge Functions (CORS lockdown live).

## 🔴 Before your first test users (mostly quick)
**Activate the latest code** (same pattern as before — see `YOUR-CHECKLIST.md` §0):
- [ ] **Run migration `018_hardening.sql`** (SQL Editor) — search_path hardening + `client_errors` table.
- [ ] **Deploy `log-error`:** `npx supabase functions deploy log-error --no-verify-jwt --project-ref phabxcijbbphfxvjedfj` → turns on remote error capture.

**Make the pilot safe** (`post-review-sprints.md` Sprints 5–6):
- [ ] **Block red deploys** — GitHub → repo Settings → Branches → protect `main`, require the **CI** check to pass before merge. *(Today Cloudflare ships on push regardless of CI.)*
- [ ] **Enable the DB tests in CI** — create a throwaway **staging** Supabase project, add repo secret `DATABASE_URL` (its connection string). Lights up the RLS + integration tests (`npm run test:db`).

**Production infrastructure** (`YOUR-CHECKLIST.md` §1):
- [ ] **Supabase → Pro** + enable **PITR** (backups; stops 7-day auto-pause). 🔴 #1 blocker.
- [ ] **Rotate `CRON_SECRET`** + update the `prism-quarterly-invoices` / WORM cron jobs to send the new value.
- [ ] **Stand up inboxes** — `privacy@` / `legal@` / `security@ prismaw.com` (Cloudflare Email Routing).
- [ ] **Verify auth config** — Site URL = `https://prismaw.com`, redirect allow-list, Google provider.
- [ ] **Counsel review** of `privacy.html` / `terms.html` / `dpa.html` before a paying customer.

**One live smoke pass** (`uat-results.md` — demo can't reach these):
- [ ] In a real session: sign up → provision → add client → request + e-sign an acknowledgement → **admin**: create/assign a fee schedule → run billing → approve invoice → check audit trail. Repeat advisor+client steps once on your phone.

## 🟡 When a partner is ready to pay (`YOUR-CHECKLIST.md` §2)
- [ ] Stripe **live** keys + Growth price + webhook + signing secret; redeploy `create-checkout-session` + `stripe-webhook`.
- [ ] Billing smoke test (test card `4242…` → "Growth · active", webhook 200).

## 🟢 Optional / decisions
- [ ] **Product analytics** — pick an approach (own events table vs. a thin tool) so you can see the signup→activation funnel (`post-review-sprints.md` 6.4).
- [ ] **Finish the GSC digest** — add `gsc-digest@tradecode-engine.iam.gserviceaccount.com` as a Full user on the prismaw.com Search Console property + add the `GSC_SA_KEY` repo secret.

## ⏸ Parked — only when you go to Plaid production
- [ ] Plaid prod access + `PLAID_ENV=production` + prod keys; redeploy the two Plaid functions.
- [ ] **Move `aggregation_items.access_token` → Supabase Vault** *before* storing real tokens (top latent security finding).
- [ ] Watch Plaid per-account cost vs. flat pricing (unit economics).

## 🚀 The actual goal — get test users (`first-outreach-plan.md`, `design-partner-kit.md`)
- [ ] Build the 50-row prospect tracker; weight toward **warm intros**.
- [ ] Recruit **3–5 design partners** (warm → XYPN/NAPFA/Kitces/LinkedIn).
- [ ] Stand up the **founder content channel** (LinkedIn + newsletter) — drafts in `founder-content-starter.md`.

---

### Honest minimum to *start* a pilot
The two 🔴 "activate" items + **block red deploys** + **Supabase Pro** + **inboxes** + the **one live smoke pass**. Then recruit one partner and run the rest in parallel. Everything in ⏸ stays parked until a partner needs linked accounts.

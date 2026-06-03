# Your Checklist — everything waiting on you, in order

Human-only actions (accounts, secrets, legal, CLI deploys). Code is all merged & deployed; these activate/secure it. Project ref: **`phabxcijbbphfxvjedfj`**.

Order matters: **Phase 0** first (cheap, activates shipped code), then **Phase 1** before any real client, then **Phase 2** only when someone's ready to pay, then **Phase 3** as-needed.

---

## Phase 0 — Activate what's already built (~1–2 hrs, no cost)

### 0.1 Rotate the Supabase access token — do this FIRST
The old token (`sbp_…`) was visible during development. Rotate it, then use the new one for every CLI step below.
1. Supabase Dashboard → top-right avatar → **Account → Access Tokens**.
2. **Revoke** the old token; **Generate** a new one; copy it.
3. Authenticate the CLI with it:
   ```
   npx supabase login        # paste the new token when prompted
   ```
**Done when:** `npx supabase projects list` shows your project.

### 0.2 Run migration 017 (activates Sprint 3 acknowledgements)
1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/017_acknowledgements.sql` → **Run**.
3. (Sanity) confirm earlier migrations are applied — Dashboard → **Database → Tables** should show `acknowledgements`, `crm_tasks`, `fee_schedules`, `invoices`, `balance_history`, `audit_log`.
**Done when:** the `acknowledgements` table exists and the query returned success.

### 0.3 Redeploy the Edge Functions (Sprint 1 security fixes)
All 7 import the shared CORS file that changed, so redeploy all. JWT stays **on** by default; the three public/webhook ones keep `--no-verify-jwt`.
```
# JWT-verified (default)
npx supabase functions deploy create-checkout-session  --project-ref phabxcijbbphfxvjedfj
npx supabase functions deploy generate-invoices        --project-ref phabxcijbbphfxvjedfj
npx supabase functions deploy plaid-create-link-token  --project-ref phabxcijbbphfxvjedfj
npx supabase functions deploy plaid-exchange-token     --project-ref phabxcijbbphfxvjedfj
# public / webhook (no JWT)
npx supabase functions deploy health        --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
npx supabase functions deploy worm-export    --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
```
Optional: if you ever serve the app from a host other than `prismaw.com` (e.g. `www`), set the CORS origin:
```
npx supabase secrets set ALLOWED_ORIGIN=https://prismaw.com --project-ref phabxcijbbphfxvjedfj
```
**Done when:** `curl https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/health` returns `{"ok":true,...}`.

### 0.4 (Optional) Turn on the RLS test in CI
Lets the GitHub Actions `rls-isolation` job actually run (it skips silently until then).
1. Create a **disposable/staging** Supabase project (or accept running against prod — the test rolls back, but staging is safer).
2. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**: name `DATABASE_URL`, value = that project's connection string (Supabase → **Project Settings → Database → Connection string**, "Session pooler" or "Direct").
**Done when:** the next push shows the `rls-isolation` job running "ALL CHECKS PASSED" instead of "skipped".

---

## Phase 1 — Before your first real advisor (required for live client data)

### 1.1 Upgrade Supabase to Pro  🔴 #1 blocker
Free tier auto-pauses after 7 days idle and has **no backups**. Don't put real client data on it.
1. Dashboard → **Project Settings → Billing → Upgrade to Pro** ($25/mo).
2. Then **Project Settings → Database → Point-in-Time Recovery** → enable.
**Done when:** plan shows Pro and PITR is on.

### 1.2 Rotate the remaining secrets
```
npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32) --project-ref phabxcijbbphfxvjedfj
```
- After changing `CRON_SECRET`, the scheduled jobs that send it must use the new value — open Dashboard → **Database → Cron jobs** (or re-run the relevant lines in `supabase/migrations/015_cron_billing.sql` / `016_worm_archive.sql`) so `prism-quarterly-invoices` and the WORM export send the new secret.
- Rotate the **Stripe test key** too if it was ever shared (Stripe Dashboard → Developers → API keys → roll). You'll replace it with the live key in Phase 2 anyway.
**Done when:** a manual "Run billing now" from Admin still succeeds (proves the cron secret path matches).

### 1.3 Stand up the inboxes referenced on the legal pages
`privacy@`, `legal@`, `security@` `prismaw.com`. Easiest: **Cloudflare → your domain → Email → Email Routing** → add the three addresses → route to your real inbox.
**Done when:** a test email to each lands in your inbox.

### 1.4 Have counsel review the legal drafts
`privacy.html`, `terms.html`, `dpa.html` are solid, substantive drafts — **not** a substitute for review. Send them (and the Colorado governing-law / LeMay Ventures LLC details) to an attorney before a paying customer.
**Done when:** counsel has signed off or given edits to apply.

### 1.5 Verify the auth configuration
Dashboard → **Authentication → URL Configuration**:
- **Site URL** = `https://prismaw.com`
- **Redirect URLs** include `https://prismaw.com/**` (and `www` if you use it).
- **Authentication → Providers → Google** is enabled with the production redirect URI registered in Google Cloud.
**Done when:** a real Google sign-in completes and lands in `/app`.

---

## Phase 2 — When a partner is ready to pay (Stripe go-live)

### 2.1 Switch Stripe to live
1. Stripe Dashboard → toggle **View test data → off** (live mode).
2. Create the **Growth** product/price (live) → copy the price ID.
3. Set the live secrets:
   ```
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_…       --project-ref phabxcijbbphfxvjedfj
   npx supabase secrets set STRIPE_PRICE_GROWTH=price_…live…  --project-ref phabxcijbbphfxvjedfj
   ```
4. Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** →
     ```
     npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_… --project-ref phabxcijbbphfxvjedfj
     ```
5. Redeploy the two billing functions so they pick up the new secrets:
   ```
   npx supabase functions deploy create-checkout-session --project-ref phabxcijbbphfxvjedfj
   npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
   ```

### 2.2 Smoke-test billing
- **Test mode first:** Admin → Upgrade to Growth → card `4242 4242 4242 4242` → expect the plan to flip to "Growth · active"; check the Stripe webhook delivery returned **200**.
- Repeat once on live mode with a real card, then refund.
**Done when:** a checkout flips the firm's plan and the webhook shows 200.

---

## Phase 3 — Optional / as-needed

### 3.1 Finish the Search Console digest (the one you were mid-setup on)
1. Add the service account **`gsc-digest@tradecode-engine.iam.gserviceaccount.com`** as a **Full** user on the `prismaw.com` Search Console property (retry past the 24h mark; ensure the Search Console API is enabled in the `tradecode-engine` GCP project).
2. Add the repo secret **`GSC_SA_KEY`** (the service-account JSON).
**Done when:** Actions → "SEO search digest" → Run workflow posts a comment to the rolling SEO Issue.

### 3.2 Activation (the actual growth work)
- Recruit **3–5 design partners** using `docs/design-partner-kit.md` (warm network → XYPN/NAPFA/Kitces/LinkedIn).
- Stand up the founder content channel using `docs/founder-content-starter.md`.

### 3.3 Only when you go to Plaid production
- Request Plaid production access; set `PLAID_ENV=production` + production `PLAID_CLIENT_ID`/`PLAID_SECRET` via `supabase secrets set`; redeploy the two Plaid functions.
- **Security:** move `aggregation_items.access_token` into **Supabase Vault** before storing real tokens (the top latent finding from the Edge Function review). Until then, keep Plaid in sandbox.

---

### Fastest path to revenue
Phase 0 (activate) → Phase 1.1 + 1.3 + 1.4 (infra + inboxes + counsel) → recruit one design partner → Phase 2 only when they click pay. Everything in Phase 3.3 stays parked until a partner actually needs linked accounts.

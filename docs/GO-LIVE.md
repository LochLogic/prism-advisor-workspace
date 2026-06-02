# Go-Live Runbook

Everything that must be true before a **real advisor with real client data** uses Prism. Ordered so each section unblocks the next. Most of this is account/console work, not code.

Project ref: `phabxcijbbphfxvjedfj` · Domain: `prismaw.com` (Cloudflare) · Hosting: Cloudflare Workers static assets (`git push main` → `npm run build` → serves `_site/`).

> Legend: ⬜ to do · 🔒 security-critical · 💳 billing · 🏛 legal · ☁️ infra

---

## A. Legal & entity (🏛) — do first; gates everything public
- ⬜ Decide the operating entity (sole prop vs. LLC). An LLC is worth it before holding others' client data.
- ⬜ Fill the placeholders in the legal pages (highlighted `[…]`):
  - `terms.html` → governing-law **state**.
  - `privacy.html` → business **mailing address**.
- ⬜ Stand up the inboxes referenced on the pages: **privacy@**, **legal@**, **security@** prismaw.com (Cloudflare Email Routing → your inbox works fine).
- ⬜ Have counsel review Privacy, Terms, and the DPA before the first paying customer. They are solid drafts, not a substitute for review.
- ⬜ Confirm your own **RIA regulatory standing** is separate from Prism — Prism is software; the advisor stays the fiduciary (already stated in Terms §4).

## B. Infrastructure hardening (☁️🔒) — before any real data lands
- ⬜ **Supabase → Pro ($25/mo).** Free tier auto-pauses after 7 days idle and has **no backups/PITR**. Non-negotiable before live client data.
- ⬜ Verify **Point-in-Time Recovery** is on after upgrading.
- 🔒 **Rotate the Supabase access token** (`sbp_…`) exposed during development — Dashboard → Account → Access Tokens. Generate a fresh one for any further CLI/Management-API work.
- 🔒 **Rotate `CRON_SECRET`** (used by `generate-invoices` / `worm-export` schedulers): `npx supabase secrets set CRON_SECRET=<new> --project-ref phabxcijbbphfxvjedfj`, then update the pg_cron job bodies that send it.
- ⬜ Confirm all migrations `001`–`016` are applied (Supabase → Database → Migrations, or re-run idempotently).
- ⬜ Confirm the `worm-export` daily job is running and writing to the private `compliance-archive` bucket.
- ⬜ (Roadmap) Replicate the archive bucket to **object-lock storage** (S3 Object Lock) for true 17a-4-grade WORM. Until then, keep the security page honest (it already says "on the roadmap").

## C. Payments go-live (💳🔒) — Stripe
- 🔒 Swap to **live keys**: `npx supabase secrets set STRIPE_SECRET_KEY=sk_live_… --project-ref phabxcijbbphfxvjedfj`.
- ⬜ Create the **live** Growth price; set `STRIPE_PRICE_GROWTH=<live price id>`.
- ⬜ Register the **live webhook** → `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook` for events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- 🔒 Set the live signing secret: `STRIPE_WEBHOOK_SECRET=whsec_…`.
- ⬜ Redeploy if needed: `npx supabase functions deploy create-checkout-session --project-ref phabxcijbbphfxvjedfj` and `… stripe-webhook --no-verify-jwt …`.
- ⬜ Reflect the final pricing model (household tiers — Solo ≤25 / Growth ≤150 / Enterprise unlimited; see `docs/ROADMAP.md`) in the live Stripe products.

## D. Aggregation go-live (🔒) — Plaid · OPTIONAL, can defer
Per the wedge, aggregation is a supporting feature, not the lead — **defer until a design partner needs it.**
- ⬜ When needed: request **Plaid production** access; set `PLAID_ENV=production` + production `PLAID_SECRET`/`PLAID_CLIENT_ID`.
- 🔒 Move `aggregation_items.access_token` into **Supabase Vault** before storing real tokens.
- ⬜ Redeploy `plaid-create-link-token` and `plaid-exchange-token`.

## E. Auth & domains (🔒) — verify
- ⬜ Supabase Auth → **Site URL** = `https://prismaw.com`; redirect allow-list includes prismaw.com (+www) and workers.dev.
- ⬜ Google OAuth: production origins/redirect URIs registered for prismaw.com.
- ⬜ Confirm HTTPS + the enforced CSP/HSTS headers are live (they ship in `_site/_headers`).

## F. Pre-launch smoke test
- 💳 In **test mode first**: Admin → Upgrade to Growth → card `4242 4242 4242 4242` → expect "Growth · active"; confirm the Stripe webhook delivery returned 200. Repeat once on live mode with a real card (then refund).
- 🔒 Run the **RLS isolation test** against a staging copy: `DATABASE_URL=… npm run test:rls` → expect "ALL CHECKS PASSED".
- ⬜ Run `npm test` (build + smoke checks + calc tests) green.
- ⬜ Walk the **demo end-to-end yourself** (it now opens on the client roadmap) so a live partner walkthrough is smooth.
- ⬜ Create a throwaway firm via real signup → provision → add a household → confirm isolation by logging in as a second firm.

## G. Make the safety nets enforcing (CI)
- ⬜ Add a **DB-enabled CI job** that sets `DATABASE_URL` (staging) and runs `npm run test:rls`, so tenant-isolation regressions fail the build. (`npm test` already runs build + smoke + calc tests on every push.)

---

### Fastest path to "first paying advisor"
A → B → E → F. **C** only when they click upgrade; **D** only when they ask for linked accounts; **G** whenever. Don't let Plaid/object-lock block the first signature.

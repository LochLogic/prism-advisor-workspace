# Edge Function Security Review — Sprint 1

Reviewed all 7 Supabase Edge Functions (2026-06, Sprint 1.3). Overall posture is **good**: secrets stay server-side, the service role is only used *after* an auth gate, the Stripe webhook is signature-verified, and `plaid-exchange-token` already does a defense-in-depth client-ownership check beyond RLS.

> **Deploy note:** the fixes below change `_shared/cors.ts` (imported by all 7) and 3 functions. Redeploy after merging:
> `npx supabase functions deploy <name> --project-ref phabxcijbbphfxvjedfj` (use `--no-verify-jwt` only for `health`, `stripe-webhook`, `worm-export` as before).

## Findings & status

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | 🟠 Med | **CORS `Access-Control-Allow-Origin: *`** on every function (the shared header). Doesn't grant data access on its own — every function is JWT/cron-gated — but it's unnecessary exposure and the code already flagged it. | ✅ **Fixed** — locked to `https://prismaw.com`, overridable via the `ALLOWED_ORIGIN` secret; added `Vary: Origin`. |
| 2 | 🔴 High *(latent)* | **Plaid `access_token` stored in plaintext** in `aggregation_items` (exchange-token). Not exploitable today — Plaid runs in sandbox and the table is service-role-only (no client RLS read) — but plaintext long-lived credentials at rest is the top risk once Plaid goes live. | 📋 **Documented — do before Plaid production.** Move the column into **Supabase Vault** (encrypt at rest); see Tier-4 backlog. |
| 3 | 🟡 Low | **`plaid-create-link-token` skipped the client-ownership check** that `exchange-token` performs — any signed-in user could mint a Link token for an arbitrary `clientId`. No data exposure (exchange still verifies), but inconsistent. | ✅ **Fixed** — added the same RLS-scoped `advised` check. |
| 4 | 🟡 Low | **`x-cron-secret` compared with `===`** (not constant-time) in `generate-invoices` / `worm-export`. Timing attack on a high-entropy secret over the network is impractical, but cheap to harden. | ✅ **Fixed** — `safeEqual()` constant-time compare in `_shared/auth.ts`. |
| 5 | 🟢 Info | **Error responses echo `(e as Error).message`** to the caller — can reveal internal/Plaid details. Functions are auth-gated, so low risk. | 📋 **Documented** — consider generic client errors + server-side logging in a future pass. |

## Confirmed-good (no change)
- **`stripe-webhook`** — async signature verification via `constructEventAsync` + SubtleCrypto; service-role writes keyed by `firm_id` from `client_reference_id` / subscription metadata (which `create-checkout-session` sets). Solid.
- **`create-checkout-session`** — JWT-verified; resolves the caller's firm; reuses/creates the Stripe customer; service role only touches the per-firm `subscriptions` row.
- **`generate-invoices`** — dual entry (admin JWT → own firm / cron → all firms); admin role checked; idempotent via the unique(client, period) constraint.
- **`worm-export`** — admin/cron gated; append-only upload (`upsert:false`) to a private bucket. (Full 17a-4 still needs object-lock storage — Tier-4 backlog.)
- **`health`** — intentionally public, returns static status only.

## Net
2 real fixes applied (CORS lockdown, Plaid ownership check), 1 hardening (constant-time secret), 2 items documented (Plaid-token-at-rest is the one that **must** land before Plaid production; error-message hygiene is low-priority). No critical exploitable issue in the current (sandbox/test) configuration.

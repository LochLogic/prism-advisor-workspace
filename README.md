<div align="center">

# Prism — Advisor Workspace

**A lifecycle-planning workspace for Registered Investment Advisors (RIAs).**

Client roadmaps · compliance-grade audit trail · CRM & workflow · account aggregation · performance reporting · billing automation.

🌐 **Live:** [prismaw.com](https://prismaw.com) · [Explore the demo](https://prismaw.com/landing.html)

</div>

---

## What it is

Prism gives an advisory firm one place to plan, communicate, and run the back office:

- **For clients** — a guided **seven-phase "Wealth Horizons"** roadmap (Foundation → Legacy) with interactive planning tools, a request-a-meeting flow, downloadable performance reports, and a "discuss with advisor" thread on any milestone.
- **For advisors** — a command center: client roster, auto-generated alerts, a flagged-question inbox with reply threads, per-client accounts/meetings/tasks/timeline/performance, a pipeline board, and one-click reports.
- **For firm admins** — advisor roster, revenue & billing (fee schedules + automated invoicing), and an append-only compliance audit trail.

## Feature highlights

| Area | What's built |
|---|---|
| **Planning** | 7-phase lifecycle roadmap + 8 calculators: cash flow, liquidity reserve, debt avalanche, HSA, asset location, Monte Carlo, Roth-conversion ladder, estate, and tax-loss harvesting |
| **Compliance** | Append-only audit trail (SEC 17a-3 oriented), WORM-style soft deletes & nightly archive to private storage (17a-4 oriented), immutable profile versioning, per-client compliance export, **TOTP MFA** |
| **CRM / workflow** | Tasks (priorities, due dates, cross-advisor assignment), one-click review cadences, client pipeline stages + board, full interaction timeline |
| **Aggregation** | Plaid account linking, daily balance-history time-series (provenance-tagged: manual / plaid / custodian) |
| **Performance** | Time-weighted return (Modified Dietz), benchmark-relative comparison, account-mix, value chart, branded client PDF |
| **Billing** | SaaS subscriptions (Stripe Checkout + webhook); advisory-fee billing — tiered fee schedules, frequency-aware automated invoicing (pg_cron), invoice PDFs, revenue dashboard |
| **Collaboration** | Realtime notifications with deep-linking, two-way flagged-question threads, meeting request → confirm scheduling |
| **Onboarding** | Demo-first landing page, true self-serve signup (auto-provisions firm + admin), Google / password / magic-link auth |

## Architecture

A deliberately dependency-light single-page app, backed entirely by Supabase, hosted as static assets on Cloudflare.

```
Browser ──► Cloudflare Workers (static assets at prismaw.com)
                │  index/login/signup/landing + dist/bundle.js + /vendor libs
                ▼
            Supabase
              ├─ Postgres + Row-Level Security (multi-tenant: firm → advisor → client)
              ├─ Auth (email/password, magic link, Google OAuth, TOTP MFA, PKCE)
              ├─ Realtime (alerts, flagged questions, meetings, messages)
              ├─ Storage (private compliance-archive bucket)
              └─ Edge Functions (Stripe, Plaid, invoicing, WORM export)
```

- **No framework / no module system.** Source files attach to `window.*`; `build.mjs` concatenates them in load order and runs **esbuild** (JSX transform + minify) into a single `dist/bundle.js`. React + ReactDOM + supabase-js are **self-hosted** in `/vendor` (only Plaid loads from its CDN).
- **Multi-tenant RLS** is the security backbone — every table is row-level-secured by `firm → advisor → client`, enforced by `px_current_advisor_id() / firm_id() / client_id()` helpers.
- **Edge Functions** hold all secrets (Stripe, Plaid) server-side and run the scheduled jobs (`pg_cron` → invoicing, nightly WORM archive).

### Tech stack
React 18 (UMD) · esbuild · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions/Deno) · Stripe · Plaid · Cloudflare Workers Static Assets.

## Repository layout

```
index.html  login.html  signup.html  landing.html   # entry pages
build.mjs                                            # concat + esbuild + assemble _site/
wrangler.jsonc                                       # Cloudflare deploy config (assets: ./_site)
vendor/                                              # self-hosted React / ReactDOM / supabase-js
src/
  supabase-client.js   icons.jsx   data.jsx   db.jsx
  store.jsx   auth.jsx   components.jsx   calculators.jsx
  numbers-panel.jsx   client-portal.jsx   advisor-dashboard.jsx   app.jsx
  styles.css
supabase/
  migrations/         # 001–016 (hand-run in the SQL editor or via API)
  functions/          # health, create-checkout-session, stripe-webhook,
                      # plaid-create-link-token, plaid-exchange-token,
                      # generate-invoices, worm-export
scripts/check.mjs     # CI smoke assertions
.github/workflows/ci.yml
```

## Develop

```bash
npm install
npm run build      # → dist/bundle.js + _site/ (deployable)
npm run check      # 21 build-artifact smoke assertions
npm test           # build + check
```

Open `index.html` (it expects `window.__sb`; see `src/supabase-client.js`). With no Supabase connection it falls back to **demo mode** with seeded mock data.

## Deploy

- **Frontend:** push to `main` → Cloudflare builds `npm run build` and serves `_site/` (the build injects content-hash cache-busting and a `_headers` file with an enforced CSP + HSTS).
- **Database:** run `supabase/migrations/*.sql` in order (Supabase SQL editor or Management API).
- **Edge Functions:** `npx supabase functions deploy <name> --project-ref <ref>`; secrets via `supabase secrets set` (Stripe, Plaid, cron secret).

## Security & hardening

Enforced **CSP + HSTS**, sanitized HTML render paths, self-hosted core libraries, minified + cache-busted bundle, fail-closed role detection, optional **TOTP MFA** with AAL2 enforcement, append-only audit logging, and a **CI gate** (build + smoke checks on every push/PR).

> **Compliance note:** Prism's audit trail, retention, and versioning are **designed around** SEC Rule 17a-3 / 17a-4 principles. Production use with live client data additionally requires object-lock storage for the archive, a backed-up database tier, and the firm's own regulatory review.

## Status

Live on `prismaw.com`. Stripe and Plaid currently run in **test / sandbox** mode pending go-live key rotation. See the project roadmap for remaining items (external-dependency-gated: custodian feeds, holdings-level attribution, calendar sync, object-lock WORM).

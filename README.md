<div align="center">

# Prism — Advisor Workspace

**A lifecycle-planning workspace for Registered Investment Advisors (RIAs).**

Client roadmaps · compliance-grade audit trail · CRM & workflow · account aggregation · performance reporting · billing automation · calendar sync · AI assist · white-label branding.

🌐 **Live:** [prismaw.com](https://prismaw.com) · [Explore the demo](https://prismaw.com/landing.html)

</div>

---

## What it is

Prism gives an advisory firm one place to plan, communicate, and run the back office:

- **For clients** — a guided **seven-phase "Wealth Horizons"** roadmap (Foundation → Legacy) with interactive planning tools, secure two-way messaging, a document vault, a request-a-meeting flow, downloadable performance reports, and a "discuss with advisor" thread on any milestone.
- **For advisors** — a command center: client roster, auto-generated alerts, a flagged-question inbox with reply threads, per-client accounts/meetings/tasks/timeline/performance, a pipeline board, prospect/proposal mode, calendar sync, an AI relationship assistant, and one-click reports.
- **For firm admins** — advisor roster, revenue & billing (fee schedules + automated invoicing), white-label branding, exam-ready compliance export, and an append-only audit trail.

## Feature highlights

| Area | What's built |
|---|---|
| **Planning** | 7-phase lifecycle roadmap + **25 interactive tools** across the phases: cash flow, freedom-date, net-worth trajectory, liquidity reserve, income runway, debt avalanche / debt-vs-invest / mortgage payoff, HSA, tax-bracket headroom, HDHP-vs-PPO, 1040 tax-return insights, asset location, contribution priority, mega-backdoor capacity, Monte Carlo, tax-loss harvesting, equity-comp concentration, Roth-conversion ladder & window, withdrawal sequencing, RMD, Social-Security claiming, and estate |
| **AI assist** | Gemini-backed (key server-side, every call audited): message-draft, household summary, review talking points, and "who needs attention?" book triage — always a draft the advisor owns |
| **Compliance** | Append-only audit trail (SEC 17a-3 oriented), WORM-style soft deletes & nightly archive to private storage (17a-4 oriented), immutable profile versioning, per-client + firm-wide exam-ready export, **DocuSign e-sign**, **TOTP MFA** |
| **CRM / workflow** | Tasks (priorities, due dates, cross-advisor assignment), one-click review cadences, client pipeline stages + board, prospect/proposal mode, bulk CSV import, calendar sync (Google + Microsoft), full interaction timeline |
| **Aggregation** | Plaid account linking, daily balance-history time-series (provenance-tagged: manual / plaid / custodian) |
| **Performance** | Time-weighted return (Modified Dietz), benchmark-relative comparison, account-mix, value chart, branded client PDF |
| **Billing** | SaaS subscriptions (Stripe Checkout + webhook); advisory-fee billing — tiered fee schedules, frequency-aware automated invoicing (pg_cron), invoice PDFs, revenue dashboard |
| **Collaboration** | Realtime notifications with deep-linking, two-way secure messaging, flagged-question threads, document vault + requests, meeting request → confirm scheduling |
| **Branding** | Per-firm white-label: accent color + logo + optional "powered by Prism", applied across the advisor app and client portal |
| **Onboarding** | Demo-first landing page, true self-serve signup (auto-provisions firm + admin), client invite/claim, Google / password / magic-link auth |

## Architecture

A deliberately dependency-light single-page app, backed entirely by Supabase, hosted as static assets on Cloudflare.

```
Browser ──► Cloudflare Workers (static assets at prismaw.com)
                │  index/login/signup/landing + dist/bundle.js (/app)
                │  + dist/portal.js (/portal, slim client bundle) + /vendor libs
                ▼
            Supabase
              ├─ Postgres + Row-Level Security (multi-tenant: firm → advisor → client)
              ├─ Auth (email/password, magic link, Google OAuth, TOTP MFA, PKCE)
              ├─ Realtime (alerts, flagged questions, meetings, messages)
              ├─ Storage (private compliance-archive + document vault buckets)
              └─ Edge Functions (Stripe, Plaid, invoicing, WORM export, DocuSign,
                                 calendar OAuth/events, AI assist, error pipeline)
```

- **No framework / no module system.** Source files attach to `window.*`; `build.mjs` concatenates them in load order (per `build-files.mjs`) and runs **esbuild** (JSX transform + minify) into two bundles from one source pool — `dist/bundle.js` (`/app`, advisor/admin) and a slim `dist/portal.js` (`/portal`, client-only, excludes advisor files). React + ReactDOM + supabase-js are **self-hosted** in `/vendor` (only Plaid loads from its CDN).
- **Multi-tenant RLS** is the security backbone — every table is row-level-secured by `firm → advisor → client`, enforced by `px_current_advisor_id() / firm_id() / client_id()` helpers.
- **Edge Functions** hold all secrets (Stripe, Plaid, Gemini, DocuSign, calendar OAuth tokens) server-side and run the scheduled jobs (`pg_cron` → invoicing, nightly WORM archive).

### Tech stack
React 18 (UMD) · esbuild · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions/Deno) · Stripe · Plaid · DocuSign · Google / Microsoft Calendar · Gemini · Cloudflare Workers Static Assets.

## Repository layout

```
index.html  login.html  signup.html  landing.html  portal.html   # entry pages
oauth-callback.html  dpa/privacy/security/sla/terms.html          # callbacks + legal
build.mjs           # concat + esbuild → dist/{bundle,portal}.js + assemble _site/
build-files.mjs     # single source of truth for src load order (both bundles)
wrangler.jsonc      # Cloudflare deploy config (assets: ./_site)
vendor/             # self-hosted React / ReactDOM / supabase-js
src/
  error-reporter.js  supabase-client.js  brand-boot.js  icons.jsx  data.jsx
  calc-core.cjs  db.jsx  store.jsx  auth.jsx  components.jsx  shell.jsx
  calculators.jsx  numbers-panel.jsx  client-portal.jsx
  advisor-modal.jsx  advisor-dashboard.jsx  firm-admin.jsx
  app.jsx  portal-app.jsx  styles.css  print.css
supabase/
  migrations/         # 001–034 (hand-run in the SQL editor or via API)
  functions/          # health, create-checkout-session, stripe-webhook,
                      # plaid-create-link-token, plaid-exchange-token,
                      # generate-invoices, worm-export, docusign-connect,
                      # docusign-envelope, calendar-oauth, calendar-events,
                      # ai-assist, log-error, error-digest
scripts/              # check.mjs (smoke), lint.mjs, calc.test.mjs, rls/db tests
.github/workflows/    # ci, deploy, scheduled-publish, seo-digest, seo-health
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
- **Database:** run `supabase/migrations/*.sql` **by hand in order** in the Supabase SQL editor (the migration ledger is intentionally unmanaged — never `db push`).
- **Edge Functions:** deploy via the gated workflow — `gh workflow run deploy.yml -f confirm=deploy` (hardcoded function list; add new functions to it). Secrets sync via `gh workflow run sync-secrets.yml -f confirm=sync`.

## Security & hardening

Enforced **CSP + HSTS**, sanitized HTML render paths, self-hosted core libraries, minified + cache-busted bundle, fail-closed role detection, optional **TOTP MFA** with AAL2 enforcement, append-only audit logging, and a **CI gate** (build + smoke checks on every push/PR).

> **Compliance note:** Prism's audit trail, retention, and versioning are **designed around** SEC Rule 17a-3 / 17a-4 principles. Production use with live client data additionally requires object-lock storage for the archive, a backed-up database tier, and the firm's own regulatory review.

## Status

Live on `prismaw.com`. Stripe and Plaid currently run in **test / sandbox** mode pending go-live key rotation. See the project roadmap for remaining items (external-dependency-gated: custodian feeds, holdings-level attribution, object-lock WORM, SSO/SAML).

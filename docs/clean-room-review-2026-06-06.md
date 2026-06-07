# Clean-room review — Prism Advisor Workspace

> Date: 2026-06-06. A full-stack pass across CX, UX, UI, click-pathing, frontend,
> backend, system architecture, code/resource optimization, database, scalability,
> InfoSec, QA, DevOps/CI-CD, and monitoring/telemetry — followed by a **wedge
> expansion** analysis ("what makes an RIA drop their current stack for this").
>
> **Headline verdict:** the product is genuinely mature and well-engineered. The
> security posture, multi-tenant RLS, calc core, and build/deploy pipeline are
> strong for this stage. The gaps are now concentrated in three places: **adoption
> friction** (you can't get an RIA's book *in*), **observability** (you can't see
> what users do or get paged when it breaks), and **switch-worthy depth** (one or
> two features that retire a paid tool). The roadmap additions at the end target
> exactly those.
>
> Severity legend: 🔴 fix before live clients · 🟡 fix soon · 🟢 opportunistic.

---

## How findings map to the product's stage

Prism is pre-first-paying-advisor. That reframes severity: a missing analytics
dashboard is 🟡 (you'll want it the day a design partner logs in), but an
unthrottled public write endpoint is 🔴 (it's a live abuse surface today). Each
finding below is tagged for *this* stage, not for a hypothetical enterprise scale.

---

## 1 · CX — Customer Experience

The buyer is the RIA; the daily user is also their client. Both journeys are unusually polished.

**Strengths**
- The wedge leads everywhere: marketing, demo, and the app all open on the
  seven-horizon roadmap + a live collaboration thread within seconds.
- Journey-aware tone (client copy informs without discouraging; advisor view stays
  unsoftened) — a real CX differentiator, rare in advisor tools.
- The demo lands on a populated client roadmap (1-click, no signup) — the single
  best sales asset here.
- New-advisor empty state offers "add your first client" **and** "load a sample
  household" — removes the cold-start cliff.

**Gaps**
- 🔴 **No way to get a book of business in.** Clients are added one at a time. An
  RIA with 60–150 households will not hand-key them. This is the #1 reason a
  warm prospect stalls. → Bulk import (Tier A, roadmap).
- 🟡 **No white-label branding.** The pitch is "your client portal, no second
  tool" — but it's Prism-branded. An RIA puts *their* name in front of clients.
  Firm logo / accent color / custom subdomain is table stakes here. → Tier A.
- 🟡 **No prospect/proposal mode.** The roadmap is a phenomenal *closing* tool, but
  today it only works after someone is a client. Letting an advisor walk a prospect
  through a sample roadmap before they sign converts the wedge into a sales weapon. → Tier A.
- 🟢 **Gross-vs-net performance** — resolved in this change set: the client portal
  now shows returns **net of advisory fees** (labeled), the honest "what you keep"
  number; the advisor view keeps the gross figure for benchmarking.

## 2 · UX — User Experience (advisor workflow)

**Strengths**
- Notification bell deep-links to the exact client/phase; inline question replies;
  edit-numbers directly from the client modal — the high-value paths are tight and
  explicitly protected against regression.
- Pagination (50/page + load-more) keeps the roster responsive.

**Gaps**
- 🟡 **No global search / command palette.** At 150 households, "jump to client X"
  needs to be one keystroke, not a scroll. A `⌘K` client+action palette is the
  single highest-leverage advisor-UX add.
- 🟢 **No roster bulk actions** (multi-select to assign a task / send a templated
  message / move a phase). Advisors batch-process; this saves real time.
- 🟢 **Keyboard navigation** is limited to the notification dropdown. Power users
  live on the keyboard.

## 3 · UI — Visual & interaction design

**Strengths**
- Cohesive institutional palette, serif numerics, consistent card system. It reads
  as a premium, trustworthy product — exactly right for the buyer.
- Icon-only controls carry `aria-label`s (verified on the doc/composition controls).

**Gaps**
- 🟡 **Pervasive inline styles** (`style={{…}}`) across components. Two costs:
  (a) it's why CSP still needs `'unsafe-inline'` for `style-src` (see InfoSec), and
  (b) visual drift — the same spacing/scale is re-declared dozens of times. A move
  to utility classes / CSS variables pays down both at once.
- 🟢 **Contrast & focus-visible audit.** Confirm the `--ink-faint` / `--ink-mute`
  text on tinted backgrounds meets WCAG AA, and that every interactive element has a
  visible focus ring (compliance-minded firms ask).

## 4 · Click-pathing & navigation

**Strengths**
- The routing split (marketing at `/`, app at `/app`) is clean; the app's absolute
  asset refs resolve from any path.

**Gaps**
- 🟡 **No deep-linkable in-app state.** View/client/tab live in React state +
  sessionStorage, so an advisor can't bookmark or share "Client X → Performance."
  This hurts support ("send me the link"), collaboration, and re-entry. A tiny
  hash/route layer (`/app#/client/:id/performance`) would unlock all three.

## 5 · Frontend

**Strengths**
- **Big win since the last review:** in-browser Babel is gone; an esbuild step now
  emits a single minified `dist/bundle.js` (~321 KB) with content-hash cache-busting.
  React + supabase-js are self-hosted (no runtime CDN except Plaid).

**Gaps**
- 🟡 **No static analysis.** No ESLint / Prettier / TypeScript on a growing JSX
  codebase that relies on bare-name globals across files — exactly the setup where a
  typo'd identifier ships silently. At minimum add ESLint (with
  `no-undef` against a globals allow-list) to CI.
- 🟡 **The client downloads the entire advisor app.** One bundle ships advisor,
  firm-admin, and client code to everyone. Splitting the client portal into its own
  entry would cut the client payload *and* shrink the attack surface a client's
  browser ever sees. (Counts under both Code-Opt and InfoSec.)
- 🟢 **Large modules** (`advisor-modal.jsx` ~86 KB, `store.jsx`/`numbers-panel.jsx`
  ~52 KB). Now that esbuild is in place, real ES-module imports are feasible —
  worth a gradual migration off window-globals for collision safety.

## 6 · Backend (Edge Functions + data layer)

**Strengths**
- Edge functions are tidy and correctly privileged: service-role key confined to
  server-side functions; Stripe webhook verifies signatures with the async
  SubtleCrypto provider; a constant-time compare helper exists for shared secrets.
- `db.jsx` cleanly wraps every Supabase call and gates demo/live on `isUUID`.

**Gaps**
- 🔴 **`log-error` is a public, unauthenticated, unthrottled write.** It's deployed
  `--no-verify-jwt` (correct — it must work pre-auth) and inserts to `client_errors`
  via the service role. Fields are length-capped (good), but there's **no rate
  limit**: a script can flood the table indefinitely. Add a per-IP/global throttle
  (or Cloudflare Turnstile / a tiny token bucket) **and** a retention job that prunes
  `client_errors` older than N days.
- 🟡 **Invoice generation idempotency.** `generate-invoices` runs on cron with the
  service role — confirm a retried/duplicated run can't double-bill (unique
  constraint on `(client_id, period_start, period_end)` or an idempotency key).
- 🟢 **Edge-function tests.** None today; the functions handle money (Stripe) and
  PII (Plaid). A few Deno unit tests around signature handling + the upsert mapping
  would be cheap insurance.

## 7 · System architecture

**Strengths**
- The deliberate split is sound and consistently applied: **planning inputs →
  `profiles.data` jsonb** (no migration; `mergeProfile` backfills), **shared/audited
  entities → relational tables + RLS** (acknowledgements, messages, documents).
- Demo/live parity via `isUUID` is uniform across every data surface.
- RLS helper functions (`px_current_advisor_id`, `px_current_firm_id`, …) are
  `security definer stable` — correct for both safety and planner caching.

**Risks**
- 🟡 **Bare-name global coupling.** All files concatenate into one scope and refer to
  each other by bare name. It works, but there's no isolation: a name collision or
  load-order mistake fails at render time, not build time. The esbuild move makes a
  staged migration to real modules low-risk; do it before the codebase grows further.
- 🟡 **Array fields don't deep-backfill.** `mergeProfile` replaces arrays wholesale,
  so a new field on an array-of-objects (e.g. `dateOfBirth` on `members[]`) won't
  populate onto stored rows — every new array-item field needs a per-field fallback.
  This is a known footgun (documented in `arch-review-w1-w4.md`); keep it on the
  checklist for every future array addition.

## 8 · Code / resource optimization

**Strengths**
- Minified bundle, content-hash busting across JS **and** CSS **and** the
  supabase-client shim, self-hosted vendor libs, clean `_site/` deploy dir that
  never ships `node_modules`/migrations/sources (asserted in `check.mjs`).

**Gaps**
- 🟡 **`styles.css` ships unminified** (~49 KB). esbuild can minify CSS too — free win.
- 🟡 **Single bundle for all roles** (see Frontend) — the largest single resource win
  available is splitting the client portal out.
- 🟢 Images are reasonable (og-image 62 KB); revisit only if Lighthouse flags them.

## 9 · Database optimization

**Strengths**
- 33 indexes across 20 migrations; cascade deletes wired; RLS predicate helpers are
  `stable`.

**Gaps**
- 🟡 **Verify indexes cover the RLS predicates.** Every policy filters on
  `advisor_id` / `firm_id` / `client_id`; those columns (and the common composite,
  e.g. `documents(client_id, uploaded_at desc)` which exists) must be indexed or RLS
  forces seq scans as tables grow. Audit messages/documents/acknowledgements for the
  firm-admin "read across firm" path (`firm_id`).
- 🟡 **Unbounded high-growth tables.** `audit`/compliance log, `client_errors`,
  `balance_history` only grow. Define retention/rollup (or partition by month) before
  a firm with history loads in — cheaper to decide now than to backfill a policy later.

## 10 · Scalability

**Strengths**
- Roster pagination bounds the DOM; realtime channels are scoped by RLS; the pricing
  household caps deliberately bound per-account aggregation cost (a real margin lever).

**Gaps**
- 🔴 **Supabase free tier** — already the #1 human blocker on the roadmap. No PITR /
  backups / connection headroom. Must move to Pro before any live client data.
- 🟢 **No capacity baseline.** A one-off load test (e.g. 200 households, 50 concurrent
  advisors hitting realtime) would convert "should scale" into a known number before
  a design partner stresses it.

## 11 · InfoSec

**Strengths (this is the standout area)**
- **Hardened CSP:** no `'unsafe-inline'` in `script-src`; every executable inline
  script is allow-listed by SHA-256 hash computed over the served bytes; React +
  supabase-js self-hosted; Plaid host-allow-listed. Plus HSTS (preload), XFO DENY,
  nosniff, referrer-policy, permissions-policy, `frame-ancestors 'none'`,
  `object-src 'none'`. `check.mjs` *enforces* that CSP stays non-Report-Only and
  un-`unsafe-inline`'d — regressions fail CI.
- **CORS locked** to the production origin (was `*`), overridable per deploy.
- **Multi-tenant RLS** firm→advisor→client on every shared table, **plus Storage
  object RLS** scoped by first-path-segment = client_id, **plus** short-lived signed
  URLs for downloads. Tenant isolation has a test harness (`rls_isolation.sql`).
- Audit log, WORM export path, and full legal surface (Privacy/Terms/DPA/Security/SLA).

**Gaps**
- 🔴 **`log-error` abuse surface** — see Backend #6.
- 🔴 **Secrets rotation + backups** before live data — rotate the Supabase token,
  service-role, Stripe/CRON secrets; enable PITR. (Roadmap Phase 0 human blocker.)
- 🟡 **`style-src` still allows `'unsafe-inline'`** (documented). Lower risk than
  script injection, but it's the one remaining CSP hole; closing it rides on the
  inline-styles → classes migration (UI #3).
- 🟡 **No advisor MFA enforcement.** Advisors hold client PII; enforce TOTP MFA on
  the advisor role (Supabase Auth supports it) before live.
- 🟡 **No dependency / SAST scanning in CI** — add `npm audit` (or Dependabot) and a
  basic secret-scan; the supply chain is the cheapest thing to monitor and the
  easiest to forget.
- 🟢 **External pen test / review** before the first real client data lands.

## 12 · QA & Testing

**Strengths**
- 77 calc-core unit tests (now including the net-of-fee handling), 34 build/deploy
  smoke assertions in `check.mjs`, an RLS isolation SQL harness, and `integration.sql`.
- `check.mjs` asserts security-relevant invariants (CSP shape, no leaked
  `node_modules`, cache-busting) — testing the *deploy artifact*, not just code.

**Gaps**
- 🟡 **No UI / e2e tests.** The explicitly-protected high-value paths (1-click demo,
  notification deep-link, inline reply, single-screen portal, mobile) have *no*
  automated guard — a refactor can silently break them. A handful of Playwright flows
  over the demo would cover the crown jewels.
- 🟡 **RLS isolation job skips** until the `DATABASE_URL` CI secret is set (against a
  disposable project). It's the most security-relevant test you have — wire it up.
- 🟢 No coverage reporting; no edge-function tests (see Backend).

## 13 · DevOps & CI/CD

**Strengths**
- CI runs `build → check → test:calc` on every push/PR; the required-check naming
  problem is solved; SEO automation (publish, digest, health) runs on schedule;
  Cloudflare auto-deploys from `main`; `_site/` is a clean-room deploy dir.

**Gaps**
- 🟡 **No per-PR preview deploys.** Cloudflare Pages offers them free; reviewers (and
  you) can't currently see a branch live before merge. Highest-value CI/CD add.
- 🟡 **Edge functions & migrations deploy manually.** Functions are `supabase
  functions deploy`'d by hand and migrations are run by hand — the repo can silently
  drift from what's live. Gate a `supabase db push` + function deploy behind a
  manual-approval CI job so the repo is the source of truth.
- 🟡 **No lint/typecheck/audit step** in CI (see Frontend/InfoSec).
- 🟢 No release tags / changelog / rollback runbook. At this size a one-paragraph
  "how to roll back a bad deploy" doc is enough.

## 14 · Monitoring & Telemetry

This is the **thinnest** area and the one that will bite first once a design partner is live.

**Strengths**
- A client-side error reporter (uncaught errors, promise rejections, React boundary)
  best-effort POSTs to `log-error`; the last 20 errors are kept on `window.__pxErrors`.
- A `health` edge function exists; a GSC digest covers SEO.

**Gaps**
- 🔴 **Errors are captured but nobody is told.** There's no alerting and no
  dashboard over `client_errors` — an advisor could hit a wall and you'd never know.
  Wire a daily/real-time alert (email/Slack) on new error clusters.
- 🟡 **No uptime monitoring.** Nothing pings `health` or the app. A free external
  monitor (UptimeRobot/Cloudflare) closes this in minutes.
- 🟡 **No product analytics.** You cannot currently answer "did the design partner
  actually use the roadmap / messaging this week?" — the one question that decides
  whether the wedge is working. Add privacy-respecting, first-party activation
  events (self-hosted Plausible/Umami or a small events table): advisor logged in,
  client invited, message sent, plan updated, report generated.
- 🟢 No RUM/web-vitals; no business-metrics view (active advisors, households, MRR).

---

# Wedge expansion — what makes an RIA drop their stack for this

An RIA today stitches together planning (RightCapital/eMoney), CRM
(Wealthbox/Redtail), portfolio/performance (Orion/Black Diamond/Advyzon), tax
(Holistiplan), and risk (Nitrogen). Prism's wedge is the **client-facing
planning + relationship layer** — the thing none of those does well. To make an
advisor *switch*, Prism must do three things: **(1) remove the cost of moving in,
(2) be visibly better at the one thing, and (3) cover enough adjacent ground to
retire at least one paid tool.** The additions below are sequenced to that.

### Tier A — Adoption unlocks (without these, RIAs won't move)
1. **Bulk client import + migration** — CSV import plus mappers for
   Wealthbox/Redtail/Orion exports. *This is the single biggest blocker to a "yes."*
2. **White-label branding** — firm logo, accent color, custom subdomain, optional
   "powered by Prism." Table stakes for a tool the advisor puts in front of clients;
   it's what makes "no second portal" literally true.
3. **Prospect / proposal mode** — run a prospect through a sample seven-horizon
   roadmap *before* they sign. Turns the wedge into a closing tool → the most direct
   "why switch" because it makes the RIA money, not just saves them time.
4. **Core integrations** — Google/Outlook two-way calendar, real e-signature
   (DocuSign/Dropbox Sign on top of the existing acknowledgements), and a
   Zapier/public API. Each one removes a rip-and-replace objection.

### Tier B — Wedge deepeners (visible client value; retire a tool)
5. **Probability-of-success on the client roadmap** — surface the **Monte Carlo you
   already have** (`calc-core.monteCarlo`) as a confidence band on the retirement
   horizon. Low effort, high expectation-match vs RightCapital/eMoney.
6. **Tax-return insight (Holistiplan-lite)** — "drop the 1040 → planning
   observations surface in the roadmap and the client portal." High willingness-to-pay
   and genuinely differentiating *inside a client-facing portal*.
7. **Risk questionnaire → auto-drafted IPS** — client-facing risk profiling that
   feeds the roadmap and drops a draft IPS into the document vault for e-sign (vault +
   acknowledgements already exist).
8. **One-click review packet (QBR generator)** — auto-assemble a client-ready review
   (roadmap + net-of-fee performance + goals + protection) PDF from data already in
   the system. Saves hours of meeting prep per client; builds on the existing report
   generators.
9. **AI relationship assistant (Opus)** — draft message replies, summarize a
   household, generate review talking points, and flag "who needs attention." A modern
   differentiator that rides directly on the two-way messaging + CRM already shipped.

### Tier C — Reach & retention
10. **Client PWA + push notifications** — clients live on mobile; push on new
    message / task / shared document.
11. **Exam-ready compliance export** — one-click books-&-records / audit packet
    (audit log + acknowledgements + WORM) for SEC/state exams. RIAs fear exams;
    "exam-ready in one click" is a concrete sales line.
12. **Client-initiated uploads** — let clients add statements/tax docs to the vault
    (the `documents.uploaded_by_role` enum already allows `'client'`).

**If forced to pick five** that most move an RIA from "nice demo" to "I'll switch":
**#1 bulk import, #2 white-label, #3 prospect mode, #6 tax-return insight, #9 AI
assistant.** The first three remove friction and create a sales lever; the last two
are the kind of capability an advisor will cancel another subscription to get.

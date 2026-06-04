# Clean-Room Holistic Deep-Dive Review — PLAN

> Status: **plan only — not executed.** This is the blueprint for the final pre-test-user review. Say "go" (optionally with a short-lived Supabase token for live verification) and I execute against it, producing `docs/REVIEW-<date>.md`.

## Purpose & framing
The last gate before real test users touch the product. **Clean-room** = I assess independently from current code and the running app, verifying everything fresh — *not* trusting prior session notes, the memory files, or my own earlier claims. Holistic = the five layers below, end to end.

## Ground rules
- **Verify, don't assume.** Every claim re-checked against code and/or the running app.
- **Evidence-based findings.** Each finding cites a file:line or a reproduction (screenshot / console / network capture).
- **Severity model:** 🔴 Blocker (fix before test users) · 🟠 High · 🟡 Medium · 🟢 Low/Polish.
- **Maturity score** per sub-category: 1 (absent) – 5 (production-grade), with a one-line justification.
- **Honest about limits.** Where I can't verify live (admin view, real auth/MFA, Stripe live, Plaid prod), I assess from code + reason, and explicitly tag it **"needs live verification."**

## Scope
- **In:** the Prism app — frontend bundle, Supabase schema/RLS/RPCs, the 7 Edge Functions, the esbuild build + Cloudflare deploy, GitHub Actions, demo mode, the legal/marketing pages.
- **Out:** FinFire (sibling "for-fun" project).
- **Access caveats:** full DB/RLS and live-auth checks are stronger with a short-lived token or a staging `DATABASE_URL`; without them I run the RLS harness logic + reason from migrations.

## Methods toolbox
Code reading (Grep/Read) · run the app (preview server: screenshots, a11y tree, console, network waterfall, responsive + dark) · the RLS isolation harness · CSP/header probes · Edge Function re-read · esbuild bundle analysis · CI/workflow inspection · dependency/supply-chain scan.

---

## Layer 1 — Experience & Design

### 1a. Customer Experience (CX)
- **Objective:** Does the end-to-end journey build trust and deliver the wedge for each persona?
- **Method:** Walk every journey in the demo + read the live-only flows in code: anonymous→demo→signup→provision→first value; advisor daily loop; client portal; admin.
- **Inspect:** first-impression/trust signals · new-advisor cold start · new-client empty state · the demo's ability to sell the wedge · error/empty/loading states everywhere · microcopy tone & honesty (no overclaiming) · the "what do I do next" clarity at each step.

### 1b. User Experience (UX)
- **Objective:** Friction, clarity, consistency, accessibility.
- **Method:** Task-based walkthroughs + a11y tree + keyboard-only pass.
- **Inspect:** information architecture · consistency of patterns (buttons, modals, forms) · form validation & feedback · undo/confirm on destructive actions · accessibility (labels, focus order/traps, contrast — re-audit, ARIA roles, keyboard operability) · responsive behavior at mobile/tablet/desktop · dark mode parity.

### 1c. User Interface (UI)
- **Objective:** Visual quality, hierarchy, polish.
- **Method:** Screenshot sweep across views/states/breakpoints/themes; inspect computed styles.
- **Inspect:** typographic hierarchy & rhythm · spacing/alignment system · color usage & semantic consistency · component states (hover/active/disabled/loading) · iconography consistency · empty/skeleton states · visual bugs (overflow, clipping, z-index) across light/dark + 3 breakpoints.

### 1d. Click Pathing & User Flows
- **Objective:** Shortest-path efficiency; no dead-ends; deep-linking.
- **Method:** Map every action → click count → outcome, per role (re-do the click-path analysis fresh).
- **Inspect:** golden-path click counts · dead-ends / hidden affordances · notification & alert deep-linking · cross-surface navigation (admin↔advisor↔client) · multi-step flows (signup→provision, request→sign acknowledgement, fee create→assign→invoice) · mobile nav completeness.

## Layer 2 — Engineering

### 2a. Frontend Development
- **Objective:** Correctness, maintainability, React hygiene in the no-module/window-globals model.
- **Method:** Read the bundle source files; trace state/data flow; check for footguns.
- **Inspect:** React hooks correctness (deps arrays, effect cleanup, conditional hooks) · state management (Context providers, prop drilling) · the global-scope/load-order model integrity post-refactor · render-time vs load-time reference safety · dead code / duplication · error boundaries (are there any?) · XSS-safe render paths (`dangerouslySetInnerHTML` sanitization) · the dual-mode `calc-core` correctness · god-file follow-ups.

### 2b. Backend Development
- **Objective:** Edge Functions + RPCs + data-access correctness and robustness.
- **Method:** Re-read all 7 Edge Functions + the `px_*` RPCs + `db.jsx`; trace each mutation.
- **Inspect:** input validation & error handling in functions · idempotency (invoices) · webhook signature handling · the acknowledgement RPC (column-tamper safety) · `db.jsx` query correctness & error paths · auth-actor capture for the audit trail · transaction/consistency gaps (denormalized `aum`/`cash` recompute) · migrations idempotency & ordering (001→017).

### 2c. System Architecture
- **Objective:** Soundness of the overall design and its boundaries.
- **Method:** Diagram the system from code; evaluate tenancy, trust boundaries, coupling.
- **Inspect:** multi-tenant model (firm→advisor→client) integrity · trust boundaries (what's enforced where: RLS vs UI vs function) · the no-build/window-globals tradeoffs at this scale · separation of concerns post-refactor · single points of failure · the demo-mode bypass surface · config/secrets boundary (nothing sensitive client-side).

## Layer 3 — Performance

### 3a. Code & Resource Optimization
- **Objective:** Fast load & render; lean payload.
- **Method:** Measure bundle size, asset weights, load/render timing, network waterfall (preview + reason about prod).
- **Inspect:** `dist/bundle.js` size & growth · vendor payload (React/supabase-js) · render performance (re-render hotspots, big lists, memoization) · image/asset weights (og-image, fonts) · caching/cache-bust correctness · font loading strategy · main-thread work on first paint.

### 3b. Database Optimization
- **Objective:** Query efficiency & index coverage as data grows.
- **Method:** Read migrations for indexes; map the app's query patterns to them; flag N+1 and full-scans.
- **Inspect:** index coverage vs actual query filters/sorts (roster, tasks, balance_history, invoices, acks) · N+1 patterns (per-row fetches) · the book-wide `balance_history` read for the AUM sparkline (cost at scale) · RLS policy cost (subqueries per row) · pagination correctness · denormalization vs joins tradeoffs.

### 3c. Scalability
- **Objective:** Behavior under more firms / advisors / clients / history.
- **Method:** Reason through growth scenarios; identify the first ceilings.
- **Inspect:** roster rendering at 500+ clients (virtualization deferred — re-evaluate) · Edge Function cold-start/throughput · realtime channel fan-out · `balance_history` table growth & query cost · Supabase tier limits · per-account Plaid cost model vs pricing (unit economics) · what breaks first and at roughly what scale.

## Layer 4 — Safeguards

### 4a. Information Security
- **Objective:** Protect client PII/financial data; no privilege or tenant escapes.
- **Method:** RLS isolation harness (run it) + manual policy review of every table + auth-flow review + header/CSP probes + Edge Function authz re-review + dependency/supply-chain check.
- **Inspect:** **RLS coverage on every table** (incl. 017 acknowledgements) + cross-tenant read/write attempts · auth: fail-closed role detection, MFA/AAL2 enforcement, PKCE, session handling · Edge Function authz (JWT/cron/ownership checks) + the deployed CORS lockdown · secrets boundary (nothing private client-side; Plaid token-at-rest finding) · CSP/HSTS/headers (re-verify live) · `SECURITY DEFINER` RPC safety (`search_path`, scoping) · input sanitization / injection surfaces · dependency vulnerabilities (`npm audit`, vendored libs) · demo-mode can't reach real data.

### 4b. QA & Testing
- **Objective:** Confidence that changes don't regress; coverage of critical logic & flows.
- **Method:** Inventory existing tests; map coverage to risk; define the gaps.
- **Inspect:**
  - **Unit:** calc-core coverage (have 39) — gaps? other pure logic (fee tiers, Modified-Dietz edge cases, date math) untested?
  - **Integration:** RLS harness (have it) — wire to CI? Edge Function integration (webhook→subscription, invoice generation, ack RPC) — any automated coverage? auth/provision flow?
  - **UAT:** define acceptance scenarios per persona (advisor onboards client → builds plan → reports; client signs ack → views performance; admin bills) and whether they pass on a clean run — this doubles as the test-user script.
  - Build/smoke checks adequacy; what's *not* covered and the risk of each gap.

## Layer 5 — Operations

### 5a. DevOps & CI/CD
- **Objective:** Safe, repeatable build → deploy; nothing manual that should be automated.
- **Method:** Read `build.mjs`, `.github/workflows/*`, `wrangler.jsonc`; trace the deploy path; check gates.
- **Inspect:** CI coverage (build + check + calc; RLS job gating) · the Cloudflare auto-deploy path & rollback story · migration application process (hand-run risk; drift detection) · Edge Function deploy process (manual CLI — drift risk) · secret management hygiene · branch protection / review gates · the drip-publish & SEO automation workflows · reproducibility (`npm ci`, lockfile).

### 5b. Monitoring & Telemetry
- **Objective:** Can you see failures and usage in production?
- **Method:** Inventory what's observable today vs. what's missing.
- **Inspect:** error monitoring (currently none? — client + Edge Function errors) · uptime/health checks (the `/health` fn — is anything watching it?) · audit log as telemetry · product analytics (signup/activation funnel visibility) · Edge Function logs & alerting · the SEO health/digest workflows · what you'd be *blind* to when a test user hits a bug, and the minimum to fix that.

---

## Deliverable: `docs/REVIEW-<date>.md`
1. **Executive summary** — overall readiness verdict for test users + the top 5 things to fix first.
2. **Maturity scorecard** — a table: 12 sub-categories × score (1–5) + one-line justification.
3. **Findings by layer** — each: severity, location (file:line / repro), impact, recommendation.
4. **🔴 Must-fix-before-test-users shortlist** — the gating subset, ordered.
5. **UAT script** — the persona acceptance scenarios (reusable as the test-user onboarding guide).
6. **Appendix** — what was verified live vs. reasoned-from-code (with the "needs live verification" items called out).

## Effort & sequencing
A genuine multi-pass effort. Suggested order (so the highest-stakes layers anchor the verdict):
1. **Safeguard** (security + testing) — the trust gate; run the RLS harness, probe live headers/CSP, review every policy.
2. **Experience** (CX/UX/UI/flows) — what test users actually touch; full demo sweep + responsive/dark/a11y.
3. **Engineering** (frontend/backend/architecture) — correctness behind both.
4. **Performance** (code/DB/scale) — measure + reason about growth.
5. **Operations** (CI/CD + monitoring) — the safety net for when test users find bugs.
Then synthesize the scorecard + shortlist.

## To execute at full strength, ideally provide:
- A **short-lived Supabase access token** (or staging `DATABASE_URL`) → run the RLS harness against the real schema + verify deployed function authz. *(Optional — I'll reason from code without it and tag those items "needs live verification.")*
- A moment of **live admin login** on your side for the few admin-only UI checks I can't reach in demo.

**Trigger:** say "go" and I'll execute this and deliver `docs/REVIEW-<date>.md`.

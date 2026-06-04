# Post-Review Sprint Plan (Sprints 5–8 + Parked)

Every item from `REVIEW-2026-06-03.md` that isn't a solid ✅, phased by leverage. The three 🔴 must-fixes (error boundary, error reporter, `search_path`) are **done** and excluded. Owner: 💻 = code (me) · 👤 = you (account/dashboard) · 🔁 = mixed.

Ordering rationale: weakest scorecard areas + highest pilot risk first (**Testing 2.5, Monitoring 2.0, DevOps 3.5**), then performance/scale, then polish. Parked items are gated on external events.

---

## Sprint 5 — Test Confidence  *(raises QA 2.5 → ~4)*
**Goal:** the critical flows have automated coverage, and the UAT script passes clean on a fresh run. This is where a pilot breaks.

| # | Item | Sev | Owner |
|---|---|---|---|
| 5.1 | **Wire the RLS isolation harness into CI** — stand up a staging Supabase project, add `DATABASE_URL` secret; the job already exists and skips until then. Runtime proof of tenant isolation. | 🟠 | 👤 (secret) + 💻 |
| 5.2 | **Edge Function integration smoke tests** — webhook→subscription, invoice generation (cron path), ack-sign RPC, against staging. A dependency-free node runner like `rls-test`. | 🟠 | 🔁 |
| 5.3 | **Auth/provision smoke** — signup → `px_provision_firm` → lands as admin (the flow with the least coverage). | 🟠 | 🔁 |
| 5.4 | **Fill unit-test gaps** — fee-tier math (`annualFeeForAum`), Modified-Dietz edge cases (flows at period boundaries), date/period helpers. | 🟡 | 💻 |
| 5.5 | **Execute the UAT script** (3 personas × desktop/mobile × light/dark from the review); fix what fails. Admin persona needs one live login. | 🟡 | 🔁 |

**DoD:** RLS runs green in CI; the 3 critical backend flows have smoke coverage; UAT passes on a clean run.

## Sprint 6 — Observability & Deploy Safety  *(raises Monitoring 2.0, DevOps 3.5)*
**Goal:** you can see failures, and a red build can't ship.

| # | Item | Sev | Owner |
|---|---|---|---|
| 6.1 | **Activate remote error capture** — run migration 018 + deploy `log-error` (already built); confirm `client_errors` fills. | 🟠 | 👤 |
| 6.2 | **Edge Function error visibility** — the client reporter covers the browser; add lightweight surfacing/alerting for *function* errors (a scheduled check, or document watching Supabase function logs + a failure email). | 🟠 | 🔁 |
| 6.3 | **CI → deploy gate** — Cloudflare currently auto-deploys on push regardless of CI. Add branch protection requiring the CI check before merge to `main` (so red builds can't ship). | 🟡 | 👤 |
| 6.4 | **Minimal product analytics** — capture the activation funnel (signup → provision → first client → first roadmap interaction) so you see where pilot users drop. Privacy-light (own events table or a thin analytics tool). | 🟡 | 🔁 |
| 6.5 | **`/health` uptime watch** — nothing watches it today; add a scheduled GitHub Action ping (mirror the SEO-health pattern) that emails on failure. | 🟢 | 💻 |

**DoD:** pilot errors land server-side + alert you; red builds blocked; you can see the activation funnel.

## Sprint 7 — Performance & Scale  *(raises Scalability 3.5, DB/Code Opt 4.0)*
**Goal:** remove the near-term growth ceilings the review flagged.

| # | Item | Sev | Owner |
|---|---|---|---|
| 7.1 | **Index `crm_tasks.assigned_to`** — the task query (`advisor_id OR assigned_to`) seq-scans the assignee side. One-line migration. | 🟡 | 🔁 |
| 7.2 | **Bound the book-wide `balance_history` read** — the Book-AUM sparkline pulls the whole book's daily history; sample to monthly / cap the window so it stays cheap at hundreds of clients. | 🟡 | 💻 |
| 7.3 | **`balance_history` growth strategy** — retention/roll-up plan (daily→monthly archive) before the table gets large. | 🟡 | 🔁 |
| 7.4 | **Payload trim** — `supabase-js` (~200KB) is the heaviest dep; assess deferring/lazy-loading non-critical SDK paths (Plaid SDK already CDN-loaded on demand). | 🟡 | 💻 |
| 7.5 | **Roster virtualization** — deferred (pagination bounds the DOM); build only if a firm reports slowness at 500+ clients. | 🟢 | 💻 |

**DoD:** the two query hot-spots are bounded; payload reviewed; a documented trigger for virtualization.

## Sprint 8 — Polish & Maintainability  *(raises Frontend 3.5, UX/UI 4.x, Architecture)*
**Goal:** close the long-tail and de-risk the no-module model for future work.

| # | Item | Sev | Owner |
|---|---|---|---|
| 8.1 | **Live-verify the firm-admin UI** — demo can't reach admin role; one live admin login to confirm Revenue/audit render (pure refactor, low risk), fix anything found. | 🟡 | 👤 (+💻 if needed) |
| 8.2 | **Load-order guardrail** — a build-time check (or `CONTRIBUTING.md`) so the window-globals/load-order model is safe for new contributors. | 🟡 | 💻 |
| 8.3 | **Full hook-dependency audit** — sweep every `useEffect`/`useMemo` deps array (spot-checks were clean). | 🟢 | 💻 |
| 8.4 | **Login/signup visual polish** — bring them up to the app's design level (functional but plainer today). | 🟢 | 💻 |
| 8.5 | **Document the rollback procedure** — Cloudflare keeps deploy history; write the 3-step "roll back a bad deploy" runbook. | 🟢 | 💻 |

**DoD:** admin verified live; contributor guardrail in place; hooks audited; login/signup polished; rollback documented.

---

## Parked — gated on external events (not scheduled)
| Item | Sev | Trigger |
|---|---|---|
| **Move Plaid `access_token` → Supabase Vault** | 🟠 | Before Plaid **production** (sandbox/parked today) |
| Plaid per-account cost vs flat pricing (unit-economics watch) | 🟡 | When real aggregation volume exists |

---

## Recommended cadence for a pilot
You don't need all four before test users. The honest minimum to **start** a small hands-on pilot is **Sprint 6.1 + 6.3** (deploy the error sink + block red deploys) — both are quick. Then run **Sprint 5** in parallel with early partners (tests protect you as you iterate on their feedback). **Sprints 7–8** are post-pilot unless a partner surfaces a specific issue.

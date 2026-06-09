# Prism — Sprint Log

> Dated, append-only record of shipped sprints. The chat is cleared after each sprint,
> so this (plus [`ROADMAP.md`](ROADMAP.md) and the working [`TODO.md`](TODO.md)) is the
> durable memory. Newest first. Each entry: what shipped, the PR, and the human deploy
> hand-off.
>
> **Baseline reset 2026-06-08.** Everything built before this date is summarized in the
> single foundation entry below rather than logged sprint-by-sprint; the full
> per-sprint detail remains in git history (commits through `c2f299e`). New sprints
> append above this entry.

---

## 2026-06-08 — Foundation baseline (everything shipped to date)

The starting point for the reset. Prism is a mature, multi-tenant RIA workspace —
advisor command center + firm admin + client portal — on a hardened foundation. What's
built and live as of this baseline:

**Core product**
- The seven-horizon ("Wealth Horizons") lifecycle roadmap with per-phase milestones +
  interactive calculators; advisor roster/KPIs; firm-admin revenue + fee schedules +
  invoicing; client portal. Financial math centralized in the dual-mode, unit-tested
  `calc-core.cjs` (incl. retirement readiness, Monte Carlo, Modified-Dietz net-of-fee
  performance, fee tiers).
- Multi-tenant Postgres + **RLS** (firm → advisor → client) on every shared table,
  Storage object RLS, append-only audit trail, soft-deletes for the 17a-4 record.

**Wedge build-out (W1–W6)**
- Fixed-income streams + retirement-readiness engine; goal-based planning; unified
  two-way realtime advisor↔client messaging + advisor inbox; document vault (Supabase
  Storage); insurance/protection + estate capture; reconciling managed-vs-held-away
  asset composition. Demo/live parity (`isUUID` gating) and tone/inclusivity lens
  applied throughout.

**Adoption unlocks & wedge deepeners**
- Bulk CSV client import (Wealthbox/Redtail/Orion mappers); prospect/proposal mode
  (run an unsaved household through the roadmap → one-click convert); client
  invite/claim flow; probability-of-success band; risk questionnaire → draft IPS;
  one-click QBR packet; real **DocuSign** e-sign on acknowledgements (activated on the
  demo account).

**Hardening, infra & quality**
- CSP with **no `unsafe-inline`** on both `script-src` and `style-src` (build-time
  hashing + inline-style → class migration); slim `/portal` bundle (~35% smaller, no
  advisor code in a client browser); deep-link hash routing; ⌘K command palette;
  minified CSS.
- CI: build + lint (`no-undef` over the esbuild concatenation) + `npm audit` +
  Dependabot + calc tests + `check.mjs` deploy-artifact assertions, with
  **`rls-isolation` and `e2e` promoted to required checks**. Gated manual
  deploy workflow for migrations + edge functions. Per-PR Cloudflare preview deploys.
- Error capture + hourly alert digest; `log-error` rate-limit + retention; audit /
  balance_history retention + rollup. Client-initiated document uploads.
- **All CRITICAL + MAJOR findings** from the 2026-06-06 and 2026-06-08 clean-room
  reviews resolved (fail-closed DocuSign webhook, non-forgeable audit RPC, flagged-
  question thread fix, phase white-label backend rebuild, Plaid token in Vault,
  Realtime defense-in-depth, single expense-total helper).
- Legal/trust surface (Privacy/Terms/DPA/Security) drafted + counsel-reviewed (v1);
  entity formed (LeMay Ventures LLC, CO); support inboxes live.

**Migration high-water mark:** `031_advisor_honorific.sql` — all migrations through
`031` are applied on the live project, the gated edge functions (`docusign-connect`,
`plaid-exchange-token`) are deployed, and Realtime-RLS scoping + the `CRON_SECRET`
Vault entry are verified. Repo and live project are in sync.

**Known-open (carried into the reset, not regressions):** the forward tracks in
[`ROADMAP.md`](ROADMAP.md) and the code-quality backlog (MINOR/CLEANUP items left open
by design). Nothing CRITICAL or MAJOR is outstanding.

---

<!-- New sprints append above this line, newest first. -->

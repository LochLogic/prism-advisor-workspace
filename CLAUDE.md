# PRISM Advisor Workspace

## Read this first
**Before any code task, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** It is a
condensed repo map (file tree, `window.db`/`PrismCalc`/store export surfaces, data flows,
edge functions, gotchas). Use it to route work to the right file instead of re-exploring
the codebase from scratch each session. Trust it for structure/contracts; read the named
file for deep logic. It carries a last-synced commit hash and "regenerate when" triggers —
if those triggers fired since that commit, re-verify and regenerate the map.

## Architecture in one breath
React via **window-globals + esbuild concat** (no module bundler — `src/*` files share one
global scope; cross-file refs are bare names published via `window.X`). Two bundles from one
source pool (`build-files.mjs` = load-order source of truth): `dist/bundle.js` → `/app`
(advisor/admin), `dist/portal.js` → `/portal` (slim client, excludes advisor-only files).
Backend = Supabase (Postgres + RLS + Deno edge functions). Hosting = Cloudflare Workers.

## When editing `src/`
- Update the file's `window.*` export assignment, and check `build-files.mjs` order — a file
  may only reference names from files **above** it.
- Frontend `src/calc-core.cjs` (`PrismCalc`) and backend `supabase/functions/_shared/fees.ts`
  are parallel fee implementations — change both together.
- The `/portal` bundle must never reference advisor-only files (advisor-modal/dashboard/firm-admin/platform-admin).

## Commands
`npm run build` · `npm test` (build+smoke+calc) · `npm run lint` · `npm run test:rls` · `npm run test:e2e`.
CI required checks: `ci`, `Cloudflare Workers Builds`, `rls-isolation`, `e2e`.

## Token savers (AI sessions — prefer these)
- **`npm run test:quiet`** — same build+smoke+calc gate, but only failures + summary
  counts (~2 lines instead of ~280). Use it for every in-session test run; plain
  `npm test` stays verbose for humans/CI.
- **`node scripts/outline.mjs <file...>`** (or `--all`) — top-level declarations,
  `window.*` exports, and line numbers for any src file. Outline a big file first,
  then Read only the ranges you need — never full-read store/db/advisor-modal.

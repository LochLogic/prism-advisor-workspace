// Single source of truth for the app's source files, in load order.
// Both the build (build.mjs) and the linter (scripts/lint.mjs) consume this so
// they can never drift: the files concatenate into one shared scope at runtime,
// so the linter must analyse them the same way to resolve cross-file globals.
//
// Two entries are built (see build.mjs):
//   • sourceFiles → dist/bundle.js — the advisor/admin app, served at /app
//   • portalFiles → dist/portal.js — the slim client portal, served at /portal
// portalFiles is a strict subset of the shared files (it drops advisor-modal,
// advisor-dashboard, firm-admin) plus its own entry shell (portal-app.jsx), so a
// client browser never downloads advisor/admin code.

// Shared files used by BOTH entries, in load order.
const sharedFiles = [
  'src/error-reporter.js',
  'src/supabase-client.js',
  'src/icons.jsx',
  'src/data.jsx',
  'src/calc-core.cjs',
  'src/db.jsx',
  'src/store.jsx',
  'src/auth.jsx',
  'src/components.jsx',
  'src/shell.jsx',
  'src/calculators.jsx',
  'src/numbers-panel.jsx',
  'src/client-portal.jsx',
];

// Advisor/admin app (served at /app).
export const sourceFiles = [
  ...sharedFiles,
  'src/paperwork.jsx',      // custodian account-paperwork POC (used by advisor-modal)
  'src/advisor-modal.jsx',
  'src/advisor-dashboard.jsx',
  'src/firm-admin.jsx',
  'src/platform-admin.jsx',
  'src/app.jsx',
];

// Client portal (served at /portal) — shared files + the portal-only entry shell.
export const portalFiles = [
  ...sharedFiles,
  'src/portal-app.jsx',
];

// Union for linting: every source file exactly once, in a resolvable order.
// (portal-app.jsx is the only file not already in sourceFiles.)
export const allFiles = [
  ...sourceFiles,
  'src/portal-app.jsx',
];

// Single source of truth for the app's source files, in load order.
// Both the build (build.mjs) and the linter (scripts/lint.mjs) consume this so
// they can never drift: the files concatenate into one shared scope at runtime,
// so the linter must analyse them the same way to resolve cross-file globals.
export const sourceFiles = [
  'src/error-reporter.js',
  'src/supabase-client.js',
  'src/icons.jsx',
  'src/data.jsx',
  'src/calc-core.cjs',
  'src/db.jsx',
  'src/store.jsx',
  'src/auth.jsx',
  'src/components.jsx',
  'src/calculators.jsx',
  'src/numbers-panel.jsx',
  'src/client-portal.jsx',
  'src/advisor-modal.jsx',
  'src/advisor-dashboard.jsx',
  'src/firm-admin.jsx',
  'src/app.jsx',
];

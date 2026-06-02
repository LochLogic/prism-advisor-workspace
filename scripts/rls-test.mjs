// Prism · RLS isolation test runner.
// Executes supabase/tests/rls_isolation.sql against a Postgres/Supabase database
// using psql. Dependency-free (shells out to psql); the SQL runs in a transaction
// that ROLLS BACK, so it never leaves test rows behind.
//
// Usage:
//   DATABASE_URL="postgresql://...:5432/postgres" npm run test:rls
//
// Get the connection string from Supabase → Project Settings → Database
// (use the direct connection or the session pooler). Run it against a
// disposable/staging project, never blindly against production.
//
// If DATABASE_URL is unset or psql is unavailable, the runner SKIPS (exit 0) so
// it never breaks a CI job that has no database wired up — gate it behind a
// DB-enabled job to make it enforcing.

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const SQL = 'supabase/tests/rls_isolation.sql';
const url = process.env.DATABASE_URL;

if (!existsSync(SQL)) {
  console.error(`✗ ${SQL} not found`);
  process.exit(1);
}

if (!url) {
  console.log('⊘ RLS test skipped: set DATABASE_URL to run it (see scripts/rls-test.mjs).');
  process.exit(0);
}

const hasPsql = spawnSync('psql', ['--version'], { stdio: 'ignore' }).status === 0;
if (!hasPsql) {
  console.log('⊘ RLS test skipped: psql not found on PATH. Install the PostgreSQL client to run it.');
  process.exit(0);
}

console.log('▶ Running RLS isolation test (transaction rolls back; no rows persisted)…\n');
const res = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', SQL], { stdio: 'inherit' });

if (res.status !== 0) {
  console.error('\n✗ RLS isolation test FAILED — a tenant boundary did not hold. See the FAIL line above.');
  process.exit(1);
}
console.log('\n✓ RLS isolation test passed.');

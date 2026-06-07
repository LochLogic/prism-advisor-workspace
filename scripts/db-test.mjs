// Prism · DB test runner — executes every supabase/tests/*.sql against the
// DATABASE_URL via psql. Each script runs in a transaction that ROLLS BACK, so
// it leaves nothing behind and is safe against any Supabase database (use a
// staging project). Skips gracefully when DATABASE_URL or psql is unavailable,
// so a CI job without a DB stays green.
//
// Usage:  DATABASE_URL="postgresql://...:5432/postgres" npm run test:db
import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';

const DIR = 'supabase/tests';
const url = process.env.DATABASE_URL;

if (!existsSync(DIR)) { console.error(`✗ ${DIR} not found`); process.exit(1); }
if (!url) { console.log('⊘ DB tests skipped: set DATABASE_URL to run them (point it at a staging project).'); process.exit(0); }
if (spawnSync('psql', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.log('⊘ DB tests skipped: psql not found on PATH. Install the PostgreSQL client to run them.');
  process.exit(0);
}

// Connectivity precheck. A DATABASE_URL may be configured but point at a DB that
// is unreachable (e.g. a paused/deleted Supabase free-tier project, or stale
// creds). Treat "cannot connect" as a graceful SKIP rather than a hard failure,
// so a non-required CI job stays green instead of being permanently red noise.
// We still ENFORCE when the DB is reachable — only a working `select 1` lets the
// SQL test files run below. (psql exit 2 = connection error.)
const ci = process.env.GITHUB_ACTIONS === 'true';
const probe = spawnSync('psql', [url, '-tAc', 'select 1'], { stdio: ['ignore', 'ignore', 'pipe'] });
if (probe.status !== 0) {
  const why = (probe.stderr?.toString() || '').split('\n').find(Boolean) || `psql exit ${probe.status}`;
  // Redact anything that could identify the (secret) DB: full URLs, the host in
  // psql's `server at "..."` text, parenthesised IPs, and supabase hostnames.
  // We keep the human-readable failure reason (e.g. "Network is unreachable").
  const sanitized = why
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '<url>')
    .replace(/server at "[^"]*"/gi, 'server at <host>')
    .replace(/\([0-9a-fA-F:.]+\)/g, '(<ip>)')
    .replace(/[a-z0-9.-]+\.supabase\.(?:co|com|net)/gi, '<host>');
  const msg = `DB tests skipped: DATABASE_URL is set but the database is unreachable (${sanitized}). Verify the staging project is running and the credentials are current.`;
  console.log(`⊘ ${msg}`);
  if (ci) console.log(`::warning title=rls-isolation::${msg}`);
  process.exit(0);
}

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n▶ ${f}`);
  const res = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', `${DIR}/${f}`], { stdio: 'inherit' });
  if (res.status !== 0) { console.error(`✗ ${f} FAILED`); failed++; } else console.log(`✓ ${f} passed`);
}
if (failed) { console.error(`\n✗ ${failed} DB test file(s) failed.`); process.exit(1); }
console.log('\n✓ All DB tests passed.');

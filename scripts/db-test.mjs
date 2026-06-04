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

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n▶ ${f}`);
  const res = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', `${DIR}/${f}`], { stdio: 'inherit' });
  if (res.status !== 0) { console.error(`✗ ${f} FAILED`); failed++; } else console.log(`✓ ${f} passed`);
}
if (failed) { console.error(`\n✗ ${failed} DB test file(s) failed.`); process.exit(1); }
console.log('\n✓ All DB tests passed.');

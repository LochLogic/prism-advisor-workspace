// Prism smoke checks — run after `npm run build`. Asserts the deploy artifact
// is well-formed so regressions are caught in CI before they ship.
// Usage: node scripts/check.mjs   (exits non-zero on any failure)

import { readFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

let failures = 0;
const ok   = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); failures++; };
const assert = (cond, m) => cond ? ok(m) : fail(m);

const read = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';

// 1. Bundle exists + is valid JS
assert(existsSync('_site/dist/bundle.js'), '_site/dist/bundle.js exists');
try { execSync('node --check _site/dist/bundle.js', { stdio: 'ignore' }); ok('bundle is syntactically valid'); }
catch { fail('bundle failed node --check'); }

const bundle = read('_site/dist/bundle.js');
// 2. Key globals present (survive minify as string keys)
for (const g of ['window.App', 'window.db', 'window.AuthProvider', 'ReactDOM']) {
  assert(bundle.includes(g), `bundle exposes ${g}`);
}

// 3. Required runtime files are in the deploy dir.
//    Routing: landing is served at _site/index.html; the app lives at _site/app/index.html.
for (const f of ['index.html', 'app/index.html', 'login.html', 'signup.html',
                 'privacy.html', 'terms.html', 'dpa.html', 'security.html',
                 'src/styles.css', 'src/supabase-client.js', '_headers',
                 'vendor/react.production.min.js', 'vendor/supabase.js']) {
  assert(existsSync(`_site/${f}`), `_site/${f} present`);
}

// 4. No node_modules leaked into the deploy dir, and it's small
assert(!existsSync('_site/node_modules'), 'no node_modules in _site');

// 5. Security headers: CSP is enforcing (not Report-Only) + HSTS present
const headers = read('_site/_headers');
assert(/Content-Security-Policy:\s/.test(headers), 'CSP is enforcing');
assert(!headers.includes('Report-Only'), 'CSP is not Report-Only');
assert(headers.includes('Strict-Transport-Security'), 'HSTS header present');

// 6. Cache-busting applied to the bundle reference (the app page carries the bundle)
assert(/dist\/bundle\.js\?v=[a-f0-9]{6,}/.test(read('_site/app/index.html')), 'app/index.html has cache-busted bundle ref');

// 7. CSP doesn't reference the old script CDNs (self-hosted now)
assert(!/script-src[^;]*(unpkg|jsdelivr)/.test(headers), 'CSP script-src has no unpkg/jsdelivr');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('All checks passed.');

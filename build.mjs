// Prism build — concatenates all source files in load order, then runs
// esbuild to transform JSX and minify into dist/bundle.js.
// No module bundling needed: files share the global scope via window.X.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';

const files = [
  'src/supabase-client.js',
  'src/icons.jsx',
  'src/data.jsx',
  'src/db.jsx',
  'src/store.jsx',
  'src/auth.jsx',
  'src/components.jsx',
  'src/calculators.jsx',
  'src/numbers-panel.jsx',
  'src/client-portal.jsx',
  'src/advisor-dashboard.jsx',
  'src/app.jsx',
];

const combined = files.map(f => readFileSync(f, 'utf8')).join('\n\n');
const tmp = 'src/_entry.jsx';
writeFileSync(tmp, combined);

try {
  mkdirSync('dist', { recursive: true });
  await esbuild.build({
    entryPoints: [tmp],
    bundle: false,
    outfile: 'dist/bundle.js',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    minify: true,
  });
  console.log('✓ dist/bundle.js built');

  // ── Assemble a clean deploy directory (_site) ──────────────────────
  // Hosts like Cloudflare upload the *entire* output dir, so we copy ONLY
  // the runtime files here — never node_modules, migrations, or .jsx sources.
  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site/dist', { recursive: true });
  mkdirSync('_site/src',  { recursive: true });

  // Content hash over all cache-busted assets → any change to any of them
  // refreshes the lot (CSS-only edits bust too, not just JS).
  const hash = createHash('sha256')
    .update(readFileSync('dist/bundle.js'))
    .update(readFileSync('src/styles.css'))
    .update(readFileSync('src/supabase-client.js'))
    .digest('hex').slice(0, 8);
  const bust = (html) => readFileSync(html, 'utf8')
    .replace(/dist\/bundle\.js(\?v=[^"']*)?/g,         `dist/bundle.js?v=${hash}`)
    .replace(/src\/styles\.css(\?v=[^"']*)?/g,         `src/styles.css?v=${hash}`)
    .replace(/src\/supabase-client\.js(\?v=[^"']*)?/g, `src/supabase-client.js?v=${hash}`);
  for (const html of ['index.html', 'login.html', 'signup.html', 'landing.html']) {
    writeFileSync(`_site/${html}`, bust(html));
  }
  copyFileSync('dist/bundle.js',          '_site/dist/bundle.js');
  copyFileSync('src/styles.css',          '_site/src/styles.css');
  copyFileSync('src/supabase-client.js',  '_site/src/supabase-client.js');

  // Self-hosted libs (no runtime CDN dependency except Plaid, which requires its CDN)
  mkdirSync('_site/vendor', { recursive: true });
  for (const v of ['react.production.min.js', 'react-dom.production.min.js', 'supabase.js']) {
    copyFileSync(`vendor/${v}`, `_site/vendor/${v}`);
  }

  // Security headers (Cloudflare/Netlify read _headers from the deploy root).
  // script-src no longer needs unpkg/jsdelivr (React + supabase-js are self-hosted);
  // only Plaid's CDN remains. 'unsafe-inline' stays for inline event handlers
  // (login/landing) + React inline styles — tightening that needs a nonce/refactor.
  const SB = 'https://phabxcijbbphfxvjedfj.supabase.co';
  writeFileSync('_site/_headers', `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.plaid.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ${SB} wss://phabxcijbbphfxvjedfj.supabase.co; frame-src https://cdn.plaid.com https://*.plaid.com; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'
`);

  console.log('✓ _site/ assembled for static hosting');
} finally {
  unlinkSync(tmp);
}

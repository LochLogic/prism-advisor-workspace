// Prism build — concatenates all source files in load order, then runs
// esbuild to transform JSX and minify into dist/bundle.js.
// No module bundling needed: files share the global scope via window.X.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from 'fs';

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

  for (const html of ['index.html', 'login.html', 'signup.html', 'landing.html']) {
    copyFileSync(html, `_site/${html}`);
  }
  copyFileSync('dist/bundle.js',          '_site/dist/bundle.js');
  copyFileSync('src/styles.css',          '_site/src/styles.css');
  copyFileSync('src/supabase-client.js',  '_site/src/supabase-client.js');

  // Security headers (Cloudflare/Netlify read _headers from the deploy root).
  const SB = 'https://phabxcijbbphfxvjedfj.supabase.co';
  writeFileSync('_site/_headers', `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdn.plaid.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ${SB} wss://phabxcijbbphfxvjedfj.supabase.co; frame-src https://cdn.plaid.com https://*.plaid.com; base-uri 'self'; frame-ancestors 'none'
`);

  console.log('✓ _site/ assembled for static hosting');
} finally {
  unlinkSync(tmp);
}

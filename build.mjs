// Prism build — concatenates all source files in load order, then runs
// esbuild to transform JSX and minify into dist/bundle.js.
// No module bundling needed: files share the global scope via window.X.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import { publishedPages, renderPage } from './content/pages.mjs';

const files = [
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
  // Routing: marketing (landing.html) is served at / ; the app (index.html) lives at /app.
  // login/signup stay at the root. The app's asset refs are absolute (/dist, /src, /vendor)
  // so they resolve correctly from the /app path.
  mkdirSync('_site/app', { recursive: true });
  writeFileSync('_site/index.html',     bust('landing.html'));
  writeFileSync('_site/app/index.html', bust('index.html'));
  writeFileSync('_site/login.html',     bust('login.html'));
  writeFileSync('_site/signup.html',    bust('signup.html'));

  // Static legal + security pages (no bundle refs — plain copy).
  for (const p of ['privacy.html', 'terms.html', 'dpa.html', 'security.html']) {
    copyFileSync(p, `_site/${p}`);
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
  //
  // CSP script-src: NO 'unsafe-inline'. React + supabase-js are self-hosted ('self');
  // every executable inline <script> (landing/login/signup + the app's theme-init)
  // is allow-listed by its SHA-256 hash, computed here over the exact served bytes.
  // Plaid's CDN stays host-allow-listed (it auto-updates its "stable" URL, so SRI
  // would break Link on their releases — host-allow-list is the correct control).
  // style-src KEEPS 'unsafe-inline': React renders inline style attributes and many
  //   components use them; removing it needs nonces or a large move-to-classes pass.
  const inlineHashes = new Set();
  for (const html of [bust('landing.html'), bust('index.html'), bust('login.html'), bust('signup.html')]) {
    const re = /<script>([\s\S]*?)<\/script>/g;   // bare <script> only — skips src= and application/ld+json
    let m;
    while ((m = re.exec(html)) !== null) {
      inlineHashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    }
  }
  const scriptSrc = `'self' ${[...inlineHashes].join(' ')} https://cdn.plaid.com`.replace(/\s+/g, ' ');

  const SB = 'https://phabxcijbbphfxvjedfj.supabase.co';
  writeFileSync('_site/_headers', `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ${SB} wss://phabxcijbbphfxvjedfj.supabase.co; frame-src https://cdn.plaid.com https://*.plaid.com; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'
`);

  // ── SEO: robots, sitemap, share image ──────────────────────────────
  // ── B2B content/intent pages (static, crawlable) ───────────────────
  const livePages = publishedPages();
  for (const p of livePages) {
    mkdirSync(`_site/${p.slug}`, { recursive: true });
    writeFileSync(`_site/${p.slug}/index.html`, renderPage(p));
  }
  console.log(`✓ ${livePages.length} content pages rendered (live by publishAt date)`);

  // ── SEO: robots, sitemap, share image ──────────────────────────────
  // The app at /app carries a noindex meta tag, so it's kept crawlable here (a Disallow
  // would prevent Google from reading the noindex, risking a URL-only index entry).
  writeFileSync('_site/robots.txt', `User-agent: *
Allow: /
Sitemap: https://prismaw.com/sitemap.xml
`);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: 'https://prismaw.com/', priority: '1.0', freq: 'weekly' },
    { loc: 'https://prismaw.com/signup.html', priority: '0.7', freq: 'monthly' },
    ...livePages.map(p => ({ loc: `https://prismaw.com/${p.slug}/`, priority: '0.8', freq: 'monthly' })),
    { loc: 'https://prismaw.com/security.html', priority: '0.5', freq: 'monthly' },
    { loc: 'https://prismaw.com/privacy.html', priority: '0.3', freq: 'yearly' },
    { loc: 'https://prismaw.com/terms.html',   priority: '0.3', freq: 'yearly' },
    { loc: 'https://prismaw.com/dpa.html',     priority: '0.3', freq: 'yearly' },
  ];
  writeFileSync('_site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`);
  try { copyFileSync('og-image.png', '_site/og-image.png'); }
  catch { console.warn('! og-image.png missing - run the OG image generator'); }

  console.log('✓ _site/ assembled for static hosting');
} finally {
  unlinkSync(tmp);
}

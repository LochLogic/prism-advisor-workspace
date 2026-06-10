// Prism build — concatenates all source files in load order, then runs
// esbuild to transform JSX and minify into dist/bundle.js.
// No module bundling needed: files share the global scope via window.X.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import { publishedPages, renderPage } from './content/pages.mjs';
import { sourceFiles, portalFiles } from './build-files.mjs';

// Two entries share one source pool (concatenated, not module-bundled): the
// advisor/admin app and the slim client portal. Each gets its own temp entry.
const entries = [
  { files: sourceFiles, tmp: 'src/_entry.jsx',        out: 'dist/bundle.js' },
  { files: portalFiles, tmp: 'src/_entry-portal.jsx', out: 'dist/portal.js' },
];
for (const e of entries) writeFileSync(e.tmp, e.files.map(f => readFileSync(f, 'utf8')).join('\n\n'));

try {
  mkdirSync('dist', { recursive: true });
  for (const e of entries) {
    await esbuild.build({
      entryPoints: [e.tmp],
      bundle: false,
      outfile: e.out,
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      minify: true,
    });
    console.log(`✓ ${e.out} built`);
  }

  // ── Assemble a clean deploy directory (_site) ──────────────────────
  // Hosts like Cloudflare upload the *entire* output dir, so we copy ONLY
  // the runtime files here — never node_modules, migrations, or .jsx sources.
  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site/dist', { recursive: true });
  mkdirSync('_site/src',  { recursive: true });

  // Minify the hand-authored CSS (esbuild, same engine as the JS) → the served
  // stylesheet is the minified output, never the source. Hashing the minified
  // bytes (below) keeps the cache-bust correct even if only the minifier changes.
  const minifyCss = async (file) =>
    (await esbuild.transform(readFileSync(file, 'utf8'), { loader: 'css', minify: true })).code;
  const stylesCssMin = await minifyCss('src/styles.css');
  const printCssMin  = await minifyCss('src/print.css');

  // Content hash over all cache-busted assets → any change to any of them
  // refreshes the lot (CSS-only edits bust too, not just JS).
  const hash = createHash('sha256')
    .update(readFileSync('dist/bundle.js'))
    .update(readFileSync('dist/portal.js'))
    .update(stylesCssMin)
    .update(printCssMin)
    .update(readFileSync('src/supabase-client.js'))
    .update(readFileSync('src/brand-boot.js'))
    .digest('hex').slice(0, 8);
  const bust = (html) => readFileSync(html, 'utf8')
    .replace(/dist\/bundle\.js(\?v=[^"']*)?/g,         `dist/bundle.js?v=${hash}`)
    .replace(/dist\/portal\.js(\?v=[^"']*)?/g,         `dist/portal.js?v=${hash}`)
    .replace(/src\/styles\.css(\?v=[^"']*)?/g,         `src/styles.css?v=${hash}`)
    .replace(/src\/supabase-client\.js(\?v=[^"']*)?/g, `src/supabase-client.js?v=${hash}`)
    .replace(/src\/brand-boot\.js(\?v=[^"']*)?/g,      `src/brand-boot.js?v=${hash}`);
  // Routing: marketing (landing.html) is served at / ; the app (index.html) lives at /app ;
  // the slim client portal (portal.html → dist/portal.js) lives at /portal.
  // login/signup stay at the root. Asset refs are absolute (/dist, /src, /vendor)
  // so they resolve correctly from any path.
  mkdirSync('_site/app', { recursive: true });
  mkdirSync('_site/portal', { recursive: true });
  writeFileSync('_site/index.html',        bust('landing.html'));
  writeFileSync('_site/app/index.html',    bust('index.html'));
  writeFileSync('_site/portal/index.html', bust('portal.html'));
  writeFileSync('_site/login.html',        bust('login.html'));
  writeFileSync('_site/signup.html',       bust('signup.html'));

  // OAuth callback page — one source file served at both provider redirect
  // URIs (the page reads the provider from its own path). Registered in
  // Google Cloud / Azure as https://prismaw.com/oauth/{google|microsoft}/callback.
  for (const prov of ['google', 'microsoft']) {
    mkdirSync(`_site/oauth/${prov}/callback`, { recursive: true });
    writeFileSync(`_site/oauth/${prov}/callback/index.html`, bust('oauth-callback.html'));
  }

  // Static legal + security pages (no bundle refs — plain copy).
  for (const p of ['privacy.html', 'terms.html', 'dpa.html', 'security.html']) {
    copyFileSync(p, `_site/${p}`);
  }
  copyFileSync('dist/bundle.js',          '_site/dist/bundle.js');
  copyFileSync('dist/portal.js',          '_site/dist/portal.js');
  writeFileSync('_site/src/styles.css',   stylesCssMin);
  writeFileSync('_site/src/print.css',    printCssMin);
  copyFileSync('src/supabase-client.js',  '_site/src/supabase-client.js');
  copyFileSync('src/brand-boot.js',       '_site/src/brand-boot.js');

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
  // style-src: NO 'unsafe-inline' (C5). Every served page that carries an inline
  //   <style> block is allow-listed by the SHA-256 of its exact bytes — the same
  //   mechanism as scripts. Inline style="" ATTRIBUTES were all migrated to classes
  //   (none remain in any served page), so style-src-attr needs no allowance. React's
  //   style={{}} props set properties via the CSSOM, which CSP does NOT gate, so the
  //   app's dynamic inline styles keep working. The print report (store.jsx) links a
  //   same-origin /src/print.css, which 'self' covers.
  const inlineHashes = new Set();
  for (const html of [bust('landing.html'), bust('index.html'), bust('portal.html'), bust('login.html'), bust('signup.html'), bust('oauth-callback.html')]) {
    const re = /<script>([\s\S]*?)<\/script>/g;   // bare <script> only — skips src= and application/ld+json
    let m;
    while ((m = re.exec(html)) !== null) {
      // The HTML parser normalizes CRLF/CR → LF before the browser hashes the text,
      // so hash the LF-normalized bytes (no-op on LF checkouts, correct on CRLF ones).
      inlineHashes.add(`'sha256-${createHash('sha256').update(m[1].replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
    }
  }
  // Cloudflare auto-injects its Web Analytics beacon (static.cloudflareinsights.com)
  // when the zone has Web Analytics enabled. Allow-list the beacon host (and its
  // RUM collection endpoint in connect-src below) so it isn't blocked by our
  // host-locked script-src. The beacon is host-allow-listed, not hashed — Cloudflare
  // controls and versions that script, so a pinned hash would break on their updates.
  const scriptSrc = `'self' ${[...inlineHashes].join(' ')} https://cdn.plaid.com https://static.cloudflareinsights.com`.replace(/\s+/g, ' ');

  // ── B2B content/intent pages (static, crawlable) — rendered below, hashed here ──
  const livePages = publishedPages();

  // Inline <style> hashes over every served page that has a <style> block.
  const styleHashes = new Set();
  const styleHostHtml = [
    bust('landing.html'), bust('login.html'), bust('signup.html'), bust('oauth-callback.html'),
    readFileSync('privacy.html', 'utf8'), readFileSync('terms.html', 'utf8'),
    readFileSync('dpa.html', 'utf8'), readFileSync('security.html', 'utf8'),
    ...livePages.map(renderPage),
  ];
  for (const html of styleHostHtml) {
    const re = /<style>([\s\S]*?)<\/style>/g;   // bare <style> only
    let m;
    while ((m = re.exec(html)) !== null) {
      styleHashes.add(`'sha256-${createHash('sha256').update(m[1].replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
    }
  }
  const styleSrc = `'self' ${[...styleHashes].join(' ')} https://fonts.googleapis.com`.replace(/\s+/g, ' ');

  const SB = 'https://phabxcijbbphfxvjedfj.supabase.co';
  writeFileSync('_site/_headers', `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ${SB} wss://phabxcijbbphfxvjedfj.supabase.co https://cloudflareinsights.com; frame-src https://cdn.plaid.com https://*.plaid.com; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'
`);

  // ── SEO: robots, sitemap, share image ──────────────────────────────
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
  for (const e of entries) { try { unlinkSync(e.tmp); } catch {} }
}

// SEO health monitor for both sites. Run on a schedule via GitHub Actions (no external
// services). Exits non-zero if any check fails, so a failed run emails the repo owner.
// Healthy runs are green and silent. Node 20+ (global fetch).

const sites = [
  {
    name: 'Prism', base: 'https://prismaw.com', marker: 'Advisor Workspace',
    pages: ['/', '/ria-client-portal-software/'], appNoindex: true,
  },
  {
    name: 'FinFire', base: 'https://finfire.prismaw.com', marker: 'FinFire',
    pages: ['/', '/learn/', '/learn/coast-fire/'],
  },
];

const results = [];
const fails = [];
const pass = (m) => results.push('  PASS  ' + m);
const fail = (m) => { results.push('  FAIL  ' + m); fails.push(m); };

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    const body = await r.text();
    return { status: r.status, ct: r.headers.get('content-type') || '', body };
  } catch (e) {
    return { status: 0, ct: '', body: '', error: e.message };
  } finally { clearTimeout(t); }
}

for (const s of sites) {
  results.push('\n' + s.name + '  (' + s.base + ')');

  // sitemap
  const sm = await get(s.base + '/sitemap.xml');
  if (sm.status === 200 && sm.body.includes('<urlset')) {
    pass(`sitemap.xml (${(sm.body.match(/<loc>/g) || []).length} urls)`);
  } else fail(`${s.name} sitemap.xml — status ${sm.status}${sm.error ? ' ' + sm.error : ''}`);

  // og image
  const og = await get(s.base + '/og-image.png');
  if (og.status === 200 && og.ct.startsWith('image/')) pass('og-image.png');
  else fail(`${s.name} og-image.png — status ${og.status}, type "${og.ct}"`);

  // key pages
  for (const p of s.pages) {
    const r = await get(s.base + p);
    if (r.status === 200 && r.body.includes(s.marker)) pass(`page ${p}`);
    else fail(`${s.name} page ${p} — status ${r.status}, marker "${s.marker}" ${r.body.includes(s.marker) ? 'found' : 'MISSING'}`);
  }

  // app noindex (Prism)
  if (s.appNoindex) {
    const a = await get(s.base + '/app');
    if (a.status === 200 && a.body.includes('noindex')) pass('/app is noindex');
    else fail(`${s.name} /app — status ${a.status}, noindex ${a.body.includes('noindex') ? 'present' : 'MISSING'}`);
  }
}

console.log(results.join('\n'));
console.log('\n' + (fails.length ? `❌ ${fails.length} check(s) failed` : '✅ all checks passed'));
if (fails.length) process.exit(1);

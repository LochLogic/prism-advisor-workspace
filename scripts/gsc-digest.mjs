// Weekly Google Search Console digest for prismaw.com (Domain property).
// FinFire subdomain data is filtered out (it's a for-fun project). Dependency-free:
// signs a service-account JWT with Node's crypto, exchanges it for an access token, and
// queries the Search Analytics API. Reads the service-account JSON from env GSC_SA_KEY.
// Writes a Markdown digest to stdout. Run by .github/workflows/seo-digest.yml.
import crypto from 'crypto';

const SITE = 'sc-domain:prismaw.com';
const EXCLUDE = 'finfire.prismaw.com';        // filter out the for-fun subdomain
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const fail = (msg) => { console.error('::error::' + msg); process.exit(1); };

const sa = (() => {
  try { return JSON.parse(process.env.GSC_SA_KEY || ''); }
  catch { fail('GSC_SA_KEY secret is missing or not valid JSON.'); }
})();

const b64url = (input) => Buffer.from(input).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`); signer.end();
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${sig}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) fail(`Token exchange failed (${res.status}): ${JSON.stringify(json)}`);
  return json.access_token;
}

async function query(token, body) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 403) fail('403 from Search Console — the service account is not yet a user on the prismaw.com property (or the API is not enabled in its project).');
  if (!res.ok) fail(`Search Analytics query failed (${res.status}): ${JSON.stringify(json)}`);
  return json.rows || [];
}

const d = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const startDate = d(30), endDate = d(2);   // GSC data lags ~2 days
const filter = { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'notContains', expression: EXCLUDE }] }] };
const num = (n) => Math.round(n).toLocaleString('en-US');
const pct = (n) => (n * 100).toFixed(1) + '%';

const token = await getAccessToken();

const totals = (await query(token, { startDate, endDate, ...filter }))[0];
const queries = await query(token, { startDate, endDate, dimensions: ['query'], rowLimit: 10, ...filter });
const pages = await query(token, { startDate, endDate, dimensions: ['page'], rowLimit: 10, ...filter });

let out = `## SEO digest — prismaw.com\n_${startDate} → ${endDate} · FinFire subdomain excluded_\n\n`;
if (!totals) {
  out += 'No search data yet for this period. (Normal for a newly indexed site — check back as Google gathers data.)\n';
  console.log(out); process.exit(0);
}
out += `**Totals** — ${num(totals.clicks)} clicks · ${num(totals.impressions)} impressions · ${pct(totals.ctr)} CTR · avg position ${totals.position.toFixed(1)}\n\n`;

out += `### Top queries\n| Query | Clicks | Impr. | CTR | Pos |\n|---|--:|--:|--:|--:|\n`;
out += queries.length
  ? queries.map(r => `| ${r.keys[0]} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${r.position.toFixed(1)} |`).join('\n')
  : '| _(none yet)_ | | | | |';

out += `\n\n### Top pages\n| Page | Clicks | Impr. | CTR | Pos |\n|---|--:|--:|--:|--:|\n`;
out += pages.length
  ? pages.map(r => `| ${r.keys[0].replace('https://prismaw.com', '')} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${r.position.toFixed(1)} |`).join('\n')
  : '| _(none yet)_ | | | | |';

out += `\n\n_Generated ${new Date().toISOString().slice(0, 10)} via GitHub Actions._\n`;
console.log(out);

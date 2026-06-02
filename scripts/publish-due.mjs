// Drip-publish latch. Run on a schedule (see .github/workflows/scheduled-publish.yml).
// Detects pages in content/pages.mjs whose publishAt date has arrived but that aren't yet
// recorded as live in content/published.json. When it finds one, it updates published.json
// — the resulting commit triggers a Cloudflare rebuild, and build.mjs (which gates on
// publishAt) then renders the now-due page. Idempotent: only writes when something changes.
import { pages } from '../content/pages.mjs';
import { readFileSync, writeFileSync } from 'fs';

const today = new Date().toISOString().slice(0, 10);
const due = pages.filter(p => (p.publishAt || '0000-00-00') <= today).map(p => p.slug);
const path = new URL('../content/published.json', import.meta.url);

let published = [];
try { published = JSON.parse(readFileSync(path, 'utf8')); } catch {}

const newly = due.filter(s => !published.includes(s));
if (newly.length) {
  writeFileSync(path, JSON.stringify(due, null, 2) + '\n');
  console.log('Newly due (now publishing): ' + newly.join(', '));
} else {
  console.log('Nothing new due today (' + today + ').');
}

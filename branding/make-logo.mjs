// Generates branding/prism-logo.svg and renders LinkedIn-ready PNGs via Playwright.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const S = 800;
const A = [400, 150], L = [118, 646], R = [682, 646];
const C = [(A[0] + L[0] + R[0]) / 3, (A[1] + L[1] + R[1]) / 3];

// Shrink each facet toward its own centroid to carve the groove gaps.
const shrink = (pts, k = 0.93) => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + k * (x - cx), cy + k * (y - cy)]);
};
const poly = (pts, fill) =>
  `<polygon fill="${fill}" points="${pts.map(p => p.map(n => n.toFixed(2)).join(',')).join(' ')}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
<defs>
<linearGradient id="faceL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17AFBE"/><stop offset="1" stop-color="#0E8D9A"/></linearGradient>
<linearGradient id="faceR" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1FB58D"/><stop offset="1" stop-color="#148A6B"/></linearGradient>
<linearGradient id="faceB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2693B6"/><stop offset="1" stop-color="#1A7596"/></linearGradient>
</defs>
<rect width="${S}" height="${S}" fill="#1c2e4a"/>
${poly(shrink([A, L, C]), 'url(#faceL)')}
${poly(shrink([A, R, C]), 'url(#faceR)')}
${poly(shrink([L, R, C]), 'url(#faceB)')}
</svg>`;

writeFileSync(new URL('./prism-logo.svg', import.meta.url), svg);

const browser = await chromium.launch();
for (const px of [400, 800]) {
  const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`);
  await page.screenshot({ path: fileURLToPath(new URL(`./prism-logo-${px}.png`, import.meta.url)) });
  await page.close();
}
await browser.close();
console.log('done');

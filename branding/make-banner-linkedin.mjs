// LinkedIn-specific banner variant: NO logo mark (the page's square logo
// already overlays the banner's lower-left on LinkedIn), wordmark shifted
// right so LinkedIn's framing leaves it cleanly visible.
// Outputs prism-banner-linkedin.svg + PNGs (1128x191 @1x and @2x).
// Run: node branding/make-banner-linkedin.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const W = 1128, H = 191;
const NAVY = '#1c2e4a';
const TEXT_X = 340; // clear of LinkedIn's profile-logo overlay at lower-left

// ── growth chart: ascending bars + trend line + arrow (same as make-banner.mjs) ──
const baseY = 163;
const bars = [
  [640, 20, '#3E7D9C'], [678, 30, '#3E9C85'], [716, 26, '#4E8FAE'],
  [754, 44, '#45A98F'], [792, 38, '#5FA8BC'], [830, 60, '#56B295'],
  [868, 54, '#6FB9C9'], [906, 82, '#7CC4AE'], [944, 100, '#9CCFDB'], [982, 118, '#B8DCE4'],
];
const barRects = bars.map(([x, h, c]) =>
  `<rect x="${x}" y="${baseY - h}" width="28" height="${h}" fill="${c}"/>`).join('\n');

const pts = [[600, 92], [648, 100], [692, 88], [732, 94], [772, 76], [816, 82], [856, 62], [900, 48], [948, 32], [996, 18]];
const trend = `
<polyline fill="none" stroke="#DCE7F3" stroke-width="3.5" stroke-linejoin="round"
  points="${pts.map(p => p.join(',')).join(' ')}"/>
${pts.filter((_, i) => i % 2 === 0).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#DCE7F3"/>`).join('\n')}
<polygon fill="#DCE7F3" points="1019,11.3 998.1,25.2 993.9,10.8"/>
<line x1="760" y1="120" x2="830" y2="86" stroke="#9CB6CC" stroke-width="2"/>
<polygon fill="#9CB6CC" points="836,83 822,86 828,95"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif">
<rect width="${W}" height="${H}" fill="${NAVY}"/>
<text x="${TEXT_X}" y="98" font-size="54" font-weight="300" letter-spacing="10" fill="#ffffff">PRISM</text>
<text x="${TEXT_X + 2}" y="138" font-size="21" font-weight="300" letter-spacing="3.5" fill="rgba(255,255,255,.82)">Advisor Workspace</text>
<line x1="56" y1="${baseY}" x2="1072" y2="${baseY}" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
${barRects}
${trend}
</svg>`;

const out = (f) => fileURLToPath(new URL(`./${f}`, import.meta.url));
writeFileSync(out('prism-banner-linkedin.svg'), svg);

const browser = await chromium.launch();
for (const scale of [1, 2]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: out(`prism-banner-linkedin-${W * scale}.png`) });
  await page.close();
}
await browser.close();
console.log('done');

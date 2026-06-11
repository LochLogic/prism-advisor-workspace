// One-shot generator for the LinkedIn brand assets in docs/marketing/.
// Renders brand-exact HTML in headless Chromium and screenshots at the
// exact pixel sizes LinkedIn wants (logo 400x400, banner 1128x191 @2x).
// Run: node scripts/linkedin-assets.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { facetedMark, NAVY } from './brand-mark.mjs';

const OUT = resolve('docs/marketing');
mkdirSync(OUT, { recursive: true });

const mark = (size) => facetedMark(size);

const logoHTML = `<!doctype html><meta charset="utf-8">
<style>
  * { margin:0; box-sizing:border-box; }
  body { width:400px; height:400px; background:${NAVY};
         display:flex; align-items:center; justify-content:center; }
</style>
<body>${mark(264)}</body>`;

const bannerHTML = `<!doctype html><meta charset="utf-8">
<style>
  * { margin:0; box-sizing:border-box; }
  body { width:1128px; height:191px; background:${NAVY};
         font-family:'Segoe UI',system-ui,sans-serif; color:#fff;
         display:flex; align-items:center; gap:30px; padding-left:72px; }
  .wordmark { display:flex; flex-direction:column; gap:10px; }
  .name { font-size:58px; font-weight:700; letter-spacing:6px; line-height:1; }
  .tag  { font-size:22px; font-weight:400; color:rgba(255,255,255,.8); letter-spacing:2.5px; }
</style>
<body>
  ${mark(150)}
  <div class="wordmark">
    <div class="name">PRISM</div>
    <div class="tag">Advisor Workspace</div>
  </div>
</body>`;

const browser = await chromium.launch();
async function shoot(html, w, h, file, scale = 2) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(OUT, file) });
  await page.close();
  console.log('wrote', file, `${w * scale}x${h * scale}`);
}
await shoot(logoHTML, 400, 400, 'linkedin-logo.png', 1);
await shoot(bannerHTML, 1128, 191, 'linkedin-banner.png', 2);
await browser.close();

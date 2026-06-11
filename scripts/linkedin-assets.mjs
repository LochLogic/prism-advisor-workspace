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
  body { width:1128px; height:191px; background:${NAVY}; position:relative;
         overflow:hidden; font-family:'Segoe UI',system-ui,sans-serif; color:#fff;
         display:flex; align-items:center; }
  /* soft refracted-light beams off the prism, brand-color only */
  .beam { position:absolute; top:-40px; height:280px; width:480px;
          transform:rotate(18deg); pointer-events:none; }
  .b1 { right:60px;  background:linear-gradient(105deg, rgba(255,255,255,0)   40%, rgba(255,255,255,.07) 60%, rgba(255,255,255,0) 80%); }
  .b2 { right:-120px; background:linear-gradient(105deg, rgba(255,255,255,0)  35%, rgba(255,255,255,.05) 55%, rgba(255,255,255,0) 75%); }
  .content { display:flex; align-items:center; gap:26px; padding-left:72px; position:relative; }
  .wordmark { display:flex; flex-direction:column; gap:8px; }
  .name { font-size:44px; font-weight:650; letter-spacing:.5px; line-height:1; }
  .tag  { font-size:17px; font-weight:400; color:rgba(255,255,255,.78); letter-spacing:.3px; }
  .ghost { position:absolute; right:96px; top:50%; transform:translateY(-50%); opacity:.16; }
</style>
<body>
  <div class="beam b1"></div><div class="beam b2"></div>
  <div class="ghost">${mark(150)}</div>
  <div class="content">
    ${mark(72)}
    <div class="wordmark">
      <div class="name">Prism</div>
      <div class="tag">The advisor workspace &mdash; living client roadmaps for RIAs &middot; prismaw.com</div>
    </div>
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

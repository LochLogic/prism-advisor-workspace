// One-shot generator for the site brand assets that build.mjs copies into
// _site/: og-image.png (1200x630 social card) and icons/portal-*.png (PWA).
// Run after changing scripts/brand-mark.mjs: node scripts/brand-assets.mjs
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { facetedMark, NAVY } from './brand-mark.mjs';

const page2html = (w, h, body, css) =>
  `<!doctype html><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;${css}}</style><body>${body}</body>`;

// ── og-image: same copy/layout as the previous card, brand mark + navy ──
const ogHTML = page2html(1200, 630, `
  <div class="bar"></div>
  <div class="head">${facetedMark(120)}<div class="name">Prism</div></div>
  <div class="tagline">The advisor workspace.</div>
  <div class="sub">Lifecycle planning, compliance, CRM &amp; reporting for RIAs.</div>
  <div class="url">prismaw.com</div>`,
  `background:linear-gradient(135deg,${NAVY},#111a26);position:relative;overflow:hidden;
   font-family:'Segoe UI',system-ui,sans-serif;color:#fff;padding:96px 100px;`) +
  `<style>
  .bar{position:absolute;top:0;left:0;right:0;height:10px;
       background:linear-gradient(90deg,#17AFBE,#1FB58D,#2693B6);}
  .head{display:flex;align-items:center;gap:28px;}
  .name{font-size:96px;font-weight:700;letter-spacing:.5px;}
  .tagline{font-size:52px;font-weight:700;margin-top:64px;}
  .sub{font-size:30px;color:rgba(255,255,255,.72);margin-top:26px;}
  .url{position:absolute;bottom:64px;left:100px;font-size:24px;color:rgba(255,255,255,.55);}
  </style>`;

// ── portal PWA icons: mark on navy; scaled in for the maskable safe zone ──
const iconHTML = (px) => page2html(px, px,
  facetedMark(px, { bg: NAVY, scale: 0.84 }),
  `background:${NAVY};display:flex;align-items:center;justify-content:center;`);

const browser = await chromium.launch();
async function shoot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(file) });
  await page.close();
  console.log('wrote', file);
}
await shoot(ogHTML, 1200, 630, 'og-image.png');
await shoot(iconHTML(192), 192, 192, 'icons/portal-192.png');
await shoot(iconHTML(512), 512, 512, 'icons/portal-512.png');
await browser.close();

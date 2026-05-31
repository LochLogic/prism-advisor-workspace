// Prism B2B content/intent pages. Each renders to a static, crawlable HTML page at
// /<slug>/ during the build. Styled to match the Prism marketing palette. These target
// high-intent advisor-software search terms and funnel to signup / the live demo.

const SITE = 'https://prismaw.com';

export const pages = [
  {
    slug: 'ria-client-portal-software',
    title: 'RIA Client Portal Software | Prism Advisor Workspace',
    description: 'Prism is client portal software for RIAs: lifecycle roadmaps, account aggregation, performance reporting, and realtime collaboration — in one secure workspace your clients actually log into.',
    keywords: 'RIA client portal software, financial advisor client portal, client portal for RIAs, advisor client portal',
    updated: '2026-05-30',
    h1: 'A client portal RIAs and clients actually want to use',
    lede: 'Most advisor portals are a static PDF vault. Prism gives every client a living financial roadmap they can open any time — and gives you one workspace to run the whole relationship.',
    body: `
<h2>One login, the whole relationship</h2>
<p>Clients see a personalized lifecycle roadmap — where they are today, what's next, and why — instead of a folder of stale statements. Advisors see the same picture from the other side, with the tools to act on it.</p>

<h2>What's inside</h2>
<ul>
  <li><strong>Lifecycle roadmaps</strong> — refract each client's wealth into clear, sequenced horizons.</li>
  <li><strong>Account aggregation</strong> — connected balances and holdings via secure bank linking.</li>
  <li><strong>Performance reporting</strong> — clean, printable performance and invoice reports.</li>
  <li><strong>Realtime collaboration</strong> — comments, flags, and updates that sync instantly between advisor and client.</li>
</ul>

<h2>Secure by design</h2>
<p>Every record is protected by row-level security (firm → advisor → client), with optional multi-factor authentication and Google sign-in. Clients only ever see their own data.</p>
`,
    faq: [
      { q: 'What is RIA client portal software?', a: 'It is a secure web app where a registered investment adviser’s clients log in to see their plan, accounts, and reports, and collaborate with their advisor. Prism adds a living lifecycle roadmap rather than a static document vault.' },
      { q: 'Is client data secure in Prism?', a: 'Yes. Prism enforces row-level security so each firm, advisor, and client only sees their own data, with optional multi-factor authentication and audit logging.' },
    ],
  },

  {
    slug: 'compliance-audit-trail-for-advisors',
    title: 'Compliance Audit Trail for RIAs | Prism Advisor Workspace',
    description: 'Prism keeps a compliance-grade, append-only audit trail of advisor and client activity, with records retained per SEC 17a-4. Defensible history without the manual logging.',
    keywords: 'compliance audit trail, RIA compliance software, SEC 17a-4 records retention, advisor audit log, WORM archive',
    updated: '2026-05-30',
    h1: 'A compliance-grade audit trail, kept automatically',
    lede: 'Examiners want a defensible record of who did what, when. Prism captures it as you work — no spreadsheets, no after-the-fact reconstruction.',
    body: `
<h2>Every meaningful action, logged</h2>
<p>Sign-ins, plan changes, client updates, and report generation are recorded with the actor, timestamp, and a human-readable summary. The trail is append-only and reviewable from an admin view.</p>

<h2>Built for retention rules</h2>
<p>Records are retained in line with <strong>SEC Rule 17a-4</strong> expectations, including a daily write-once archive (WORM-style export) so historical records can't be quietly altered. Profile versioning preserves prior states of a client's plan for point-in-time review.</p>

<h2>Why it matters</h2>
<ul>
  <li><strong>Exam readiness</strong> — produce a clear history on request instead of scrambling.</li>
  <li><strong>Internal oversight</strong> — firm admins can review activity across advisors.</li>
  <li><strong>Client trust</strong> — changes are attributable and reversible to a known prior state.</li>
</ul>
`,
    faq: [
      { q: 'Does Prism support SEC 17a-4 record retention?', a: 'Prism keeps an append-only audit trail and a daily write-once (WORM-style) archive designed to align with SEC Rule 17a-4 retention expectations, plus profile versioning for point-in-time review.' },
      { q: 'What activity does the audit trail capture?', a: 'Sign-ins, plan and client changes, and report generation are logged with the actor, timestamp, and a readable summary, reviewable from an admin view.' },
    ],
  },

  {
    slug: 'crm-for-financial-advisors',
    title: 'CRM for Financial Advisors | Prism Advisor Workspace',
    description: 'Prism includes a CRM built for advisors: tasks, a client pipeline, an activity timeline, and automated cadences — connected to the same roadmaps and reports you already use.',
    keywords: 'CRM for financial advisors, RIA CRM, advisor CRM software, financial advisor pipeline, client cadences',
    updated: '2026-05-30',
    h1: 'A CRM that lives where the planning happens',
    lede: 'Bolt-on CRMs make you re-enter everything. Prism’s workflow sits on top of the same client data as your roadmaps and reports — so nothing is duplicated.',
    body: `
<h2>Run the book of business</h2>
<ul>
  <li><strong>Tasks</strong> — assign and track follow-ups against the right client.</li>
  <li><strong>Pipeline</strong> — move prospects and households through clear stages.</li>
  <li><strong>Activity timeline</strong> — a chronological record of touchpoints per client.</li>
  <li><strong>Cadences</strong> — recurring outreach so no client slips through the cracks.</li>
</ul>

<h2>Connected, not bolted on</h2>
<p>Because the CRM shares the same data model as the roadmaps, reporting, and audit trail, a task or pipeline change is already tied to the client's full context — no exports, no double entry.</p>

<h2>One workspace</h2>
<p>Planning, client portal, reporting, compliance, and CRM in a single secure app means your team works from one source of truth instead of stitching tools together.</p>
`,
    faq: [
      { q: 'Does Prism include a CRM?', a: 'Yes. Prism has advisor CRM workflow built in — tasks, a client pipeline, an activity timeline, and automated cadences — sharing the same data as your roadmaps and reports.' },
      { q: 'Do I need a separate CRM with Prism?', a: 'No. The CRM is part of the workspace and connected to client roadmaps, reporting, and the audit trail, so you avoid duplicate data entry across tools.' },
    ],
  },
];

// ── Rendering ──────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const head = ({ title, description, keywords, canonical }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="keywords" content="${esc(keywords)}" />
<link rel="canonical" href="${canonical}" />
<meta name="theme-color" content="#1c2e4a" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Prism Advisor Workspace" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${SITE}/og-image.png" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231c2e4a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 2 3 20h18Z'/><path d='m12 2 4 9-9 4'/></svg>" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#fafaf7; --surface:#fff; --ink:#1c2e4a; --ink2:#2d4258; --ink3:#5d7a8e; --line:#e4dfd0; --gold:#a98c4b; --serif:'Source Serif 4',Georgia,serif; --sans:'Inter',system-ui,sans-serif; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink2); font-family:var(--sans); line-height:1.65; }
  .wrap { max-width:740px; margin:0 auto; padding:0 22px; }
  header.site, footer.site { border-color:var(--line); }
  header.site { border-bottom:1px solid var(--line); background:var(--surface); }
  header.site .wrap { display:flex; align-items:center; justify-content:space-between; height:60px; }
  header.site a.brand { display:flex; align-items:center; gap:9px; text-decoration:none; color:var(--ink); font-family:var(--serif); font-weight:600; font-size:18px; }
  header.site .cta-top { font-size:14px; text-decoration:none; color:#fff; background:var(--ink); padding:8px 16px; border-radius:8px; font-weight:500; }
  nav.crumb { font-size:13px; color:var(--ink3); padding:20px 0 0; }
  nav.crumb a { color:var(--gold); text-decoration:none; }
  h1 { font-family:var(--serif); font-size:34px; line-height:1.2; font-weight:600; color:var(--ink); margin:14px 0 10px; }
  .lede { font-size:18px; color:var(--ink2); margin:0 0 8px; }
  .meta { font-size:13px; color:var(--ink3); margin:0 0 24px; }
  h2 { font-family:var(--serif); font-size:23px; font-weight:600; color:var(--ink); margin:32px 0 10px; }
  p, li { font-size:16px; }
  a { color:var(--gold); }
  ul { padding-left:22px; }
  .cta { margin:36px 0; padding:26px; border:1px solid var(--line); border-radius:16px; background:var(--surface); text-align:center; }
  .cta .btns { margin-top:14px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .cta a.primary { background:var(--ink); color:#fff; text-decoration:none; padding:11px 22px; border-radius:9px; font-weight:500; }
  .cta a.ghost { border:1px solid var(--line); color:var(--ink); text-decoration:none; padding:11px 22px; border-radius:9px; font-weight:500; }
  .faq { margin:36px 0; }
  .faq dt { font-weight:600; color:var(--ink); margin-top:16px; font-size:16px; }
  .faq dd { margin:6px 0 0; }
  .related { margin:34px 0; font-size:15px; }
  .related a { color:var(--gold); text-decoration:none; }
  footer.site { border-top:1px solid var(--line); margin-top:40px; }
  footer.site .wrap { padding:26px 22px; font-size:13px; color:var(--ink3); }
  footer.site a { color:var(--gold); text-decoration:none; }
</style>`;

const siteHeader = `<header class="site"><div class="wrap">
  <a class="brand" href="${SITE}/">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c2e4a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 20h18Z"/><path d="m12 2 4 9-9 4"/></svg>
    Prism
  </a>
  <a class="cta-top" href="${SITE}/signup.html">Create workspace</a>
</div></header>`;

const siteFooter = `<footer class="site"><div class="wrap">
  <a href="${SITE}/">Overview</a> &middot; <a href="${SITE}/signup.html">Sign up</a> &middot; <a href="${SITE}/login.html">Sign in</a><br/>
  Secured by row-level security &middot; Records retained per SEC 17a-4
</div></footer>`;

export function renderPage(p) {
  const canonical = `${SITE}/${p.slug}/`;
  const related = pages.filter(o => o.slug !== p.slug);
  const faqJson = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const articleJson = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: p.title, description: p.description,
    datePublished: p.updated, dateModified: p.updated,
    author: { '@type': 'Organization', name: 'Prism Advisor Workspace' },
    publisher: { '@type': 'Organization', name: 'Prism Advisor Workspace' },
    mainEntityOfPage: canonical, image: `${SITE}/og-image.png`,
  };
  return `${head({ title: p.title, description: p.description, keywords: p.keywords, canonical })}
<script type="application/ld+json">${JSON.stringify(articleJson)}</script>
<script type="application/ld+json">${JSON.stringify(faqJson)}</script>
</head>
<body>
${siteHeader}
<div class="wrap">
  <nav class="crumb"><a href="${SITE}/">Home</a> &rsaquo; ${esc(p.h1)}</nav>
  <h1>${esc(p.h1)}</h1>
  <p class="lede">${esc(p.lede)}</p>
  <p class="meta">Updated ${p.updated} &middot; Prism Advisor Workspace</p>
  ${p.body.trim()}
  <div class="faq">
    <h2>Frequently asked questions</h2>
    <dl>
      ${p.faq.map(f => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('\n      ')}
    </dl>
  </div>
  <div class="cta">
    <strong style="font-family:var(--serif);font-size:19px;color:var(--ink);">See it before you sign up.</strong>
    <div>Open a fully populated demo workspace — no account required.</div>
    <div class="btns">
      <a class="primary" href="${SITE}/app">Explore the live demo</a>
      <a class="ghost" href="${SITE}/signup.html">Create your workspace</a>
    </div>
  </div>
  <div class="related">
    <strong>More:</strong>
    <ul>${related.map(r => `<li><a href="${SITE}/${r.slug}/">${esc(r.h1)}</a></li>`).join('')}</ul>
  </div>
</div>
${siteFooter}
</body>
</html>`;
}

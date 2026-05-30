// Generates docs/Prism-Whitepaper.docx from the whitepaper content.
// Run: npm install docx --no-save && node scripts/build-whitepaper.mjs
import fs from 'fs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak,
} from 'docx';

const NAVY = '1C2E4A', GOLD = 'A98C4B', INK = '2D4258', MUTE = '5D7A8E';

// ── helpers ───────────────────────────────────────────────────────────
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const P  = (t, opts = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, ...opts })] });
const Italic = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, italics: true, color: MUTE })] });
const bullet = (t, bold) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 40 },
  children: bold ? [new TextRun({ text: bold, bold: true }), new TextRun(t)] : [new TextRun(t)] });
const numbered = (t, bold) => new Paragraph({ numbering: { reference: 'n', level: 0 }, spacing: { after: 40 },
  children: bold ? [new TextRun({ text: bold, bold: true }), new TextRun(t)] : [new TextRun(t)] });
const rule = () => new Paragraph({ spacing: { before: 60, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 1 } }, children: [] });

const border = { style: BorderStyle.SINGLE, size: 1, color: 'D4CCB7' };
const borders = { top: border, bottom: border, left: border, right: border };
const COLW = [1700, 4360, 3300]; // sums to 9360
const cell = (text, { head = false, bold = false, w } = {}) => new TableCell({
  borders, width: { size: w, type: WidthType.DXA },
  shading: { fill: head ? NAVY : 'FFFFFF', type: ShadingType.CLEAR },
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ children: [new TextRun({ text, bold: head || bold, color: head ? 'FFFFFF' : INK, size: 20 })] })],
});
const row = (cells, head = false) => new TableRow({ children: cells.map((t, i) => cell(t, { head, w: COLW[i], bold: i === 0 && !head })) });

// ── document ──────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Prism Advisor Workspace',
  title: 'Prism Advisor Workspace — Factsheet',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, color: GOLD, font: 'Arial' },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
      { reference: 'n', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'Prism Advisor Workspace', size: 16, color: MUTE })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: 'right', position: 9360 }],
      children: [
        new TextRun({ text: 'Marketing source · keep claims aligned to §4 & §8', size: 16, color: MUTE }),
        new TextRun({ text: '\t', size: 16 }),
        new TextRun({ text: 'Page ', size: 16, color: MUTE }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTE }),
      ] })] }) },
    children: [
      // Title block
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Prism Advisor Workspace', bold: true, size: 48, color: NAVY })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Factsheet & Positioning Paper', size: 26, color: GOLD })] }),
      rule(),
      Italic('Document purpose: a single, accurate source for website copy, sales decks, one-pagers, and outreach. Everything below reflects what is actually built and live. Items still in development are marked (roadmap) so marketing never overstates.'),

      H1('1. One-liner & elevator pitch'),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'One-liner: ', bold: true }),
        new TextRun('Prism is the lifecycle-planning workspace where RIAs build coordinated client plans, run their book, and keep a compliance-grade record — in one place.')] }),
      new Paragraph({ children: [new TextRun({ text: 'Elevator pitch: ', bold: true }),
        new TextRun('Most advisory firms stitch together a planning tool, a CRM, a portfolio reporter, a billing system, and a pile of spreadsheets. Prism unifies the relationship: a guided seven-phase financial roadmap clients actually engage with, an advisor command center for the whole book, and a firm-admin layer for revenue and compliance — built on a multi-tenant, row-level-secured foundation with an append-only audit trail from day one.')] }),

      H1('2. Who it’s for'),
      bullet(' independent and small/mid-size RIAs (1–50 advisors) who want planning + CRM + reporting + billing without integrating five vendors.', 'Primary: '),
      bullet(' the solo advisor (look institutional without the overhead), the growing practice (workflow + scale), and the firm administrator / CCO (oversight, billing, audit trail).', 'Buyer personas: '),
      bullet('The client is a first-class user too — Prism is one of the few advisor tools where the client-facing experience is a feature, not an afterthought.'),

      H1('3. The core idea — “Wealth Horizons”'),
      P('Prism organizes every household’s financial life into a seven-phase lifecycle roadmap, advanced collaboratively with the advisor:'),
      numbered(' — stabilize cash flow and the household ledger', 'Foundation'),
      numbered(' — build the protective cash cushion', 'Liquidity Reserve'),
      numbered(' — retire high-cost debt (avalanche)', 'Liability Optimization'),
      numbered(' — maximize the HSA and sheltered space', 'Tax-Advantaged Foundations'),
      numbered(' — asset location across accounts', 'Retirement Sleeve Construction'),
      numbered(' — taxable investing, tax-loss harvesting, Monte Carlo', 'Capital Deployment'),
      numbered(' — Roth-conversion ladders and estate structuring', 'Legacy & Drawdown'),
      P('Each phase carries milestones and interactive tools, so the plan is a living thing the client returns to — not a PDF that dies in an inbox.'),

      H1('4. What it does'),
      H2('Planning & analysis'),
      P('Nine advisor-grade calculators embedded in the roadmap: cash-flow, liquidity reserve, debt avalanche, HSA, asset location, Monte Carlo retirement projection, Roth-conversion ladder, estate & generational modeling, and tax-loss harvesting.'),
      H2('Client experience'),
      P('A branded client portal: the live roadmap, real-time portfolio summary, “discuss with your advisor” threads on any milestone, a request-a-meeting flow, and self-serve performance and milestone reports.'),
      H2('Advisor command center'),
      P('Client roster (searchable, sortable, paginated, CSV export), an intelligent alert engine (cash drag, stale relationships), a flagged-question inbox with two-way reply threads, and a per-client workspace spanning accounts, meeting log, tasks, interaction timeline, and performance.'),
      H2('CRM & workflow'),
      P('Tasks with priorities, due dates, and cross-advisor assignment; one-click review cadences; a client pipeline board (lead → onboarding → active → review-due); and a unified interaction timeline.'),
      H2('Account aggregation'),
      P('Plaid account linking and a daily balance-history time-series that powers performance and billing. (Custodian file/API feeds — Schwab/Fidelity/Yodlee/Flinks — and holdings-level data are roadmap.)'),
      H2('Performance reporting'),
      P('Time-weighted return (Modified Dietz) across standard periods, benchmark-relative comparison, account-mix breakdown, a portfolio-value chart, and a branded client-facing PDF.'),
      H2('Billing — two engines'),
      bullet(' for the firm (Stripe Checkout + webhooks).', 'SaaS subscriptions'),
      bullet(' for clients: tiered/flat fee schedules, frequency-aware automated invoicing (monthly/quarterly/annual), an approval workflow, branded invoice PDFs, and a firm revenue dashboard (projected ARR + realized fees).', 'Advisory-fee billing'),
      H2('Compliance & trust'),
      P('An append-only audit trail of every material action, records-retained-not-erased soft deletes, immutable profile versioning, a nightly archive of the audit trail to private storage, per-client compliance export, and optional two-factor authentication — all designed around SEC Rule 17a-3 / 17a-4 principles.'),
      H2('Onboarding & growth'),
      P('A demo-first landing page (prospects explore a fully populated workspace with no signup), true self-serve signup that provisions a firm and its first admin automatically, and sign-in via Google, password, or magic link.'),

      H1('5. Why it’s different'),
      bullet(' Engagement lives where the relationship lives — clients use the roadmap, ask questions in-context, and pull their own reports.', 'The client side is real. '),
      bullet(' Row-level security, an append-only audit trail, and retention were there from the first migration — not retrofitted.', 'Compliance is the foundation, not a bolt-on. '),
      bullet(' Planning, CRM, aggregation, performance, and billing share one data model and one login.', 'One workspace, not five integrations. '),
      bullet(' A solo advisor presents like a large RIA.', 'Institutional feel for any size firm. '),
      bullet(' A minified single-bundle app on a global edge CDN, an enforced Content-Security-Policy, self-hosted libraries, and no third-party trackers.', 'Lean, fast, and private. '),

      H1('6. Security & compliance posture'),
      bullet(' via Postgres row-level security — every advisor sees only their book; firm admins see only their firm.', 'Multi-tenant isolation'),
      bullet(' email/password, magic link, Google OAuth, and TOTP multi-factor with assurance-level enforcement.', 'Authentication: '),
      bullet(' append-only, immutable, with a firm-admin viewer and a nightly off-table archive.', 'Audit trail: '),
      bullet(' soft-deletes (records archived, never erased) aligned to 17a-4; immutable profile version history.', 'Records retention: '),
      bullet(' HTTPS-only with HSTS, an enforced CSP, sanitized rendering, and a CI gate on every change.', 'Transport & app hardening: '),
      Italic('Honest framing for legal review: Prism provides the tooling designed around SEC 17a-3/17a-4 record-making and retention principles; full regulatory compliance is a function of the firm’s configuration, a WORM/object-lock storage tier, and the firm’s own supervisory procedures.'),

      H1('7. Packaging & pricing (as presented today)'),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: COLW, rows: [
        row(['Plan', 'Who', 'Price (indicative)'], true),
        row(['Solo', 'Independent advisor getting started', 'Free in preview · up to 25 households']),
        row(['Growth', 'Growing practices with a full book', '$49 / advisor / mo · unlimited clients, aggregation, performance, priority support']),
        row(['Enterprise', 'Multi-advisor firms with compliance teams', 'From $99 / advisor / mo · annual, 5-seat min · firm-admin, billing automation, WORM retention, SSO (roadmap)']),
      ] }),
      new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'Pricing is indicative during preview; the public funnel currently captures interest and provisions free workspaces.', italics: true, color: MUTE, size: 18 })] }),

      H1('8. Proof points marketing can cite'),
      bullet('Seven-phase planning framework with nine embedded calculators.'),
      bullet('Multi-tenant architecture with row-level security across every table.'),
      bullet('Append-only audit trail plus a nightly compliance archive.'),
      bullet('Time-weighted (Modified Dietz) performance with benchmark comparison.'),
      bullet('Automated advisory-fee billing with frequency-aware invoicing.'),
      bullet('Self-serve onboarding plus a no-signup live demo.'),
      bullet('Runs on a global edge CDN with an enforced Content-Security-Policy.'),

      H1('9. Suggested messaging pillars'),
      numbered(' — the planning narrative.', '“Your clients’ wealth, refracted into seven horizons.”'),
      numbered(' — trust & audit narrative.', '“Compliance-grade from the first click.”'),
      numbered(' — consolidation/value narrative.', '“One workspace. Not five subscriptions.”'),
      numbered(' — the demo-led funnel.', '“See it before you sign up.”'),

      H1('10. Honest “not yet” list'),
      P('Keep these out of public claims until shipped: custodian data feeds (Schwab/Fidelity/Yodlee/Flinks), holdings-level / per-security performance attribution, live market-data benchmarks, external calendar sync (Google/Outlook/Calendly), SSO/SAML, and object-lock WORM storage are on the roadmap and should be described as “coming” rather than available.'),
      rule(),
      Italic('Prepared as an internal marketing source. Keep claims aligned to the “what it does” and “facts” sections; route anything in §10 through product before publishing.'),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync('docs/Prism-Whitepaper.docx', buf); console.log('✓ docs/Prism-Whitepaper.docx written'); });

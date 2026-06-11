// Prism B2B content/intent pages. Each renders to a static, crawlable HTML page at
// /<slug>/ during the build. Styled to match the Prism marketing palette. These target
// high-intent advisor-software search terms and funnel to signup / the live demo.

const SITE = 'https://prismaw.com';

export const pages = [
  {
    slug: 'ria-client-portal-software',
    title: 'RIA Client Portal Software | Prism Advisor Workspace',
    description: 'Prism is client portal software for RIAs: lifecycle roadmaps, account aggregation, performance reporting, and realtime collaboration - in one secure workspace your clients actually log into.',
    keywords: 'RIA client portal software, financial advisor client portal, client portal for RIAs, advisor client portal',
    updated: '2026-05-30',
    publishAt: '2026-05-30',
    h1: 'A client portal RIAs and clients actually want to use',
    lede: 'Most advisor portals are a static PDF vault. Prism gives every client a living financial roadmap they can open any time - and gives you one workspace to run the whole relationship.',
    body: `
<h2>One login, the whole relationship</h2>
<p>Clients see a personalized lifecycle roadmap - where they are today, what's next, and why - instead of a folder of stale statements. Advisors see the same picture from the other side, with the tools to act on it.</p>

<h2>What's inside</h2>
<ul>
  <li><strong>Lifecycle roadmaps</strong> - refract each client's wealth into clear, sequenced horizons.</li>
  <li><strong>Account aggregation</strong> - connected balances and holdings via secure bank linking.</li>
  <li><strong>Performance reporting</strong> - clean, printable performance and invoice reports.</li>
  <li><strong>Realtime collaboration</strong> - comments, flags, and updates that sync instantly between advisor and client.</li>
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
    publishAt: '2026-05-30',
    h1: 'A compliance-grade audit trail, kept automatically',
    lede: 'Examiners want a defensible record of who did what, when. Prism captures it as you work - no spreadsheets, no after-the-fact reconstruction.',
    body: `
<h2>Every meaningful action, logged</h2>
<p>Sign-ins, plan changes, client updates, and report generation are recorded with the actor, timestamp, and a human-readable summary. The trail is append-only and reviewable from an admin view.</p>

<h2>Designed around the retention rules</h2>
<p>Prism is built around the record-keeping principles of <strong>SEC Rules 17a-3 and 17a-4</strong>: an append-only trail, immutable profile versioning that preserves prior states of a plan for point-in-time review, and a daily write-once (WORM-style) archive that makes historical records tamper-evident. Production use with live client data additionally calls for object-lock archival storage and your firm's own regulatory review - see our <a href="${SITE}/security.html">security overview</a> for the current posture.</p>

<h2>Why it matters</h2>
<ul>
  <li><strong>Exam readiness</strong> - produce a clear history on request instead of scrambling.</li>
  <li><strong>Internal oversight</strong> - firm admins can review activity across advisors.</li>
  <li><strong>Client trust</strong> - changes are attributable and reversible to a known prior state.</li>
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
    description: 'Prism includes a CRM built for advisors: tasks, a client pipeline, an activity timeline, and automated cadences - connected to the same roadmaps and reports you already use.',
    keywords: 'CRM for financial advisors, RIA CRM, advisor CRM software, financial advisor pipeline, client cadences',
    updated: '2026-05-30',
    publishAt: '2026-05-30',
    h1: 'A CRM that lives where the planning happens',
    lede: 'Bolt-on CRMs make you re-enter everything. Prism’s workflow sits on top of the same client data as your roadmaps and reports - so nothing is duplicated.',
    body: `
<h2>Run the book of business</h2>
<ul>
  <li><strong>Tasks</strong> - assign and track follow-ups against the right client.</li>
  <li><strong>Pipeline</strong> - move prospects and households through clear stages.</li>
  <li><strong>Activity timeline</strong> - a chronological record of touchpoints per client.</li>
  <li><strong>Cadences</strong> - recurring outreach so no client slips through the cracks.</li>
</ul>

<h2>Connected, not bolted on</h2>
<p>Because the CRM shares the same data model as the roadmaps, reporting, and audit trail, a task or pipeline change is already tied to the client's full context - no exports, no double entry.</p>

<h2>One workspace</h2>
<p>Planning, client portal, reporting, compliance, and CRM in a single secure app means your team works from one source of truth instead of stitching tools together.</p>
`,
    faq: [
      { q: 'Does Prism include a CRM?', a: 'Yes. Prism has advisor CRM workflow built in - tasks, a client pipeline, an activity timeline, and automated cadences - sharing the same data as your roadmaps and reports.' },
      { q: 'Do I need a separate CRM with Prism?', a: 'No. The CRM is part of the workspace and connected to client roadmaps, reporting, and the audit trail, so you avoid duplicate data entry across tools.' },
    ],
  },

  {
    slug: 'account-aggregation-for-advisors',
    title: 'Account Aggregation for Financial Advisors | Prism',
    description: 'Prism aggregates client account balances and holdings through secure bank linking, so advisors see the full financial picture without manual statement entry.',
    keywords: 'account aggregation, advisor account aggregation, financial data aggregation, held-away accounts',
    updated: '2026-06-16', publishAt: '2026-06-16',
    h1: 'Account aggregation that builds the whole picture',
    lede: 'A plan is only as good as the data behind it. Prism pulls connected account balances and holdings into one view, so you advise on reality, not last quarter’s statement.',
    body: `
<h2>One connected view</h2>
<p>Clients securely link their accounts, and Prism keeps balances and holdings current in the workspace. Advisors stop chasing PDFs and re-keying numbers, and the roadmap, net-worth picture, and reports all draw from the same live data.</p>

<h2>Why it matters</h2>
<ul>
  <li><strong>Accuracy</strong> - advice based on current balances, not stale statements.</li>
  <li><strong>Less manual work</strong> - no quarterly data-entry marathons.</li>
  <li><strong>Held-away visibility</strong> - see accounts you do not custody, for true holistic planning.</li>
</ul>

<h2>Connected to everything else</h2>
<p>Because aggregation feeds the same data model as <a href="${SITE}/performance-reporting-for-rias/">performance reporting</a> and lifecycle roadmaps, connected balances flow straight into the client’s plan and your reports - no exports.</p>
`,
    faq: [
      { q: 'How does Prism aggregate client accounts?', a: 'Clients securely link their accounts and Prism keeps balances and holdings current in the workspace, feeding the same data used by roadmaps and reports.' },
      { q: 'Can Prism show held-away accounts?', a: 'Yes. Linked accounts you do not custody appear alongside managed ones, giving a holistic view for planning.' },
    ],
  },

  {
    slug: 'performance-reporting-for-rias',
    title: 'Performance Reporting Software for RIAs | Prism',
    description: 'Prism generates clean, client-ready performance and invoice reports straight from connected account data - no spreadsheet wrangling.',
    keywords: 'performance reporting software, RIA performance reports, advisor reporting software, client reports',
    updated: '2026-06-30', publishAt: '2026-06-30',
    h1: 'Performance reporting without the spreadsheet wrangling',
    lede: 'Reporting season should not mean a week in Excel. Prism turns connected account data into clean, client-ready reports on demand.',
    body: `
<h2>Reports clients understand</h2>
<p>Generate clear performance summaries and fee invoices that read well and print cleanly. Because they are built from the same aggregated data as the rest of the workspace, the numbers always reconcile with what the client sees in their portal.</p>

<h2>Built in, not bolted on</h2>
<ul>
  <li><strong>On-demand</strong> - produce a report whenever you need one, not just quarterly.</li>
  <li><strong>Consistent</strong> - same data source as the client portal and roadmap.</li>
  <li><strong>Printable</strong> - clean output for review meetings and records.</li>
</ul>

<h2>Part of the workflow</h2>
<p>Reporting connects to <a href="${SITE}/account-aggregation-for-advisors/">account aggregation</a> and your compliance records, so generating a report also leaves a clean trail.</p>
`,
    faq: [
      { q: 'Does Prism create client performance reports?', a: 'Yes. Prism generates client-ready performance summaries and fee invoices from connected account data, available on demand.' },
      { q: 'Do the reports match the client portal?', a: 'Yes. Reports draw from the same aggregated data the client sees in their portal, so the figures reconcile.' },
    ],
  },

  {
    slug: 'client-lifecycle-planning-software',
    title: 'Client Lifecycle Planning Software | Prism',
    description: 'Prism turns each client’s wealth into a sequenced lifecycle roadmap - clear horizons clients understand and advisors can act on.',
    keywords: 'lifecycle planning, financial planning software, client roadmaps, financial advisor planning software',
    updated: '2026-07-14', publishAt: '2026-07-14',
    h1: 'Lifecycle planning clients can actually see',
    lede: 'Most planning lives in the advisor’s head or a static deck. Prism makes it a living roadmap the client opens any time.',
    body: `
<h2>Wealth, refracted into horizons</h2>
<p>Prism sequences each client’s financial life into clear stages - what is handled, what is next, and why. Clients get orientation instead of jargon; advisors get a shared reference for every conversation.</p>

<h2>A plan that stays current</h2>
<ul>
  <li><strong>Living, not static</strong> - the roadmap updates as the client’s data and goals change.</li>
  <li><strong>Shared context</strong> - advisor and client see the same picture from both sides.</li>
  <li><strong>Actionable</strong> - each stage ties to concrete next steps.</li>
</ul>

<h2>The hub of the workspace</h2>
<p>The roadmap connects to <a href="${SITE}/realtime-client-collaboration/">realtime collaboration</a> and reporting, so planning, doing, and documenting all live in one place.</p>
`,
    faq: [
      { q: 'What is lifecycle planning in Prism?', a: 'It sequences a client’s financial life into clear stages - what is handled, what is next, and why - as a living roadmap both advisor and client can see.' },
      { q: 'Does the roadmap update automatically?', a: 'Yes. It reflects the client’s current data and goals, so it stays current rather than going stale like a static plan.' },
    ],
  },

  {
    slug: 'why-advisors-outgrow-spreadsheets',
    title: 'Why Advisors Outgrow Spreadsheets (and What Comes Next) | Prism',
    description: 'Spreadsheets break down as an advisory practice grows - no audit trail, no client access, manual data entry. Here is what to move to and why.',
    keywords: 'financial advisor spreadsheets, advisor software vs excel, RIA spreadsheet alternative',
    updated: '2026-07-28', publishAt: '2026-07-28',
    h1: 'When spreadsheets stop scaling for advisors',
    lede: 'Excel is where most practices start. It is rarely where they should stay. Here is where it breaks - and what replaces it.',
    body: `
<h2>Where spreadsheets break</h2>
<ul>
  <li><strong>No audit trail</strong> - a cell change leaves no record, which is a compliance problem.</li>
  <li><strong>No client access</strong> - clients cannot log in to their own plan.</li>
  <li><strong>Manual data</strong> - balances are re-keyed by hand and quickly go stale.</li>
  <li><strong>Version chaos</strong> - "final_v3_really.xlsx" is not a system of record.</li>
</ul>

<h2>What comes next</h2>
<p>A purpose-built workspace keeps the flexibility you like while adding what spreadsheets cannot: a <a href="${SITE}/compliance-audit-trail-for-advisors/">compliance audit trail</a>, a client portal, live account data, and reporting - in one place, with proper security.</p>

<h2>Without the rip-and-replace</h2>
<p>Prism is one workspace for planning, the client portal, reporting, compliance, and CRM, so you consolidate tools instead of adding another silo.</p>
`,
    faq: [
      { q: 'Why are spreadsheets risky for advisors?', a: 'They lack an audit trail, client access, and live data, and they fragment into uncontrolled versions - all problems for a growing, regulated practice.' },
      { q: 'What should advisors use instead?', a: 'A purpose-built workspace that adds a client portal, live account data, reporting, and a compliance audit trail while keeping planning flexible.' },
    ],
  },

  {
    slug: 'ria-software-security',
    title: 'Security in RIA Software: MFA, Row-Level Security, and Audit Trails | Prism',
    description: 'Client financial data demands real security. Prism uses row-level security, optional multi-factor authentication, and an append-only audit trail to keep data protected and access scoped.',
    keywords: 'RIA software security, advisor data security, financial advisor MFA, row-level security',
    updated: '2026-08-11', publishAt: '2026-08-11',
    h1: 'Security built into the foundation, not bolted on',
    lede: 'Client financial data is among the most sensitive there is. Prism is built so each person sees only what they should - and every action is accountable.',
    body: `
<h2>Access scoped at the data layer</h2>
<p>Prism enforces <strong>row-level security</strong> along the firm → advisor → client hierarchy. A client only ever sees their own data; an advisor sees their book; firm admins see their firm. The rules live in the database, not just the UI.</p>

<h2>Defense in depth</h2>
<ul>
  <li><strong>Multi-factor authentication</strong> - optional TOTP and Google sign-in.</li>
  <li><strong>Append-only audit trail</strong> - every meaningful action is attributable.</li>
  <li><strong>Strict transport and content policies</strong> - hardened headers across the app.</li>
</ul>

<h2>Accountability by default</h2>
<p>Security and compliance reinforce each other: the same model that scopes access also powers the <a href="${SITE}/compliance-audit-trail-for-advisors/">audit trail</a>.</p>
`,
    faq: [
      { q: 'How does Prism protect client data?', a: 'Row-level security scopes access along the firm, advisor, and client hierarchy at the database layer, with optional multi-factor authentication and an append-only audit trail.' },
      { q: 'Does Prism support multi-factor authentication?', a: 'Yes. Prism supports optional TOTP-based MFA and Google sign-in.' },
    ],
  },

  {
    slug: 'realtime-client-collaboration',
    title: 'Realtime Client Collaboration for Advisors | Prism',
    description: 'Prism lets advisors and clients collaborate in realtime - comments, flags, and updates that sync instantly, so the relationship lives between meetings.',
    keywords: 'client collaboration, advisor client portal collaboration, realtime advisor software',
    updated: '2026-08-25', publishAt: '2026-08-25',
    h1: 'A relationship that lives between meetings',
    lede: 'Most advice happens four times a year. Prism keeps the conversation going in between, with realtime collaboration inside the plan.',
    body: `
<h2>Work together, live</h2>
<p>Comments, questions, and flags sync instantly between advisor and client inside the workspace. A client can raise a question on their roadmap; you see it and respond without a phone-tag cycle.</p>

<h2>Why realtime matters</h2>
<ul>
  <li><strong>Faster cycles</strong> - resolve questions as they come up.</li>
  <li><strong>Context preserved</strong> - discussion stays attached to the relevant part of the plan.</li>
  <li><strong>Stronger relationships</strong> - clients feel looked after year-round.</li>
</ul>

<h2>On a shared plan</h2>
<p>Collaboration sits on top of the <a href="${SITE}/client-lifecycle-planning-software/">lifecycle roadmap</a>, so every conversation has context built in.</p>
`,
    faq: [
      { q: 'How do clients and advisors collaborate in Prism?', a: 'Through comments, questions, and flags that sync in realtime inside the workspace, attached to the relevant part of the client’s plan.' },
      { q: 'Does collaboration replace meetings?', a: 'No - it complements them, keeping the relationship active between scheduled reviews instead of going quiet.' },
    ],
  },

  {
    slug: 'advisor-fee-billing-and-invoicing',
    title: 'Fee Billing and Invoicing for RIAs | Prism',
    description: 'Prism generates clean fee invoices from the same data as your reports, with a complete record of what was billed and when.',
    keywords: 'advisor fee billing, RIA invoicing, advisory fee invoices, AUM billing software',
    updated: '2026-09-08', publishAt: '2026-09-08',
    h1: 'Fee billing that reconciles itself',
    lede: 'Invoicing should not be a separate, error-prone chore. Prism produces fee invoices from the same connected data behind your reports.',
    body: `
<h2>Invoices from the source of truth</h2>
<p>Generate client-ready fee invoices that draw on the same account data as your performance reports, so billing reconciles with reality and with what clients see in their portal.</p>

<h2>Clean and on the record</h2>
<ul>
  <li><strong>Client-ready</strong> - clear, printable invoices.</li>
  <li><strong>Consistent</strong> - one data source for reports and billing.</li>
  <li><strong>Documented</strong> - invoice generation is captured in the audit trail.</li>
</ul>

<h2>One less tool</h2>
<p>Billing lives alongside <a href="${SITE}/performance-reporting-for-rias/">performance reporting</a> in the same workspace, so you are not stitching a separate invoicing app into your stack.</p>
`,
    faq: [
      { q: 'Can Prism generate fee invoices?', a: 'Yes. Prism produces client-ready fee invoices from the same connected data as your performance reports, and logs their generation in the audit trail.' },
      { q: 'Do invoices reconcile with reports?', a: 'Yes, because both draw from the same account data, so billing matches what the client sees.' },
    ],
  },

  {
    slug: 'client-onboarding-for-advisors',
    title: 'Client Onboarding Software for Financial Advisors | Prism',
    description: 'Prism gets new clients into a secure portal and a personalized roadmap quickly, with access scoped correctly from day one.',
    keywords: 'client onboarding advisors, advisor onboarding software, RIA client onboarding',
    updated: '2026-09-22', publishAt: '2026-09-22',
    h1: 'Onboarding that starts the relationship right',
    lede: 'First impressions compound. Prism gets a new client into a secure portal and a personalized roadmap fast, with the right access from the start.',
    body: `
<h2>From signed to set up</h2>
<p>New clients log in to their own portal, link accounts, and see a roadmap built around their situation. Access is scoped correctly from the first session, so onboarding is both fast and safe.</p>

<h2>Why it matters</h2>
<ul>
  <li><strong>Momentum</strong> - clients engage while enthusiasm is high.</li>
  <li><strong>Clarity</strong> - a roadmap orients them immediately.</li>
  <li><strong>Security from day one</strong> - row-level access scoping applies instantly.</li>
</ul>

<h2>Into the full workspace</h2>
<p>Once onboarded, the client steps straight into <a href="${SITE}/realtime-client-collaboration/">collaboration</a> and lifecycle planning - no separate tools to introduce.</p>
`,
    faq: [
      { q: 'How does client onboarding work in Prism?', a: 'New clients log into their portal, link accounts, and see a personalized roadmap, with access correctly scoped from the first session.' },
      { q: 'Is client data scoped correctly during onboarding?', a: 'Yes. Row-level security applies from day one, so each client only ever sees their own information.' },
    ],
  },

  {
    slug: 'best-client-portal-for-financial-advisors',
    title: 'What to Look for in a Client Portal for Financial Advisors | Prism',
    description: 'The best advisor client portals do more than store documents. Here are the features that matter - living roadmaps, aggregation, collaboration, and a compliance trail.',
    keywords: 'best client portal financial advisors, advisor client portal features, choosing a client portal',
    updated: '2026-10-06', publishAt: '2026-10-06',
    h1: 'What separates a great advisor client portal from a file vault',
    lede: 'Many "client portals" are just document storage with a login. Here is what actually moves the relationship forward.',
    body: `
<h2>Features that matter</h2>
<ul>
  <li><strong>A living roadmap</strong>, not a folder of statements - clients should see their plan, not just files.</li>
  <li><strong>Account aggregation</strong> so the picture is current.</li>
  <li><strong>Realtime collaboration</strong> so the relationship lives between meetings.</li>
  <li><strong>A compliance audit trail</strong> so activity is defensible.</li>
  <li><strong>Real security</strong> - row-level access and MFA, not just a password.</li>
</ul>

<h2>How Prism measures up</h2>
<p>Prism is built around exactly these: a <a href="${SITE}/client-lifecycle-planning-software/">lifecycle roadmap</a>, <a href="${SITE}/account-aggregation-for-advisors/">aggregation</a>, collaboration, reporting, and a <a href="${SITE}/compliance-audit-trail-for-advisors/">compliance trail</a> - in one secure workspace.</p>
`,
    faq: [
      { q: 'What should I look for in an advisor client portal?', a: 'A living plan rather than a document vault, account aggregation, realtime collaboration, a compliance audit trail, and real security like row-level access and MFA.' },
      { q: 'How is Prism different from a document portal?', a: 'Prism centers on a living lifecycle roadmap with aggregation, collaboration, reporting, and a compliance trail - not just file storage.' },
    ],
  },

  {
    slug: 'financial-planning-software-for-small-rias',
    title: 'Financial Planning Software for Small RIAs | Prism',
    description: 'Small RIAs need one workspace that does planning, the client portal, reporting, and compliance - without enterprise complexity or a stack of subscriptions.',
    keywords: 'financial planning software small RIA, software for small advisory firms, solo advisor software',
    updated: '2026-10-20', publishAt: '2026-10-20',
    h1: 'One workspace for a lean advisory practice',
    lede: 'Small firms feel tool sprawl most. Prism consolidates planning, the client portal, reporting, and compliance into a single workspace.',
    body: `
<h2>Built for lean teams</h2>
<p>Solo advisors and small RIAs do not have an ops department to stitch tools together. Prism puts planning, the client portal, reporting, and a compliance trail in one place, so a small team runs like a bigger one.</p>

<h2>Why it fits small firms</h2>
<ul>
  <li><strong>Fewer subscriptions</strong> - consolidate instead of integrating five apps.</li>
  <li><strong>Less admin</strong> - shared data means no duplicate entry.</li>
  <li><strong>Compliance without a department</strong> - the audit trail is automatic.</li>
</ul>

<h2>Room to grow</h2>
<p>The same row-level security model that protects a solo practice scales cleanly to multiple advisors as you add them.</p>
`,
    faq: [
      { q: 'Is Prism a good fit for a small or solo RIA?', a: 'Yes. It consolidates planning, the client portal, reporting, and compliance into one workspace, which is ideal for lean teams without dedicated operations staff.' },
      { q: 'Will it scale as my firm grows?', a: 'Yes. The firm, advisor, and client security model scales cleanly as you add advisors.' },
    ],
  },

  {
    slug: 'advisor-tech-stack',
    title: 'The Modern Advisor Tech Stack: What an RIA Actually Needs | Prism',
    description: 'A practical look at the tools a modern RIA needs - planning, client portal, aggregation, reporting, CRM, and compliance - and how to avoid tool sprawl.',
    keywords: 'advisor tech stack, RIA technology stack, financial advisor tools, advisor software stack',
    updated: '2026-11-03', publishAt: '2026-11-03',
    h1: 'The modern advisor tech stack, without the sprawl',
    lede: 'The typical RIA stack is five or six disconnected apps. Here is what you actually need - and why fewer, connected tools win.',
    body: `
<h2>The core functions</h2>
<ul>
  <li><strong>Planning</strong> - turn a client’s situation into a clear plan.</li>
  <li><strong>Client portal</strong> - give clients a window into that plan.</li>
  <li><strong>Account aggregation</strong> - keep the data current.</li>
  <li><strong>Reporting and billing</strong> - communicate results and fees.</li>
  <li><strong>CRM</strong> - run the book of business.</li>
  <li><strong>Compliance</strong> - keep a defensible record.</li>
</ul>

<h2>The cost of disconnection</h2>
<p>When these live in separate apps, you pay in duplicate data entry, reconciliation errors, and integration upkeep. Connected tools share one source of truth.</p>

<h2>Consolidating the stack</h2>
<p>Prism covers planning, the client portal, aggregation, reporting, <a href="${SITE}/crm-for-financial-advisors/">CRM</a>, and <a href="${SITE}/compliance-audit-trail-for-advisors/">compliance</a> in one workspace, replacing several point tools.</p>
`,
    faq: [
      { q: 'What does a modern RIA tech stack include?', a: 'Planning, a client portal, account aggregation, reporting and billing, CRM, and compliance. The main risk is sprawl across disconnected apps.' },
      { q: 'Why consolidate advisor tools?', a: 'Connected tools share one source of truth, eliminating duplicate entry, reconciliation errors, and integration maintenance.' },
    ],
  },

  {
    slug: 'client-meeting-cadences',
    title: 'Client Meeting Cadences for Financial Advisors | Prism',
    description: 'Prism’s cadences automate recurring client outreach so no relationship goes quiet - built into the same workspace as your CRM and roadmaps.',
    keywords: 'client meeting cadence, advisor client cadences, client review schedule, advisor follow-up automation',
    updated: '2026-11-17', publishAt: '2026-11-17',
    h1: 'Cadences so no client goes quiet',
    lede: 'The clients who feel neglected are usually the ones who quietly slipped off the calendar. Prism cadences make recurring outreach automatic.',
    body: `
<h2>Recurring outreach, handled</h2>
<p>Set cadences for reviews and check-ins, and Prism keeps the schedule so the right touchpoint surfaces at the right time. No client falls through the cracks because a reminder lived only in your head.</p>

<h2>Why cadences matter</h2>
<ul>
  <li><strong>Retention</strong> - consistent contact is what clients remember.</li>
  <li><strong>Fairness</strong> - every client gets attention, not just the loudest.</li>
  <li><strong>Less mental load</strong> - the system tracks the schedule, not you.</li>
</ul>

<h2>Part of the CRM</h2>
<p>Cadences are part of Prism’s <a href="${SITE}/crm-for-financial-advisors/">advisor CRM</a>, tied to the same client records as tasks, pipeline, and the activity timeline.</p>
`,
    faq: [
      { q: 'What are client cadences in Prism?', a: 'Automated recurring outreach schedules for reviews and check-ins, so the right client touchpoint surfaces at the right time.' },
      { q: 'Are cadences part of the CRM?', a: 'Yes. Cadences are part of Prism’s advisor CRM, tied to the same client records as tasks, pipeline, and the activity timeline.' },
    ],
  },
];

// ── Publishing ───────────────────────────────────────────────────────────
// Drip schedule: a page is only rendered/sitemapped once its publishAt date has arrived.
const todayISO = () => new Date().toISOString().slice(0, 10);
export const publishedPages = () => pages.filter(p => (p.publishAt || '0000-00-00') <= todayISO());

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
  :root { --bg:#fafaf7; --surface:#fff; --ink:#1c2e4a; --ink2:#2d4258; --ink3:#51708a; --line:#e4dfd0; --gold:#a98c4b; --serif:'Source Serif 4',Georgia,serif; --sans:'Inter',system-ui,sans-serif; }
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

  .cta-foot{margin-top:10px;padding-top:10px;border-top:1px solid var(--line);color:var(--ink3);}
  .cta-head{font-family:var(--serif);font-size:19px;color:var(--ink);}
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
  Secured by row-level security &middot; Audit trail designed around SEC 17a-3/17a-4 principles
  <div class="cta-foot">
    &copy; 2026 Prism Advisor Workspace &middot; A product of LeMay Ventures LLC &nbsp;&middot;&nbsp;
    <a href="${SITE}/privacy.html">Privacy</a> &middot;
    <a href="${SITE}/terms.html">Terms</a> &middot;
    <a href="${SITE}/dpa.html">DPA</a> &middot;
    <a href="${SITE}/security.html">Security</a>
  </div>
</div></footer>`;

export function renderPage(p) {
  const canonical = `${SITE}/${p.slug}/`;
  const related = publishedPages().filter(o => o.slug !== p.slug).slice(0, 4);
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
    <strong class="cta-head">See it before you sign up.</strong>
    <div>Open a fully populated demo workspace - no account required.</div>
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

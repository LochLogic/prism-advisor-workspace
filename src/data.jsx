// Prism — domain data: Phases, mock client roster, alerts, flagged questions.
// (In production these live in Supabase; see supabase/migrations/001_prism_schema.sql)

/* ─── Wealth Horizons · 7 Phases (institutional RIA voice) ─────────── */
let phasesData = [
  {
    id: 0, num: '01', title: 'Foundation', tag: 'Stabilization',
    description: 'Establish the operational base — predictable cash flow, current obligations, and a disciplined household ledger.',
    icon: 'Shield',
    rationale: "Before optimization, stabilization. <b>Cash flow precedes capital allocation.</b> A clear monthly accounting — every dollar in, every dollar out — is the prerequisite for every subsequent decision. We map the household ledger together in onboarding, then refresh quarterly.",
    tasks: [
      { id: 'p0t1', label: 'Complete household cash-flow worksheet', tool: 'discuss' },
      { id: 'p0t2', label: 'Confirm essential expenses are current', tool: null },
      { id: 'p0t3', label: 'Establish autopay across recurring obligations', tool: null },
      { id: 'p0t4', label: 'Review and acknowledge fiduciary disclosure', tool: 'discuss' },
      { id: 'p0t5', label: 'Sign Investment Policy Statement (draft)', tool: 'discuss' },
    ],
    calc: 'cashflow',
    metricLabel: 'Monthly outflow',
    metricKey: 'totalExpenses',
  },
  {
    id: 1, num: '02', title: 'Liquidity Reserve', tag: 'Protection',
    description: 'Build the operating cushion — six months of essential outflow held in laddered cash equivalents, isolated from market risk.',
    icon: 'Umbrella',
    rationale: "The reserve is not a return vehicle. Its function is to <b>prevent forced liquidation of long-horizon assets during a drawdown</b>. Six months is standard for stable W-2 income; we extend to twelve for variable compensation, equity-heavy households, or pre-retirees.",
    tasks: [
      { id: 'p1t1', label: 'Open laddered HYSA / Treasury MMF (4-tier)', tool: null },
      { id: 'p1t2', label: 'Fund Month 1–3 reserve from working cash', tool: null },
      { id: 'p1t3', label: 'Capture full employer 401(k) match (parallel)', tool: 'discuss' },
      { id: 'p1t4', label: 'Document recurring obligations + minimums', tool: null },
      { id: 'p1t5', label: 'Build to six-month target — review semi-annually', tool: 'discuss' },
    ],
    calc: 'reserve',
    metricLabel: 'Six-month target',
    metricKey: 'reserveTarget',
  },
  {
    id: 2, num: '03', title: 'Liability Optimization', tag: 'Velocity',
    description: 'Retire high-cost debt at a rate that exceeds plausible after-tax investment returns. Apply the avalanche method against APRs above 6%.',
    icon: 'TrendDown',
    rationale: "Debt servicing above ~7% APR produces a <b>guaranteed, tax-free negative return</b> that no reasonable portfolio can systematically beat after fees, taxes, and sequence risk. We attack the highest-APR balance first, hold minimums on the rest, and roll the freed payment forward. Balance transfers and rate negotiations are the first move, not the last.",
    tasks: [
      { id: 'p2t1', label: 'Compile complete liability schedule', tool: null },
      { id: 'p2t2', label: 'Negotiate rate reductions on revolving credit', tool: 'discuss' },
      { id: 'p2t3', label: 'Execute balance transfers where economical', tool: 'discuss' },
      { id: 'p2t4', label: 'Apply avalanche payoff above 6% APR', tool: null },
      { id: 'p2t5', label: 'Quarterly debt schedule review', tool: null },
    ],
    calc: 'avalanche',
    metricLabel: 'High-cost balance',
    metricKey: 'toxicDebt',
  },
  {
    id: 3, num: '04', title: 'Tax-Advantaged Foundations', tag: 'Shelter',
    description: 'Fund the triple-advantaged HSA in full. The most efficient single vehicle in the US tax code when the household qualifies.',
    icon: 'Heart',
    rationale: "The HSA is the only US account with <b>three-axis tax advantage</b>: deductible contributions, tax-free growth, and tax-free qualified withdrawals. We treat it as a stealth retirement bucket — invest the balance, pay current medical costs from cash flow, and retain receipts for tax-free reimbursement decades hence.",
    tasks: [
      { id: 'p3t1', label: 'Confirm HDHP eligibility for current plan year', tool: 'discuss' },
      { id: 'p3t2', label: 'Fund annual HSA limit ($4,400 / $8,750)', tool: null },
      { id: 'p3t3', label: 'Migrate cash balance to invested HSA assets', tool: 'discuss' },
      { id: 'p3t4', label: 'Establish receipt archive for future reimbursement', tool: null },
    ],
    calc: 'hsa',
    metricLabel: 'Annual tax savings',
    metricKey: 'hsaTaxSavings',
  },
  {
    id: 4, num: '05', title: 'Retirement Sleeve Construction', tag: 'Long Horizon',
    description: 'Layer Roth/Traditional IRA contributions and complete employer plan deferrals. Establish target asset allocation by location.',
    icon: 'Briefcase',
    rationale: "Sleeve construction is a tax-location problem more than a security-selection problem. The household holds the same total equity exposure across accounts — but <b>tax-inefficient assets (corporate bonds, REITs, active funds) live in tax-deferred space</b>, while broad equity index funds anchor taxable and Roth. We model the optimal placement annually in the Asset Location tool.",
    tasks: [
      { id: 'p4t1', label: 'Confirm Roth vs. Traditional split for current year', tool: 'discuss' },
      { id: 'p4t2', label: 'Execute backdoor Roth if above phase-out', tool: 'discuss' },
      { id: 'p4t3', label: 'Complete employee 401(k)/403(b) deferral ($23,500)', tool: null },
      { id: 'p4t4', label: 'Review asset allocation across all sleeves', tool: 'discuss' },
      { id: 'p4t5', label: 'Run Asset Location optimizer (annual)', tool: 'advanced' },
    ],
    calc: 'assetlocation',
    metricLabel: 'Retirement assets',
    metricKey: 'retirementAssets',
  },
  {
    id: 5, num: '06', title: 'Capital Deployment', tag: 'Velocity',
    description: 'Extend the portfolio into taxable space with disciplined dollar-cost averaging, tax-loss harvesting, and broad index exposure.',
    icon: 'TrendUp',
    rationale: "Taxable capital is the lever that compresses time-to-independence. <b>Systematic tax-loss harvesting adds an estimated 0.50–1.50% in annualized after-tax return</b> across full market cycles — the engine our discretionary management runs on. We coordinate concentrated equity, 10b5-1 plans, and Roth conversion windows from this base.",
    tasks: [
      { id: 'p5t1', label: 'Open jointly-titled taxable brokerage', tool: null },
      { id: 'p5t2', label: 'Set automated monthly deployment', tool: null },
      { id: 'p5t3', label: 'Enable systematic tax-loss harvesting', tool: 'discuss' },
      { id: 'p5t4', label: 'Run Monte Carlo retirement projection', tool: 'advanced' },
      { id: 'p5t5', label: 'Quarterly portfolio review with advisor', tool: 'discuss' },
    ],
    calc: 'montecarlo',
    metricLabel: 'Taxable assets',
    metricKey: 'taxableBalance',
  },
  {
    id: 6, num: '07', title: 'Legacy & Drawdown', tag: 'Stewardship',
    description: 'Sequence withdrawals tax-efficiently, optimize Roth conversion ladder, and structure the estate for intergenerational transfer.',
    icon: 'Anchor',
    rationale: "The accumulation problem and the distribution problem are different problems. <b>Withdrawal sequencing — taxable, then tax-deferred, then Roth — combined with Roth conversions during low-income years can preserve six- to seven-figure value across the lifecycle.</b> Estate structuring (revocable trust, beneficiary designations, basis step-up) is non-negotiable above HNW thresholds.",
    tasks: [
      { id: 'p6t1', label: 'Build 5-year Roth conversion ladder', tool: 'advanced' },
      { id: 'p6t2', label: 'Model RMD impact at age 73', tool: 'advanced' },
      { id: 'p6t3', label: 'Bridge ACA coverage to Medicare (if applicable)', tool: 'discuss' },
      { id: 'p6t4', label: 'Execute revocable trust + beneficiary review', tool: 'discuss' },
      { id: 'p6t5', label: 'Run Estate & Generational Wealth model', tool: 'advanced' },
    ],
    calc: 'rothladder',
    calc2: 'estate',
    metricLabel: 'Projected legacy',
    metricKey: 'legacyValue',
  },
];

/* ─── Advisor (this user) ─────────────────────────────────────────── */
const advisor = {
  id: 'adv_001',
  name: 'M. Chen',
  fullName: 'Madeline Chen, CFP®',
  firm: 'Northbridge Wealth',
  initials: 'MC',
  email: 'm.chen@northbridge.example',
};

/* ─── Mock client roster ──────────────────────────────────────────── */
// Each client has a current Phase (0-6), AUM, and a derived "uninvested cash"
// drift signal we surface in Alerts.
const clientsData = [
  {
    id: 'c001', name: 'Robert & Eileen Marsh', shortName: 'R. & E. Marsh',
    tag: 'Joint · age 62', initials: 'RM',
    aum: 4_280_000, phase: 6, phaseProgress: 0.42,
    lastActivity: '2h ago', recent: true,
    surplus: 14_200, uninvestedCash: 184_300,
    monthlyOutflow: 18_900, accentHue: 215,
    notes: 'Pre-retirement bridge planning. Concentrated PFE position 14%.',
  },
  {
    id: 'c002', name: 'Yara Okonkwo', shortName: 'Y. Okonkwo',
    tag: 'Individual · age 41', initials: 'YO',
    aum: 1_840_000, phase: 5, phaseProgress: 0.68,
    lastActivity: '6h ago', recent: true,
    surplus: 9_400, uninvestedCash: 82_900,
    monthlyOutflow: 9_120, accentHue: 32,
    notes: 'Surgeon. RSU vest schedule heavy 2026 Q3. TLH active.',
  },
  {
    id: 'c003', name: 'Daniel Castellanos', shortName: 'D. Castellanos',
    tag: 'Individual · age 38', initials: 'DC',
    aum: 920_000, phase: 4, phaseProgress: 0.55,
    lastActivity: '1d ago', recent: false,
    surplus: 5_200, uninvestedCash: 41_200,
    monthlyOutflow: 7_400, accentHue: 145,
    notes: 'Founder · liquidity event Q1 2026. Backdoor Roth in progress.',
  },
  {
    id: 'c004', name: 'The Patel Family Trust', shortName: 'Patel Trust',
    tag: 'Trust · multigenerational', initials: 'PT',
    aum: 12_900_000, phase: 6, phaseProgress: 0.78,
    lastActivity: '3d ago', recent: false,
    surplus: 0, uninvestedCash: 412_000,
    monthlyOutflow: 28_400, accentHue: 268,
    notes: 'GST trust. Annual review pending. Estate counsel TBD.',
  },
  {
    id: 'c005', name: 'Jeong-Su Park', shortName: 'J. Park',
    tag: 'Individual · age 34', initials: 'JP',
    aum: 380_000, phase: 3, phaseProgress: 0.5,
    lastActivity: '4h ago', recent: true,
    surplus: 3_900, uninvestedCash: 18_200,
    monthlyOutflow: 5_100, accentHue: 8,
    notes: 'New onboarding. HDHP confirmed; HSA setup this quarter.',
  },
  {
    id: 'c006', name: 'Alessandro & Marta Ferri', shortName: 'A. & M. Ferri',
    tag: 'Joint · age 49', initials: 'AF',
    aum: 2_640_000, phase: 5, phaseProgress: 0.31,
    lastActivity: '11d ago', recent: false,
    surplus: 8_100, uninvestedCash: 96_500,
    monthlyOutflow: 14_200, accentHue: 198,
    notes: 'Italy property closing 2026 Q2. Currency-hedge discussion needed.',
  },
  {
    id: 'c007', name: 'Beatrice Ndlovu', shortName: 'B. Ndlovu',
    tag: 'Individual · age 56', initials: 'BN',
    aum: 3_120_000, phase: 6, phaseProgress: 0.18,
    lastActivity: '5d ago', recent: false,
    surplus: 6_800, uninvestedCash: 58_900,
    monthlyOutflow: 11_400, accentHue: 305,
    notes: 'Recently widowed. Probate complete. Cash bias persistent.',
  },
  {
    id: 'c008', name: 'M. Tanaka', shortName: 'M. Tanaka',
    tag: 'Individual · age 29', initials: 'MT',
    aum: 165_000, phase: 2, phaseProgress: 0.6,
    lastActivity: '18h ago', recent: true,
    surplus: 2_400, uninvestedCash: 6_800,
    monthlyOutflow: 4_800, accentHue: 168,
    notes: 'Aggressive avalanche payoff. 11k toxic debt remaining.',
  },
];

/* ─── Alerts feed (advisor command center) ────────────────────────── */
const alertsData = [
  {
    id: 'al01', priority: 'high', clientId: 'c004',
    icon: 'Dollar',
    headline: 'Cash drag — Patel Trust',
    body: 'Trust account holding <b>$412,000</b> in uninvested cash following beneficiary distribution. Below target allocation by <b>3.2%</b>. Recommend brokerage deployment or laddered Treasury MMF before quarter-close.',
    timeAgo: '12m',
    cta: 'Deploy cash',
  },
  {
    id: 'al02', priority: 'high', clientId: 'c001',
    icon: 'Calendar',
    headline: 'Roth conversion window closing',
    body: '<b>Robert & Eileen Marsh</b> currently in 22% bracket with $84K headroom before 24% threshold. Window to convert traditional IRA closes <b>Dec 31</b>. Modeling shows $74K conversion is optimal.',
    timeAgo: '2h',
    cta: 'Open Roth modeler',
  },
  {
    id: 'al03', priority: 'med', clientId: 'c005',
    icon: 'Sparkles',
    headline: 'Numbers updated — J. Park',
    body: 'Client just updated take-home (<b>+$1,400/mo</b>) following promotion. Phase 04 plan needs refresh; HSA contribution rate can scale to limit immediately.',
    timeAgo: '4h',
    cta: 'Review plan',
  },
  {
    id: 'al04', priority: 'med', clientId: 'c002',
    icon: 'TrendDown',
    headline: 'TLH opportunity — Y. Okonkwo',
    body: 'Three positions in taxable sleeve are currently <b>&gt;$8,000 below cost basis</b>. Wash-sale-safe replacement trades available. Estimated <b>$2,940</b> in offset value.',
    timeAgo: '6h',
    cta: 'Add to agenda',
  },
  {
    id: 'al05', priority: 'low', clientId: 'c007',
    icon: 'AlertCircle',
    headline: 'Allocation drift — B. Ndlovu',
    body: 'Cash position has grown from <b>9% → 21%</b> over six months. Behavioral pattern post-bereavement is normal — flag for empathetic re-engagement, not urgent rebalance.',
    timeAgo: '1d',
    cta: 'Add to agenda',
  },
  {
    id: 'al06', priority: 'low', clientId: 'c006',
    icon: 'Building',
    headline: 'FX exposure — Ferri household',
    body: 'Pending EUR property purchase (Q2 2026). Recommend introducing currency-hedge conversation 60 days ahead of closing. Forward contract or staged DCA.',
    timeAgo: '3d',
    cta: 'Add to agenda',
  },
];

/* ─── Flagged questions inbox (from clients) ──────────────────────── */
const questionsData = [
  {
    id: 'q01', clientId: 'c001', timeAgo: '38m',
    quote: 'Should we hold off on the Roth conversion until after the next election? It feels like rates could change.',
    context: 'Flagged on · Phase 07 · Build 5-year Roth conversion ladder',
  },
  {
    id: 'q02', clientId: 'c003', timeAgo: '4h',
    quote: 'My CPA mentioned a "Mega Backdoor" Roth — is that something we should be doing too?',
    context: 'Flagged on · Phase 05 · Execute backdoor Roth if above phase-out',
  },
  {
    id: 'q03', clientId: 'c005', timeAgo: '1d',
    quote: 'Is the company HDHP actually worth it if I never go to the doctor?',
    context: 'Flagged on · Phase 04 · Confirm HDHP eligibility',
  },
  {
    id: 'q04', clientId: 'c002', timeAgo: '2d',
    quote: 'My friend\'s advisor told her to put everything in dividend stocks for tax efficiency. Why don\'t we?',
    context: 'Flagged on · Phase 06 · Enable systematic tax-loss harvesting',
  },
];

/* ─── CRM tasks (demo only — mirrors window.db.mapTask shape) ──────── */
const _dt = (days) => new Date(Date.now() + days * 86400000).toISOString();
const tasksData = [
  { id: 't1', clientId: 'c004', clientName: 'Patel Trust',   title: 'Confirm GST trust beneficiary designations', detail: 'Estate counsel to review before the annual meeting.', priority: 'high',   status: 'open', dueAt: _dt(-3), createdAt: _dt(-12), completedAt: null },
  { id: 't2', clientId: 'c001', clientName: 'R. & E. Marsh', title: 'Finalize Roth conversion amount before year-end', detail: '$74K modeled as optimal.',                       priority: 'high',   status: 'open', dueAt: _dt(2),  createdAt: _dt(-5),  completedAt: null },
  { id: 't3', clientId: 'c002', clientName: 'Y. Okonkwo',    title: 'Review RSU vesting tax plan',                  detail: 'Q3 vest is sizable — coordinate withholding.',      priority: 'normal', status: 'open', dueAt: _dt(0),  createdAt: _dt(-3),  completedAt: null },
  { id: 't4', clientId: 'c005', clientName: 'J. Park',       title: 'Open and fund HSA for the plan year',          detail: '',                                                  priority: 'normal', status: 'open', dueAt: _dt(5),  createdAt: _dt(-1),  completedAt: null },
  { id: 't5', clientId: 'c006', clientName: 'A. & M. Ferri', title: 'Set up EUR hedge ahead of property closing',   detail: 'Closing ~Q2; staged DCA or forward contract.',      priority: 'normal', status: 'open', dueAt: _dt(9),  createdAt: _dt(-2),  completedAt: null },
  { id: 't6', clientId: 'c007', clientName: 'B. Ndlovu',     title: 'Schedule empathetic re-engagement call',       detail: 'Cash bias persists post-bereavement.',              priority: 'low',    status: 'open', dueAt: _dt(14), createdAt: _dt(-4),  completedAt: null },
];

/* ─── Demo accounts (per mock client; sums to their AUM) ──────────── */
const accountsData = {};
clientsData.forEach(c => {
  const taxable = Math.round(c.aum * 0.6);
  const ira = c.aum - taxable;
  accountsData[c.id] = [
    { id: c.id + '-a1', client_id: c.id, type: 'taxable',         custodian: 'Schwab',   name: 'Joint brokerage', balance: taxable, cash: c.uninvestedCash || 0, source: 'manual' },
    { id: c.id + '-a2', client_id: c.id, type: 'ira_traditional', custodian: 'Fidelity', name: 'Rollover IRA',    balance: ira,     cash: 0,                    source: 'manual' },
  ];
});

/* ─── Demo generators for the Performance & Timeline tabs ─────────── */
const demoBalanceHistory = (aum) => {
  const rows = [], now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const t = (11 - i) / 11;
    const factor = 0.82 + t * 0.18 + Math.sin(i * 1.7) * 0.012; // upward trend + mild noise
    rows.push({ account_id: 'demo', as_of: d.toISOString().slice(0, 10), balance: Math.round((aum || 0) * factor), cash: 0 });
  }
  return rows;
};
const demoCashFlows = () => {
  const now = new Date();
  const m = (back) => new Date(now.getFullYear(), now.getMonth() - back, 15).toISOString().slice(0, 10);
  return [
    { id: 'cf1', flow_date: m(8), amount:  50000, kind: 'contribution' },
    { id: 'cf2', flow_date: m(3), amount: -15000, kind: 'withdrawal' },
  ];
};
const demoTimeline = (client) => {
  const now = Date.now(), ago = (days) => new Date(now - days * 86400000).toISOString();
  const email = 'advisor@demo.prism';
  const firstTask = tasksData.find(t => t.clientId === client.id);
  return [
    { id: 'tl1', occurred_at: ago(1),  action: 'profile.save',   summary: 'Updated household financial profile', actor_email: email },
    { id: 'tl2', occurred_at: ago(3),  action: 'meeting.create', summary: 'Logged quarterly review (45 min)',     actor_email: email },
    { id: 'tl3', occurred_at: ago(9),  action: 'account.update', summary: 'Refreshed brokerage balance',          actor_email: email },
    { id: 'tl4', occurred_at: ago(14), action: 'task.create',    summary: 'Created task: ' + (firstTask?.title || 'Follow-up'), actor_email: email },
    { id: 'tl5', occurred_at: ago(30), action: 'client.update',  summary: 'Updated client details',               actor_email: email },
  ];
};

/* ─── "Current user" — Robert & Eileen Marsh, viewed in Client Portal ─ */
const currentClientId = 'c001';

window.phasesData = phasesData;
window.advisor = advisor;
window.clientsData = clientsData;
window.alertsData = alertsData;
window.questionsData = questionsData;
window.tasksData = tasksData;
window.accountsData = accountsData;
window.demoBalanceHistory = demoBalanceHistory;
window.demoCashFlows = demoCashFlows;
window.demoTimeline = demoTimeline;
window.currentClientId = currentClientId;

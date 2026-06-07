// Prism — calc-core. Pure, dependency-free financial math, extracted from the UI
// so it can be unit-tested in Node AND shared by the in-browser bundle.
//
// Dual-mode: concatenated into dist/bundle.js (top-level fns are in the shared
// bundle scope; also exposed on window.PrismCalc), and require()-able by the
// Node test runner via module.exports. The two `typeof` guards make each side
// inert in the other environment.
//
// IMPORTANT: this is the single source of truth. Do not re-inline these formulas
// in components — call the functions here so the tests actually cover the app.

/* ─── Performance math (Theme D) ─────────────────────────────────────── */

// Portfolio value per snapshot date = sum of each account's latest balance ≤ that date.
function buildValueSeries(balanceRows) {
  if (!balanceRows || !balanceRows.length) return [];
  const byAccount = {};
  const dateSet = new Set();
  for (const r of balanceRows) {
    (byAccount[r.account_id] = byAccount[r.account_id] || []).push({ date: r.as_of, balance: Number(r.balance) || 0 });
    dateSet.add(r.as_of);
  }
  Object.values(byAccount).forEach(arr => arr.sort((a, b) => a.date < b.date ? -1 : 1));
  const dates = [...dateSet].sort();
  return dates.map(d => {
    let total = 0;
    for (const arr of Object.values(byAccount)) {
      let last = null;
      for (const pt of arr) { if (pt.date <= d) last = pt.balance; else break; }
      if (last != null) total += last;
    }
    return { date: d, value: total };
  });
}

// Modified Dietz return between startDate and endDate, given dated flows.
//
// Advisory fees (flows with kind === 'fee') are treated as a return DRAG, not as a
// capital flow: a fee debit already reduced the ending value and is NOT added back,
// so the default `pct` is NET of advisory fees — the number the client actually keeps.
// Contributions / withdrawals are capital flows: time-weighted and netted out so the
// client's own money moving in/out doesn't distort the return. `grossPct` adds the fee
// drag back for the advisor's pre-fee comparison; `netOfFees` flags that a fee was seen.
function modifiedDietz(series, flows, startDate, endDate) {
  if (!series.length) return null;
  const inRange = series.filter(p => p.date <= endDate);
  if (!inRange.length) return null;
  const ev = inRange[inRange.length - 1].value;
  let bv = null;
  for (const p of series) { if (p.date < startDate) bv = p.value; else break; }
  const inception = bv == null;
  if (bv == null) bv = series[0].value;
  const inPeriod = (flows || []).filter(f => f.flow_date >= startDate && f.flow_date <= endDate);
  const capital  = inPeriod.filter(f => f.kind !== 'fee');   // contributions / withdrawals
  const feeFlows = inPeriod.filter(f => f.kind === 'fee');   // advisory fee debits
  const start = new Date(startDate), end = new Date(endDate);
  const span = Math.max(1, (end - start) / 86400000);
  const net = capital.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const weighted = capital.reduce((s, f) => s + (Number(f.amount) || 0) * ((end - new Date(f.flow_date)) / 86400000 / span), 0);
  const fees = feeFlows.reduce((s, f) => s + Math.abs(Number(f.amount) || 0), 0);
  const denom = bv + weighted;
  const gain  = ev - bv - net;     // net of fees: fee debits already reduced ev and are not added back
  const grossGain = gain + fees;   // pre-fee gain for the advisor's gross figure
  return {
    bv, ev, net, gain, fees,
    pct:      denom !== 0 ? (gain / denom) * 100 : null,
    grossPct: denom !== 0 ? (grossGain / denom) * 100 : null,
    netOfFees: fees > 0,
    inception,
  };
}

function perfPeriods(series, flows) {
  if (!series.length) return [];
  const end = new Date().toISOString().slice(0, 10);
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const yStart = `${new Date().getFullYear()}-01-01`;
  const defs = [['1M', ago(30)], ['3M', ago(90)], ['YTD', yStart], ['1Y', ago(365)], ['ITD', series[0].date]];
  return defs.map(([label, start]) => ({ label, start, end, ...(modifiedDietz(series, flows, start, end) || {}) }));
}

/* ─── Planning calculators ───────────────────────────────────────────── */

// Months to pay off a balance compounding at a weighted APR with a fixed
// monthly payment. 0 if nothing owed; Infinity if the payment never wins.
function debtPayoffMonths(balance, weightedAprPct, monthly) {
  let bal = Number(balance) || 0;
  const r = (Number(weightedAprPct) || 0) / 100 / 12;
  if (bal <= 0 || monthly <= 0) return 0;
  for (let m = 1; m <= 480; m++) {
    bal = bal * (1 + r) - monthly;
    if (bal <= 0) return m;
  }
  return Infinity;
}

// Compound an HSA balance with annual contributions.
function hsaProjection(balance, contrib, rate = 0.07, years = 25) {
  let bal = Number(balance) || 0;
  const c = Number(contrib) || 0;
  for (let y = 0; y < years; y++) bal = bal * (1 + rate) + c;
  return bal;
}

// Monte Carlo retirement projection with a seeded RNG (Box–Muller). Deterministic
// for a given seed so each client sees stable-but-distinct results.
function monteCarlo({ principal, years, withdrawal, seed = 42, runs = 800, mean = 0.07, sd = 0.16 }) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let success = 0;
  const finals = [];
  for (let r = 0; r < runs; r++) {
    let bal = principal;
    let alive = true;
    for (let y = 0; y < years; y++) {
      const ret = mean + gauss() * sd;
      bal = bal * (1 + ret) - withdrawal;
      if (bal <= 0) { alive = false; bal = 0; break; }
    }
    if (alive) success++;
    finals.push(bal);
  }
  finals.sort((a, b) => a - b);
  return {
    successPct: (success / runs) * 100,
    medianFinal: finals[Math.floor(finals.length / 2)],
    p10: finals[Math.floor(finals.length * 0.1)],
    p90: finals[Math.floor(finals.length * 0.9)],
  };
}

// Roth conversion ladder: a 5-year cohort schedule, taxed as ordinary income at
// conversion, with growth applied to the un-converted remainder each year.
function rothLadder({ tradBalance, annualConvert, bracketPct, growth = 0.06, years = 5, startYear }) {
  let remaining = Number(tradBalance) || 0;
  const out = [];
  const year = startYear || new Date().getFullYear();
  for (let y = 0; y < years; y++) {
    const convert = Math.min(annualConvert, remaining);
    const tax = convert * bracketPct / 100;
    remaining -= convert;
    remaining *= (1 + growth);
    out.push({ year: year + y, convert, tax, available: year + y + 5, remaining });
  }
  return out;
}

// Estate projection: grow/draw to date of death, apply the federal estate tax
// above the exemption, then compound the net to a second generation.
function estateProjection({ principal, years, withdrawalRatePct, g2Years, realRet = 0.05, exempt = 13_990_000, estateTaxRate = 0.40 }) {
  const draw = principal * (withdrawalRatePct / 100);
  let bal = principal;
  for (let y = 0; y < years; y++) bal = bal * (1 + realRet) - draw;
  const estate = Math.max(0, bal);
  const estateTax = Math.max(0, estate - exempt) * estateTaxRate;
  const netToHeirs = estate - estateTax;
  let g2 = netToHeirs;
  for (let y = 0; y < g2Years; y++) g2 = g2 * (1 + realRet);
  return { estate, estateTax, netToHeirs, g2 };
}

// Retirement-readiness engine. Deterministic year-by-year accumulation, then
// decumulation that nets fixed-income streams (Social Security / pension / annuity)
// against inflated spending — to answer the one question every client asks:
// "are we on track?" Returns a funded ratio + a plain-language verdict.
//
// Assumptions are intentionally simple and transparent (the advisor can refine):
// nominal growth, expenses inflated from today, retirement spending ≈ today's
// spending, contributions flat in nominal terms, plan horizon to age 95. A stream
// only counts once the member reaches its start age, and grows by its COLA after.
function retirementReadiness({
  currentAge, retireAt, currentInvested, annualContribution = 0,
  annualExpenses, streams = [],
  nominalReturn = 0.06, inflation = 0.025, horizonAge = 95,
}) {
  currentAge = Number(currentAge) || 0;
  retireAt   = Math.max(currentAge, Number(retireAt) || currentAge);
  let bal    = Number(currentInvested) || 0;
  const need0 = Number(annualExpenses) || 0;
  const contrib = Number(annualContribution) || 0;

  // Accumulation: today → retirement.
  for (let a = currentAge; a < retireAt; a++) bal = (bal + contrib) * (1 + nominalReturn);
  const nestEgg = bal;

  // Decumulation: retirement → horizon. Each year, withdraw the gap between
  // inflated spending and the income streams active that year.
  let depletionAge = null;
  for (let a = retireAt; a < horizonAge; a++) {
    const need = need0 * Math.pow(1 + inflation, a - currentAge);
    const streamIncome = (streams || []).reduce((s, st) => {
      const start = Number(st.startAge) || 0;
      if (a < start) return s;
      const annual = (Number(st.monthlyAmount) || 0) * 12;
      const cola = Math.pow(1 + (Number(st.colaPct) || 0) / 100, a - start);
      return s + annual * cola;
    }, 0);
    const withdrawal = Math.max(0, need - streamIncome);
    bal = (bal - withdrawal) * (1 + nominalReturn);
    if (bal <= 0) { depletionAge = a; bal = 0; break; }
  }

  const yearsNeeded = Math.max(0, horizonAge - retireAt);
  const lasts       = depletionAge == null;
  const yearsFunded = lasts ? yearsNeeded : (depletionAge - retireAt);
  const fundedRatio = yearsNeeded > 0 ? Math.min(1, yearsFunded / yearsNeeded) : 1;
  const verdict = fundedRatio >= 1 ? 'On track'
    : fundedRatio >= 0.85 ? 'Nearly there'
    : fundedRatio >= 0.6  ? 'Off track'
    : 'At risk';

  return { nestEgg, depletionAge, yearsNeeded, yearsFunded, lasts, fundedRatio, verdict };
}

// Goal funding projection. Given a target amount + date, current funding, and a
// monthly contribution, projects the balance at the target date (current funding
// compounded + contributions as an ordinary annuity) and reports a funded ratio,
// status, and the monthly contribution required to hit the target on time.
function goalFunding({ targetAmount, targetDate, currentFunding = 0, monthlyContribution = 0, annualReturn = 0.05, asOf }) {
  const target = Number(targetAmount) || 0;
  const cur    = Number(currentFunding) || 0;
  const pmt    = Number(monthlyContribution) || 0;
  const now = asOf ? new Date(asOf) : new Date();
  const end = targetDate ? new Date(targetDate) : now;
  const n = Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()));
  const r = (Number(annualReturn) || 0) / 12;

  const fvCurrent = cur * Math.pow(1 + r, n);
  const annuityFactor = r === 0 ? n : (Math.pow(1 + r, n) - 1) / r;
  const projected = fvCurrent + pmt * annuityFactor;
  const fundedRatio = target > 0 ? projected / target : 1;

  // Monthly contribution required to exactly hit the target by the date.
  let requiredMonthly;
  if (cur >= target) requiredMonthly = 0;
  else if (annuityFactor === 0) requiredMonthly = Infinity;       // no time left, not funded
  else requiredMonthly = Math.max(0, (target - fvCurrent) / annuityFactor);
  const gapMonthly = isFinite(requiredMonthly) ? Math.max(0, requiredMonthly - pmt) : Infinity;

  const status = cur >= target ? 'funded'
    : n <= 0 ? 'past due'
    : projected >= target ? 'on pace'
    : 'behind';

  return { monthsRemaining: n, projected, fundedRatio, requiredMonthly, gapMonthly, status };
}

// Tax-loss harvesting estimate from the share of the taxable book below basis.
function tlh({ taxableBalance, lossPct, offsetRatePct }) {
  const harvestable = taxableBalance * (lossPct / 100);
  return {
    harvestable,
    taxOffset: harvestable * (offsetRatePct / 100),
    alphaLow: taxableBalance * 0.005,
    alphaHigh: taxableBalance * 0.015,
  };
}

// Tiered annual advisory fee ($) for a given AUM. Mirrors the generate-invoices
// Edge Function's annualFee() — keep the two in sync.
function annualFeeForAum(tiers, aum) {
  const list = Array.isArray(tiers) ? tiers : [];
  if (!list.length) return 0;
  let fee = 0, prev = 0;
  for (const t of list) {
    const cap = (t.up_to == null || t.up_to === '') ? Infinity : Number(t.up_to);
    const band = Math.max(0, Math.min(aum, cap) - prev);
    fee += band * (Number(t.annual_bps) || 0) / 10000;
    prev = cap;
    if (aum <= cap) break;
  }
  return fee;
}

// ── Life-insurance coverage gap (W5) ────────────────────────────────────────
// A simple, transparent capture-and-coach check — NOT underwriting. The common
// rule of thumb is coverage ≈ income × a multiple, plus debts to be retired, less
// liquid assets already earmarked. Returns the recommended figure, the gap, and a
// coverage ratio (clamped 0..1). All inputs default to 0 so partial data is safe.
function lifeCoverageGap({ annualIncome = 0, incomeMultiple = 10, liabilities = 0, existingCoverage = 0, liquidAssets = 0 } = {}) {
  const income  = Math.max(0, Number(annualIncome) || 0);
  const mult    = Math.max(0, Number(incomeMultiple) || 0);
  const debts   = Math.max(0, Number(liabilities) || 0);
  const liquid  = Math.max(0, Number(liquidAssets) || 0);
  const have    = Math.max(0, Number(existingCoverage) || 0);
  const recommended = Math.max(0, income * mult + debts - liquid);
  const gap   = Math.max(0, recommended - have);
  const ratio = recommended > 0 ? Math.min(1, have / recommended) : (have > 0 ? 1 : 0);
  return { recommended, existingCoverage: have, gap, covered: gap <= 0, ratio };
}

// ── Asset-truth composition (W6) ────────────────────────────────────────────
// Replaces the AUM-vs-typed "reconciliation warning" with a correct *composition*:
// total invested = assets under management + explicitly held-away balances. The
// household's typed invested total is treated as the whole picture; managed AUM is
// the slice the advisor custodies. Held-away is the remainder. The ONE genuine error
// case — managed AUM materially exceeding the reported total — means the typed numbers
// are stale; we flag that (and trust managed as the floor) rather than invent negative
// held-away. All inputs default to 0 so partial data is safe.
function assetComposition({ managedAum = 0, investedOnFile = 0 } = {}) {
  const managed = Math.max(0, Number(managedAum) || 0);
  const typed   = Math.max(0, Number(investedOnFile) || 0);
  const stale   = typed > 0 && managed > typed * 1.1;   // managed > reported total by >10%
  const heldAway = stale ? 0 : Math.max(0, typed - managed);
  const total    = stale ? managed : typed;             // managed is the better floor when typed is stale
  return {
    managed, heldAway, total,
    hasHeldAway: heldAway > 0,
    managedPct: total > 0 ? Math.round((managed / total) * 100) : 0,
    stale, staleDelta: stale ? managed - typed : 0,
  };
}

// ── Risk tolerance profile → strategic allocation (C4) ───────────────────────
// Maps a short risk questionnaire to a band + a transparent strategic asset
// allocation (equity / fixed income / cash). Pure and deterministic so the draft
// IPS it feeds is reproducible. `answers` is an array of per-question scores
// (each option weighted 0..4, higher = more risk-tolerant). An optional planning
// horizon nudges tolerance up for long runways, down for short ones. Returns null
// for an empty questionnaire so callers can show it as not-yet-taken.
const RISK_ALLOCATIONS = {
  Conservative: { equity: 30, fixedIncome: 55, cash: 15 },
  Moderate:     { equity: 45, fixedIncome: 45, cash: 10 },
  Balanced:     { equity: 60, fixedIncome: 35, cash: 5 },
  Growth:       { equity: 75, fixedIncome: 22, cash: 3 },
  Aggressive:   { equity: 90, fixedIncome: 9,  cash: 1 },
};
function riskProfile({ answers = [], horizonYears = null } = {}) {
  const a = (Array.isArray(answers) ? answers : []).filter(x => x != null && x !== '');
  if (!a.length) return null;
  const raw = a.reduce((s, x) => s + (Number(x) || 0), 0);
  const max = a.length * 4;                       // each question scored 0..4
  let score = max > 0 ? (raw / max) * 100 : 0;
  if (horizonYears != null && isFinite(horizonYears)) {
    if (horizonYears >= 20)     score = Math.min(100, score + 6);
    else if (horizonYears <= 5) score = Math.max(0, score - 10);
  }
  const band = score >= 80 ? 'Aggressive'
    : score >= 62 ? 'Growth'
    : score >= 42 ? 'Balanced'
    : score >= 22 ? 'Moderate'
    : 'Conservative';
  return { score: Math.round(score), band, allocation: RISK_ALLOCATIONS[band] };
}

const PrismCalc = {
  buildValueSeries, modifiedDietz, perfPeriods,
  debtPayoffMonths, hsaProjection, monteCarlo, rothLadder, estateProjection, tlh,
  retirementReadiness, goalFunding, annualFeeForAum, lifeCoverageGap, assetComposition,
  riskProfile, RISK_ALLOCATIONS,
};

if (typeof window !== 'undefined') window.PrismCalc = PrismCalc;
if (typeof module !== 'undefined' && module.exports) module.exports = PrismCalc;

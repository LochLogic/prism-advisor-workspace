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

/* ─── Household aggregates ───────────────────────────────────────────── */

// Total monthly household expenses = the fixed categories + any custom outflow
// line items. SINGLE SOURCE OF TRUTH so the portal, advisor QBR, and overview
// readiness can't drift: a naive `Object.values(expenses).reduce(…)` folds the
// `custom` *array* in as NaN→0 and silently drops every custom line item.
function monthlyExpenseTotal(expenses) {
  const e = expenses || {};
  const fixed = ['housing', 'food', 'transport', 'utilities', 'healthcare', 'other']
    .reduce((a, k) => a + (Number(e[k]) || 0), 0);
  const custom = (Array.isArray(e.custom) ? e.custom : [])
    .reduce((a, c) => a + (Number(c && c.amount) || 0), 0);
  return fixed + custom;
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
  // RNG-quality note: this is a tiny LCG (period 233,280) — adequate for an
  // *illustrative* confidence band (stable, deterministic, dependency-free), but
  // its short period means it must NOT back a figure presented to a client as a
  // precise/exact probability. If we ever surface an exact number, swap in a
  // longer-period generator (e.g. mulberry32) here.
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

// ── Asset location optimizer (C4 planning depth) ─────────────────────────────
// Given the three account "sleeves" (taxable / tax-deferred / tax-free) and a target
// strategic allocation (equity / fixed income / cash, e.g. from `riskProfile`),
// produce a tax-aware placement of the household's ACTUAL dollars: tax-inefficient
// assets (bonds/TIPS, REIT/high-dividend) claim sheltered space first; tax-efficient
// broad equity and international (whose foreign-tax-credit is wasted in a retirement
// account) anchor taxable. Equity is split into broad domestic / international / REIT
// by conventional weights; cash is parked in taxable and not placed. Returns, per
// asset class, the dollars and the resulting share across sleeves — so the mapping
// table reflects THIS household, not a static rule of thumb. Returns null when there
// are no invested dollars, so callers can fall back to the illustrative model.
const AL_EQUITY_SPLIT = { broad: 0.63, intl: 0.25, reit: 0.12 };
const AL_PREF = {        // sleeve preference per class, most → least preferred
  bonds: ['D', 'F', 'T'], reit: ['D', 'F', 'T'],
  intl:  ['T', 'F', 'D'], broad: ['T', 'F', 'D'],
};
const AL_ORDER  = ['bonds', 'reit', 'intl', 'broad'];   // shelter-hungry assets first
const AL_LABELS = {
  broad: 'Broad equity index (efficient)',
  bonds: 'Corporate bonds / TIPS (inefficient)',
  reit:  'REIT / high-dividend (inefficient)',
  intl:  'International equity',
};
// Round a [taxable, deferred, free] fraction split to whole percents summing to 100
// (largest-remainder), so each row reads cleanly like the legacy table.
function alPctSplit(parts, sum) {
  if (sum <= 0) return { taxable: 0, deferred: 0, free: 0 };
  const raw = [parts.T / sum * 100, parts.D / sum * 100, parts.F / sum * 100];
  const floor = raw.map(Math.floor);
  let rem = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [i, v - floor[i]]).sort((a, b) => b[1] - a[1]);
  for (let k = 0; k < order.length && rem > 0; k++, rem--) floor[order[k][0]]++;
  return { taxable: floor[0], deferred: floor[1], free: floor[2] };
}
function assetLocationPlan({ taxable = 0, taxDeferred = 0, taxFree = 0, allocation = {} } = {}) {
  const T = Math.max(0, taxable), D = Math.max(0, taxDeferred), F = Math.max(0, taxFree);
  const total = T + D + F;
  if (total <= 0) return null;
  const eqPct = (allocation.equity ?? 60) / 100;
  const fiPct = (allocation.fixedIncome ?? 35) / 100;
  const targets = {
    bonds: total * fiPct,
    reit:  total * eqPct * AL_EQUITY_SPLIT.reit,
    intl:  total * eqPct * AL_EQUITY_SPLIT.intl,
    broad: total * eqPct * AL_EQUITY_SPLIT.broad,
  };
  const cap = { T, D, F };
  const placed = {};
  for (const cls of AL_ORDER) {
    const p = { T: 0, D: 0, F: 0 };
    let need = targets[cls];
    for (const sleeve of AL_PREF[cls]) {
      if (need <= 0) break;
      const take = Math.min(need, cap[sleeve]);
      p[sleeve] += take; cap[sleeve] -= take; need -= take;
    }
    placed[cls] = p;
  }
  const rows = ['broad', 'bonds', 'reit', 'intl'].map(cls => {
    const p = placed[cls];
    const sum = p.T + p.D + p.F;
    return { key: cls, label: AL_LABELS[cls], dollars: Math.round(sum), ...alPctSplit(p, sum) };
  });
  return { total, rows, sleeves: { taxable: T, taxDeferred: D, taxFree: F } };
}

// ── Contribution priority waterfall (C4 planning depth) ──────────────────────
// Per-account contribution optimization: given the household's annual savings
// capacity, sequence it across accounts in the canonical tax-efficiency order every
// fee-only planner uses — capture the full employer match first (a guaranteed return
// nothing else beats), then the triple-advantaged HSA, then IRA/Roth, then fill the
// 401(k) to the federal limit, and finally taxable for anything left. Each step is
// capped by that account's REMAINING room (limit − already-contributed this year), so
// the plan reflects what the household has left to give, not a blank-slate maximum.
// Returns the ordered steps with dollars + cumulative, the taxable remainder, and the
// one finding that matters most: whether capacity is too thin to capture the full
// match (leaving free money on the table). All inputs default so partial data is safe.
function contributionWaterfall({
  annualCapacity = 0, salary = 0, employerMatchPct = 0,
  k401Limit = 23_500, k401Contributed = 0,
  iraLimit = 7_000,   iraContributed = 0,
  hsaLimit = 4_300,   hsaContributed = 0, hsaEligible = true,
} = {}) {
  let left = Math.max(0, Number(annualCapacity) || 0);
  const steps = [];
  const take = (key, label, room, note) => {
    const amount = Math.min(Math.max(0, room), left);
    if (amount > 0) { left -= amount; steps.push({ key, label, amount, note, cumulative: (Number(annualCapacity) || 0) - left }); }
    return amount;
  };

  // 1. Employer match — fund the 401(k) up to the matched share of salary first.
  const k401Room   = Math.max(0, (Number(k401Limit) || 0) - (Number(k401Contributed) || 0));
  const matchTarget = Math.min(k401Room, (Number(salary) || 0) * (Number(employerMatchPct) || 0) / 100);
  const matchFunded = take('match', 'Capture full employer match', matchTarget, '401(k) — guaranteed return');
  const fullMatch   = matchTarget > 0 ? matchFunded >= matchTarget - 0.5 : true;
  const missedMatch = Math.max(0, matchTarget - matchFunded);

  // 2. HSA — triple-advantaged (deductible in, tax-free growth, tax-free out).
  if (hsaEligible) take('hsa', 'Max the HSA', (Number(hsaLimit) || 0) - (Number(hsaContributed) || 0), 'Triple-advantaged');
  // 3. IRA / Roth.
  take('ira', 'Fund IRA / Roth', (Number(iraLimit) || 0) - (Number(iraContributed) || 0), 'Tax-free or deductible');
  // 4. 401(k) to the federal limit (room beyond what the match already used).
  take('k401', 'Fill 401(k) to the federal max', k401Room - matchFunded, 'Tax-deferred');
  // 5. Whatever remains → taxable brokerage.
  const taxable = Math.max(0, left);

  return {
    steps, taxable,
    totalTaxAdvantaged: (Number(annualCapacity) || 0) - taxable,
    fullMatch, missedMatch,
    capacity: Number(annualCapacity) || 0,
  };
}

// ── Tax-aware withdrawal sequencing (C4 planning depth) ──────────────────────
// The accumulation problem and the decumulation problem are different problems. In
// retirement, the conventional tax-efficient draw order is: spend the TAXABLE sleeve
// first (only its gains are taxed, and it stops generating annual drag), then
// TAX-DEFERRED (ordinary income), and preserve the TAX-FREE Roth sleeve longest so its
// untaxed growth compounds as long as possible. This models that sequence year by year:
// each year it funds the spending gap (inflated spending less guaranteed income) by
// pulling from sleeves in order, grossing each withdrawal up so the household nets its
// spend after tax. It reports the per-year schedule, the lifetime tax under this order,
// how long the portfolio lasts, and the after-tax value remaining at the horizon (the
// tax-deferred sleeve is discounted for the ordinary tax an heir still owes on it).
//
// Deliberately NOT claimed: a dollar "saved vs. drawing proportionally." Under a flat
// marginal rate that comparison is dominated by deferral timing and can invert, so a
// headline number there would mislead. The honest, robust output is the sequence
// itself, the schedule, and longevity. Transparent, deterministic, advisor-refinable.
// Returns null when there's nothing to draw.
function withdrawalSequence({
  taxable = 0, taxDeferred = 0, taxFree = 0,
  annualSpending = 0, otherIncome = 0,
  currentAge = 65, retireAt = 65, horizonAge = 95,
  growth = 0.05, inflation = 0.025,
  taxableGainFraction = 0.5, capGainsRate = 0.15, ordinaryRate = 0.22,
} = {}) {
  const start = Math.max(0, Number(taxable) || 0) + Math.max(0, Number(taxDeferred) || 0) + Math.max(0, Number(taxFree) || 0);
  if (start <= 0 || (Number(annualSpending) || 0) <= 0) return null;
  retireAt = Math.max(Number(currentAge) || 0, Number(retireAt) || 0);
  const effRate = { taxable: taxableGainFraction * capGainsRate, taxDeferred: ordinaryRate, taxFree: 0 };

  const bal = { taxable: Math.max(0, taxable), taxDeferred: Math.max(0, taxDeferred), taxFree: Math.max(0, taxFree) };
  const grow = () => { bal.taxable *= 1 + growth; bal.taxDeferred *= 1 + growth; bal.taxFree *= 1 + growth; };
  for (let i = 0; i < retireAt - (Number(currentAge) || 0); i++) grow();      // accumulate to retirement
  const pull = (sleeve, need) => {                                            // gross up so `need` nets after tax
    const r = effRate[sleeve];
    const gross = Math.min(need / (1 - r), bal[sleeve]);
    bal[sleeve] -= gross;
    return { gross, net: gross * (1 - r), tax: gross * r };
  };

  const schedule = []; let lifetimeTax = 0; let depletesAt = null;
  for (let age = retireAt; age < horizonAge; age++) {
    const need = Math.max(0, (Number(annualSpending) || 0) * Math.pow(1 + inflation, age - (Number(currentAge) || 0))
      - (Number(otherIncome) || 0) * Math.pow(1 + inflation, Math.max(0, age - retireAt)));
    const draw = { taxable: 0, taxDeferred: 0, taxFree: 0 }; let yearTax = 0; let remaining = need;
    for (const s of ['taxable', 'taxDeferred', 'taxFree']) {
      if (remaining <= 0.5) break;
      const p = pull(s, remaining); draw[s] += p.gross; yearTax += p.tax; remaining -= p.net;
    }
    lifetimeTax += yearTax;
    grow();
    schedule.push({ age, need, ...draw, tax: yearTax, shortfall: remaining > 1 ? remaining : 0 });
    if (remaining > 1 && depletesAt == null) depletesAt = age;
  }
  const ending = Math.max(0, bal.taxable + bal.taxDeferred + bal.taxFree);
  // After-tax ending: a tax-deferred dollar at the horizon still owes ordinary tax when
  // an heir draws it, so discount that sleeve for its embedded liability.
  const afterTax = Math.max(0, bal.taxable + bal.taxDeferred * (1 - effRate.taxDeferred) + bal.taxFree);
  const yearsFunded = (depletesAt == null ? horizonAge : depletesAt) - retireAt;
  return {
    strategy: 'Taxable → Tax-deferred → Tax-free (Roth)',
    schedule, lifetimeTax, depletesAt, yearsFunded, lasts: depletesAt == null, ending, afterTax,
  };
}

// ── Federal ordinary-income brackets + standard deduction (2025, dated) ──────
// A maintainable, clearly-dated assumption (like the estate exemption in
// estateProjection). Update annually for inflation indexing. Thresholds are the
// TOP of each bracket (taxable income, i.e. AFTER the standard deduction).
const FED_BRACKETS_2025 = {
  single: { stdDeduction: 15_000, bands: [
    [11_925, 0.10], [48_475, 0.12], [103_350, 0.22], [197_300, 0.24],
    [250_525, 0.32], [626_350, 0.35], [Infinity, 0.37],
  ] },
  mfj: { stdDeduction: 30_000, bands: [
    [23_850, 0.10], [96_950, 0.12], [206_700, 0.22], [394_600, 0.24],
    [501_050, 0.32], [751_600, 0.35], [Infinity, 0.37],
  ] },
};

// ── Roth-conversion window sizing (C4 planning depth) ────────────────────────
// The years between retirement and the start of RMDs (age 73) — before Social
// Security and required distributions push income back up — are the prime window to
// convert tax-deferred dollars to Roth at a low rate. This sizes that window: it finds
// the household's projected taxable income in those gap years, measures the HEADROOM
// to the top of a target bracket, and recommends an annual conversion that fills the
// bracket without spilling into the next one — capped so it doesn't over-draw the
// balance across the window. Returns null when there's no window or nothing to convert.
function rothConversionWindow({
  currentAge = 60, retireAt = 65, rmdAge = 73,
  filingStatus = 'mfj', taxDeferredBalance = 0,
  estimatedRetirementIncome = 0,          // annual ordinary income in the gap years (pre-conversion)
  targetBracket = 0.22,                   // fill up to the top of this bracket
  year = new Date().getFullYear(),
} = {}) {
  const bal = Math.max(0, Number(taxDeferredBalance) || 0);
  const windowStart = Math.max(Number(currentAge) || 0, Number(retireAt) || 0);
  const windowYears = Math.max(0, (Number(rmdAge) || 73) - windowStart);
  if (windowYears <= 0 || bal <= 0) return null;

  const table = FED_BRACKETS_2025[filingStatus] || FED_BRACKETS_2025.mfj;
  const ceiling = (table.bands.find(b => Math.abs(b[1] - targetBracket) < 1e-9) || table.bands[2])[0];
  const taxableIncome = Math.max(0, (Number(estimatedRetirementIncome) || 0) - table.stdDeduction);
  const headroom = Math.max(0, ceiling - taxableIncome);              // room before spilling to the next bracket
  // Don't recommend converting more than fits in the headroom, nor more than an even
  // drawdown of the balance across the window.
  const annualConversion = Math.max(0, Math.min(headroom, bal / windowYears));
  const totalConverted   = Math.min(bal, annualConversion * windowYears);
  const estTaxCost       = totalConverted * targetBracket;            // blended ≈ the filled bracket's rate

  const schedule = [];
  let remaining = bal;
  for (let i = 0; i < windowYears; i++) {
    const convert = Math.min(annualConversion, remaining);
    remaining -= convert;
    schedule.push({ year: year + i, age: windowStart + i, convert, tax: convert * targetBracket, remaining });
  }
  return {
    windowYears, windowStart, windowEnd: rmdAge,
    targetBracket, headroom, taxableIncome,
    annualConversion, totalConverted, estTaxCost,
    fillsBracket: headroom > 0, schedule,
  };
}

// ── Marginal-bracket position + headroom (client-utility, reuses FED_BRACKETS) ─
// Given ordinary income and a filing status, locate the household in the 2025
// federal brackets: their taxable income (after the standard deduction unless an
// explicit `deductions` is passed), the marginal rate, the blended effective rate,
// and — the number that matters for planning — the HEADROOM remaining before income
// spills into the next bracket. That headroom is the space the Roth-conversion and
// contribution-order tools fill, so this is shared infrastructure, not a one-off.
// Also returns the full band list (with the household's dollars per band) so a tool
// can render where they sit. Pure/deterministic; all inputs default so partial data
// is safe. Brackets are a dated assumption (see FED_BRACKETS_2025) — reindex annually.
function bracketPosition({ filingStatus = 'mfj', ordinaryIncome = 0, deductions = null } = {}) {
  const table = FED_BRACKETS_2025[filingStatus] || FED_BRACKETS_2025.mfj;
  const std = deductions == null ? table.stdDeduction : Math.max(0, Number(deductions) || 0);
  const taxableIncome = Math.max(0, (Number(ordinaryIncome) || 0) - std);
  let prev = 0, tax = 0;
  let marginalRate = table.bands[0][1], bandLo = 0, bandTop = table.bands[0][0];
  let nextRate = null, headroom = Infinity;
  const bands = [];
  for (let i = 0; i < table.bands.length; i++) {
    const [top, rate] = table.bands[i];
    const lo = prev;
    const inBand = Math.max(0, Math.min(taxableIncome, top) - lo);   // household $ taxed in this band
    tax += inBand * rate;
    // The household sits in the band where lo < income ≤ top; income 0 sits in the first band.
    const isCurrent = taxableIncome > lo ? taxableIncome <= top : lo === 0;
    if (isCurrent) {
      marginalRate = rate; bandLo = lo; bandTop = top;
      nextRate = (i + 1 < table.bands.length) ? table.bands[i + 1][1] : null;
      headroom = isFinite(top) ? Math.max(0, top - taxableIncome) : Infinity;
    }
    bands.push({ lo, top, rate, inBand, isCurrent });
    prev = top;
  }
  const effectiveRate = taxableIncome > 0 ? tax / taxableIncome : 0;
  return { filingStatus, stdDeduction: std, taxableIncome, tax,
    marginalRate, effectiveRate, bandLo, bandTop, headroom, nextRate, bands };
}

// ── Rough term-life premium estimate (illustrative, NOT a quote) ─────────────
// A ballpark monthly cost for a given coverage amount, by age band, for a healthy
// non-smoker on a ~20-year level term. Deliberately coarse and clearly illustrative
// — it exists only to make the coverage-gap finding feel actionable ("≈ $X/mo"),
// never to price a policy. Real pricing depends on health, term, and carrier.
function termLifePremium({ coverage = 0, age = 40 } = {}) {
  const c = Math.max(0, Number(coverage) || 0);
  const a = Number(age) || 0;
  const ratePer1k = a < 30 ? 0.6 : a < 40 ? 0.9 : a < 50 ? 1.7 : a < 60 ? 4.0 : 9.0;  // $/yr per $1,000
  const annual = (c / 1000) * ratePer1k;
  return { annual, monthly: annual / 12, ratePer1k };
}

// ── Years to financial independence ("Freedom Date") ────────────────────────
// How long until invested assets reach a target number (the FIRE number ≈ 25×
// annual spending), compounding current investments at a real return and adding a
// flat annual contribution. Whole-year resolution; returns `reached:false` with
// years:Infinity if the contribution never gets there inside maxYears. Pure and
// deterministic — pairs with a "+1% saved → months sooner" lever the caller derives
// by re-running with a higher annualSavings. All inputs default so partial data is safe.
function yearsToIndependence({ currentInvested = 0, annualSavings = 0, targetNumber = 0, realReturn = 0.05, maxYears = 80 } = {}) {
  const target = Math.max(0, Number(targetNumber) || 0);
  let bal = Math.max(0, Number(currentInvested) || 0);
  if (target <= 0 || bal >= target) return { years: 0, reached: true, finalBalance: bal };
  const save = Math.max(0, Number(annualSavings) || 0);
  const r = Number(realReturn) || 0;
  for (let y = 1; y <= maxYears; y++) {
    bal = bal * (1 + r) + save;
    if (bal >= target) return { years: y, reached: true, finalBalance: bal };
  }
  return { years: Infinity, reached: false, finalBalance: bal };
}

// ── Debt-vs-invest crossover ─────────────────────────────────────────────────
// The one question Phase 03 turns on: pay the debt down or invest the marginal
// dollar? Paying down a balance earns a GUARANTEED, tax-free return equal to its APR;
// investing earns an UNCERTAIN after-tax return. So the rule is simply APR vs. the
// expected after-tax return, with a small dead-band around the crossover where it's a
// genuine toss-up (and other factors — liquidity, behavior — decide). Returns the
// verdict, the edge in percentage points, and the crossover return at which it flips.
function debtVsInvest({ apr = 0, afterTaxReturn = 0, deadbandPct = 0.5 } = {}) {
  const a = Number(apr) || 0;
  const r = Number(afterTaxReturn) || 0;
  const edge = a - r;                                  // percentage points; >0 favors paying down
  const band = Math.max(0, Number(deadbandPct) || 0);
  const verdict = edge > band ? 'pay' : edge < -band ? 'invest' : 'tossup';
  return { verdict, edge, breakeven: r };              // breakeven APR = the expected after-tax return
}

// ── Mortgage payoff accelerator (Phase 03, client-utility) ───────────────────
// The second half of the Phase 03 debt pair: a mortgage usually sits below the
// avalanche cutoff, so it's a "should we pay it down faster?" question, not a "must
// we?" one. Given the balance, APR, the regular monthly P&I payment, and an optional
// extra principal payment, amortize both the regular and accelerated schedules and
// report the months and interest the extra saves. Caps at 600 months. Returns null
// when there's no balance, or `amortizes:false` when the payment can't even cover
// interest (so it never pays off). All inputs default so partial data is safe.
function mortgagePayoff({ balance = 0, aprPct = 0, paymentMonthly = 0, extraMonthly = 0 } = {}) {
  const B = Math.max(0, Number(balance) || 0);
  const r = (Number(aprPct) || 0) / 100 / 12;
  const pay = Math.max(0, Number(paymentMonthly) || 0);
  const extra = Math.max(0, Number(extraMonthly) || 0);
  if (B <= 0 || pay <= 0) return null;
  const run = (monthly) => {
    let bal = B, interest = 0;
    for (let m = 1; m <= 600; m++) {
      const i = bal * r;
      const principal = monthly - i;
      if (principal <= 0) return { months: Infinity, interest: Infinity };   // never amortizes
      interest += i;
      bal -= principal;
      if (bal <= 0) return { months: m, interest };
    }
    return { months: Infinity, interest: Infinity };
  };
  const base = run(pay);
  const accel = extra > 0 ? run(pay + extra) : base;
  const monthsSaved   = (isFinite(base.months) && isFinite(accel.months)) ? base.months - accel.months : 0;
  const interestSaved = (isFinite(base.interest) && isFinite(accel.interest)) ? Math.max(0, base.interest - accel.interest) : 0;
  return { base, accel, monthsSaved, interestSaved, amortizes: isFinite(base.months) };
}

// ── HDHP-vs-PPO break-even (Phase 04 — answers flagged q03) ──────────────────
// "Is the HDHP worth it if I never go to the doctor?" Models the total annual cost of
// each plan at a given expected-claims level: premiums + the patient's share of claims
// (full cost up to the deductible, then coinsurance, capped at the out-of-pocket max).
// The HDHP's net cost is reduced by the HSA advantage it unlocks — the employer's HSA
// contribution (free money) plus the tax saved on the household's own pre-tax HSA
// dollars. Then it scans the claims axis for the break-even point where the cheaper
// plan flips, so the answer is "HDHP wins below ~$X of annual claims." All inputs
// default so partial data is safe. NOT advice — a transparent cost comparison.
function _planOop(claims, deductible, coinsurance, oopMax) {
  const c = Math.max(0, claims);
  const ded = Math.max(0, deductible);
  const cap = oopMax > 0 ? oopMax : Infinity;
  if (c <= ded) return Math.min(c, cap);
  return Math.min(ded + (c - ded) * Math.max(0, coinsurance), cap);
}
function hdhpVsPpo({
  expectedClaims = 0,
  hdhpPremium = 0, hdhpDeductible = 0, hdhpOopMax = 0, hdhpCoinsurance = 0.1,
  ppoPremium = 0,  ppoDeductible = 0,  ppoOopMax = 0,  ppoCoinsurance = 0.2,
  employerHsaContribution = 0, hsaContribution = 0, marginalRatePct = 22,
} = {}) {
  const hsaTaxBenefit = Math.max(0, Number(hsaContribution) || 0) * (Number(marginalRatePct) || 0) / 100
    + Math.max(0, Number(employerHsaContribution) || 0);
  const cost = (claims) => {
    const hdhpOop = _planOop(claims, hdhpDeductible, hdhpCoinsurance, hdhpOopMax);
    const ppoOop  = _planOop(claims, ppoDeductible,  ppoCoinsurance,  ppoOopMax);
    return { hdhp: hdhpPremium + hdhpOop - hsaTaxBenefit, ppo: ppoPremium + ppoOop, hdhpOop, ppoOop };
  };
  const at = cost(Math.max(0, Number(expectedClaims) || 0));
  // Break-even claims level: monotonic OOP means the plans cross at most once over the
  // relevant range. Scan in $100 steps to the higher OOP max + headroom.
  const hi = Math.max(hdhpOopMax, ppoOopMax, Number(expectedClaims) || 0) + 5000;
  let breakeven = null, prev = cost(0).hdhp - cost(0).ppo;
  for (let c = 100; c <= hi; c += 100) {
    const diff = cost(c).hdhp - cost(c).ppo;
    if ((prev <= 0 && diff > 0) || (prev >= 0 && diff < 0)) { breakeven = c; break; }
    prev = diff;
  }
  return { ...at, hsaTaxBenefit, breakeven,
    cheaper: at.hdhp <= at.ppo ? 'hdhp' : 'ppo', savings: Math.abs(at.hdhp - at.ppo) };
}

// ── Mega-Backdoor Roth capacity (Phase 05 — answers flagged q02) ─────────────
// "Should we be doing a Mega Backdoor Roth?" The capacity is whatever's left under the
// §415(c) total-additions limit ($70,000 in 2025, $77,500 with the 50+ catch-up) after
// the employee's own elective deferral and all employer contributions — that headroom
// can be filled with after-tax 401(k) dollars and converted to Roth, IF the plan allows
// after-tax contributions + in-service conversion. Also reports remaining elective-
// deferral room. All inputs default so partial data is safe.
function megaBackdoorCapacity({
  age = 40, employeeDeferral = 0, employerContribution = 0,
  totalAdditionsLimit = null, deferralLimit = 23_500,
} = {}) {
  const limit = totalAdditionsLimit != null ? Math.max(0, Number(totalAdditionsLimit) || 0)
    : ((Number(age) || 0) >= 50 ? 77_500 : 70_000);
  const deferral = Math.max(0, Number(employeeDeferral) || 0);
  const employer = Math.max(0, Number(employerContribution) || 0);
  const deferralRoom    = Math.max(0, deferralLimit - deferral);
  const afterTaxCapacity = Math.max(0, limit - deferral - employer);
  return { limit, deferral, employer, deferralRoom, afterTaxCapacity, hasCapacity: afterTaxCapacity > 0 };
}

// ── RMD projector (Phase 07) ─────────────────────────────────────────────────
// Required Minimum Distributions begin at age 73. Project the tax-deferred balance
// forward to that age, then apply the IRS Uniform Lifetime Table divisor each year:
// RMD = balance ÷ divisor, taxed as ordinary income, with the remainder growing on.
// Surfaces the first RMD (age, amount), the lifetime RMD + tax drag, and a schedule —
// making the Roth-ladder urgency tangible (every dollar converted now is a dollar not
// force-distributed and taxed later). Returns null when there's no deferred balance.
const RMD_UNIFORM_DIVISORS = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};
function rmdProjection({ taxDeferredBalance = 0, currentAge = 65, rmdAge = 73, growth = 0.05, marginalRatePct = 22, throughAge = 95 } = {}) {
  let bal = Math.max(0, Number(taxDeferredBalance) || 0);
  if (bal <= 0) return null;
  const start = Number(currentAge) || 0;
  const rate = Number(growth) || 0;
  const taxRate = (Number(marginalRatePct) || 0) / 100;
  for (let a = start; a < rmdAge; a++) bal *= (1 + rate);     // grow to the first RMD year
  const balanceAtRmd = bal;
  const schedule = []; let firstRmd = null, lifetimeRmd = 0, lifetimeTax = 0;
  for (let a = rmdAge; a <= throughAge; a++) {
    const divisor = RMD_UNIFORM_DIVISORS[a] || RMD_UNIFORM_DIVISORS[100];
    const rmd = bal / divisor;
    const tax = rmd * taxRate;
    if (firstRmd == null) firstRmd = { age: a, amount: rmd, balance: bal };
    lifetimeRmd += rmd; lifetimeTax += tax;
    schedule.push({ age: a, divisor, rmd, tax, balanceBefore: bal });
    bal = Math.max(0, (bal - rmd) * (1 + rate));
  }
  return { firstRmd, schedule, lifetimeRmd, lifetimeTax, rmdAge, balanceAtRmd };
}

// ── Social Security claiming-age optimizer (Phase 07) ────────────────────────
// Claiming early (62) permanently reduces the benefit; delaying past full retirement
// age (FRA, 67 for current retirees) earns 8%/yr delayed credits to age 70. Given the
// PIA (the monthly benefit at FRA), this computes the benefit at each candidate claim
// age, then the lifetime total to an assumed longevity — both nominal and present-value
// (so a discount rate can reflect "a dollar now beats a dollar later"). Reports the
// PV-maximizing age and the break-even age between the earliest and latest options.
// Reductions: 5/9% per month for the first 36 months early, 5/12% per month beyond;
// credits: 2/3% per month after FRA. Returns null without a PIA.
function ssBenefitFactor(claimAge, fra = 67) {
  const months = (Number(claimAge) - Number(fra)) * 12;
  if (months === 0) return 1;
  if (months < 0) {
    const early = -months, first = Math.min(early, 36), beyond = Math.max(0, early - 36);
    return Math.max(0, 1 - first * (5 / 9) / 100 - beyond * (5 / 12) / 100);
  }
  const credited = Math.min(months, (70 - fra) * 12);        // credits cap at 70
  return 1 + credited * (2 / 3) / 100;
}
function socialSecurityClaiming({ pia = 0, fra = 67, colaPct = 0, longevityAge = 90, discountRatePct = 0, claimAges = [62, 67, 70] } = {}) {
  const P = Math.max(0, Number(pia) || 0);
  if (P <= 0) return null;
  const cola = (Number(colaPct) || 0) / 100;
  const disc = (Number(discountRatePct) || 0) / 100;
  const ages = (Array.isArray(claimAges) && claimAges.length ? claimAges : [62, 67, 70]).slice().sort((a, b) => a - b);
  const base = ages[0];
  const options = ages.map(age => {
    const monthly = P * ssBenefitFactor(age, fra);
    let nominal = 0, pv = 0;
    for (let a = age; a <= longevityAge; a++) {
      const annual = monthly * 12 * Math.pow(1 + cola, a - age);
      nominal += annual;
      pv += annual / Math.pow(1 + disc, a - base);
    }
    return { claimAge: age, monthly, annual: monthly * 12, lifetimeNominal: nominal, lifetimePV: pv };
  });
  const best = options.reduce((b, o) => o.lifetimePV > b.lifetimePV ? o : b, options[0]);
  // Break-even age between the earliest and latest claim: where the later option's
  // cumulative benefit overtakes the earlier one's.
  const lo = options[0], hi = options[options.length - 1];
  let breakevenAge = null, cumLo = 0, cumHi = 0;
  for (let a = lo.claimAge; a <= longevityAge; a++) {
    if (a >= lo.claimAge) cumLo += lo.monthly * 12 * Math.pow(1 + cola, a - lo.claimAge);
    if (a >= hi.claimAge) cumHi += hi.monthly * 12 * Math.pow(1 + cola, a - hi.claimAge);
    if (a > hi.claimAge && cumHi >= cumLo) { breakevenAge = a; break; }
  }
  return { options, best, breakevenAge, longevityAge, fra };
}

// ── Equity-comp concentration / diversification (Phase 06) ───────────────────
// RSU/ISO-heavy households often carry a single-stock position far above prudent
// concentration. Given the concentrated position's market value, its cost basis, the
// whole invested portfolio, and any unvested value, this measures the concentration as
// a share of the portfolio, the embedded unrealized gain, the capital-gains tax to fully
// diversify, and the tax to merely trim back to a target threshold (default 10%). The
// "tax to trim" makes the cost of de-risking concrete. Returns null without a position.
function equityCompConcentration({ positionValue = 0, costBasis = 0, totalInvested = 0, unvestedValue = 0, capGainsRatePct = 15, thresholdPct = 10 } = {}) {
  const pos = Math.max(0, Number(positionValue) || 0);
  if (pos <= 0) return null;
  const total = Math.max(pos, Number(totalInvested) || 0);     // the position is part of the total
  const rate  = (Number(capGainsRatePct) || 0) / 100;
  const thr   = Math.max(0, Number(thresholdPct) || 0);
  const concentrationPct = (pos / total) * 100;
  const gain = Math.max(0, pos - Math.max(0, Number(costBasis) || 0));
  const gainFraction = pos > 0 ? gain / pos : 0;
  const taxToFullyDiversify = gain * rate;
  const targetValue = total * (thr / 100);
  const excess = Math.max(0, pos - targetValue);               // dollars above the threshold
  const taxToTrim = excess * gainFraction * rate;
  return {
    concentrationPct, gain, gainFraction, taxToFullyDiversify,
    targetValue, excess, taxToTrim, thresholdPct: thr,
    concentrated: concentrationPct > thr,
    unvestedValue: Math.max(0, Number(unvestedValue) || 0),
  };
}

const PrismCalc = {
  monthlyExpenseTotal,
  buildValueSeries, modifiedDietz, perfPeriods,
  debtPayoffMonths, hsaProjection, monteCarlo, rothLadder, estateProjection, tlh,
  retirementReadiness, goalFunding, annualFeeForAum, lifeCoverageGap, assetComposition,
  riskProfile, RISK_ALLOCATIONS, assetLocationPlan,
  contributionWaterfall, withdrawalSequence, rothConversionWindow, FED_BRACKETS_2025,
  bracketPosition, termLifePremium, yearsToIndependence, debtVsInvest,
  mortgagePayoff, hdhpVsPpo, megaBackdoorCapacity,
  rmdProjection, RMD_UNIFORM_DIVISORS, ssBenefitFactor, socialSecurityClaiming,
  equityCompConcentration,
};

if (typeof window !== 'undefined') window.PrismCalc = PrismCalc;
if (typeof module !== 'undefined' && module.exports) module.exports = PrismCalc;

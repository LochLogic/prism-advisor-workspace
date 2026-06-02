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
function modifiedDietz(series, flows, startDate, endDate) {
  if (!series.length) return null;
  const inRange = series.filter(p => p.date <= endDate);
  if (!inRange.length) return null;
  const ev = inRange[inRange.length - 1].value;
  let bv = null;
  for (const p of series) { if (p.date < startDate) bv = p.value; else break; }
  const inception = bv == null;
  if (bv == null) bv = series[0].value;
  const fls = (flows || []).filter(f => f.flow_date >= startDate && f.flow_date <= endDate);
  const start = new Date(startDate), end = new Date(endDate);
  const span = Math.max(1, (end - start) / 86400000);
  const net = fls.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const weighted = fls.reduce((s, f) => s + (Number(f.amount) || 0) * ((end - new Date(f.flow_date)) / 86400000 / span), 0);
  const denom = bv + weighted;
  const gain = ev - bv - net;
  return { bv, ev, net, gain, pct: denom !== 0 ? (gain / denom) * 100 : null, inception };
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

const PrismCalc = {
  buildValueSeries, modifiedDietz, perfPeriods,
  debtPayoffMonths, hsaProjection, monteCarlo, rothLadder, estateProjection, tlh,
};

if (typeof window !== 'undefined') window.PrismCalc = PrismCalc;
if (typeof module !== 'undefined' && module.exports) module.exports = PrismCalc;

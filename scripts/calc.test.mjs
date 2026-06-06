// Prism — calculator unit tests. Zero-dependency runner over src/calc-core.cjs.
// Run: npm run test:calc   (exits non-zero on any failure)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const C = require('../src/calc-core.cjs');

let failures = 0;
const ok   = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); failures++; };
const assert = (cond, m) => cond ? ok(m) : fail(m);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

console.log('calc-core unit tests\n');

/* ── buildValueSeries ─────────────────────────────────────────────── */
{
  const rows = [
    { account_id: 'x', as_of: '2026-01-01', balance: 100 },
    { account_id: 'y', as_of: '2026-01-01', balance: 50 },
    { account_id: 'x', as_of: '2026-02-01', balance: 120 },
  ];
  const s = C.buildValueSeries(rows);
  assert(s.length === 2, 'buildValueSeries: one point per distinct date');
  assert(s[0].date === '2026-01-01' && s[0].value === 150, 'buildValueSeries: sums accounts on first date');
  assert(s[1].value === 170, 'buildValueSeries: carries y forward (120 + 50) on later date');
  assert(C.buildValueSeries([]).length === 0, 'buildValueSeries: empty input → empty');
}

/* ── modifiedDietz ────────────────────────────────────────────────── */
{
  const series = [
    { date: '2026-01-01', value: 1000 },
    { date: '2026-02-01', value: 1100 },
  ];
  const r = C.modifiedDietz(series, [], '2026-01-01', '2026-02-01');
  assert(near(r.pct, 10), 'modifiedDietz: no flows → simple value change (10%)');
  assert(r.gain === 100 && r.net === 0, 'modifiedDietz: gain/net correct with no flows');
  assert(r.inception === true, 'modifiedDietz: inception flag when start is at/before first point');

  // A 100 deposit at the midpoint should dilute the return below the raw change.
  const withFlow = C.modifiedDietz(series, [{ flow_date: '2026-01-16', amount: 100 }], '2026-01-01', '2026-02-01');
  assert(withFlow.net === 100, 'modifiedDietz: net flow captured');
  assert(withFlow.pct < 10 && withFlow.pct > -10, 'modifiedDietz: mid-period inflow dilutes the return');
  assert(C.modifiedDietz([], [], 'a', 'b') === null, 'modifiedDietz: empty series → null');
}

/* ── perfPeriods ──────────────────────────────────────────────────── */
{
  const series = [{ date: '2020-01-01', value: 1000 }, { date: '2026-01-01', value: 2000 }];
  const p = C.perfPeriods(series, []);
  assert(p.length === 5, 'perfPeriods: returns 1M/3M/YTD/1Y/ITD');
  assert(p.map(x => x.label).join() === '1M,3M,YTD,1Y,ITD', 'perfPeriods: expected labels in order');
  assert(C.perfPeriods([], []).length === 0, 'perfPeriods: empty series → empty');
}

/* ── debtPayoffMonths ─────────────────────────────────────────────── */
{
  assert(C.debtPayoffMonths(0, 20, 500) === 0, 'debtPayoffMonths: nothing owed → 0');
  assert(C.debtPayoffMonths(10000, 0, 1000) === 10, 'debtPayoffMonths: 0% APR, 10k @ 1k/mo → 10 months');
  const m = C.debtPayoffMonths(10000, 18, 500);
  assert(m > 0 && Number.isFinite(m), 'debtPayoffMonths: 18% APR, 10k @ 500/mo → finite payoff');
  // Payment below monthly interest can never win.
  assert(C.debtPayoffMonths(100000, 24, 100) === Infinity, 'debtPayoffMonths: payment < interest → Infinity');
}

/* ── hsaProjection ────────────────────────────────────────────────── */
{
  assert(C.hsaProjection(0, 1000, 0, 3) === 3000, 'hsaProjection: 0% growth → sum of contributions');
  assert(near(C.hsaProjection(1000, 0, 0.07, 1), 1070), 'hsaProjection: one year at 7%, no contrib');
  assert(C.hsaProjection(5000, 4000, 0.07, 25) > 5000 + 4000 * 25, 'hsaProjection: growth beats plain contributions over 25y');
}

/* ── monteCarlo ───────────────────────────────────────────────────── */
{
  const a = C.monteCarlo({ principal: 1_000_000, years: 30, withdrawal: 40_000, seed: 123 });
  const b = C.monteCarlo({ principal: 1_000_000, years: 30, withdrawal: 40_000, seed: 123 });
  assert(JSON.stringify(a) === JSON.stringify(b), 'monteCarlo: deterministic for a fixed seed');
  assert(a.successPct >= 0 && a.successPct <= 100, 'monteCarlo: success probability within 0–100%');
  const noDraw = C.monteCarlo({ principal: 1_000_000, years: 30, withdrawal: 0, seed: 7 });
  assert(noDraw.successPct === 100, 'monteCarlo: zero withdrawal → never depletes (100%)');
  const heavy = C.monteCarlo({ principal: 1_000_000, years: 30, withdrawal: 150_000, seed: 7 });
  assert(heavy.successPct <= noDraw.successPct, 'monteCarlo: heavier withdrawal does not raise success');
  assert(a.p10 <= a.medianFinal && a.medianFinal <= a.p90, 'monteCarlo: p10 ≤ median ≤ p90');
}

/* ── rothLadder ───────────────────────────────────────────────────── */
{
  const rows = C.rothLadder({ tradBalance: 500_000, annualConvert: 72_000, bracketPct: 24, startYear: 2026 });
  assert(rows.length === 5, 'rothLadder: 5-year schedule');
  assert(rows[0].convert === 72_000, 'rothLadder: converts the annual amount while funds remain');
  assert(near(rows[0].tax, 72_000 * 0.24), 'rothLadder: tax = convert × bracket');
  assert(rows[0].available === 2031, 'rothLadder: penalty-free 5 years after conversion');
  assert(rows[4].remaining > 0, 'rothLadder: remainder compounds across years');
  const small = C.rothLadder({ tradBalance: 50_000, annualConvert: 72_000, bracketPct: 24, startYear: 2026 });
  assert(small[0].convert === 50_000, 'rothLadder: never converts more than remains');
}

/* ── estateProjection ─────────────────────────────────────────────── */
{
  const below = C.estateProjection({ principal: 2_000_000, years: 10, withdrawalRatePct: 3.5, g2Years: 30 });
  assert(below.estateTax === 0, 'estateProjection: estate below exemption → no tax');
  assert(below.netToHeirs === below.estate, 'estateProjection: net = gross when untaxed');
  const above = C.estateProjection({ principal: 50_000_000, years: 5, withdrawalRatePct: 2, g2Years: 0 });
  assert(above.estateTax > 0, 'estateProjection: large estate is taxed above the exemption');
  assert(near(above.estateTax, Math.max(0, above.estate - 13_990_000) * 0.40, 1e-3), 'estateProjection: 40% over the exemption');
  assert(above.g2 === above.netToHeirs, 'estateProjection: 0 gen-2 years → no further growth');
}

/* ── tlh ──────────────────────────────────────────────────────────── */
{
  const r = C.tlh({ taxableBalance: 1_000_000, lossPct: 8, offsetRatePct: 23.8 });
  assert(r.harvestable === 80_000, 'tlh: harvestable = balance × loss%');
  assert(near(r.taxOffset, 80_000 * 0.238), 'tlh: tax offset = harvestable × offset rate');
  assert(r.alphaLow === 5000 && r.alphaHigh === 15000, 'tlh: alpha band = 0.5%–1.5% of taxable book');
}

/* ── annualFeeForAum (tiered advisory fee) ────────────────────────── */
{
  const flat = [{ up_to: null, annual_bps: 100 }];
  assert(C.annualFeeForAum(flat, 1_000_000) === 10_000, 'fee: flat 100bps on $1M → $10k (1%)');
  assert(C.annualFeeForAum(flat, 500_000) === 5_000, 'fee: flat 100bps on $500k → $5k');
  const tiered = [{ up_to: 1_000_000, annual_bps: 100 }, { up_to: null, annual_bps: 50 }];
  assert(C.annualFeeForAum(tiered, 2_000_000) === 15_000, 'fee: tiered (1% to $1M, 0.5% above) on $2M → $15k');
  assert(C.annualFeeForAum(tiered, 1_000_000) === 10_000, 'fee: tiered at the breakpoint → $10k (first band only)');
  assert(C.annualFeeForAum(tiered, 750_000) === 7_500, 'fee: tiered below breakpoint → blended within first band');
  assert(C.annualFeeForAum([], 1_000_000) === 0, 'fee: no tiers → 0');
  assert(C.annualFeeForAum([{ up_to: '', annual_bps: 75 }], 1_000_000) === 7_500, 'fee: empty up_to treated as no cap (Infinity)');
}

/* ── modifiedDietz edge cases (flow timing) ───────────────────────── */
{
  const s = [{ date: '2026-01-01', value: 1000 }, { date: '2026-02-01', value: 1100 }];
  // Deposit on the LAST day earns nothing → return collapses toward 0.
  const lastDay = C.modifiedDietz(s, [{ flow_date: '2026-02-01', amount: 100 }], '2026-01-01', '2026-02-01');
  assert(near(lastDay.pct, 0), 'mDietz: deposit on the final day → ~0% (no time to earn)');
  // Mid-period WITHDRAWAL with same ending value → higher return on a smaller base.
  const wd = C.modifiedDietz(s, [{ flow_date: '2026-01-16', amount: -100 }], '2026-01-01', '2026-02-01');
  assert(wd.pct > 10, 'mDietz: mid-period withdrawal lifts the % vs the 10% no-flow case');
  assert(wd.net === -100, 'mDietz: negative (withdrawal) flow captured');
  // Zero base with no offsetting flow → undefined return (null, not NaN/Infinity).
  const zero = C.modifiedDietz([{ date: '2026-01-01', value: 0 }, { date: '2026-02-01', value: 100 }], [], '2026-01-01', '2026-02-01');
  assert(zero.pct === null, 'mDietz: zero denominator → null (no divide-by-zero)');
}

/* ── retirementReadiness ──────────────────────────────────────────── */
{
  // Streams that fully cover spending → portfolio never drawn → on track.
  const covered = C.retirementReadiness({
    currentAge: 67, retireAt: 67, currentInvested: 100_000, annualContribution: 0,
    annualExpenses: 60_000, streams: [{ monthlyAmount: 12_000, startAge: 67, colaPct: 0 }] });
  assert(covered.lasts === true && covered.depletionAge === null, 'readiness: streams covering spend → never depletes');
  assert(covered.fundedRatio === 1 && covered.verdict === 'On track', 'readiness: covered household is On track');

  // No assets, no streams, already retired with real expenses → immediate depletion.
  const broke = C.retirementReadiness({
    currentAge: 67, retireAt: 67, currentInvested: 0, annualContribution: 0,
    annualExpenses: 50_000, streams: [] });
  assert(broke.depletionAge === 67, 'readiness: zero resources deplete in the first retirement year');
  assert(broke.fundedRatio === 0 && broke.verdict === 'At risk', 'readiness: zero resources → At risk');

  // Accumulation grows the balance before retirement.
  const accum = C.retirementReadiness({
    currentAge: 40, retireAt: 65, currentInvested: 200_000, annualContribution: 30_000,
    annualExpenses: 80_000, streams: [{ monthlyAmount: 2_500, startAge: 67, colaPct: 2 }] });
  assert(accum.nestEgg > 200_000 && Number.isFinite(accum.nestEgg), 'readiness: contributions compound the nest egg');

  // Adding an income stream can only help: never lowers funded ratio or years funded.
  const base = { currentAge: 60, retireAt: 65, currentInvested: 300_000, annualContribution: 10_000, annualExpenses: 70_000, streams: [] };
  const without = C.retirementReadiness(base);
  const withSS  = C.retirementReadiness({ ...base, streams: [{ monthlyAmount: 3_000, startAge: 65, colaPct: 0 }] });
  assert(withSS.fundedRatio >= without.fundedRatio, 'readiness: adding a stream never lowers the funded ratio');
  assert(withSS.yearsFunded >= without.yearsFunded, 'readiness: adding a stream never shortens years funded');

  // Funded ratio is capped at 1 (no "over 100%").
  const rich = C.retirementReadiness({ currentAge: 65, retireAt: 65, currentInvested: 10_000_000, annualContribution: 0, annualExpenses: 50_000, streams: [] });
  assert(rich.fundedRatio === 1 && rich.lasts === true, 'readiness: ample portfolio caps funded ratio at 1');

  // Deterministic for identical inputs.
  const a = C.retirementReadiness(base), b = C.retirementReadiness(base);
  assert(JSON.stringify(a) === JSON.stringify(b), 'readiness: deterministic for identical inputs');
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} test(s)`); process.exit(1); }
console.log('All calc-core tests passed.');

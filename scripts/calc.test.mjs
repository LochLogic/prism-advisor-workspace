// Prism — calculator unit tests. Zero-dependency runner over src/calc-core.cjs.
// Run: npm run test:calc   (exits non-zero on any failure)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const C = require('../src/calc-core.cjs');

// --quiet (or PX_QUIET=1): suppress per-test ✓ lines, keep failures + the
// summary count. Saves AI-session tokens; humans/CI keep the verbose default.
const QUIET = process.argv.includes('--quiet') || process.env.PX_QUIET === '1';
let failures = 0, passes = 0;
const ok   = (m) => { passes++; if (!QUIET) console.log(`  ✓ ${m}`); };
const fail = (m) => { console.error(`  ✗ ${m}`); failures++; };
const assert = (cond, m) => cond ? ok(m) : fail(m);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

if (!QUIET) console.log('calc-core unit tests\n');

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

/* ── monthlyExpenseTotal ──────────────────────────────────────────── */
{
  const exp = { housing: 2000, food: 800, transport: 400, utilities: 300,
                healthcare: 200, other: 500, custom: [{ amount: 250 }, { amount: 150 }] };
  // Fixed (4200) + custom (400). The bug this guards: Object.values folds `custom`
  // (an array) in as NaN→0 and drops the line items — so this MUST be 4600, not 4200.
  assert(C.monthlyExpenseTotal(exp) === 4600, 'monthlyExpenseTotal: fixed + custom line items');
  assert(C.monthlyExpenseTotal({ housing: 1000 }) === 1000, 'monthlyExpenseTotal: missing keys → 0');
  assert(C.monthlyExpenseTotal({}) === 0 && C.monthlyExpenseTotal(null) === 0, 'monthlyExpenseTotal: empty/null → 0');
  assert(C.monthlyExpenseTotal({ food: 'x', custom: [{ amount: 'y' }] }) === 0, 'monthlyExpenseTotal: non-numeric → 0, no NaN');
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

/* ── modifiedDietz: advisory fees are a net-of-fee drag, not a capital flow ─ */
{
  const series = [
    { date: '2026-01-01', value: 1000 },
    { date: '2026-02-01', value: 1100 },   // ending value already reflects the fee debit
  ];
  // A $10 advisory fee debited mid-period: the account grew to 1110 gross, the fee
  // took 10, leaving 1100. Net return = 10%, gross = 11%.
  const withFee = C.modifiedDietz(series, [{ flow_date: '2026-01-16', amount: -10, kind: 'fee' }], '2026-01-01', '2026-02-01');
  assert(withFee.fees === 10, 'modifiedDietz: fee magnitude captured');
  assert(near(withFee.pct, 10), 'modifiedDietz: default pct is NET of advisory fees');
  assert(near(withFee.grossPct, 11), 'modifiedDietz: grossPct adds the fee drag back');
  assert(withFee.net === 0, 'modifiedDietz: a fee is not counted as a capital flow');
  assert(withFee.netOfFees === true, 'modifiedDietz: netOfFees flag set when a fee is present');
  // No fee → net and gross coincide, flag is false.
  const noFee = C.modifiedDietz(series, [], '2026-01-01', '2026-02-01');
  assert(noFee.fees === 0 && noFee.netOfFees === false, 'modifiedDietz: no fee → fees 0, netOfFees false');
  assert(near(noFee.pct, noFee.grossPct), 'modifiedDietz: no fee → net equals gross');
  // A withdrawal of the same size is a CAPITAL flow (added back), not a fee.
  const withWd = C.modifiedDietz(series, [{ flow_date: '2026-01-16', amount: -10, kind: 'withdrawal' }], '2026-01-01', '2026-02-01');
  assert(withWd.fees === 0 && withWd.net === -10, 'modifiedDietz: withdrawal is a capital flow, not a fee');
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

/* ── goalFunding ──────────────────────────────────────────────────── */
{
  const asOf = '2026-06-01';
  // Already funded → status 'funded', nothing more required.
  const funded = C.goalFunding({ targetAmount: 100_000, targetDate: '2030-06-01', currentFunding: 120_000, monthlyContribution: 0, asOf });
  assert(funded.status === 'funded' && funded.requiredMonthly === 0, 'goalFunding: current ≥ target → funded, $0 required');
  assert(funded.fundedRatio >= 1, 'goalFunding: funded goal has ratio ≥ 1');

  // On pace: current + contributions project past the target.
  const onPace = C.goalFunding({ targetAmount: 100_000, targetDate: '2031-06-01', currentFunding: 50_000, monthlyContribution: 600, asOf });
  assert(onPace.monthsRemaining === 60, 'goalFunding: month count from asOf to target');
  assert(onPace.status === 'on pace' && onPace.projected >= 100_000, 'goalFunding: adequate funding → on pace');

  // Behind: contribution too small to reach the target in time.
  const behind = C.goalFunding({ targetAmount: 100_000, targetDate: '2028-06-01', currentFunding: 10_000, monthlyContribution: 100, asOf });
  assert(behind.status === 'behind' && behind.projected < 100_000, 'goalFunding: underfunding → behind');
  assert(behind.requiredMonthly > 100 && behind.gapMonthly > 0, 'goalFunding: behind surfaces a contribution gap');

  // Past due: the target date has already passed and it is not funded.
  const overdue = C.goalFunding({ targetAmount: 100_000, targetDate: '2025-01-01', currentFunding: 50_000, monthlyContribution: 500, asOf });
  assert(overdue.status === 'past due' && overdue.monthsRemaining === 0, 'goalFunding: past target date + unfunded → past due');
  assert(overdue.requiredMonthly === Infinity && overdue.gapMonthly === Infinity, 'goalFunding: no time left → required is Infinity');

  // Zero growth: pure sum of contributions.
  const flat = C.goalFunding({ targetAmount: 12_000, targetDate: '2027-06-01', currentFunding: 0, monthlyContribution: 1000, annualReturn: 0, asOf });
  assert(near(flat.projected, 12_000) && flat.status === 'on pace', 'goalFunding: 0% growth → contributions sum exactly');
  assert(near(flat.requiredMonthly, 1000), 'goalFunding: 0% growth → required = target / months');

  // The required monthly, when applied, lands the projection on the target.
  const req = behind.requiredMonthly;
  const solved = C.goalFunding({ targetAmount: 100_000, targetDate: '2028-06-01', currentFunding: 10_000, monthlyContribution: req, asOf });
  assert(near(solved.projected, 100_000, 1), 'goalFunding: requiredMonthly reaches the target by the date');

  // Deterministic for a fixed asOf.
  const a = C.goalFunding({ targetAmount: 50_000, targetDate: '2030-06-01', currentFunding: 5_000, monthlyContribution: 400, asOf });
  const b = C.goalFunding({ targetAmount: 50_000, targetDate: '2030-06-01', currentFunding: 5_000, monthlyContribution: 400, asOf });
  assert(JSON.stringify(a) === JSON.stringify(b), 'goalFunding: deterministic for a fixed asOf');
}

/* ── lifeCoverageGap (W5) ─────────────────────────────────────────── */
{
  // Fully covered: existing ≥ recommended → no gap, ratio 1.
  const ok1 = C.lifeCoverageGap({ annualIncome: 100_000, incomeMultiple: 10, liabilities: 0, existingCoverage: 1_200_000 });
  assert(ok1.recommended === 1_000_000 && ok1.gap === 0 && ok1.covered === true && ok1.ratio === 1,
    'lifeCoverageGap: over-covered → no gap, ratio 1');

  // Under-covered: gap surfaces, ratio < 1.
  const under = C.lifeCoverageGap({ annualIncome: 100_000, incomeMultiple: 10, existingCoverage: 400_000 });
  assert(under.recommended === 1_000_000 && under.gap === 600_000 && under.covered === false && near(under.ratio, 0.4),
    'lifeCoverageGap: under-covered → gap + ratio');

  // Liabilities raise the recommendation; liquid assets lower it.
  const withDebt = C.lifeCoverageGap({ annualIncome: 50_000, incomeMultiple: 10, liabilities: 200_000, liquidAssets: 100_000, existingCoverage: 0 });
  assert(withDebt.recommended === 600_000, 'lifeCoverageGap: recommended = income×mult + debts − liquid');

  // No data → zeros, treated as covered (nothing to flag).
  const empty = C.lifeCoverageGap({});
  assert(empty.recommended === 0 && empty.gap === 0 && empty.covered === true && empty.ratio === 0,
    'lifeCoverageGap: empty inputs → zeros, no false alarm');

  // Recommendation floors at 0 when liquid assets exceed need.
  const floored = C.lifeCoverageGap({ annualIncome: 10_000, incomeMultiple: 1, liquidAssets: 999_999, existingCoverage: 0 });
  assert(floored.recommended === 0 && floored.covered === true, 'lifeCoverageGap: recommendation floors at 0');
}

/* ── assetComposition (W6) ────────────────────────────────────────── */
{
  // Held-away present: total = typed; managed is a slice; remainder is held away.
  const ha = C.assetComposition({ managedAum: 1_000_000, investedOnFile: 1_600_000 });
  assert(ha.managed === 1_000_000 && ha.heldAway === 600_000 && ha.total === 1_600_000
    && ha.hasHeldAway === true && ha.stale === false && ha.managedPct === 63,
    'assetComposition: held-away = typed − managed');

  // Fully managed: no held-away, total = managed = typed.
  const full = C.assetComposition({ managedAum: 800_000, investedOnFile: 800_000 });
  assert(full.heldAway === 0 && full.hasHeldAway === false && full.total === 800_000 && full.managedPct === 100,
    'assetComposition: fully managed → no held-away');

  // Stale: managed materially exceeds the reported total → flag, trust managed, no negative held-away.
  const stale = C.assetComposition({ managedAum: 1_500_000, investedOnFile: 1_000_000 });
  assert(stale.stale === true && stale.heldAway === 0 && stale.total === 1_500_000 && stale.staleDelta === 500_000,
    'assetComposition: managed ≫ typed → stale flag, managed is the floor');

  // Within 10%: not stale (tolerance), small held-away or none.
  const close = C.assetComposition({ managedAum: 1_050_000, investedOnFile: 1_000_000 });
  assert(close.stale === false, 'assetComposition: within 10% tolerance is not stale');

  // Empty → all zeros, nothing to show.
  const empty = C.assetComposition({});
  assert(empty.total === 0 && empty.hasHeldAway === false && empty.stale === false,
    'assetComposition: empty inputs → zeros');
}

// ── riskProfile (C4) ────────────────────────────────────────────────────────
{
  assert(C.riskProfile({ answers: [] }) === null, 'riskProfile: empty questionnaire → null');

  // All-low answers → Conservative, capital-preservation allocation.
  const low = C.riskProfile({ answers: [0, 0, 0, 0, 0, 0] });
  assert(low.band === 'Conservative' && low.score === 0 && low.allocation.equity === 30,
    'riskProfile: all-low → Conservative');

  // All-high answers → Aggressive, equity-heavy.
  const high = C.riskProfile({ answers: [4, 4, 4, 4, 4, 4] });
  assert(high.band === 'Aggressive' && high.score === 100 && high.allocation.equity === 90,
    'riskProfile: all-high → Aggressive');

  // Mid answers land in the middle bands.
  const mid = C.riskProfile({ answers: [2, 2, 2, 2, 2, 2] });
  assert(mid.score === 50 && mid.band === 'Balanced', 'riskProfile: mid → Balanced (50)');

  // Allocations always sum to 100% across every band.
  for (const b of Object.values(C.RISK_ALLOCATIONS)) {
    assert(b.equity + b.fixedIncome + b.cash === 100, 'riskProfile: allocation sums to 100%');
  }

  // Long horizon nudges tolerance up; short horizon nudges it down.
  const up = C.riskProfile({ answers: [2, 2, 2, 2, 2, 2], horizonYears: 30 });
  const dn = C.riskProfile({ answers: [2, 2, 2, 2, 2, 2], horizonYears: 3 });
  assert(up.score === 56 && dn.score === 40, 'riskProfile: horizon nudges score (±)');
}

// ── assetLocationPlan (C4 planning depth) ───────────────────────────────────
{
  // No invested dollars → null (caller falls back to the illustrative model).
  assert(C.assetLocationPlan({ taxable: 0, taxDeferred: 0, taxFree: 0 }) === null,
    'assetLocationPlan: empty sleeves → null');

  const p = C.assetLocationPlan({
    taxable: 300000, taxDeferred: 500000, taxFree: 200000,
    allocation: { equity: 60, fixedIncome: 35, cash: 5 },
  });
  assert(p && p.total === 1_000_000, 'assetLocationPlan: total = sum of sleeves');
  assert(p.rows.length === 4, 'assetLocationPlan: four asset-class rows');

  // Each row's three sleeve percentages sum to 100 (largest-remainder rounding).
  for (const r of p.rows) {
    assert(r.taxable + r.deferred + r.free === 100 || r.dollars === 0,
      `assetLocationPlan: ${r.key} row sums to 100%`);
  }

  // Tax-inefficient bonds shelter first: with ample tax-deferred room (500k vs a
  // 350k bond target) they land entirely in tax-deferred.
  const bonds = p.rows.find(r => r.key === 'bonds');
  assert(bonds.deferred === 100 && bonds.taxable === 0,
    'assetLocationPlan: bonds shelter into tax-deferred first');

  // Broad equity is tax-efficient → anchors taxable over tax-deferred.
  const broad = p.rows.find(r => r.key === 'broad');
  assert(broad.taxable >= broad.deferred,
    'assetLocationPlan: broad equity favors taxable');

  // Tiny shelter forces inefficient assets to overflow into taxable.
  const squeezed = C.assetLocationPlan({
    taxable: 900000, taxDeferred: 50000, taxFree: 50000,
    allocation: { equity: 40, fixedIncome: 55, cash: 5 },
  });
  const sb = squeezed.rows.find(r => r.key === 'bonds');
  assert(sb.taxable > 0, 'assetLocationPlan: bonds overflow to taxable when shelter is full');
}

// ── contributionWaterfall (C4 planning depth) ───────────────────────────────
{
  // Ample capacity: fills match → HSA → IRA → 401(k) max → taxable remainder.
  const w = C.contributionWaterfall({
    annualCapacity: 60_000, salary: 200_000, employerMatchPct: 5,
    k401Limit: 23_500, k401Contributed: 0, iraLimit: 7_000, iraContributed: 0,
    hsaLimit: 4_300, hsaContributed: 0, hsaEligible: true,
  });
  assert(w.steps[0].key === 'match' && w.steps[0].amount === 10_000, 'waterfall: match first = 5% of $200k salary');
  assert(w.steps.find(s => s.key === 'hsa').amount === 4_300, 'waterfall: HSA filled to limit');
  assert(w.steps.find(s => s.key === 'ira').amount === 7_000, 'waterfall: IRA filled to limit');
  assert(w.steps.find(s => s.key === 'k401').amount === 13_500, 'waterfall: 401(k) topped to federal max (23.5k − 10k match)');
  assert(w.taxable === 60_000 - 10_000 - 4_300 - 7_000 - 13_500, 'waterfall: remainder spills to taxable');
  assert(w.fullMatch === true && w.missedMatch === 0, 'waterfall: ample capacity captures the full match');

  // Thin capacity that cannot even cover the match → flags missed free money.
  const thin = C.contributionWaterfall({ annualCapacity: 6_000, salary: 200_000, employerMatchPct: 5, k401Contributed: 0 });
  assert(thin.steps[0].amount === 6_000 && thin.fullMatch === false && thin.missedMatch === 4_000,
    'waterfall: capacity below match → full match not captured, missed amount surfaced');
  assert(thin.taxable === 0, 'waterfall: nothing reaches taxable when capacity is exhausted on the match');

  // HSA-ineligible household skips the HSA step.
  const noHsa = C.contributionWaterfall({ annualCapacity: 30_000, salary: 100_000, employerMatchPct: 4, hsaEligible: false });
  assert(!noHsa.steps.some(s => s.key === 'hsa'), 'waterfall: HSA-ineligible skips the HSA step');

  // Already-contributed amounts reduce remaining room.
  const partial = C.contributionWaterfall({ annualCapacity: 50_000, salary: 150_000, employerMatchPct: 0,
    k401Limit: 23_500, k401Contributed: 20_000, iraLimit: 7_000, iraContributed: 7_000, hsaEligible: false });
  assert(partial.steps.find(s => s.key === 'k401').amount === 3_500, 'waterfall: 401(k) room nets out prior contributions');
  assert(!partial.steps.some(s => s.key === 'ira'), 'waterfall: a maxed IRA contributes no step');

  // Zero capacity → no steps, no taxable.
  const zero = C.contributionWaterfall({ annualCapacity: 0, salary: 100_000, employerMatchPct: 5 });
  assert(zero.steps.length === 0 && zero.taxable === 0, 'waterfall: zero capacity → empty plan');
}

// ── withdrawalSequence (C4 planning depth) ──────────────────────────────────
{
  // Nothing to draw → null.
  assert(C.withdrawalSequence({ taxable: 0, taxDeferred: 0, taxFree: 0, annualSpending: 50_000 }) === null,
    'withdrawalSequence: empty sleeves → null');
  assert(C.withdrawalSequence({ taxable: 100_000, annualSpending: 0 }) === null,
    'withdrawalSequence: zero spending → null');

  const r = C.withdrawalSequence({
    taxable: 500_000, taxDeferred: 800_000, taxFree: 300_000,
    annualSpending: 90_000, otherIncome: 40_000,
    currentAge: 65, retireAt: 65, horizonAge: 95,
  });
  assert(r && r.strategy.startsWith('Taxable'), 'withdrawalSequence: taxable-first strategy label');
  assert(r.schedule.length === 30, 'withdrawalSequence: one row per retirement year to horizon');
  // Year 1 funds the gap from the taxable sleeve first (deferred/free untouched).
  assert(r.schedule[0].taxable > 0 && r.schedule[0].taxDeferred === 0 && r.schedule[0].taxFree === 0,
    'withdrawalSequence: first year draws taxable before deferred/free');
  // The tax-free Roth sleeve is preserved longest — only tapped after taxable is gone.
  const firstRothYear = r.schedule.findIndex(y => y.taxFree > 0);
  const firstDefYear  = r.schedule.findIndex(y => y.taxDeferred > 0);
  assert(firstRothYear === -1 || firstRothYear >= firstDefYear, 'withdrawalSequence: Roth tapped no earlier than tax-deferred');
  assert(Number.isFinite(r.lifetimeTax) && r.lifetimeTax >= 0, 'withdrawalSequence: lifetime tax is a finite non-negative number');
  assert(r.afterTax <= r.ending, 'withdrawalSequence: after-tax ending discounts the deferred sleeve');
  assert(typeof r.lasts === 'boolean' && r.yearsFunded >= 0, 'withdrawalSequence: reports longevity');

  // Deterministic for identical inputs.
  const args = { taxable: 400_000, taxDeferred: 600_000, taxFree: 200_000, annualSpending: 80_000, currentAge: 60, retireAt: 65 };
  assert(JSON.stringify(C.withdrawalSequence(args)) === JSON.stringify(C.withdrawalSequence(args)),
    'withdrawalSequence: deterministic for identical inputs');
}

// ── rothConversionWindow (C4 planning depth) ────────────────────────────────
{
  // No window (already past RMD age) → null.
  assert(C.rothConversionWindow({ currentAge: 75, retireAt: 75, taxDeferredBalance: 500_000 }) === null,
    'rothWindow: no gap years before RMDs → null');
  // Nothing to convert → null.
  assert(C.rothConversionWindow({ currentAge: 65, retireAt: 65, taxDeferredBalance: 0 }) === null,
    'rothWindow: empty tax-deferred balance → null');

  // Standard gap: retire at 65, RMDs at 73 → an 8-year window.
  const w = C.rothConversionWindow({
    currentAge: 65, retireAt: 65, rmdAge: 73, filingStatus: 'mfj',
    taxDeferredBalance: 1_200_000, estimatedRetirementIncome: 60_000, targetBracket: 0.22,
  });
  assert(w.windowYears === 8 && w.schedule.length === 8, 'rothWindow: 8-year conversion window (65→73)');
  // Headroom = top of the 22% MFJ bracket (206,700) − (income 60,000 − std deduction 30,000) = 176,700.
  assert(w.headroom === 206_700 - (60_000 - 30_000), 'rothWindow: headroom = bracket ceiling − taxable income');
  // Annual conversion is capped by the smaller of headroom and an even drawdown.
  assert(w.annualConversion === Math.min(w.headroom, 1_200_000 / 8), 'rothWindow: annual conversion = min(headroom, even drawdown)');
  assert(near(w.estTaxCost, w.totalConverted * 0.22, 1e-3), 'rothWindow: tax cost ≈ converted × target bracket');
  assert(w.totalConverted <= 1_200_000, 'rothWindow: never converts more than the balance');
  assert(w.fillsBracket === true, 'rothWindow: positive headroom fills the bracket');

  // High existing income (already above the target bracket) → no headroom.
  const noRoom = C.rothConversionWindow({ currentAge: 65, retireAt: 65, taxDeferredBalance: 500_000,
    estimatedRetirementIncome: 300_000, targetBracket: 0.22 });
  assert(noRoom.headroom === 0 && noRoom.annualConversion === 0 && noRoom.fillsBracket === false,
    'rothWindow: income above the bracket → no headroom, no conversion');

  // Brackets table is exposed and dated.
  assert(C.FED_BRACKETS_2025.mfj.stdDeduction === 30_000 && C.FED_BRACKETS_2025.single.stdDeduction === 15_000,
    'rothWindow: 2025 standard deductions exposed');
}

/* ── bracketPosition (client-utility headroom) ──────────────────────── */
{
  // MFJ, $150k gross → taxable 120,000 (after 30k std). That sits in the 22% band
  // (96,950 < 120,000 ≤ 206,700), with 86,700 of headroom before the 24% band.
  const b = C.bracketPosition({ filingStatus: 'mfj', ordinaryIncome: 150_000 });
  assert(b.taxableIncome === 120_000, 'bracketPosition: taxable income nets the standard deduction');
  assert(near(b.marginalRate, 0.22), 'bracketPosition: marginal rate located (22% band)');
  assert(b.headroom === 206_700 - 120_000, 'bracketPosition: headroom to the top of the current band');
  assert(near(b.nextRate, 0.24), 'bracketPosition: next bracket rate reported');
  assert(b.effectiveRate > 0 && b.effectiveRate < b.marginalRate, 'bracketPosition: effective rate below marginal');
  assert(b.bands.some(x => x.isCurrent) && b.bands.filter(x => x.isCurrent).length === 1,
    'bracketPosition: exactly one current band flagged');

  // Income at/below the standard deduction → 0 taxable, first band, full headroom.
  const z = C.bracketPosition({ filingStatus: 'mfj', ordinaryIncome: 20_000 });
  assert(z.taxableIncome === 0 && near(z.marginalRate, 0.10) && z.bands[0].isCurrent,
    'bracketPosition: income under the deduction sits in the first band at 0 taxable');

  // Top bracket → infinite headroom, no next rate.
  const top = C.bracketPosition({ filingStatus: 'single', ordinaryIncome: 2_000_000 });
  assert(near(top.marginalRate, 0.37) && top.headroom === Infinity && top.nextRate === null,
    'bracketPosition: top bracket has no headroom ceiling and no next rate');
}

/* ── w2Position (W-2 capture → parsed marginal rate) ────────────────── */
{
  // MFJ W-2: Box 1 $150k wages → taxable 120k → 22% band (matches bracketPosition).
  // Box 2 $18k withheld → 12% effective federal withholding (18,000 / 150,000).
  const w = C.w2Position({ box1: 150_000, box2: 18_000, filingStatus: 'mfj' });
  assert(w.wages === 150_000 && w.withheld === 18_000, 'w2Position: passes box1/box2 through as wages/withheld');
  assert(w.marginalRatePct === 22, 'w2Position: marginal rate parsed from Box 1 via bracketPosition (whole percent)');
  assert(near(w.withholdingRate, 0.12), 'w2Position: effective withholding = Box 2 / Box 1');
  assert(near(w.bracket.marginalRate, 0.22), 'w2Position: exposes the underlying bracketPosition result');

  // Filing status collapses to the two bracket tables (mfs/hoh → mfj).
  const single = C.w2Position({ box1: 60_000, box2: 0, filingStatus: 'single' });
  assert(single.filingStatus === 'single' && single.marginalRatePct === 12,
    'w2Position: single Box-1 $60k → 12% band');

  // Empty / zero W-2 is safe: 0 wages → first band, no withholding rate.
  const z = C.w2Position({});
  assert(z.wages === 0 && z.withholdingRate === 0 && z.marginalRatePct === 10,
    'w2Position: empty capture defaults to the first band with no withholding');
}

/* ── termLifePremium (illustrative coverage cost) ───────────────────── */
{
  const p = C.termLifePremium({ coverage: 1_000_000, age: 45 });
  assert(near(p.annual, 1700) && near(p.monthly, 1700 / 12), 'termLifePremium: $1M at 45 → age-banded annual/monthly');
  assert(C.termLifePremium({ coverage: 0, age: 45 }).monthly === 0, 'termLifePremium: no coverage → $0');
  assert(C.termLifePremium({ coverage: 500_000, age: 25 }).ratePer1k < C.termLifePremium({ coverage: 500_000, age: 65 }).ratePer1k,
    'termLifePremium: rate rises with age');
  assert(C.termLifePremium({}).monthly === 0, 'termLifePremium: empty input is safe');
}

/* ── yearsToIndependence (Freedom Date) ─────────────────────────────── */
{
  // Already at/over the target → 0 years, reached.
  assert(C.yearsToIndependence({ currentInvested: 2_000_000, targetNumber: 1_000_000 }).years === 0,
    'yearsToIndependence: already past target → 0 years');

  // 100k invested, 50k/yr saved, 5% real, target 1M → reached in a finite, sensible span.
  const f = C.yearsToIndependence({ currentInvested: 100_000, annualSavings: 50_000, targetNumber: 1_000_000, realReturn: 0.05 });
  assert(f.reached && f.years > 0 && f.years < 20, 'yearsToIndependence: 100k + 50k/yr @5% reaches 1M in <20 yr');
  assert(f.finalBalance >= 1_000_000, 'yearsToIndependence: final balance clears the target');

  // More savings → never later (monotonic lever the tool relies on).
  const more = C.yearsToIndependence({ currentInvested: 100_000, annualSavings: 70_000, targetNumber: 1_000_000, realReturn: 0.05 });
  assert(more.years <= f.years, 'yearsToIndependence: saving more never pushes the date later');

  // No savings and no growth ever reaching the target → Infinity, not reached.
  const never = C.yearsToIndependence({ currentInvested: 1000, annualSavings: 0, targetNumber: 1_000_000, realReturn: 0 });
  assert(never.years === Infinity && never.reached === false, 'yearsToIndependence: unreachable → Infinity, reached:false');
  assert(C.yearsToIndependence({}).reached === true, 'yearsToIndependence: empty input is safe (target 0 → reached)');
}

/* ── debtVsInvest crossover ──────────────────────────────────────────── */
{
  const pay = C.debtVsInvest({ apr: 9, afterTaxReturn: 6 });
  assert(pay.verdict === 'pay' && near(pay.edge, 3), 'debtVsInvest: APR above expected return → pay down');
  const inv = C.debtVsInvest({ apr: 3, afterTaxReturn: 6 });
  assert(inv.verdict === 'invest' && near(inv.edge, -3), 'debtVsInvest: APR below expected return → invest');
  const toss = C.debtVsInvest({ apr: 6.2, afterTaxReturn: 6 });
  assert(toss.verdict === 'tossup', 'debtVsInvest: within the dead-band → toss-up');
  assert(near(C.debtVsInvest({ apr: 9, afterTaxReturn: 6 }).breakeven, 6), 'debtVsInvest: breakeven = the expected after-tax return');
  assert(C.debtVsInvest({}).verdict === 'tossup', 'debtVsInvest: empty input is safe');
}

/* ── mortgagePayoff accelerator ──────────────────────────────────────── */
{
  const r = C.mortgagePayoff({ balance: 300_000, aprPct: 6, paymentMonthly: 1798.65, extraMonthly: 0 });
  // A 30-yr $300k @ 6% standard payment is ~$1,798.65 → ~360 months.
  assert(r.amortizes && Math.abs(r.base.months - 360) <= 1, 'mortgagePayoff: standard 30-yr payment ≈ 360 months');
  const ex = C.mortgagePayoff({ balance: 300_000, aprPct: 6, paymentMonthly: 1798.65, extraMonthly: 400 });
  assert(ex.accel.months < ex.base.months && ex.monthsSaved > 0, 'mortgagePayoff: extra principal shortens the loan');
  assert(ex.interestSaved > 0, 'mortgagePayoff: extra principal saves interest');
  const stuck = C.mortgagePayoff({ balance: 300_000, aprPct: 12, paymentMonthly: 100 });
  assert(stuck.amortizes === false, 'mortgagePayoff: payment below interest never amortizes');
  assert(C.mortgagePayoff({ balance: 0 }) === null && C.mortgagePayoff({}) === null, 'mortgagePayoff: no balance → null');
}

/* ── hdhpVsPpo break-even ─────────────────────────────────────────────── */
{
  // Low claims: HDHP's lower premium + HSA benefit should win.
  const low = C.hdhpVsPpo({ expectedClaims: 1000, hdhpPremium: 2400, ppoPremium: 5400,
    hdhpDeductible: 3300, hdhpOopMax: 7000, ppoDeductible: 1000, ppoOopMax: 4000,
    employerHsaContribution: 1000, hsaContribution: 4300, marginalRatePct: 24 });
  assert(low.cheaper === 'hdhp', 'hdhpVsPpo: low claims → HDHP cheaper');
  // A scenario that genuinely crosses (no HSA benefit, HDHP carries more OOP exposure):
  // at high claims the PPO's lower out-of-pocket max wins.
  const params = { hdhpPremium: 2400, ppoPremium: 5400, hdhpDeductible: 3300, hdhpOopMax: 7500,
    hdhpCoinsurance: 0.2, ppoDeductible: 1000, ppoOopMax: 4000, ppoCoinsurance: 0.2,
    employerHsaContribution: 0, hsaContribution: 0, marginalRatePct: 0 };
  const lowX  = C.hdhpVsPpo({ ...params, expectedClaims: 1000 });
  const highX = C.hdhpVsPpo({ ...params, expectedClaims: 40_000 });
  assert(lowX.cheaper === 'hdhp', 'hdhpVsPpo: low claims (crossover scenario) → HDHP cheaper');
  assert(highX.cheaper === 'ppo', 'hdhpVsPpo: high claims → PPO cheaper');
  assert(highX.breakeven != null && highX.breakeven > 0, 'hdhpVsPpo: a break-even claims level exists');
  assert(near(low.hsaTaxBenefit, 1000 + 4300 * 0.24), 'hdhpVsPpo: HSA benefit = employer + tax saved on contribution');
}

/* ── megaBackdoorCapacity ─────────────────────────────────────────────── */
{
  const c = C.megaBackdoorCapacity({ age: 40, employeeDeferral: 23_500, employerContribution: 10_000 });
  assert(c.limit === 70_000 && near(c.afterTaxCapacity, 70_000 - 23_500 - 10_000), 'megaBackdoorCapacity: 70k − deferral − employer');
  assert(c.deferralRoom === 0, 'megaBackdoorCapacity: maxed deferral → no elective room');
  const c50 = C.megaBackdoorCapacity({ age: 55, employeeDeferral: 0, employerContribution: 0 });
  assert(c50.limit === 77_500, 'megaBackdoorCapacity: 50+ uses the catch-up limit');
  const full = C.megaBackdoorCapacity({ age: 40, employeeDeferral: 40_000, employerContribution: 40_000 });
  assert(full.afterTaxCapacity === 0 && full.hasCapacity === false, 'megaBackdoorCapacity: over the limit → no capacity');
}

/* ── rmdProjection ────────────────────────────────────────────────────── */
{
  const r = C.rmdProjection({ taxDeferredBalance: 1_000_000, currentAge: 73, rmdAge: 73, growth: 0, marginalRatePct: 22, throughAge: 75 });
  assert(near(r.firstRmd.amount, 1_000_000 / 26.5, 1), 'rmdProjection: first RMD = balance ÷ 26.5 at age 73');
  assert(r.firstRmd.age === 73, 'rmdProjection: first RMD at 73');
  assert(r.lifetimeRmd > 0 && r.lifetimeTax > 0, 'rmdProjection: accumulates lifetime RMD + tax');
  // Growth before RMD age increases the balance at 73.
  const grown = C.rmdProjection({ taxDeferredBalance: 1_000_000, currentAge: 63, rmdAge: 73, growth: 0.06, marginalRatePct: 22 });
  assert(grown.balanceAtRmd > 1_000_000, 'rmdProjection: balance grows to the RMD age');
  assert(C.rmdProjection({ taxDeferredBalance: 0 }) === null, 'rmdProjection: no balance → null');
}

/* ── socialSecurityClaiming ───────────────────────────────────────────── */
{
  const r = C.socialSecurityClaiming({ pia: 3000, fra: 67, colaPct: 0, longevityAge: 90, discountRatePct: 0 });
  const at62 = r.options.find(o => o.claimAge === 62);
  const at67 = r.options.find(o => o.claimAge === 67);
  const at70 = r.options.find(o => o.claimAge === 70);
  assert(near(at67.monthly, 3000), 'socialSecurityClaiming: PIA paid in full at FRA (67)');
  assert(near(at62.monthly, 3000 * 0.70, 1), 'socialSecurityClaiming: 62 = 70% of PIA (30% reduction)');
  assert(near(at70.monthly, 3000 * 1.24, 1), 'socialSecurityClaiming: 70 = 124% of PIA (8%/yr credits)');
  assert(r.best.claimAge === 70, 'socialSecurityClaiming: no discount + long life → 70 maximizes PV');
  assert(r.breakevenAge > 67 && r.breakevenAge < 90, 'socialSecurityClaiming: 62-vs-70 break-even in the late 70s/early 80s');
  assert(C.socialSecurityClaiming({ pia: 0 }) === null, 'socialSecurityClaiming: no PIA → null');
}

/* ── equityCompConcentration ──────────────────────────────────────────── */
{
  const c = C.equityCompConcentration({ positionValue: 500_000, costBasis: 100_000, totalInvested: 1_000_000, capGainsRatePct: 20, thresholdPct: 10 });
  assert(near(c.concentrationPct, 50), 'equityCompConcentration: 500k of 1M → 50%');
  assert(near(c.gain, 400_000), 'equityCompConcentration: gain = value − basis');
  assert(near(c.taxToFullyDiversify, 400_000 * 0.20), 'equityCompConcentration: full-exit tax = gain × rate');
  // Trim to 10% of 1M = 100k target → 400k excess, at 80% gain fraction, 20% rate.
  assert(near(c.excess, 400_000) && near(c.taxToTrim, 400_000 * 0.8 * 0.20), 'equityCompConcentration: trim tax on the excess only');
  assert(c.concentrated === true, 'equityCompConcentration: above threshold → concentrated');
  assert(C.equityCompConcentration({ positionValue: 0 }) === null, 'equityCompConcentration: no position → null');
}

/* ── netWorthTrajectory ───────────────────────────────────────────────── */
{
  const t = C.netWorthTrajectory({ startNetWorth: 100_000, annualSavings: 10_000, realReturn: 0.05, years: 20 });
  assert(t.series.length === 21, 'netWorthTrajectory: year-0 + 20 projected points');
  assert(near(t.series[1].value, 100_000 * 1.05 + 10_000), 'netWorthTrajectory: year 1 = growth + savings');
  assert(t.at5 < t.at10 && t.at10 < t.at20, 'netWorthTrajectory: monotonic with positive savings');
  assert(t.crossesZeroYear === 0, 'netWorthTrajectory: positive start → crosses zero at 0');
  // Negative net worth: debt is NOT compounded at the investment return; savings dig out linearly.
  const neg = C.netWorthTrajectory({ startNetWorth: -30_000, annualSavings: 10_000, realReturn: 0.05, years: 10 });
  assert(near(neg.series[1].value, -20_000), 'netWorthTrajectory: negative balance not compounded');
  assert(neg.crossesZeroYear === 3, 'netWorthTrajectory: -30k at 10k/yr crosses zero in year 3');
  const flat = C.netWorthTrajectory({});
  assert(flat.series.length === 21 && flat.final === 0, 'netWorthTrajectory: defaults are safe');
}

/* ── incomeRunway ─────────────────────────────────────────────────────── */
{
  const bare = C.incomeRunway({ liquidReserve: 30_000, monthlyEssentials: 5_000 });
  assert(bare.months === 6, 'incomeRunway: reserve ÷ essentials with no benefit');
  // 60% benefit after a 3-month wait: 3 × 5000 through the wait, then 2000/mo.
  const ltd = C.incomeRunway({ liquidReserve: 30_000, monthlyEssentials: 5_000, monthlyBenefit: 3_000, benefitWaitMonths: 3 });
  assert(ltd.months === 3 + Math.floor(15_000 / 2_000), 'incomeRunway: wait burns full essentials, then the gap');
  assert(near(ltd.coveragePct, 60), 'incomeRunway: benefit coverage percent of essentials');
  const full = C.incomeRunway({ liquidReserve: 1_000, monthlyEssentials: 4_000, monthlyBenefit: 4_000, benefitWaitMonths: 0 });
  assert(full.indefinite === true, 'incomeRunway: benefit ≥ essentials → indefinite');
  const broke = C.incomeRunway({ liquidReserve: 0, monthlyEssentials: 4_000 });
  assert(broke.months === 0 && broke.indefinite === false, 'incomeRunway: no reserve → 0 months');
  assert(C.incomeRunway({}).indefinite === true, 'incomeRunway: no essentials → indefinite (safe default)');
}

/* ── tax1040Insights ─────────────────────────────────────────────── */
{
  assert(C.tax1040Insights({}) === null, 'tax1040Insights: no AGI → null (nothing entered)');

  // MFJ household, mid-bracket, over-withheld, itemizing just over the standard.
  const a = C.tax1040Insights({ filingStatus: 'mfj', lines: {
    agi: 180_000, deduction: 32_000, totalTax: 22_000, withholding: 27_000 } });
  assert(near(a.marginalRate, 0.22), 'tax1040Insights: $148k MFJ taxable → 22% marginal');
  assert(near(a.effectiveRate, 22_000 / 180_000), 'tax1040Insights: effective = total tax ÷ AGI');
  const ids = a.observations.map(o => o.id);
  assert(ids.includes('over-withheld'), 'tax1040Insights: >10% over-withholding flagged');
  assert(ids.includes('bunching'), 'tax1040Insights: itemizing narrowly over standard → bunching');
  assert(ids.includes('bracket-headroom'), 'tax1040Insights: headroom observation present');

  // Low-income single: room in the 0% LTCG band; ordinary income backs out gains.
  const b = C.tax1040Insights({ filingStatus: 'single', lines: { agi: 50_000, capGains: 8_000 } });
  assert(b.observations.some(o => o.id === 'ltcg-zero'), 'tax1040Insights: below 0% LTCG top → gain-harvest room');
  assert(b.ordinaryTaxable < b.taxableIncome, 'tax1040Insights: LTCG backed out of ordinary income');

  // Retiree at 72 with IRA distributions: QCD; near-IRMAA single flagged.
  const c = C.tax1040Insights({ filingStatus: 'single', age: 72, lines: {
    agi: 100_000, iraDistributions: 40_000, ssBenefits: 20_000, taxableInterest: 12_000 } });
  const cids = c.observations.map(o => o.id);
  assert(cids.includes('qcd'), 'tax1040Insights: 70½+ with IRA distributions → QCD');
  assert(cids.includes('irmaa-near'), 'tax1040Insights: within 10% of IRMAA tier → flagged');
  assert(cids.includes('ss-taxation'), 'tax1040Insights: taxable SS + other income → provisional note');

  // Under-withholding watch.
  const d = C.tax1040Insights({ filingStatus: 'mfj', lines: { agi: 200_000, totalTax: 30_000, withholding: 20_000 } });
  assert(d.observations.some(o => o.id === 'under-withheld'), 'tax1040Insights: >10% under-withholding flagged');

  // Every observation carries a known tone.
  const tones = new Set(['opportunity', 'watch', 'info']);
  assert([a, b, c, d].every(r => r.observations.every(o => tones.has(o.tone))), 'tax1040Insights: tones are client-safe enum');
}

if (!QUIET) console.log('');
if (failures) { console.error(`FAILED: ${failures} test(s)`); process.exit(1); }
console.log(`All ${passes} calc-core tests passed.`);

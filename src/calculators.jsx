// Prism — calculators. Restyled basic tools + four advanced tools that
// justify the AUM fee (Monte Carlo, Asset Location, Roth Ladder, Estate).

const { useState: useStateC, useMemo: useMemoC } = React;

const ToolShell = ({ title, hint, badge, advanced, children }) => (
  <div className="px-tool">
    <div className="px-tool-head">
      <div className="px-tool-title">
        <Icons.Calculator size={14} />
        <span>{title}</span>
        {advanced && <span className="px-tool-badge">Advisor tool</span>}
      </div>
      {hint && <div className="px-tool-hint">{hint}</div>}
    </div>
    {children}
  </div>
);

const StatCell = ({ label, value, tone, foot, big }) => (
  <div className="px-tool-stat">
    <div className="px-tool-stat-label">{label}</div>
    <div className={`px-tool-stat-value ${tone ? `is-${tone}` : ''}`}
         style={big ? { fontSize: 26 } : undefined}>{value}</div>
    {foot && <div className="px-tool-stat-foot">{foot}</div>}
  </div>
);

/* ───────────────────── BASIC TOOLS ────────────────────────────────── */

/* Phase 01 · Cash flow */
const CashflowTool = () => {
  const { profile, totalExpenses, surplus, savingsRate, effectiveTakehome } = useProfile();
  return (
    <ToolShell title="Household cash flow" hint="Sourced from your numbers">
      <div className="px-tool-grid">
        <StatCell label="Monthly take-home" value={fmt$(effectiveTakehome)} />
        <StatCell label="Essential outflow" value={fmt$(totalExpenses)} />
        <StatCell label="Net surplus" value={fmt$(surplus)} tone={surplus < 0 ? 'bad' : 'good'} />
        <StatCell label="Savings rate" value={fmtPct(savingsRate)}
          foot={savingsRate >= 30 ? 'Above target — institutional grade.' : savingsRate >= 20 ? 'On pace.' : 'Review with advisor.'} />
      </div>
    </ToolShell>
  );
};

/* Phase 01 · Freedom Date — savings-rate → years-to-independence (client utility) */
const FreedomDateTool = () => {
  const { surplus, savingsRate, totalInvested, annualExpenses, fireNumber, fireProgress, effectiveTakehome, planningAge } = useProfile();
  // Investable surplus drives the contribution; let the client try saving a little more.
  const baseAnnualSavings = Math.max(0, surplus * 12);
  const [annualSavings, setAnnualSavings] = useStateC(Math.round(baseAnnualSavings));

  const target = fireNumber;
  const fi = useMemoC(
    () => yearsToIndependence({ currentInvested: totalInvested, annualSavings, targetNumber: target, realReturn: 0.05 }),
    [totalInvested, annualSavings, target]);
  // The lever: one more percent of take-home, saved → how many months sooner.
  const onePct = Math.max(0, effectiveTakehome) * 12 * 0.01;
  const fiMore = useMemoC(
    () => yearsToIndependence({ currentInvested: totalInvested, annualSavings: annualSavings + onePct, targetNumber: target, realReturn: 0.05 }),
    [totalInvested, annualSavings, onePct, target]);
  const monthsSooner = (fi.reached && fiMore.reached) ? Math.max(0, Math.round((fi.years - fiMore.years) * 12)) : 0;

  const reached = fi.reached && isFinite(fi.years);
  const freedomYear = reached ? new Date().getFullYear() + fi.years : null;
  const freedomAge  = (reached && planningAge > 0) ? planningAge + fi.years : null;

  return (
    <ToolShell title="Freedom Date" hint="When work becomes optional — at today's savings pace">
      <div className="px-tool-grid">
        <StatCell label="Years to independence"
          value={reached ? (fi.years === 0 ? 'Now' : `${fi.years} yr`) : '—'}
          tone={reached ? 'good' : null}
          foot={reached ? (freedomAge ? `around age ${freedomAge}` : `≈ ${freedomYear}`) : 'increase saving to set a date'} big />
        <StatCell label="Freedom number" value={fmt$(target, { short: true })} foot="≈ 25× annual spending" />
        <StatCell label="Progress" value={fmtPct(fireProgress)}
          foot={`${fmt$(totalInvested, { short: true })} invested today`} />
        <StatCell label="Saving" value={fmt$(annualSavings, { short: true })} foot={`${fmtPct(savingsRate)} of take-home`} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ height: 6, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, fireProgress)}%`, background: 'var(--forest)', transition: 'width .4s' }} />
        </div>
      </div>
      {monthsSooner > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
          borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          Saving just <b>1% more</b> of take-home ({fmt$(onePct / 12)}/mo) brings your Freedom Date forward about
          <b> {monthsSooner} month{monthsSooner === 1 ? '' : 's'}</b>. Small, steady increases compound into years.
        </div>
      )}
      <label className="px-field" style={{ marginTop: 14 }}>
        <span className="px-field-label">Annual amount invested</span>
        <div className="px-input-affix">
          <span className="px-affix">$</span>
          <input type="number" value={annualSavings} step="1000" onChange={(e) => setAnnualSavings(parseFloat(e.target.value) || 0)} />
        </div>
      </label>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        "Independence" = invested assets reaching ≈ 25× your annual spending, the point a 4%-ish draw could
        cover today's lifestyle. Illustrative at a 5% real return — the early years are the advantage, since
        time does the heavy lifting. Your advisor can refine the target and pace with you.
      </div>
    </ToolShell>
  );
};

/* Phase 02 · Reserve */
const ReserveTool = () => {
  const { totalExpenses, profile, reserveTarget, reservePct } = useProfile();
  return (
    <ToolShell title="Liquidity reserve">
      <div className="px-tool-grid">
        <StatCell label="Current reserve" value={fmt$(profile.savings.emergency)} />
        <StatCell label="Six-month target" value={fmt$(reserveTarget)} foot={`${reservePct.toFixed(0)}% funded`} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ height: 6, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${reservePct}%`, background: 'var(--forest)', transition: 'width .4s' }} />
        </div>
      </div>
    </ToolShell>
  );
};

/* Phase 02 · Income-protection / life-coverage gap (client utility) */
const CoverageGapTool = () => {
  const { profile, grossAnnualIncome, effectiveTakehome, totalDebt, lifeCoverage, planningAge } = useProfile();
  const income = grossAnnualIncome || (effectiveTakehome || 0) * 12;
  const liquid = profile.savings?.emergency || 0;
  const [multiple, setMultiple] = useStateC(10);
  const [existing, setExisting] = useStateC(Math.round(lifeCoverage || 0));

  const cg = useMemoC(
    () => lifeCoverageGap({ annualIncome: income, incomeMultiple: multiple,
      liabilities: totalDebt, existingCoverage: existing, liquidAssets: liquid }),
    [income, multiple, totalDebt, existing, liquid]);
  const prem = useMemoC(() => termLifePremium({ coverage: cg.gap, age: planningAge }), [cg.gap, planningAge]);

  // Constructive tone (never alarming on the client side): forest when covered,
  // gold "room to strengthen" when there's a gap — no red.
  const tone     = cg.covered ? 'var(--forest)' : 'var(--gold)';
  const label    = cg.covered ? 'Well protected' : 'Room to strengthen';
  const ratioPct = Math.round((cg.ratio || 0) * 100);

  return (
    <ToolShell title="Income protection · coverage gap"
      hint="Life cover vs. a simple income-multiple guideline">
      <div className="px-tool-grid">
        <StatCell label="Guideline coverage" value={fmt$(cg.recommended, { short: true })}
          foot={`${multiple}× income + debts, less reserve`} />
        <StatCell label="Coverage in place" value={fmt$(existing, { short: true })} />
        <StatCell label={cg.covered ? 'Surplus' : 'Coverage gap'}
          value={cg.covered ? 'Covered' : fmt$(cg.gap, { short: true })}
          tone={cg.covered ? 'good' : null}
          foot={cg.covered ? 'guideline met' : 'worth reviewing with your advisor'} />
        <StatCell label="Est. term premium"
          value={cg.gap > 0 ? `${fmt$(prem.monthly)}/mo` : '—'}
          foot={cg.gap > 0 ? 'rough, healthy non-smoker' : 'no gap to fill'} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span className="px-eyebrow">Coverage vs. guideline</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600, color: tone }}>{label}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${ratioPct}%`, background: tone, transition: 'width .4s' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Income multiple</span>
          <div className="px-input-affix">
            <input type="number" value={multiple} min="0" step="1" onChange={(e) => setMultiple(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">×</span>
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Coverage in place</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={existing} step="50000" onChange={(e) => setExisting(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        Guideline ≈ income × {multiple} + debts to retire, less the liquidity reserve. The premium is a
        rough illustration, not a quote — actual cost depends on age, health, and term. A short
        conversation with your advisor sizes the right policy.
      </div>
    </ToolShell>
  );
};

/* Phase 03 · Avalanche */
const AvalancheTool = () => {
  const { profile, toxicDebt } = useProfile();
  const [extra, setExtra] = useStateC(800);
  const totalMin = profile.debts.reduce((a, d) => a + Number(d.min || 0), 0);
  const weightedApr = profile.debts.reduce((a, d) => a + d.balance * d.apr, 0) / Math.max(1, profile.debts.reduce((a, d) => a + d.balance, 0));
  const monthly = totalMin + extra;
  const totalDebtBalance = profile.debts.reduce((a, d) => a + Number(d.balance || 0), 0);
  const monthsToPayoff = debtPayoffMonths(totalDebtBalance, weightedApr, monthly);
  return (
    <ToolShell title="Debt avalanche schedule">
      <div className="px-tool-grid">
        <StatCell label="High-cost balance" value={fmt$(toxicDebt)} tone={toxicDebt > 0 ? 'bad' : 'good'} />
        <StatCell label="Weighted APR" value={fmtPct(weightedApr)} />
        <StatCell label="Monthly applied" value={fmt$(monthly)} foot={`${fmt$(extra)} above minimum`} />
        <StatCell label="Payoff horizon" value={isFinite(monthsToPayoff) ? `${monthsToPayoff} mo` : '—'} />
      </div>
      <label className="px-field" style={{ marginTop: 14 }}>
        <span className="px-field-label">Extra principal per month</span>
        <div className="px-input-affix">
          <span className="px-affix">$</span>
          <input type="number" value={extra} step="100" onChange={(e) => setExtra(parseFloat(e.target.value) || 0)} />
        </div>
      </label>
    </ToolShell>
  );
};

/* Phase 03 · Debt-vs-Invest crossover — pay down or invest the marginal dollar? */
const DebtVsInvestTool = () => {
  const { profile } = useProfile();
  const debts = Array.isArray(profile.debts) ? profile.debts.filter(d => (Number(d.balance) || 0) > 0) : [];
  const [returnPct, setReturnPct] = useStateC(6);   // expected after-tax annual return

  const rows = useMemoC(() => debts.map(d => ({
    label: d.label || d.name || 'Debt', balance: Number(d.balance) || 0, apr: Number(d.apr) || 0,
    ...debtVsInvest({ apr: Number(d.apr) || 0, afterTaxReturn: returnPct }),
  })), [debts, returnPct]);

  const payBalance    = rows.filter(r => r.verdict === 'pay').reduce((a, r) => a + r.balance, 0);
  const investBalance = rows.filter(r => r.verdict === 'invest').reduce((a, r) => a + r.balance, 0);

  if (!debts.length) {
    return (
      <ToolShell title="Pay down or invest?" hint="The marginal-dollar crossover">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          No debts on file — nothing to weigh against investing. Every spare dollar can go straight to the
          portfolio. Add balances in your numbers if that changes.
        </div>
      </ToolShell>
    );
  }
  const V = { pay: { label: 'Pay down first', color: 'var(--gold)' },
              invest: { label: 'Invest instead', color: 'var(--forest)' },
              tossup: { label: 'Toss-up', color: 'var(--ink-mute)' } };
  return (
    <ToolShell title="Pay down or invest?" hint="Guaranteed payoff return vs. expected after-tax return">
      <div className="px-tool-grid">
        <StatCell label="Expected return" value={fmtPct(returnPct)} foot="after-tax, the bar to beat" />
        <StatCell label="Pay down first" value={fmt$(payBalance, { short: true })}
          tone={payBalance > 0 ? null : 'good'} foot={payBalance > 0 ? 'APR beats investing' : 'none — all below the bar'} />
        <StatCell label="Better to invest" value={fmt$(investBalance, { short: true })} tone="good"
          foot="APR below expected return" />
        <StatCell label="Debts weighed" value={`${debts.length}`} foot="balances on file" />
      </div>
      <label className="px-field" style={{ marginTop: 14 }}>
        <span className="px-field-label">Expected after-tax investment return</span>
        <div className="px-input-affix">
          <input type="number" value={returnPct} step="0.5" onChange={(e) => setReturnPct(parseFloat(e.target.value) || 0)} />
          <span className="px-affix px-affix-r">%</span>
        </div>
      </label>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Debt</th><th className="is-num">Balance</th><th className="is-num">APR</th><th className="is-num">Verdict</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5 }}>{r.label}</td>
                <td className="is-num px-mono">{fmt$(r.balance, { short: true })}</td>
                <td className="is-num px-mono">{fmtPct(r.apr)}</td>
                <td className="is-num px-mono" style={{ color: V[r.verdict].color, fontWeight: 600 }}>{V[r.verdict].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8, lineHeight: 1.5 }}>
          Paying a balance down earns a <b>guaranteed, tax-free</b> return equal to its APR; investing earns an
          uncertain one. Above ~{fmtPct(returnPct)} APR, the guaranteed payoff usually wins — below it, the
          expected market return does. Near the line it's a toss-up where liquidity and peace of mind decide.
        </div>
      </div>
    </ToolShell>
  );
};

/* Phase 04 · HSA */
const HSATool = () => {
  const { profile, hsaTaxSavings } = useProfile();
  const yearsCompounded = useMemoC(
    () => hsaProjection(profile.retirement.hsaBalance, profile.retirement.hsaContrib, 0.07, 25),
    [profile.retirement.hsaBalance, profile.retirement.hsaContrib]);
  return (
    <ToolShell title="HSA · triple-advantaged">
      <div className="px-tool-grid">
        <StatCell label="Current balance" value={fmt$(profile.retirement.hsaBalance)} />
        <StatCell label="Annual contribution" value={fmt$(profile.retirement.hsaContrib)} />
        <StatCell label="Annual tax savings" value={fmt$(hsaTaxSavings)} tone="good"
          foot={`at ${profile.taxes.marginalRate}% marginal rate`} />
        <StatCell label="25-year projection" value={fmt$(yearsCompounded, { short: true })}
          foot="at 7% nominal, tax-free" />
      </div>
    </ToolShell>
  );
};

/* Phase 04 · Tax-bracket headroom (client utility; shared bracket engine) */
const BracketHeadroomTool = () => {
  const { profile, grossAnnualIncome, effectiveTakehome } = useProfile();
  const defaultFiling = profile.taxes?.filingStatus === 'single' ? 'single' : 'mfj';
  const [income, setIncome] = useStateC(Math.round(((grossAnnualIncome || (effectiveTakehome || 0) * 12)) / 1000) * 1000);
  const [filing, setFiling] = useStateC(defaultFiling);

  const b = useMemoC(() => bracketPosition({ filingStatus: filing, ordinaryIncome: income }), [filing, income]);
  const topBracket = b.nextRate == null;
  const pct = (x) => `${Math.round(x * 100)}%`;

  return (
    <ToolShell title="Tax-bracket headroom"
      hint="Where this year's income sits — and the room before the next bracket">
      <div className="px-tool-grid">
        <StatCell label="Marginal rate" value={pct(b.marginalRate)} big
          foot={topBracket ? 'top federal bracket' : `next dollar taxed at ${pct(b.marginalRate)}`} />
        <StatCell label="Taxable income" value={fmt$(b.taxableIncome, { short: true })}
          foot={`after ${fmt$(b.stdDeduction, { short: true })} standard deduction`} />
        <StatCell label="Effective rate" value={pct(b.effectiveRate)} foot="blended across brackets" />
        <StatCell label="Headroom to next" value={topBracket ? '—' : fmt$(b.headroom, { short: true })}
          tone={topBracket ? null : 'good'}
          foot={topBracket ? 'no higher bracket' : `before the ${pct(b.nextRate)} bracket`} />
      </div>
      {!topBracket && b.headroom > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
          borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          You have <b>{fmt$(b.headroom, { short: true })}</b> of room in the {pct(b.marginalRate)} bracket before income
          spills into {pct(b.nextRate)}. That headroom is the space for Roth conversions or pre-tax vs. Roth
          contribution choices this year — worth coordinating with your advisor.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Ordinary income</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={income} step="5000" onChange={(e) => setIncome(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Filing status</span>
          <select value={filing} onChange={(e) => setFiling(e.target.value)}>
            <option value="mfj">Married filing jointly</option>
            <option value="single">Single</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Bracket</th><th className="is-num">Taxable range</th><th className="is-num">Your income here</th></tr>
          </thead>
          <tbody>
            {b.bands.map((band) => (
              <tr key={band.rate + '-' + band.lo}
                style={{ cursor: 'default', background: band.isCurrent ? 'var(--gold-soft)' : undefined }}>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5, fontWeight: band.isCurrent ? 600 : 400 }}>
                  {pct(band.rate)}{band.isCurrent ? <span style={{ color: 'var(--gold)', fontSize: 11 }}> · you are here</span> : null}
                </td>
                <td className="is-num px-mono">
                  {fmt$(band.lo, { short: true })} – {isFinite(band.top) ? fmt$(band.top, { short: true }) : '+'}
                </td>
                <td className="is-num px-mono">{band.inBand > 0 ? fmt$(band.inBand, { short: true }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8, lineHeight: 1.5 }}>
          2025 federal ordinary-income brackets, applied to income after the standard deduction. Brackets
          reindex each year. This frames the Roth-conversion and contribution-priority decisions in the
          later phases — illustrative, and best refined with your advisor.
        </div>
      </div>
    </ToolShell>
  );
};

/* ───────────────────── ADVANCED TOOLS ─────────────────────────────── */

/* Asset Location optimizer — placement of tax-inefficient vs efficient assets */
const AssetLocationTool = () => {
  const { profile, riskProfile } = useProfile();
  const r = profile.retirement;
  const taxDeferred = (r.iraBalance || 0) + (r.fourohonekBalance || 0);
  const taxFree     = (r.hsaBalance || 0) + (r.rothBalance || 0);   // Roth + HSA = tax-free
  const taxable     = profile.taxable?.balance || 0;

  // Bespoke placement of the household's ACTUAL dollars, fit to their strategic
  // allocation (from the risk profile). Falls back to an illustrative rule-of-thumb
  // model when nothing is invested yet (e.g. a blank/prospect client).
  const plan = assetLocationPlan({ taxable, taxDeferred, taxFree, allocation: riskProfile?.allocation });
  const STATIC = [
    { label: 'Broad equity index (efficient)', taxable: 80, deferred: 10, free: 10 },
    { label: 'Corporate bonds / TIPS (inefficient)', taxable: 5, deferred: 90, free: 5 },
    { label: 'REIT / high-dividend (inefficient)', taxable: 5, deferred: 60, free: 35 },
    { label: 'International equity', taxable: 60, deferred: 25, free: 15 },
  ];
  const rows = plan ? plan.rows : STATIC;

  return (
    <ToolShell title="Asset Location optimizer" advanced>
      <div className="px-tool-grid">
        <StatCell label="Taxable sleeve" value={fmt$(taxable, { short: true })} foot="Long-term gains rate" />
        <StatCell label="Tax-deferred" value={fmt$(taxDeferred, { short: true })} foot="Ordinary income at withdrawal" />
        <StatCell label="Tax-free (HSA + Roth)" value={fmt$(taxFree, { short: true })} foot="Zero tax on withdrawal" />
        <StatCell label="Projected tax alpha" value="0.40 – 0.85%" tone="good" foot="annualized · model est." />
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="px-eyebrow" style={{ marginBottom: 10 }}>
          Target asset → account mapping
          {plan && riskProfile && (
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--ink-mute)' }}>
              {' '}· fit to this household ({riskProfile.band})
            </span>
          )}
        </div>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr>
              <th>Asset class</th>
              <th className="is-num">Taxable</th>
              <th className="is-num">Tax-deferred</th>
              <th className="is-num">Tax-free</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.label} style={{ cursor: 'default' }}>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5 }}>{t.label}</td>
                <td className="is-num px-mono">{t.taxable}%</td>
                <td className="is-num px-mono">{t.deferred}%</td>
                <td className="is-num px-mono">{t.free}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan ? (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
            Placement of {fmt$(plan.total, { short: true })} invested across your accounts
            {riskProfile ? ` at a ${riskProfile.band.toLowerCase()} target allocation` : ''} —
            tax-inefficient assets are sheltered first.
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
            Illustrative institutional model — enter account balances to fit this to the household.
          </div>
        )}
      </div>
    </ToolShell>
  );
};

/* Monte Carlo — 1,000 deterministic-feeling scenarios using seeded RNG */
const MonteCarloTool = () => {
  const { profile, totalInvested, annualExpenses, planningAge } = useProfile();
  const { activeClientId } = useView();
  const [yearsHorizon, setYears] = useStateC(Math.max(20, profile.goals.retireAt - planningAge + 25));
  const [withdrawal, setWithdrawal] = useStateC(Math.round(annualExpenses / 1000) * 1000);

  const result = useMemoC(() => {
    // Per-client seed so each client sees consistent but distinct results.
    const baseSeed = activeClientId
      ? activeClientId.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      : 42;
    return monteCarlo({ principal: totalInvested, years: yearsHorizon, withdrawal,
      seed: baseSeed, runs: 800, mean: 0.07, sd: 0.16 });
  }, [totalInvested, yearsHorizon, withdrawal]);

  return (
    <ToolShell title="Monte Carlo retirement projection" advanced
      hint={`${800} simulated market paths · 7% mean / 16% σ`}>
      <div className="px-tool-grid">
        <StatCell label="Success probability" value={`${result.successPct.toFixed(0)}%`}
          tone={result.successPct >= 90 ? 'good' : result.successPct >= 75 ? null : 'bad'}
          foot={result.successPct >= 90 ? 'Robust under stress' : result.successPct >= 75 ? 'Within tolerance' : 'Below threshold'}
          big />
        <StatCell label="Median terminal value" value={fmt$(result.medianFinal, { short: true })} />
        <StatCell label="10th percentile" value={fmt$(result.p10, { short: true })} foot="bear-case outcome" />
        <StatCell label="90th percentile" value={fmt$(result.p90, { short: true })} foot="bull-case outcome" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Horizon (years)</span>
          <div className="px-input-affix">
            <input type="number" value={yearsHorizon} min="5" max="60" onChange={(e) => setYears(parseInt(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">yr</span>
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Annual withdrawal</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={withdrawal} step="5000" onChange={(e) => setWithdrawal(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
      </div>
    </ToolShell>
  );
};

/* Roth Conversion Ladder optimizer */
const RothLadderTool = () => {
  const { profile } = useProfile();
  const tradBalance = profile.retirement.iraBalance + profile.retirement.fourohonekBalance * 0.5;
  const [annualConvert, setAnnual] = useStateC(72_000);
  const [bracket, setBracket] = useStateC(profile.taxes.marginalRate);

  const rows = useMemoC(
    () => rothLadder({ tradBalance, annualConvert, bracketPct: bracket, growth: 0.06, years: 5 }),
    [tradBalance, annualConvert, bracket]);

  const totalConverted = rows.reduce((a, r) => a + r.convert, 0);
  const totalTax       = rows.reduce((a, r) => a + r.tax, 0);

  return (
    <ToolShell title="Roth Conversion Ladder" advanced
      hint="5-year cohort schedule · ordinary income taxed at conversion">
      <div className="px-tool-grid">
        <StatCell label="Traditional bal. eligible" value={fmt$(tradBalance, { short: true })} />
        <StatCell label="5-year total converted" value={fmt$(totalConverted, { short: true })} tone="good" />
        <StatCell label="Total tax cost" value={fmt$(totalTax, { short: true })} foot={`at ${bracket}% bracket`} />
        <StatCell label="Penalty-free at" value={`${rows[0]?.available || '—'}`} foot="5-year rule" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Annual conversion</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={annualConvert} step="5000" onChange={(e) => setAnnual(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Marginal tax rate</span>
          <div className="px-input-affix">
            <input type="number" value={bracket} onChange={(e) => setBracket(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span>
          </div>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Conversion year</th><th className="is-num">Amount</th><th className="is-num">Tax due</th><th className="is-num">Available</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.year} style={{ cursor: 'default' }}>
                <td className="px-mono">{r.year}</td>
                <td className="is-num px-mono">{fmt$(r.convert)}</td>
                <td className="is-num px-mono" style={{ color: 'var(--brick)' }}>{fmt$(r.tax)}</td>
                <td className="is-num px-mono"><span className="px-chip is-forest">{r.available}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ToolShell>
  );
};

/* Estate & Generational Wealth model */
const EstateTool = () => {
  const { profile, totalInvested } = useProfile();
  const [grossUp, setGrossUp] = useStateC(20);     // years until death
  const [g2Years, setG2Years] = useStateC(30);     // generation-2 horizon
  const [withdrawalRate, setWdRate] = useStateC(3.5);

  // 2026 federal estate tax exemption ~ $13.99M / individual (sunset 2026 ~ $7M post)
  const result = useMemoC(
    () => estateProjection({ principal: totalInvested, years: grossUp,
      withdrawalRatePct: withdrawalRate, g2Years, realRet: 0.05,
      exempt: 13_990_000, estateTaxRate: 0.40 }),
    [totalInvested, grossUp, withdrawalRate, g2Years]);

  return (
    <ToolShell title="Estate & generational wealth" advanced
      hint="Federal estate exemption $13.99M / individual · 40% above threshold">
      <div className="px-tool-grid">
        <StatCell label="Projected gross estate" value={fmt$(result.estate, { short: true })}
          foot={`@ ${grossUp}y · ${withdrawalRate}% draw · 5% real`} />
        <StatCell label="Federal estate tax" value={fmt$(result.estateTax, { short: true })} tone={result.estateTax > 0 ? 'bad' : 'good'}
          foot={result.estateTax > 0 ? 'Above exemption' : 'Below exemption'} />
        <StatCell label="Net to heirs" value={fmt$(result.netToHeirs, { short: true })} tone="good" />
        <StatCell label={`Gen-2 value (+${g2Years}y)`} value={fmt$(result.g2, { short: true })}
          foot="continued 5% real return" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Years to estate</span>
          <div className="px-input-affix">
            <input type="number" value={grossUp} onChange={(e) => setGrossUp(parseInt(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">yr</span>
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Withdrawal rate</span>
          <div className="px-input-affix">
            <input type="number" value={withdrawalRate} step="0.1" onChange={(e) => setWdRate(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span>
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Gen-2 horizon</span>
          <div className="px-input-affix">
            <input type="number" value={g2Years} onChange={(e) => setG2Years(parseInt(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">yr</span>
          </div>
        </label>
      </div>
    </ToolShell>
  );
};

/* Phase 06 · Tax-Loss Harvesting (advisor tool) */
const TLHTool = () => {
  const { taxableBalance } = useProfile();
  const [lossPct, setLossPct]       = useStateC(8);     // % of taxable book below cost basis
  const [offsetRate, setOffsetRate] = useStateC(23.8);  // LTCG 20% + NIIT 3.8% (or ordinary if short-term)
  const result = useMemoC(
    () => tlh({ taxableBalance, lossPct, offsetRatePct: offsetRate }),
    [taxableBalance, lossPct, offsetRate]);

  return (
    <ToolShell title="Tax-loss harvesting" advanced hint="Estimated offset from harvesting unrealized losses">
      <div className="px-tool-grid">
        <StatCell label="Harvestable losses" value={fmt$(result.harvestable, { short: true })} big />
        <StatCell label="Est. tax offset" value={fmt$(result.taxOffset, { short: true })} tone="good"
          foot="Offsets gains + up to $3k ordinary / yr" />
        <StatCell label="Annual TLH alpha (est.)"
          value={`${fmt$(result.alphaLow, { short: true })}–${fmt$(result.alphaHigh, { short: true })}`}
          foot="~0.5–1.5% after-tax, full cycle" />
        <StatCell label="Taxable assets" value={fmt$(taxableBalance, { short: true })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Portfolio at a loss</span>
          <div className="px-input-affix">
            <input type="number" value={lossPct} min="0" max="100" onChange={(e) => setLossPct(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span>
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Offset tax rate</span>
          <div className="px-input-affix">
            <input type="number" value={offsetRate} step="0.1" onChange={(e) => setOffsetRate(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span>
          </div>
        </label>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', lineHeight: 1.5 }}>
        Wash-sale rule: a harvested position can't be repurchased within 30 days — we rotate into a correlated, non-substantially-identical replacement to hold market exposure.
      </div>
    </ToolShell>
  );
};

/* Contribution Priority — the savings waterfall (per-account optimization) */
const ContributionPriorityTool = () => {
  const { profile, surplus, annualRetirementContribution, grossAnnualIncome, effectiveTakehome } = useProfile();
  const r = profile.retirement;
  // Default capacity: what the household already directs to retirement plus any free
  // monthly surplus — a sensible starting figure the advisor tunes.
  const defaultCapacity = Math.max(0, Math.round((annualRetirementContribution + Math.max(0, surplus) * 12) / 500) * 500);
  const [capacity, setCapacity] = useStateC(defaultCapacity);
  const [matchPct, setMatchPct] = useStateC(r.employerMatchPct || 0);
  const salary = grossAnnualIncome || effectiveTakehome * 12;

  const plan = useMemoC(() => contributionWaterfall({
    annualCapacity: capacity, salary, employerMatchPct: matchPct,
    k401Limit: r.fourohonekLimit || 23_500, k401Contributed: 0,
    iraLimit: r.iraLimit || 7_000, iraContributed: 0,
    hsaLimit: 4_300, hsaContributed: 0, hsaEligible: (r.hsaBalance || 0) > 0 || (r.hsaContrib || 0) > 0,
  }), [capacity, salary, matchPct, r.fourohonekLimit, r.iraLimit, r.hsaBalance, r.hsaContrib]);

  return (
    <ToolShell title="Contribution Priority" advanced
      hint="Optimal funding order for this year's savings — match first, taxable last">
      <div className="px-tool-grid">
        <StatCell label="Annual to invest" value={fmt$(capacity, { short: true })} />
        <StatCell label="Into tax-advantaged" value={fmt$(plan.totalTaxAdvantaged, { short: true })} tone="good"
          foot={`${capacity > 0 ? Math.round(plan.totalTaxAdvantaged / capacity * 100) : 0}% sheltered`} />
        <StatCell label="To taxable brokerage" value={fmt$(plan.taxable, { short: true })} foot="after accounts are filled" />
        <StatCell label="Employer match"
          value={plan.fullMatch ? 'Captured' : 'Short'} tone={plan.fullMatch ? 'good' : 'bad'}
          foot={plan.fullMatch ? 'full match funded' : `${fmt$(plan.missedMatch)} left on the table`} />
      </div>
      {!plan.fullMatch && plan.missedMatch > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--brick)',
          borderRadius: 6, fontSize: 12, color: 'var(--ink)' }}>
          Capacity stops short of the full employer match — {fmt$(plan.missedMatch)}/yr of guaranteed return is unclaimed.
          The match is the first dollar to fund.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Annual amount to invest</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={capacity} step="1000" onChange={(e) => setCapacity(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Employer match (% of salary)</span>
          <div className="px-input-affix">
            <input type="number" value={matchPct} step="0.5" onChange={(e) => setMatchPct(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span>
          </div>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Priority</th><th>Account</th><th className="is-num">Annual amount</th></tr>
          </thead>
          <tbody>
            {plan.steps.map((s, i) => (
              <tr key={s.key} style={{ cursor: 'default' }}>
                <td className="px-mono">{i + 1}</td>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5 }}>{s.label}<span style={{ color: 'var(--ink-mute)', fontSize: 11 }}> · {s.note}</span></td>
                <td className="is-num px-mono">{fmt$(s.amount)}</td>
              </tr>
            ))}
            {plan.taxable > 0 && (
              <tr style={{ cursor: 'default' }}>
                <td className="px-mono">{plan.steps.length + 1}</td>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5 }}>Taxable brokerage<span style={{ color: 'var(--ink-mute)', fontSize: 11 }}> · flexible, no limit</span></td>
                <td className="is-num px-mono">{fmt$(plan.taxable)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
          Each tier is filled to its annual limit before the next — capturing the guaranteed
          employer match first, then the most tax-advantaged space, with the remainder deployed to taxable.
        </div>
      </div>
    </ToolShell>
  );
};

/* Tax-aware Withdrawal Sequencing — the decumulation draw order */
const WithdrawalSequenceTool = () => {
  const { profile, taxableBalance, annualExpenses, planningAge, incomeStreams } = useProfile();
  const r = profile.retirement;
  const taxDeferred = (r.iraBalance || 0) + (r.fourohonekBalance || 0);
  const taxFree     = (r.rothBalance || 0) + (r.hsaBalance || 0);
  const streamsAnnual = (incomeStreams || []).reduce((a, s) => a + (Number(s.monthlyAmount) || 0) * 12, 0);
  const [spending, setSpending] = useStateC(Math.round(annualExpenses / 1000) * 1000);
  const [otherIncome, setOther] = useStateC(Math.round(streamsAnnual / 1000) * 1000);

  const result = useMemoC(() => withdrawalSequence({
    taxable: taxableBalance, taxDeferred, taxFree,
    annualSpending: spending, otherIncome,
    currentAge: planningAge, retireAt: profile.goals.retireAt, horizonAge: 95,
  }), [taxableBalance, taxDeferred, taxFree, spending, otherIncome, planningAge, profile.goals.retireAt]);

  if (!result) {
    return (
      <ToolShell title="Withdrawal Sequencing" advanced hint="Tax-efficient retirement draw order">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Add invested balances and a spending figure to model the draw-down.</div>
      </ToolShell>
    );
  }
  // Show the schedule at 5-year checkpoints to keep it scannable.
  const checkpoints = result.schedule.filter((y, i) => i % 5 === 0 || i === result.schedule.length - 1);
  return (
    <ToolShell title="Withdrawal Sequencing" advanced
      hint={`Draw order · ${result.strategy}`}>
      <div className="px-tool-grid">
        <StatCell label="Portfolio horizon"
          value={result.lasts ? `Through ${profile.goals.retireAt + result.yearsFunded}` : `Depletes at ${result.depletesAt}`}
          tone={result.lasts ? 'good' : 'bad'}
          foot={result.lasts ? `funds all ${result.yearsFunded} years` : 'spending outpaces assets'} big />
        <StatCell label="Lifetime tax (this order)" value={fmt$(result.lifetimeTax, { short: true })}
          foot="cumulative, nominal" />
        <StatCell label="After-tax value at 95" value={fmt$(result.afterTax, { short: true })} tone="good"
          foot="deferred sleeve net of embedded tax" />
        <StatCell label="Guaranteed income" value={fmt$(otherIncome, { short: true })} foot="SS / pension, before draws" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Annual retirement spending</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={spending} step="5000" onChange={(e) => setSpending(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Guaranteed annual income</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={otherIncome} step="1000" onChange={(e) => setOther(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Age</th><th className="is-num">From taxable</th><th className="is-num">Tax-deferred</th><th className="is-num">Tax-free</th><th className="is-num">Est. tax</th></tr>
          </thead>
          <tbody>
            {checkpoints.map(y => (
              <tr key={y.age} style={{ cursor: 'default' }}>
                <td className="px-mono">{y.age}</td>
                <td className="is-num px-mono">{fmt$(y.taxable, { short: true })}</td>
                <td className="is-num px-mono">{fmt$(y.taxDeferred, { short: true })}</td>
                <td className="is-num px-mono">{fmt$(y.taxFree, { short: true })}</td>
                <td className="is-num px-mono" style={{ color: y.tax > 0 ? 'var(--brick)' : 'inherit' }}>{fmt$(y.tax, { short: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
          Spend taxable first (only gains are taxed), then tax-deferred, preserving the tax-free Roth
          longest so its untaxed growth compounds the longest. Five-year checkpoints shown.
        </div>
      </div>
    </ToolShell>
  );
};

/* Roth Conversion Window — bracket-headroom sizing in the low-income years */
const RothConversionWindowTool = () => {
  const { profile, planningAge, incomeStreams } = useProfile();
  const r = profile.retirement;
  const taxDeferredBalance = (r.iraBalance || 0) + (r.fourohonekBalance || 0);
  const filing = profile.taxes.filingStatus === 'single' ? 'single' : 'mfj';
  const streamsAnnual = (incomeStreams || []).reduce((a, s) => a + (Number(s.monthlyAmount) || 0) * 12, 0);
  const [income, setIncome] = useStateC(Math.round(streamsAnnual / 1000) * 1000);
  const [bracket, setBracket] = useStateC(0.22);

  const w = useMemoC(() => rothConversionWindow({
    currentAge: planningAge, retireAt: profile.goals.retireAt, rmdAge: 73,
    filingStatus: filing, taxDeferredBalance, estimatedRetirementIncome: income, targetBracket: bracket,
  }), [planningAge, profile.goals.retireAt, filing, taxDeferredBalance, income, bracket]);

  if (!w) {
    return (
      <ToolShell title="Roth Conversion Window" advanced hint="Bracket-filling conversions before RMDs">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          No conversion window — either retirement is at/after the RMD age (73) or there's no tax-deferred balance to convert.
        </div>
      </ToolShell>
    );
  }
  return (
    <ToolShell title="Roth Conversion Window" advanced
      hint={`Low-income years ${w.windowStart}–${w.windowEnd} · fill to the ${Math.round(w.targetBracket * 100)}% bracket`}>
      <div className="px-tool-grid">
        <StatCell label="Conversion window" value={`${w.windowYears} yr`} foot={`age ${w.windowStart} → ${w.windowEnd} (RMDs)`} big />
        <StatCell label="Annual conversion" value={fmt$(w.annualConversion, { short: true })} tone="good"
          foot={w.fillsBracket ? 'fills the target bracket' : 'no headroom at this income'} />
        <StatCell label="Total over window" value={fmt$(w.totalConverted, { short: true })} />
        <StatCell label="Est. tax cost" value={fmt$(w.estTaxCost, { short: true })} foot={`≈ ${Math.round(w.targetBracket * 100)}% on converted`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Other taxable income (gap years)</span>
          <div className="px-input-affix">
            <span className="px-affix">$</span>
            <input type="number" value={income} step="5000" onChange={(e) => setIncome(parseFloat(e.target.value) || 0)} />
          </div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Fill to bracket</span>
          <select value={bracket} onChange={(e) => setBracket(parseFloat(e.target.value))}>
            <option value="0.12">12%</option>
            <option value="0.22">22%</option>
            <option value="0.24">24%</option>
            <option value="0.32">32%</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Year</th><th className="is-num">Age</th><th className="is-num">Convert</th><th className="is-num">Tax</th><th className="is-num">Remaining deferred</th></tr>
          </thead>
          <tbody>
            {w.schedule.map(s => (
              <tr key={s.year} style={{ cursor: 'default' }}>
                <td className="px-mono">{s.year}</td>
                <td className="is-num px-mono">{s.age}</td>
                <td className="is-num px-mono">{fmt$(s.convert)}</td>
                <td className="is-num px-mono" style={{ color: 'var(--brick)' }}>{fmt$(s.tax)}</td>
                <td className="is-num px-mono">{fmt$(s.remaining, { short: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
          Headroom this year: {fmt$(w.headroom, { short: true })} before income spills into the next bracket
          ({filing === 'mfj' ? 'married filing jointly' : 'single'}, 2025 brackets). Converting in these low-income
          years moves tax-deferred dollars to tax-free at a controlled rate, ahead of RMDs and Social Security.
        </div>
      </div>
    </ToolShell>
  );
};

/* ───────────────── FRONT-PHASE PARITY TOOLS (client-utility) ──────── */

// Months → "Xy Ym" for payoff horizons.
const fmtMonths = (m) => {
  if (!isFinite(m)) return '—';
  const y = Math.floor(m / 12), mo = Math.round(m % 12);
  return y > 0 ? `${y}y${mo ? ` ${mo}m` : ''}` : `${mo}m`;
};

/* Phase 03 · Mortgage payoff accelerator — extra principal → time & interest saved */
const MortgagePayoffTool = () => {
  const { profile, isOwner, mortgageBalance, mortgageInterestMonthly, mortgagePrincipalMonthly } = useProfile();
  const apr = Number(profile.housing?.mortgageApr) || 0;
  const regularPI = Math.max(0, Math.round(mortgagePrincipalMonthly + mortgageInterestMonthly));
  const [payment, setPayment] = useStateC(regularPI || 0);
  const [extra, setExtra] = useStateC(500);

  const result = useMemoC(
    () => mortgagePayoff({ balance: mortgageBalance, aprPct: apr, paymentMonthly: payment, extraMonthly: extra }),
    [mortgageBalance, apr, payment, extra]);

  if (!isOwner || mortgageBalance <= 0 || !result) {
    return (
      <ToolShell title="Mortgage payoff accelerator" hint="Extra principal → time & interest saved">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          No mortgage on file — nothing to accelerate. Add your home and mortgage balance in your numbers to
          model paying it down faster.
        </div>
      </ToolShell>
    );
  }
  if (!result.amortizes) {
    return (
      <ToolShell title="Mortgage payoff accelerator" hint="Extra principal → time & interest saved">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          At {fmtPct(apr)} APR, a payment of {fmt$(payment)}/mo doesn't cover the monthly interest, so the
          balance never amortizes. Raise the payment to see a payoff horizon.
        </div>
        <label className="px-field" style={{ marginTop: 14 }}>
          <span className="px-field-label">Monthly payment (P&amp;I)</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={payment} step="100" onChange={(e) => setPayment(parseFloat(e.target.value) || 0)} /></div>
        </label>
      </ToolShell>
    );
  }
  return (
    <ToolShell title="Mortgage payoff accelerator" hint="What a little extra principal each month buys you">
      <div className="px-tool-grid">
        <StatCell label="Payoff at current pace" value={fmtMonths(result.base.months)}
          foot={`${fmt$(result.base.interest, { short: true })} total interest`} />
        <StatCell label="With extra principal" value={fmtMonths(result.accel.months)} tone="good"
          foot={`${fmt$(result.accel.interest, { short: true })} total interest`} big />
        <StatCell label="Time saved" value={result.monthsSaved > 0 ? fmtMonths(result.monthsSaved) : '—'} tone={result.monthsSaved > 0 ? 'good' : null}
          foot={`${fmt$(extra)}/mo extra`} />
        <StatCell label="Interest saved" value={result.interestSaved > 0 ? fmt$(result.interestSaved, { short: true }) : '—'} tone="good"
          foot="over the life of the loan" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Monthly payment (P&amp;I)</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={payment} step="100" onChange={(e) => setPayment(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Extra principal / mo</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={extra} step="100" onChange={(e) => setExtra(parseFloat(e.target.value) || 0)} /></div>
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        Paying extra principal shortens the loan and saves interest — a guaranteed, tax-free return equal to the
        mortgage rate ({fmtPct(apr)}). At a low fixed rate that's often below what the same dollars might earn
        invested — see "Pay down or invest?" — so this is usually a peace-of-mind choice. Worth weighing with your advisor.
      </div>
    </ToolShell>
  );
};

/* Phase 04 · HDHP-vs-PPO break-even — answers the flagged "is the HDHP worth it?" */
const HDHPvsPPOTool = () => {
  const { profile } = useProfile();
  const marginal = Number(profile.taxes?.marginalRate) || 22;
  const hsaContrib = Number(profile.retirement?.hsaContrib) || 4_300;
  const [claims, setClaims] = useStateC(3000);
  const [hdhpPremium, setHdhpPremium] = useStateC(2400);
  const [ppoPremium, setPpoPremium] = useStateC(5400);
  const [hdhpDeductible, setHdhpDed] = useStateC(3300);
  const [ppoDeductible, setPpoDed] = useStateC(1000);
  const [employerHsa, setEmployerHsa] = useStateC(1000);

  const r = useMemoC(() => hdhpVsPpo({
    expectedClaims: claims, hdhpPremium, ppoPremium,
    hdhpDeductible, hdhpOopMax: 7000, hdhpCoinsurance: 0.1,
    ppoDeductible, ppoOopMax: 4000, ppoCoinsurance: 0.2,
    employerHsaContribution: employerHsa, hsaContribution: hsaContrib, marginalRatePct: marginal,
  }), [claims, hdhpPremium, ppoPremium, hdhpDeductible, ppoDeductible, employerHsa, hsaContrib, marginal]);

  const winnerLabel = r.cheaper === 'hdhp' ? 'HDHP + HSA' : 'PPO';
  return (
    <ToolShell title="HDHP vs. PPO break-even"
      hint="Total annual cost of each plan — including the HSA tax advantage">
      <div className="px-tool-grid">
        <StatCell label="HDHP net cost" value={fmt$(r.hdhp, { short: true })}
          tone={r.cheaper === 'hdhp' ? 'good' : null} foot={`incl. ${fmt$(r.hsaTaxBenefit)} HSA benefit`} />
        <StatCell label="PPO cost" value={fmt$(r.ppo, { short: true })}
          tone={r.cheaper === 'ppo' ? 'good' : null} foot="premium + your share of claims" />
        <StatCell label="Lower-cost plan" value={winnerLabel} tone="good" big
          foot={`saves ${fmt$(r.savings, { short: true })}/yr at this spend`} />
        <StatCell label="Break-even claims" value={r.breakeven != null ? fmt$(r.breakeven, { short: true }) : '—'}
          foot={r.breakeven != null ? 'above this, the PPO wins' : 'HDHP wins across the range'} />
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
        borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
        For your expected <b>{fmt$(claims, { short: true })}</b> of annual medical spending, the <b>{winnerLabel}</b> costs
        less. {r.breakeven != null
          ? <>The plans break even around <b>{fmt$(r.breakeven, { short: true })}</b> of claims — below that the HDHP's lower premium and HSA advantage win.</>
          : <>The HDHP stays cheaper across the plausible range here, thanks to the HSA tax advantage.</>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Expected annual claims</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={claims} step="500" onChange={(e) => setClaims(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Employer HSA contribution</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={employerHsa} step="250" onChange={(e) => setEmployerHsa(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">HDHP premium / yr</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={hdhpPremium} step="100" onChange={(e) => setHdhpPremium(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">PPO premium / yr</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={ppoPremium} step="100" onChange={(e) => setPpoPremium(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">HDHP deductible</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={hdhpDeductible} step="250" onChange={(e) => setHdhpDed(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">PPO deductible</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={ppoDeductible} step="250" onChange={(e) => setPpoDed(parseFloat(e.target.value) || 0)} /></div>
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        The HDHP's net cost subtracts the HSA advantage — the employer's contribution plus the tax saved on
        your own HSA dollars at your {marginal}% rate. Coinsurance and out-of-pocket maximums use plan-typical
        defaults; your advisor can refine with your actual benefits summary. Illustrative, not benefits advice.
      </div>
    </ToolShell>
  );
};

/* Phase 05 · Mega-Backdoor Roth capacity — answers the flagged q02 */
const MegaBackdoorTool = () => {
  const { profile, planningAge, grossAnnualIncome, effectiveTakehome } = useProfile();
  const r = profile.retirement;
  const salary = grossAnnualIncome || (effectiveTakehome || 0) * 12;
  const defaultEmployer = Math.round(salary * (Number(r.employerMatchPct) || 0) / 100);
  const [deferral, setDeferral] = useStateC(Number(r.fourohonekContributed) || 23_500);
  const [employer, setEmployer] = useStateC(defaultEmployer);
  const [planAllows, setPlanAllows] = useStateC(true);

  const c = useMemoC(() => megaBackdoorCapacity({
    age: planningAge, employeeDeferral: deferral, employerContribution: employer,
    deferralLimit: Number(r.fourohonekLimit) || 23_500,
  }), [planningAge, deferral, employer, r.fourohonekLimit]);

  return (
    <ToolShell title="Mega-Backdoor Roth capacity"
      hint="After-tax 401(k) room under the §415(c) total-additions limit">
      <div className="px-tool-grid">
        <StatCell label="After-tax capacity" value={planAllows ? fmt$(c.afterTaxCapacity, { short: true }) : '—'}
          tone={planAllows && c.hasCapacity ? 'good' : null} big
          foot={planAllows ? (c.hasCapacity ? 'convertible to Roth' : 'limit already reached') : 'plan must allow it'} />
        <StatCell label="Total-additions limit" value={fmt$(c.limit, { short: true })}
          foot={`§415(c) · ${planningAge >= 50 ? '50+' : 'under 50'}`} />
        <StatCell label="Your deferral" value={fmt$(c.deferral, { short: true })}
          foot={c.deferralRoom > 0 ? `${fmt$(c.deferralRoom, { short: true })} elective room left` : 'elective max reached'} />
        <StatCell label="Employer contribution" value={fmt$(c.employer, { short: true })} foot="match + profit-share" />
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)',
        borderLeft: `3px solid ${planAllows && c.hasCapacity ? 'var(--forest)' : 'var(--gold)'}`,
        borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
        {planAllows
          ? (c.hasCapacity
            ? <>Your plan has roughly <b>{fmt$(c.afterTaxCapacity, { short: true })}</b> of room for after-tax contributions that
                can be converted to Roth — the "mega backdoor." This only works if your 401(k) plan allows after-tax
                contributions <i>and</i> in-plan Roth conversions (or in-service withdrawals). Confirm both with your advisor.</>
            : <>You've already filled the §415(c) limit, so there's no after-tax room to convert this year.</>)
          : <>The mega backdoor requires a plan that permits after-tax contributions and in-plan Roth conversions.
              Check your plan documents — your advisor can help read them.</>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Your 401(k) deferral / yr</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={deferral} step="500" onChange={(e) => setDeferral(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Employer contribution / yr</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={employer} step="500" onChange={(e) => setEmployer(parseFloat(e.target.value) || 0)} /></div>
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>
        <input type="checkbox" checked={planAllows} onChange={(e) => setPlanAllows(e.target.checked)} />
        My 401(k) plan allows after-tax contributions + in-plan Roth conversion
      </label>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        The §415(c) total-additions limit ({fmt$(c.limit, { short: true })} in 2025) caps all 401(k) money — your
        deferral, the employer's contribution, and after-tax dollars combined. Whatever's left is the mega-backdoor
        capacity. A dated assumption; reindexed annually. Illustrative — coordinate with your advisor.
      </div>
    </ToolShell>
  );
};

/* Phase 06 · Equity-comp concentration & diversification planner */
const EquityCompTool = () => {
  const { equityComp, largestPosition, equityConcentration, totalInvested, equityUnvested } = useProfile();
  const [capGains, setCapGains] = useStateC(15);
  const [threshold, setThreshold] = useStateC(10);

  const conc = useMemoC(() => (largestPosition ? equityCompConcentration({
    positionValue: Number(largestPosition.positionValue) || 0,
    costBasis: Number(largestPosition.costBasis) || 0,
    totalInvested, unvestedValue: Number(largestPosition.unvestedValue) || 0,
    capGainsRatePct: capGains, thresholdPct: threshold,
  }) : null), [largestPosition, totalInvested, capGains, threshold]);

  if (!equityComp.length || !conc) {
    return (
      <ToolShell title="Equity-comp concentration" hint="Single-stock risk + cost to diversify">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          No equity compensation on file. If you hold RSUs, options, or a concentrated single-stock position, add it
          in your numbers to see the concentration and the tax cost of diversifying.
        </div>
      </ToolShell>
    );
  }
  const ticker = largestPosition.ticker || 'position';
  const tone = conc.concentrated ? 'var(--gold)' : 'var(--forest)';
  return (
    <ToolShell title="Equity-comp concentration"
      hint={`Single-stock risk in ${ticker} — and the tax cost to diversify`}>
      <div className="px-tool-grid">
        <StatCell label="Concentration" value={`${conc.concentrationPct.toFixed(1)}%`} big
          tone={conc.concentrated ? null : 'good'}
          foot={conc.concentrated ? `above the ${conc.thresholdPct}% guideline` : 'within guideline'} />
        <StatCell label="Position value" value={fmt$(largestPosition.positionValue, { short: true })}
          foot={`${fmt$(conc.gain, { short: true })} unrealized gain`} />
        <StatCell label={`Trim to ${conc.thresholdPct}%`} value={conc.excess > 0 ? fmt$(conc.excess, { short: true }) : '—'}
          foot={conc.excess > 0 ? `≈ ${fmt$(conc.taxToTrim, { short: true })} cap-gains tax` : 'no trim needed'} />
        <StatCell label="Tax to fully exit" value={fmt$(conc.taxToFullyDiversify, { short: true })}
          foot={`at ${capGains}% on the full gain`} />
      </div>
      {conc.unvestedValue > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 12, lineHeight: 1.5 }}>
          Plus <b>{fmt$(conc.unvestedValue, { short: true })}</b> of unvested grants still to come — future vesting adds
          to the position (and to ordinary income) as it lands, so the concentration tends to rebuild without a plan.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Capital-gains rate</span>
          <div className="px-input-affix">
            <input type="number" value={capGains} step="1" onChange={(e) => setCapGains(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Concentration target</span>
          <div className="px-input-affix">
            <input type="number" value={threshold} step="1" onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span></div>
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        A single stock above ~{conc.thresholdPct}% of the portfolio carries company-specific risk no diversified
        plan would choose deliberately. Diversifying realizes the gain and the tax — a staged sell-down, a 10b5-1
        plan, or charitable gifting of appreciated shares can soften it. Your advisor coordinates the glide.
      </div>
    </ToolShell>
  );
};

/* Phase 07 · RMD projector — required distributions at 73 */
const RMDProjectionTool = () => {
  const { profile, planningAge } = useProfile();
  const r = profile.retirement;
  const taxDeferred = (Number(r.iraBalance) || 0) + (Number(r.fourohonekBalance) || 0);
  const [growth, setGrowth] = useStateC(5);
  const [rate, setRate] = useStateC(Number(profile.taxes?.marginalRate) || 22);

  const result = useMemoC(() => rmdProjection({
    taxDeferredBalance: taxDeferred, currentAge: planningAge, rmdAge: 73,
    growth: growth / 100, marginalRatePct: rate, throughAge: 95,
  }), [taxDeferred, planningAge, growth, rate]);

  if (!result) {
    return (
      <ToolShell title="RMD projector" advanced hint="Required distributions starting at 73">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          No tax-deferred balance (IRA / 401k) on file — nothing to project. RMDs only apply to pre-tax accounts.
        </div>
      </ToolShell>
    );
  }
  const checkpoints = result.schedule.filter((y, i) => i % 4 === 0 || i === result.schedule.length - 1);
  return (
    <ToolShell title="RMD projector" advanced hint="Required distributions begin at age 73 — and the tax they trigger">
      <div className="px-tool-grid">
        <StatCell label="First RMD (age 73)" value={fmt$(result.firstRmd.amount, { short: true })} big
          foot={`on ${fmt$(result.balanceAtRmd, { short: true })} projected`} />
        <StatCell label="First-year tax" value={fmt$(result.firstRmd.amount * rate / 100, { short: true })}
          foot={`at ${rate}% ordinary`} />
        <StatCell label="Lifetime RMDs (to 95)" value={fmt$(result.lifetimeRmd, { short: true })} />
        <StatCell label="Lifetime RMD tax" value={fmt$(result.lifetimeTax, { short: true })} tone="bad"
          foot="ordinary income, nominal" />
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
        borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
        Pre-tax accounts can't grow untaxed forever — at 73 the IRS forces a growing distribution each year, taxed
        as income. Roth conversions in the low-income years before then shrink this future tax. See the
        Roth Conversion Window tool.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">Growth rate</span>
          <div className="px-input-affix">
            <input type="number" value={growth} step="0.5" onChange={(e) => setGrowth(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Marginal tax rate</span>
          <div className="px-input-affix">
            <input type="number" value={rate} step="1" onChange={(e) => setRate(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span></div>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <table className="px-table" style={{ background: 'var(--surface)' }}>
          <thead>
            <tr><th>Age</th><th className="is-num">Divisor</th><th className="is-num">RMD</th><th className="is-num">Est. tax</th><th className="is-num">Balance</th></tr>
          </thead>
          <tbody>
            {checkpoints.map(y => (
              <tr key={y.age} style={{ cursor: 'default' }}>
                <td className="px-mono">{y.age}</td>
                <td className="is-num px-mono">{y.divisor}</td>
                <td className="is-num px-mono">{fmt$(y.rmd, { short: true })}</td>
                <td className="is-num px-mono" style={{ color: 'var(--brick)' }}>{fmt$(y.tax, { short: true })}</td>
                <td className="is-num px-mono">{fmt$(y.balanceBefore, { short: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8, lineHeight: 1.5 }}>
          IRS Uniform Lifetime Table divisors; RMD = balance ÷ divisor. Illustrative at a flat {growth}% growth and
          {rate}% rate — your advisor refines with actual balances and bracket projections.
        </div>
      </div>
    </ToolShell>
  );
};

/* Phase 07 · Social Security claiming-age optimizer (62 / 67 / 70 break-even) */
const SSClaimingTool = () => {
  const { incomeStreams } = useProfile();
  const ssStreams = (incomeStreams || []).filter(s => s.type === 'social_security');
  // PIA = benefit at full retirement age. Prefer a captured `pia`; fall back to the
  // largest stream's monthly amount (assumes it was entered at FRA).
  const defaultPia = ssStreams.reduce((m, s) => Math.max(m, Number(s.pia) || Number(s.monthlyAmount) || 0), 0);
  const [pia, setPia] = useStateC(Math.round(defaultPia) || 3000);
  const [longevity, setLongevity] = useStateC(90);
  const [discount, setDiscount] = useStateC(0);

  const result = useMemoC(() => socialSecurityClaiming({
    pia, fra: 67, colaPct: 2.5, longevityAge: longevity, discountRatePct: discount, claimAges: [62, 67, 70],
  }), [pia, longevity, discount]);

  if (!result) {
    return (
      <ToolShell title="Social Security claiming age" advanced hint="62 vs. 67 vs. 70 — lifetime break-even">
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          Enter your PIA — the monthly Social Security benefit at full retirement age (67), from your SSA statement —
          to compare claiming ages. Or add a Social Security stream in your numbers.
        </div>
        <label className="px-field" style={{ marginTop: 14 }}>
          <span className="px-field-label">PIA (monthly benefit at 67)</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={pia} step="100" onChange={(e) => setPia(parseFloat(e.target.value) || 0)} /></div>
        </label>
      </ToolShell>
    );
  }
  const fmtAge = (a) => result.options.find(o => o.claimAge === a);
  return (
    <ToolShell title="Social Security claiming age" advanced
      hint={`PV-optimal at ${result.best.claimAge}${result.breakevenAge ? ` · 62-vs-70 break-even ≈ age ${result.breakevenAge}` : ''}`}>
      <div className="px-tool-grid">
        {result.options.map(o => (
          <StatCell key={o.claimAge} label={`Claim at ${o.claimAge}`} value={`${fmt$(o.monthly)}/mo`}
            tone={o.claimAge === result.best.claimAge ? 'good' : null}
            foot={`${fmt$(o.lifetimeNominal, { short: true })} lifetime${o.claimAge === result.best.claimAge ? ' · best PV' : ''}`} />
        ))}
        <StatCell label="Break-even age" value={result.breakevenAge ? `${result.breakevenAge}` : '—'}
          foot={result.breakevenAge ? 'delaying to 70 pulls ahead here' : 'no crossover before ' + longevity} />
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
        borderRadius: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
        Claiming at 62 means a smaller check for life; waiting to 70 earns 8%/yr of delayed credits.
        {result.breakevenAge
          ? <> If you live past about <b>age {result.breakevenAge}</b>, delaying to 70 wins on total dollars — so
              longevity, other income, and a spouse's benefit drive the call.</>
          : <> At this longevity the earlier claim isn't overtaken — but health, other income, and survivor benefits matter.</>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
        <label className="px-field">
          <span className="px-field-label">PIA (at 67)</span>
          <div className="px-input-affix"><span className="px-affix">$</span>
            <input type="number" value={pia} step="100" onChange={(e) => setPia(parseFloat(e.target.value) || 0)} /></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Live to age</span>
          <div className="px-input-affix">
            <input type="number" value={longevity} step="1" onChange={(e) => setLongevity(parseInt(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">yr</span></div>
        </label>
        <label className="px-field">
          <span className="px-field-label">Discount rate</span>
          <div className="px-input-affix">
            <input type="number" value={discount} step="0.5" onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
            <span className="px-affix px-affix-r">%</span></div>
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10, lineHeight: 1.5 }}>
        PIA is your benefit at full retirement age (67). Figures assume a 2.5% annual COLA; the discount rate (0% =
        compare raw dollars) reflects how much you value money sooner. Illustrative — your actual SSA estimate and a
        spouse's benefit should anchor the decision with your advisor.
      </div>
    </ToolShell>
  );
};

/* ─── Calculator registry ─────────────────────────────────────────── */
const calculators = {
  cashflow:      CashflowTool,
  freedomdate:   FreedomDateTool,
  reserve:       ReserveTool,
  coveragegap:   CoverageGapTool,
  avalanche:     AvalancheTool,
  debtvinvest:   DebtVsInvestTool,
  mortgagepayoff: MortgagePayoffTool,
  hsa:           HSATool,
  brackets:      BracketHeadroomTool,
  hdhpppo:       HDHPvsPPOTool,
  assetlocation: AssetLocationTool,
  contriborder:  ContributionPriorityTool,
  megabackdoor:  MegaBackdoorTool,
  montecarlo:    MonteCarloTool,
  tlh:           TLHTool,
  equitycomp:    EquityCompTool,
  estate:        EstateTool,
  rothladder:    RothLadderTool,
  withdrawalseq: WithdrawalSequenceTool,
  rothwindow:    RothConversionWindowTool,
  rmd:           RMDProjectionTool,
  ssclaiming:    SSClaimingTool,
};

Object.assign(window, { calculators, ToolShell, StatCell });

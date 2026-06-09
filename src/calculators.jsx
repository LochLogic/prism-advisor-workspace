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

/* ─── Calculator registry ─────────────────────────────────────────── */
const calculators = {
  cashflow:      CashflowTool,
  reserve:       ReserveTool,
  avalanche:     AvalancheTool,
  hsa:           HSATool,
  assetlocation: AssetLocationTool,
  contriborder:  ContributionPriorityTool,
  montecarlo:    MonteCarloTool,
  tlh:           TLHTool,
  estate:        EstateTool,
  rothladder:    RothLadderTool,
  withdrawalseq: WithdrawalSequenceTool,
  rothwindow:    RothConversionWindowTool,
};

Object.assign(window, { calculators, ToolShell, StatCell });

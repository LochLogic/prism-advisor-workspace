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
  const { profile, totalExpenses, surplus, savingsRate } = useProfile();
  return (
    <ToolShell title="Household cash flow" hint="Sourced from your numbers">
      <div className="px-tool-grid">
        <StatCell label="Monthly take-home" value={fmt$(profile.income.monthlyTakehome)} />
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
  const monthsToPayoff = (() => {
    let bal = profile.debts.reduce((a, d) => a + Number(d.balance || 0), 0);
    let r = weightedApr / 100 / 12;
    if (bal <= 0 || monthly <= 0) return 0;
    for (let m = 1; m <= 480; m++) {
      bal = bal * (1 + r) - monthly;
      if (bal <= 0) return m;
    }
    return Infinity;
  })();
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
  const yearsCompounded = useMemoC(() => {
    let bal = profile.retirement.hsaBalance;
    const contrib = profile.retirement.hsaContrib;
    for (let y = 0; y < 25; y++) bal = bal * 1.07 + contrib;
    return bal;
  }, [profile.retirement.hsaBalance, profile.retirement.hsaContrib]);
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
  const { profile, retirementAssets, taxableBalance } = useProfile();
  const taxDeferred = (profile.retirement.iraBalance || 0) + (profile.retirement.fourohonekBalance || 0);
  const roth = 0;
  const taxFree = profile.retirement.hsaBalance + roth;
  const taxable = taxableBalance;

  // Target placement model — institutional rule of thumb
  const targets = [
    { label: 'Broad equity index (efficient)', taxable: 80, deferred: 10, free: 10 },
    { label: 'Corporate bonds / TIPS (inefficient)', taxable: 5, deferred: 90, free: 5 },
    { label: 'REIT / high-dividend (inefficient)', taxable: 5, deferred: 60, free: 35 },
    { label: 'International equity', taxable: 60, deferred: 25, free: 15 },
  ];

  return (
    <ToolShell title="Asset Location optimizer" advanced>
      <div className="px-tool-grid">
        <StatCell label="Taxable sleeve" value={fmt$(taxable, { short: true })} foot="Long-term gains rate" />
        <StatCell label="Tax-deferred" value={fmt$(taxDeferred, { short: true })} foot="Ordinary income at withdrawal" />
        <StatCell label="Tax-free (HSA + Roth)" value={fmt$(taxFree, { short: true })} foot="Zero tax on withdrawal" />
        <StatCell label="Projected tax alpha" value="0.40 – 0.85%" tone="good" foot="annualized · model est." />
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="px-eyebrow" style={{ marginBottom: 10 }}>Target asset → account mapping</div>
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
            {targets.map(t => (
              <tr key={t.label} style={{ cursor: 'default' }}>
                <td style={{ fontFamily: 'var(--serif)', fontSize: 13.5 }}>{t.label}</td>
                <td className="is-num px-mono">{t.taxable}%</td>
                <td className="is-num px-mono">{t.deferred}%</td>
                <td className="is-num px-mono">{t.free}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ToolShell>
  );
};

/* Monte Carlo — 1,000 deterministic-feeling scenarios using seeded RNG */
const MonteCarloTool = () => {
  const { profile, totalInvested, annualExpenses } = useProfile();
  const { activeClientId } = useView();
  const [yearsHorizon, setYears] = useStateC(Math.max(20, profile.goals.retireAt - profile.goals.age + 25));
  const [withdrawal, setWithdrawal] = useStateC(Math.round(annualExpenses / 1000) * 1000);

  const result = useMemoC(() => {
    const RUNS = 800;
    const meanReturn = 0.07;
    const sd = 0.16;
    let success = 0;
    let medianFinal = 0;
    const finals = [];
    // Box-Muller seeded — per-client seed so each client sees consistent but distinct results
    const baseSeed = activeClientId
      ? activeClientId.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      : 42;
    let seed = baseSeed;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (let r = 0; r < RUNS; r++) {
      let bal = totalInvested;
      let alive = true;
      for (let y = 0; y < yearsHorizon; y++) {
        const ret = meanReturn + gauss() * sd;
        bal = bal * (1 + ret) - withdrawal;
        if (bal <= 0) { alive = false; bal = 0; break; }
      }
      if (alive) success++;
      finals.push(bal);
    }
    finals.sort((a, b) => a - b);
    medianFinal = finals[Math.floor(finals.length / 2)];
    return { successPct: (success / RUNS) * 100, medianFinal, p10: finals[Math.floor(finals.length * 0.1)], p90: finals[Math.floor(finals.length * 0.9)] };
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

  const rows = useMemoC(() => {
    let remaining = tradBalance;
    const out = [];
    const year = new Date().getFullYear();
    for (let y = 0; y < 5; y++) {
      const convert = Math.min(annualConvert, remaining);
      const tax = convert * bracket / 100;
      remaining -= convert;
      remaining *= 1.06; // growth on remainder
      out.push({ year: year + y, convert, tax, available: year + y + 5, remaining });
    }
    return out;
  }, [tradBalance, annualConvert, bracket]);

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

  const result = useMemoC(() => {
    const realRet = 0.05;
    const draw = totalInvested * (withdrawalRate / 100);
    let bal = totalInvested;
    for (let y = 0; y < grossUp; y++) bal = bal * (1 + realRet) - draw;
    const estate = Math.max(0, bal);
    // 2026 federal estate tax exemption ~ $13.99M / individual (sunset 2026 ~ $7M post)
    const exempt = 13_990_000;
    const estateTax = Math.max(0, (estate - exempt)) * 0.40;
    const netToHeirs = estate - estateTax;
    let g2 = netToHeirs;
    for (let y = 0; y < g2Years; y++) g2 = g2 * (1 + realRet);
    return { estate, estateTax, netToHeirs, g2 };
  }, [totalInvested, grossUp, withdrawalRate, g2Years]);

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

/* ─── Calculator registry ─────────────────────────────────────────── */
const calculators = {
  cashflow:      CashflowTool,
  reserve:       ReserveTool,
  avalanche:     AvalancheTool,
  hsa:           HSATool,
  assetlocation: AssetLocationTool,
  montecarlo:    MonteCarloTool,
  estate:        EstateTool,
  rothladder:    RothLadderTool,
};

Object.assign(window, { calculators, ToolShell, StatCell });

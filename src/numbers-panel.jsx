// Prism — Numbers Panel drawer. Lets the client (or advisor on their behalf)
// edit the household ledger. Restyled for the institutional palette.

const NumbersDrawer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const { profile, update, totalExpenses, surplus, netWorth } = useProfile();

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const NumField = ({ label, path, value, prefix = '$', step = 100 }) => (
    <label className="px-field">
      <span className="px-field-label">{label}</span>
      <div className="px-input-affix">
        {prefix && <span className="px-affix">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => update(path, parseFloat(e.target.value) || 0)}
        />
      </div>
    </label>
  );

  return (
    <>
      <div className="px-drawer-backdrop" onClick={onClose} />
      <aside className="px-drawer" role="dialog" aria-label="Your numbers">
        <div className="px-drawer-head">
          <div>
            <div className="px-eyebrow">Household ledger</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, margin: '4px 0 0', color: 'var(--ink)' }}>
              Your numbers
            </h2>
          </div>
          <button className="px-icon-btn" onClick={onClose} aria-label="Close">
            <Icons.X size={15} />
          </button>
        </div>
        <div className="px-drawer-body">

          {/* Snapshot */}
          <div className="px-card" style={{ padding: 14, marginBottom: 22, background: 'var(--surface-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <div className="px-portstat-label">Net worth</div>
                <div className="px-portstat-value" style={{ fontSize: 18, marginTop: 2 }}>
                  {fmt$(netWorth, { short: true })}
                </div>
              </div>
              <div>
                <div className="px-portstat-label">Surplus / mo</div>
                <div className="px-portstat-value" style={{ fontSize: 18, marginTop: 2, color: surplus < 0 ? 'var(--brick)' : 'var(--forest)' }}>
                  {fmt$(surplus)}
                </div>
              </div>
              <div>
                <div className="px-portstat-label">Outflow / mo</div>
                <div className="px-portstat-value" style={{ fontSize: 18, marginTop: 2 }}>
                  {fmt$(totalExpenses)}
                </div>
              </div>
            </div>
          </div>

          {/* Income */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Income</div>
            <NumField label="Monthly take-home" path="income.monthlyTakehome" value={profile.income.monthlyTakehome} />
          </section>

          {/* Expenses */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Essential outflow</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Housing" path="expenses.housing" value={profile.expenses.housing} />
              <NumField label="Food" path="expenses.food" value={profile.expenses.food} />
              <NumField label="Transport" path="expenses.transport" value={profile.expenses.transport} />
              <NumField label="Utilities" path="expenses.utilities" value={profile.expenses.utilities} />
              <NumField label="Healthcare" path="expenses.healthcare" value={profile.expenses.healthcare} />
              <NumField label="Other" path="expenses.other" value={profile.expenses.other} />
            </div>
          </section>

          {/* Savings + reserve */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Cash reserve</div>
            <NumField label="Liquidity reserve" path="savings.emergency" value={profile.savings.emergency} />
          </section>

          {/* Retirement */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Retirement assets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="HSA balance" path="retirement.hsaBalance" value={profile.retirement.hsaBalance} step="500" />
              <NumField label="IRA balance" path="retirement.iraBalance" value={profile.retirement.iraBalance} step="500" />
              <NumField label="401(k) balance" path="retirement.fourohonekBalance" value={profile.retirement.fourohonekBalance} step="500" />
              <NumField label="HSA contrib / yr" path="retirement.hsaContrib" value={profile.retirement.hsaContrib} step="100" />
            </div>
          </section>

          {/* Taxable */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Taxable brokerage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Balance" path="taxable.balance" value={profile.taxable.balance} step="1000" />
              <NumField label="Monthly contribution" path="taxable.monthlyContrib" value={profile.taxable.monthlyContrib} />
            </div>
          </section>

          {/* Tax */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Tax profile</div>
            <NumField label="Marginal rate (%)" path="taxes.marginalRate" value={profile.taxes.marginalRate} prefix={null} step="1" />
          </section>

          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
            Changes save automatically and are visible to {advisor.name} in real time. Use the <b>Discuss with advisor</b> action on any task to flag questions.
          </div>
        </div>
      </aside>
    </>
  );
};

window.NumbersDrawer = NumbersDrawer;

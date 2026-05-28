// Prism — Numbers Panel drawer. Lets the client (or advisor on their behalf)
// edit the household ledger. Restyled for the institutional palette.

// NumField must be at module scope — defining it inside a component
// causes React to remount the input on every render, losing focus mid-edit.
const NumField = ({ label, path, value, prefix = '$', step = 100, onUpdate }) => (
  <label className="px-field">
    <span className="px-field-label">{label}</span>
    <div className="px-input-affix">
      {prefix && <span className="px-affix">{prefix}</span>}
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onUpdate(path, parseFloat(e.target.value) || 0)}
      />
    </div>
  </label>
);

const NumbersDrawer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const { profile, update, setProfile, totalExpenses, surplus, netWorth } = useProfile();

  const addDebt = () => setProfile(p => ({
    ...p,
    debts: [...p.debts, { id: `d${Date.now()}`, name: 'New debt', balance: 0, apr: 0, min: 0 }],
  }));
  const removeDebt = (id) => setProfile(p => ({ ...p, debts: p.debts.filter(d => d.id !== id) }));
  const updateDebt = (id, field, value) => setProfile(p => ({
    ...p,
    debts: p.debts.map(d => d.id === id ? { ...d, [field]: value } : d),
  }));

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
            <NumField label="Monthly take-home" path="income.monthlyTakehome" value={profile.income.monthlyTakehome}  onUpdate={update}/>
          </section>

          {/* Expenses */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Essential outflow</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Housing" path="expenses.housing" value={profile.expenses.housing}  onUpdate={update}/>
              <NumField label="Food" path="expenses.food" value={profile.expenses.food}  onUpdate={update}/>
              <NumField label="Transport" path="expenses.transport" value={profile.expenses.transport}  onUpdate={update}/>
              <NumField label="Utilities" path="expenses.utilities" value={profile.expenses.utilities}  onUpdate={update}/>
              <NumField label="Healthcare" path="expenses.healthcare" value={profile.expenses.healthcare}  onUpdate={update}/>
              <NumField label="Other" path="expenses.other" value={profile.expenses.other}  onUpdate={update}/>
            </div>
          </section>

          {/* Savings + reserve */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Cash reserve</div>
            <NumField label="Liquidity reserve" path="savings.emergency" value={profile.savings.emergency}  onUpdate={update}/>
          </section>

          {/* Liabilities */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Liabilities</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addDebt}>
                <Icons.Plus size={10} /> Add debt
              </button>
            </div>
            {profile.debts.length === 0 && (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                No liabilities recorded.
              </div>
            )}
            {profile.debts.map(d => (
              <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => updateDebt(d.id, 'name', e.target.value)}
                    style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }}
                    placeholder="Debt name"
                  />
                  <button onClick={() => removeDebt(d.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
                    title="Remove">
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <label className="px-field">
                    <span className="px-field-label">Balance</span>
                    <div className="px-input-affix">
                      <span className="px-affix">$</span>
                      <input type="number" value={d.balance} step="100"
                        onChange={(e) => updateDebt(d.id, 'balance', parseFloat(e.target.value) || 0)} />
                    </div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">APR</span>
                    <div className="px-input-affix">
                      <input type="number" value={d.apr} step="0.1"
                        onChange={(e) => updateDebt(d.id, 'apr', parseFloat(e.target.value) || 0)} />
                      <span className="px-affix px-affix-r">%</span>
                    </div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Min / mo</span>
                    <div className="px-input-affix">
                      <span className="px-affix">$</span>
                      <input type="number" value={d.min} step="10"
                        onChange={(e) => updateDebt(d.id, 'min', parseFloat(e.target.value) || 0)} />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Retirement */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Retirement assets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="HSA balance" path="retirement.hsaBalance" value={profile.retirement.hsaBalance} step="500"  onUpdate={update}/>
              <NumField label="IRA balance" path="retirement.iraBalance" value={profile.retirement.iraBalance} step="500"  onUpdate={update}/>
              <NumField label="401(k) balance" path="retirement.fourohonekBalance" value={profile.retirement.fourohonekBalance} step="500"  onUpdate={update}/>
              <NumField label="HSA contrib / yr" path="retirement.hsaContrib" value={profile.retirement.hsaContrib} step="100"  onUpdate={update}/>
            </div>
          </section>

          {/* Taxable */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Taxable brokerage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Balance" path="taxable.balance" value={profile.taxable.balance} step="1000"  onUpdate={update}/>
              <NumField label="Monthly contribution" path="taxable.monthlyContrib" value={profile.taxable.monthlyContrib}  onUpdate={update}/>
            </div>
          </section>

          {/* Tax */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Tax profile</div>
            <NumField label="Marginal rate (%)" path="taxes.marginalRate" value={profile.taxes.marginalRate} prefix={null} step="1"  onUpdate={update}/>
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

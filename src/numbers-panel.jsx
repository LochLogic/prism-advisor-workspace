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
  const { profile, update, setProfile, totalExpenses, surplus, netWorth,
          isOwner, homeEquity, mortgagePrincipalMonthly, mortgageInterestMonthly, escrowMonthly,
          propertiesEquity } = useProfile();

  const addDebt = () => setProfile(p => ({
    ...p,
    debts: [...p.debts, { id: `d${Date.now()}`, name: 'New debt', balance: 0, apr: 0, min: 0 }],
  }));
  const removeDebt = (id) => setProfile(p => ({ ...p, debts: p.debts.filter(d => d.id !== id) }));
  const updateDebt = (id, field, value) => setProfile(p => ({
    ...p,
    debts: p.debts.map(d => d.id === id ? { ...d, [field]: value } : d),
  }));

  const addProperty = () => setProfile(p => ({
    ...p,
    properties: [...(p.properties || []), { id: `p${Date.now()}`, label: 'New property', use: 'second', value: 0, mortgageBalance: 0, paymentMonthly: 0, rentalIncomeMonthly: 0 }],
  }));
  const removeProperty = (id) => setProfile(p => ({ ...p, properties: (p.properties || []).filter(x => x.id !== id) }));
  const updateProperty = (id, field, value) => setProfile(p => ({
    ...p,
    properties: (p.properties || []).map(x => x.id === id ? { ...x, [field]: value } : x),
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

          {/* Housing — rent vs. own */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Housing</div>
            <div className="px-seg" role="tablist" aria-label="Housing type" style={{ marginBottom: 10 }}>
              <button role="tab" aria-selected={!isOwner} className={`px-seg-btn ${!isOwner ? 'is-on' : ''}`}
                onClick={() => update('housing.type', 'rent')}>Rent</button>
              <button role="tab" aria-selected={isOwner} className={`px-seg-btn ${isOwner ? 'is-on' : ''}`}
                onClick={() => update('housing.type', 'own')}>Own — mortgage</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label={isOwner ? 'Total payment / mo' : 'Monthly rent'} path="expenses.housing" value={profile.expenses.housing} onUpdate={update}/>
              {isOwner && <>
                <NumField label="Home value" path="housing.homeValue" value={profile.housing.homeValue} step="5000" onUpdate={update}/>
                <NumField label="Mortgage balance" path="housing.mortgageBalance" value={profile.housing.mortgageBalance} step="5000" onUpdate={update}/>
                <NumField label="Mortgage rate (%)" path="housing.mortgageApr" value={profile.housing.mortgageApr} prefix={null} step="0.1" onUpdate={update}/>
                <NumField label="Taxes + ins / mo" path="housing.escrowMonthly" value={profile.housing.escrowMonthly} step="50" onUpdate={update}/>
              </>}
            </div>
            {isOwner && Number(profile.expenses.housing) > 0 && (() => {
              const pr = mortgagePrincipalMonthly, intr = mortgageInterestMonthly, esc = escrowMonthly;
              const tot = Math.max(1, pr + intr + esc);
              const pct = (n) => `${(n / tot) * 100}%`;
              return (
                <div style={{ marginTop: 12 }}>
                  <div className="px-split-bar">
                    <div className="px-split-seg px-split-principal" style={{ width: pct(pr) }} title={`Principal ${fmt$(pr)}`} />
                    <div className="px-split-seg px-split-interest" style={{ width: pct(intr) }} title={`Interest ${fmt$(intr)}`} />
                    {esc > 0 && <div className="px-split-seg px-split-escrow" style={{ width: pct(esc) }} title={`Taxes + insurance ${fmt$(esc)}`} />}
                  </div>
                  <div className="px-split-legend">
                    <span><i className="px-split-dot px-split-principal" />{fmt$(pr)} principal <em>· builds equity</em></span>
                    <span><i className="px-split-dot px-split-interest" />{fmt$(intr)} interest</span>
                    {esc > 0 && <span><i className="px-split-dot px-split-escrow" />{fmt$(esc)} taxes + ins.</span>}
                  </div>
                  <div className="px-split-equity">
                    <span>Home equity (value − mortgage)</span>
                    <strong style={{ color: homeEquity >= 0 ? 'var(--forest)' : 'var(--brick)' }}>{fmt$(homeEquity)}</strong>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '8px 0 0', lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
                    Only the non-principal portion is a true cost — principal is forced savings that builds equity.
                  </p>
                </div>
              );
            })()}
          </section>

          {/* Additional properties — second homes / rentals (equity → net worth) */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Additional properties</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addProperty}>
                <Icons.Plus size={10} /> Add property
              </button>
            </div>
            {(profile.properties || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Second homes or rentals — their equity counts toward net worth.
              </div>
            )}
            {(profile.properties || []).map(p => {
              const eq = Number(p.value || 0) - Number(p.mortgageBalance || 0);
              const isRental = p.use === 'rental';
              const net = (isRental ? Number(p.rentalIncomeMonthly || 0) : 0) - Number(p.paymentMonthly || 0);
              return (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updateProperty(p.id, 'label', e.target.value)}
                      style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }}
                      placeholder="Property name"
                    />
                    <button onClick={() => removeProperty(p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
                      title="Remove">
                      <Icons.X size={12} />
                    </button>
                  </div>
                  <div className="px-seg" role="tablist" aria-label="Property use" style={{ marginBottom: 10 }}>
                    <button role="tab" aria-selected={!isRental} className={`px-seg-btn ${!isRental ? 'is-on' : ''}`}
                      onClick={() => updateProperty(p.id, 'use', 'second')}>Second home</button>
                    <button role="tab" aria-selected={isRental} className={`px-seg-btn ${isRental ? 'is-on' : ''}`}
                      onClick={() => updateProperty(p.id, 'use', 'rental')}>Rental</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label className="px-field">
                      <span className="px-field-label">Market value</span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <input type="number" value={p.value} step="5000"
                          onChange={(e) => updateProperty(p.id, 'value', parseFloat(e.target.value) || 0)} /></div>
                    </label>
                    <label className="px-field">
                      <span className="px-field-label">Mortgage balance</span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <input type="number" value={p.mortgageBalance} step="5000"
                          onChange={(e) => updateProperty(p.id, 'mortgageBalance', parseFloat(e.target.value) || 0)} /></div>
                    </label>
                    <label className="px-field">
                      <span className="px-field-label">Payment / mo</span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <input type="number" value={p.paymentMonthly} step="50"
                          onChange={(e) => updateProperty(p.id, 'paymentMonthly', parseFloat(e.target.value) || 0)} /></div>
                    </label>
                    {isRental && (
                      <label className="px-field">
                        <span className="px-field-label">Rental income / mo</span>
                        <div className="px-input-affix"><span className="px-affix">$</span>
                          <input type="number" value={p.rentalIncomeMonthly} step="50"
                            onChange={(e) => updateProperty(p.id, 'rentalIncomeMonthly', parseFloat(e.target.value) || 0)} /></div>
                      </label>
                    )}
                  </div>
                  <div className="px-prop-foot">
                    <span>Equity <strong style={{ color: eq >= 0 ? 'var(--forest)' : 'var(--brick)' }}>{fmt$(eq)}</strong></span>
                    {isRental && <span>Net / mo <strong style={{ color: net >= 0 ? 'var(--forest)' : 'var(--brick)' }}>{fmt$(net)}</strong></span>}
                  </div>
                </div>
              );
            })}
            {(profile.properties || []).length > 0 && (
              <div className="px-split-equity" style={{ marginTop: 4 }}>
                <span>Real estate equity · added to net worth</span>
                <strong style={{ color: propertiesEquity >= 0 ? 'var(--forest)' : 'var(--brick)' }}>{fmt$(propertiesEquity)}</strong>
              </div>
            )}
          </section>

          {/* Expenses */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Essential outflow</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Food" path="expenses.food" value={profile.expenses.food}  onUpdate={update}/>
              <NumField label="Transport" path="expenses.transport" value={profile.expenses.transport}  onUpdate={update}/>
              <NumField label="Utilities" path="expenses.utilities" value={profile.expenses.utilities}  onUpdate={update}/>
              <NumField label="Healthcare" path="expenses.healthcare" value={profile.expenses.healthcare}  onUpdate={update}/>
              <NumField label="Other" path="expenses.other" value={profile.expenses.other}  onUpdate={update}/>
            </div>
            <div className="px-outflow-total">
              <span>Total monthly outflow <em>· incl. housing</em></span>
              <strong>{fmt$(totalExpenses)}</strong>
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

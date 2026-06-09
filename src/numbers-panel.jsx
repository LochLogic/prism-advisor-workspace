// Prism — Numbers Panel drawer. Lets the client (or advisor on their behalf)
// edit the household ledger. Restyled for the institutional palette.

// Date-of-birth picker: Month / Day / Year dropdowns instead of a native <input
// type="date">, so picking a birth year is one click from a descending list rather
// than scrolling the native calendar back decades. Stores/parses YYYY-MM-DD.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DobSelects = ({ value, onChange }) => {
  const thisYear = new Date().getFullYear();
  // Hold partial selections locally. The stored value is only a *complete*
  // YYYY-MM-DD, so a brand-new member starts blank. Without local state, picking
  // Month first would emit '' (date incomplete) and the controlled <select> would
  // snap back to "Month" — making it impossible to ever set a new member's DOB.
  // Local state lets Month → Day → Year accumulate; we commit upstream only once
  // all three are chosen. (Seeded members already had full DOBs, which is why the
  // bug only bit newly-added people.)
  const parse = (v) => {
    const [yy = '', mm = '', dd = ''] = (v || '').split('-');
    return { y: yy, m: mm ? String(parseInt(mm, 10)) : '', d: dd ? String(parseInt(dd, 10)) : '' };
  };
  const [sel, setSel] = React.useState(() => parse(value));
  // Re-sync when the upstream value changes (e.g. switching members/clients).
  React.useEffect(() => { setSel(parse(value)); }, [value]);

  const years = []; for (let y = thisYear; y >= thisYear - 100; y--) years.push(y);
  const daysInMonth = (y, m) => (y && m) ? new Date(Number(y), Number(m), 0).getDate() : 31;
  const days = []; for (let d = 1; d <= daysInMonth(sel.y || thisYear, sel.m || 1); d++) days.push(d);

  const pick = (next) => {
    setSel(next);
    if (next.y && next.m && next.d) {
      const clampedDay = Math.min(Number(next.d), daysInMonth(next.y, next.m));
      onChange(`${next.y}-${String(next.m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <select className="px-select" aria-label="Birth month" value={sel.m} onChange={(e) => pick({ ...sel, m: e.target.value })} style={{ flex: '2 1 90px' }}>
        <option value="">Month</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select className="px-select" aria-label="Birth day" value={sel.d} onChange={(e) => pick({ ...sel, d: e.target.value })} style={{ flex: '1 1 56px' }}>
        <option value="">Day</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="px-select" aria-label="Birth year" value={sel.y} onChange={(e) => pick({ ...sel, y: e.target.value })} style={{ flex: '1 1 70px' }}>
        <option value="">Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
};

// Inline help affordance — an info icon that reveals an upscale tooltip on hover
// or keyboard focus. Sprinkle a `hint=` onto any field where a word of context
// helps. The styled `px-hint-bubble` is the visible tooltip; `aria-label` covers
// assistive tech. We deliberately omit the native `title` — leaving it on stacks
// the browser's default tooltip on top of our bubble (double tooltip on hover).
const FieldHint = ({ text }) => (
  <span className="px-hint" tabIndex={0} aria-label={text}>
    <Icons.Info size={12} />
    <span className="px-hint-bubble" role="tooltip">{text}</span>
  </span>
);

// US states + DC, for the residence dropdown. Value is the 2-letter code, which
// matches what `taxes.state` already stored as free text (back-compatible).
const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];

// NumField must be at module scope — defining it inside a component
// causes React to remount the input on every render, losing focus mid-edit.
const NumField = ({ label, path, value, prefix = '$', step = 100, onUpdate, hint }) => (
  <label className="px-field">
    <span className="px-field-label">{label}{hint && <FieldHint text={hint} />}</span>
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
  const { profile, update, setProfile, undoEdit, undoDepth, totalExpenses, surplus, netWorth,
          isOwner, homeEquity, mortgagePrincipalMonthly, mortgageInterestMonthly, escrowMonthly,
          propertiesEquity, primaryMember, planningAge, grossMonthlyIncome, effectiveTakehome } = useProfile();
  const hasIncomeSources = (profile.income.sources || []).length > 0;

  // Undo safety net. The drawer remounts each time it opens (the `if (!isOpen)`
  // guard short-circuits before any hook), so these refs capture the state as of
  // *this* opening: the snapshot to revert to, and the undo depth to measure
  // edits made since. `dirtyCount` drives the "revert everything" affordance.
  const openBaseline = React.useRef(profile);
  const openDepth    = React.useRef(undoDepth);
  const dirtyCount   = Math.max(0, undoDepth - openDepth.current);
  const revertAll    = () => { if (dirtyCount > 0) setProfile(openBaseline.current); };

  // ── Household members ──
  const addMember = () => setProfile(p => {
    const hasPrimary = (p.members || []).some(m => m.role === 'primary');
    return { ...p, members: [...(p.members || []),
      { id: `m${Date.now()}`, name: '', role: hasPrimary ? 'spouse' : 'primary', dateOfBirth: '' }] };
  });
  const removeMember = (id) => setProfile(p => ({ ...p, members: (p.members || []).filter(m => m.id !== id) }));
  const updateMember = (id, field, value) => setProfile(p => ({
    ...p, members: (p.members || []).map(m => m.id === id ? { ...m, [field]: value } : m),
  }));

  // ── Income sources (optional composition) ──
  const srcs = (p) => (p.income && Array.isArray(p.income.sources)) ? p.income.sources : [];
  const addSource = () => setProfile(p => ({
    ...p, income: { ...p.income, sources: [...srcs(p), { id: `s${Date.now()}`, label: '', type: 'salary', monthlyGross: 0 }] },
  }));
  const removeSource = (id) => setProfile(p => ({ ...p, income: { ...p.income, sources: srcs(p).filter(s => s.id !== id) } }));
  const updateSource = (id, field, value) => setProfile(p => ({
    ...p, income: { ...p.income, sources: srcs(p).map(s => s.id === id ? { ...s, [field]: value } : s) },
  }));

  // ── Guaranteed income streams (SS / pension / annuity) ──
  const addStream = () => setProfile(p => ({
    ...p, incomeStreams: [...(p.incomeStreams || []),
      { id: `is${Date.now()}`, label: '', type: 'social_security', monthlyAmount: 0, startAge: 67, colaPct: 2.5 }] }));
  const removeStream = (id) => setProfile(p => ({ ...p, incomeStreams: (p.incomeStreams || []).filter(s => s.id !== id) }));
  const updateStream = (id, field, value) => setProfile(p => ({
    ...p, incomeStreams: (p.incomeStreams || []).map(s => s.id === id ? { ...s, [field]: value } : s),
  }));

  // ── Funding goals (education / home / custom) ──
  const gitems = (p) => (p.goals && Array.isArray(p.goals.items)) ? p.goals.items : [];
  const addGoal = () => setProfile(p => ({ ...p, goals: { ...p.goals, items: [...gitems(p),
    { id: `g${Date.now()}`, label: '', type: 'custom', targetAmount: 0, targetDate: '', currentFunding: 0, monthlyContribution: 0 }] } }));
  const removeGoal = (id) => setProfile(p => ({ ...p, goals: { ...p.goals, items: gitems(p).filter(g => g.id !== id) } }));
  const updateGoal = (id, field, value) => setProfile(p => ({ ...p, goals: { ...p.goals, items: gitems(p).map(g => g.id === id ? { ...g, [field]: value } : g) } }));

  // Planning age is now derived from members[].dateOfBirth in store.jsx — no setter needed.

  // ── Insurance (life / disability / LTC) ──
  const ins = (p) => Array.isArray(p.insurance) ? p.insurance : [];
  const addInsurance = () => setProfile(p => ({ ...p, insurance: [...ins(p),
    { id: `ins${Date.now()}`, type: 'life', carrier: '', owner: '', coverageAmount: 0, premiumMonthly: 0 }] }));
  const removeInsurance = (id) => setProfile(p => ({ ...p, insurance: ins(p).filter(i => i.id !== id) }));
  const updateInsurance = (id, field, value) => setProfile(p => ({
    ...p, insurance: ins(p).map(i => i.id === id ? { ...i, [field]: value } : i) }));

  // ── Estate checklist (will / trust / POA / directive / beneficiaries) ──
  const updateEstate = (key, field, value) => setProfile(p => ({
    ...p, estate: { ...(p.estate || {}), [key]: { ...((p.estate || {})[key] || {}), [field]: value } } }));

  // ── Custom outflow boxes (editable-title expense lines) ──
  const cexp = (p) => Array.isArray(p.expenses?.custom) ? p.expenses.custom : [];
  const addCustomExpense = () => setProfile(p => ({ ...p, expenses: { ...p.expenses,
    custom: [...cexp(p), { id: `ce${Date.now()}`, label: '', amount: 0 }] } }));
  const removeCustomExpense = (id) => setProfile(p => ({ ...p, expenses: { ...p.expenses,
    custom: cexp(p).filter(c => c.id !== id) } }));
  const updateCustomExpense = (id, field, value) => setProfile(p => ({ ...p, expenses: { ...p.expenses,
    custom: cexp(p).map(c => c.id === id ? { ...c, [field]: value } : c) } }));

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={undoEdit} disabled={undoDepth === 0}
              title="Undo the last change" aria-label="Undo the last change"
              style={{ padding: '4px 9px', opacity: undoDepth === 0 ? 0.4 : 1, cursor: undoDepth === 0 ? 'default' : 'pointer' }}>
              <Icons.Undo size={13} /> Undo
            </button>
            <button className="px-icon-btn" onClick={onClose} aria-label="Close">
              <Icons.X size={15} />
            </button>
          </div>
        </div>
        {dirtyCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '8px 16px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)',
            fontSize: 11.5, color: 'var(--ink-mute)' }}>
            <span><b style={{ color: 'var(--ink)' }}>{dirtyCount}</b> change{dirtyCount === 1 ? '' : 's'} this session — nothing is locked in.</span>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={revertAll} style={{ padding: '3px 9px', whiteSpace: 'nowrap' }}>
              <Icons.Refresh size={11} /> Revert all
            </button>
          </div>
        )}
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

          {/* Household members */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Household</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addMember}>
                <Icons.Plus size={10} /> Add person
              </button>
            </div>
            {(profile.members || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Add the people in this household — their ages anchor the retirement and legacy projections.
              </div>
            )}
            {(profile.members || []).map(m => (
              <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                  <label className="px-field" style={{ flex: 1 }}>
                    <span className="px-field-label">Name</span>
                    <div className="px-input-affix">
                      <input type="text" value={m.name} placeholder="Full name"
                        onChange={(e) => updateMember(m.id, 'name', e.target.value)} />
                    </div>
                  </label>
                  <button onClick={() => removeMember(m.id)} aria-label="Remove person" title="Remove"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 0 9px', lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'end' }}>
                  <label className="px-field">
                    <span className="px-field-label">Role</span>
                    <select className="px-select" value={m.role} onChange={(e) => updateMember(m.id, 'role', e.target.value)}>
                      <option value="primary">Primary</option>
                      <option value="spouse">Spouse / partner</option>
                      <option value="dependent">Dependent</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Date of birth</span>
                    <DobSelects value={m.dateOfBirth || ''} onChange={(v) => updateMember(m.id, 'dateOfBirth', v)} />
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Income */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Income</div>
            {hasIncomeSources ? (
              <label className="px-field">
                <span className="px-field-label">Monthly take-home</span>
                <div className="px-input-affix" style={{ background: 'var(--bg)' }}>
                  <span className="px-affix">$</span>
                  <input type="text" readOnly value={(effectiveTakehome || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} style={{ cursor: 'default', color: 'var(--ink-mute)' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2, display: 'block' }}>auto-summed from the income sources below</span>
              </label>
            ) : (
              <NumField label="Monthly take-home" path="income.monthlyTakehome" value={profile.income.monthlyTakehome}  onUpdate={update}
                hint="Income after taxes and payroll deductions — what actually lands in your account each month, not gross pay." />
            )}

            {/* Income sources — itemized lines that auto-sum into monthly take-home */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>Income sources (optional — these sum to take-home)</span>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addSource}>
                <Icons.Plus size={10} /> Add source
              </button>
            </div>
            {(profile.income.sources || []).map(s => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 24px', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                <label className="px-field">
                  <span className="px-field-label">Label</span>
                  <div className="px-input-affix">
                    <input type="text" value={s.label} placeholder="e.g. Salary"
                      onChange={(e) => updateSource(s.id, 'label', e.target.value)} />
                  </div>
                </label>
                <label className="px-field">
                  <span className="px-field-label">Type</span>
                  <select className="px-select" value={s.type} onChange={(e) => updateSource(s.id, 'type', e.target.value)}>
                    <option value="salary">Salary / wages</option>
                    <option value="rsu">RSU / equity</option>
                    <option value="bonus">Bonus</option>
                    <option value="self">Self-employment</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="px-field">
                  <span className="px-field-label">Amount / mo</span>
                  <div className="px-input-affix"><span className="px-affix">$</span>
                    <input type="number" value={s.monthlyGross} step="500"
                      onChange={(e) => updateSource(s.id, 'monthlyGross', parseFloat(e.target.value) || 0)} /></div>
                </label>
                <button onClick={() => removeSource(s.id)} aria-label="Remove source"
                  style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 0 9px', lineHeight: 1 }}>
                  <Icons.X size={12} />
                </button>
              </div>
            ))}
            {grossMonthlyIncome > 0 && (
              <div className="px-split-equity" style={{ marginTop: 4 }}>
                <span>Total income · {fmt$(grossMonthlyIncome)}/mo</span>
                <strong>{fmt$(grossMonthlyIncome * 12, { short: true })}/yr</strong>
              </div>
            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Essential outflow</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addCustomExpense}>
                <Icons.Plus size={10} /> Add box
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Food" path="expenses.food" value={profile.expenses.food}  onUpdate={update}/>
              <NumField label="Transport" path="expenses.transport" value={profile.expenses.transport}  onUpdate={update}/>
              <NumField label="Utilities" path="expenses.utilities" value={profile.expenses.utilities}  onUpdate={update}/>
              <NumField label="Healthcare" path="expenses.healthcare" value={profile.expenses.healthcare}  onUpdate={update}/>
              <NumField label="Other" path="expenses.other" value={profile.expenses.other}  onUpdate={update}/>
            </div>
            {/* Custom outflow boxes — editable title + amount */}
            {(profile.expenses.custom || []).map(c => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 24px', gap: 8, alignItems: 'end', marginTop: 10 }}>
                <label className="px-field">
                  <span className="px-field-label">Category</span>
                  <div className="px-input-affix">
                    <input type="text" value={c.label} placeholder="e.g. Childcare, tuition…"
                      onChange={(e) => updateCustomExpense(c.id, 'label', e.target.value)} />
                  </div>
                </label>
                <label className="px-field">
                  <span className="px-field-label">Amount / mo</span>
                  <div className="px-input-affix"><span className="px-affix">$</span>
                    <input type="number" value={c.amount} step="50"
                      onChange={(e) => updateCustomExpense(c.id, 'amount', parseFloat(e.target.value) || 0)} /></div>
                </label>
                <button onClick={() => removeCustomExpense(c.id)} aria-label="Remove box"
                  style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 0 9px', lineHeight: 1 }}>
                  <Icons.X size={12} />
                </button>
              </div>
            ))}
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
            <div className="px-field-label" style={{ marginTop: 14, marginBottom: 8 }}>Contributions &amp; employer match</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="401(k) contributed / yr" path="retirement.fourohonekContributed" value={profile.retirement.fourohonekContributed} step="500" onUpdate={update}/>
              <NumField label="401(k) limit / yr" path="retirement.fourohonekLimit" value={profile.retirement.fourohonekLimit} step="500" onUpdate={update}/>
              <NumField label="IRA contributed / yr" path="retirement.iraContributed" value={profile.retirement.iraContributed} step="500" onUpdate={update}/>
              <NumField label="IRA limit / yr" path="retirement.iraLimit" value={profile.retirement.iraLimit} step="500" onUpdate={update}/>
              <NumField label="Employer match (%)" path="retirement.employerMatchPct" value={profile.retirement.employerMatchPct} prefix={null} step="0.5" onUpdate={update}/>
            </div>
          </section>

          {/* Guaranteed retirement income — SS / pension / annuity */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Guaranteed income</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addStream}>
                <Icons.Plus size={10} /> Add stream
              </button>
            </div>
            {(profile.incomeStreams || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Social Security, pensions, or annuities — these reduce how much the portfolio must cover in retirement.
              </div>
            )}
            {(profile.incomeStreams || []).map(s => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input type="text" value={s.label} placeholder="e.g. Social Security — Robert"
                    onChange={(e) => updateStream(s.id, 'label', e.target.value)}
                    style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }} />
                  <button onClick={() => removeStream(s.id)} title="Remove" aria-label="Remove stream"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label className="px-field">
                    <span className="px-field-label">Type</span>
                    <select className="px-select" value={s.type} onChange={(e) => updateStream(s.id, 'type', e.target.value)}>
                      <option value="social_security">Social Security</option>
                      <option value="pension">Pension</option>
                      <option value="annuity">Annuity</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Amount / mo</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={s.monthlyAmount} step="100"
                        onChange={(e) => updateStream(s.id, 'monthlyAmount', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Starts at age</span>
                    <div className="px-input-affix">
                      <input type="number" value={s.startAge} step="1" min="0"
                        onChange={(e) => updateStream(s.id, 'startAge', parseInt(e.target.value) || 0)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Annual COLA (%)</span>
                    <div className="px-input-affix">
                      <input type="number" value={s.colaPct} step="0.1"
                        onChange={(e) => updateStream(s.id, 'colaPct', parseFloat(e.target.value) || 0)} />
                      <span className="px-affix px-affix-r">%</span></div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Taxable */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Taxable brokerage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Balance" path="taxable.balance" value={profile.taxable.balance} step="1000"  onUpdate={update}/>
              <NumField label="Monthly contribution" path="taxable.monthlyContrib" value={profile.taxable.monthlyContrib}  onUpdate={update}/>
            </div>
          </section>

          {/* Insurance — protection capture (life / disability / LTC) */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Protection</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addInsurance}>
                <Icons.Plus size={10} /> Add policy
              </button>
            </div>
            {(profile.insurance || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Life, disability, or long-term care coverage — capture what's in place so the plan reflects how the household is protected.
              </div>
            )}
            {(profile.insurance || []).map(i => (
              <div key={i.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input type="text" value={i.carrier} placeholder="Carrier"
                    onChange={(e) => updateInsurance(i.id, 'carrier', e.target.value)}
                    style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }} />
                  <button onClick={() => removeInsurance(i.id)} title="Remove" aria-label="Remove policy"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label className="px-field">
                    <span className="px-field-label">Type</span>
                    <select className="px-select" value={i.type} onChange={(e) => updateInsurance(i.id, 'type', e.target.value)}>
                      <option value="life">Life</option>
                      <option value="disability">Disability</option>
                      <option value="ltc">Long-term care</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Owner</span>
                    <div className="px-input-affix">
                      <input type="text" value={i.owner} placeholder="Who's covered"
                        onChange={(e) => updateInsurance(i.id, 'owner', e.target.value)} />
                    </div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Coverage</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={i.coverageAmount} step="10000"
                        onChange={(e) => updateInsurance(i.id, 'coverageAmount', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Premium / mo</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={i.premiumMonthly} step="10"
                        onChange={(e) => updateInsurance(i.id, 'premiumMonthly', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Estate readiness checklist */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Estate readiness</div>
            {[
              { key: 'will', label: 'Will' },
              { key: 'trust', label: 'Revocable trust' },
              { key: 'poa', label: 'Power of attorney' },
              { key: 'healthcareDirective', label: 'Healthcare directive' },
              { key: 'beneficiaries', label: 'Beneficiary review' },
            ].map(({ key, label }) => {
              const item = (profile.estate || {})[key] || { status: 'none', lastReviewed: '' };
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 140px', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                  <label className="px-field">
                    <span className="px-field-label">Status</span>
                    <select className="px-select" value={item.status || 'none'} onChange={(e) => updateEstate(key, 'status', e.target.value)}>
                      <option value="none">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Last reviewed</span>
                    <input type="date" className="px-input" value={item.lastReviewed || ''} style={{ width: '100%' }}
                      onChange={(e) => updateEstate(key, 'lastReviewed', e.target.value)} />
                  </label>
                </div>
              );
            })}
          </section>

          {/* Planning & tax */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Planning &amp; tax</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="px-field">
                <span className="px-field-label">Planning age{primaryMember ? ` · ${primaryMember.name || 'primary'}` : ''}</span>
                <div className="px-input-affix" style={{ background: 'var(--bg)', cursor: 'default' }}>
                  <input type="text" readOnly value={planningAge > 0 ? `${planningAge} yrs` : '—'} style={{ cursor: 'default', color: 'var(--ink-mute)' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2, display: 'block' }}>from date of birth above</span>
              </label>
              <NumField label="Target retirement age" path="goals.retireAt" value={profile.goals.retireAt} prefix={null} step="1" onUpdate={update}/>
              <label className="px-field">
                <span className="px-field-label">Filing status</span>
                <select className="px-select" value={profile.taxes.filingStatus || 'mfj'}
                  onChange={(e) => update('taxes.filingStatus', e.target.value)}>
                  <option value="single">Single</option>
                  <option value="mfj">Married filing jointly</option>
                  <option value="mfs">Married filing separately</option>
                  <option value="hoh">Head of household</option>
                </select>
              </label>
              <label className="px-field">
                <span className="px-field-label">State of residence<FieldHint text="Used to estimate state income tax in your plan. Pick None / N/A if you split residency." /></span>
                <select className="px-select" value={profile.taxes.state || ''}
                  onChange={(e) => update('taxes.state', e.target.value)}>
                  <option value="">Select a state…</option>
                  {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              <NumField label="Marginal rate (%)" path="taxes.marginalRate" value={profile.taxes.marginalRate} prefix={null} step="1"  onUpdate={update}
                hint="Your combined top tax bracket — the rate on your next dollar of income. Drives tax-advantaged savings estimates." />
            </div>
          </section>

          {/* Funding goals — education / home / custom, tracked to a target date */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow">Goals</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addGoal}>
                <Icons.Plus size={10} /> Add goal
              </button>
            </div>
            {gitems(profile).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                A home, education, or any milestone with a target amount and date — we'll track whether it's on pace.
              </div>
            )}
            {gitems(profile).map(g => (
              <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input type="text" value={g.label} placeholder="e.g. College fund"
                    onChange={(e) => updateGoal(g.id, 'label', e.target.value)}
                    style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }} />
                  <button onClick={() => removeGoal(g.id)} title="Remove" aria-label="Remove goal"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label className="px-field">
                    <span className="px-field-label">Type</span>
                    <select className="px-select" value={g.type} onChange={(e) => updateGoal(g.id, 'type', e.target.value)}>
                      <option value="education">Education</option>
                      <option value="home">Home / property</option>
                      <option value="retirement">Retirement</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Target date</span>
                    <div className="px-input-affix">
                      <input type="date" value={g.targetDate || ''}
                        onChange={(e) => updateGoal(g.id, 'targetDate', e.target.value)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Target amount</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={g.targetAmount} step="1000"
                        onChange={(e) => updateGoal(g.id, 'targetAmount', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Saved so far</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={g.currentFunding} step="1000"
                        onChange={(e) => updateGoal(g.id, 'currentFunding', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                  <label className="px-field" style={{ gridColumn: '1 / -1' }}>
                    <span className="px-field-label">Monthly contribution</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <input type="number" value={g.monthlyContribution} step="50"
                        onChange={(e) => updateGoal(g.id, 'monthlyContribution', parseFloat(e.target.value) || 0)} /></div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
            Changes save automatically and are visible to {advisor.name} in real time — but nothing is locked in: use <b>Undo</b> (top right) to step back, or <b>Revert all</b> to undo everything since you opened this. Use the <b>Discuss with advisor</b> action on any task to flag questions.
          </div>
        </div>
      </aside>
    </>
  );
};

window.NumbersDrawer = NumbersDrawer;

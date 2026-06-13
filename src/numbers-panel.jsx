// Prism - Numbers Panel drawer. Lets the client (or advisor on their behalf)
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
  // snap back to "Month" - making it impossible to ever set a new member's DOB.
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

// Inline help affordance - an info icon that reveals an upscale tooltip on hover
// or keyboard focus. Sprinkle a `hint=` onto any field where a word of context
// helps. The styled `px-hint-bubble` is the visible tooltip; `aria-label` covers
// assistive tech. We deliberately omit the native `title` - leaving it on stacks
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

// NumInput (the draft-holding numeric input that never traps a leading zero)
// moved to components.jsx so the phase tools share it - the rationale lives there.

/* ─── KYC / identity capture (round 24) ────────────────────────────────
   The option lists are the single source of truth for both the selects here
   and the label lookups in the paperwork prefill engine (src/paperwork.jsx
   reads window.KYC_OPTIONS - numbers-panel loads first in both bundles).
   Values are stable codes; labels are display-only. */
const KYC_OPTIONS = {
  marital: [
    ['single', 'Single'], ['married', 'Married'], ['domestic_partner', 'Domestic partner'],
    ['divorced', 'Divorced'], ['widowed', 'Widowed'],
  ],
  citizenship: [
    ['us', 'U.S. citizen'], ['permanent_resident', 'U.S. permanent resident'],
    ['non_resident', 'Non-resident alien'],
  ],
  employment: [
    ['employed', 'Employed'], ['self_employed', 'Self-employed'], ['retired', 'Retired'],
    ['student', 'Student'], ['homemaker', 'Homemaker'], ['not_employed', 'Not employed'],
  ],
  govId: [
    ['drivers_license', "Driver's license"], ['passport', 'Passport'],
    ['state_id', 'State ID'], ['military_id', 'Military ID'],
  ],
};
const kycLabel = (group, value) =>
  ((KYC_OPTIONS[group] || []).find(([v]) => v === value) || [])[1] || '';

// Plain text input in the drawer's field style (NumField's non-numeric sibling).
// Module scope for the same reason as NumField: an inline definition remounts
// the input on every render and drops focus mid-edit.
const TextField = ({ label, value, placeholder, onChange, hint, inputMode, maxLength }) => (
  <label className="px-field">
    <span className="px-field-label">{label}{hint && <FieldHint text={hint} />}</span>
    <div className="px-input-affix">
      <input type="text" value={value || ''} placeholder={placeholder || ''} inputMode={inputMode}
        maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </div>
  </label>
);

// Street/city/state/zip group - used for the household address and a member's
// own address when they live elsewhere. `onField(field, value)` writes back.
const AddressFields = ({ value, onField }) => {
  const a = value || {};
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
        <TextField label="Street address" value={a.street1} placeholder="Street and number" onChange={(v) => onField('street1', v)} />
        <TextField label="Apt / unit" value={a.street2} onChange={(v) => onField('street2', v)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 130px 90px', gap: 8 }}>
        <TextField label="City" value={a.city} onChange={(v) => onField('city', v)} />
        <label className="px-field">
          <span className="px-field-label">State</span>
          <select className="px-select" value={a.state || ''} onChange={(e) => onField('state', e.target.value)}>
            <option value="">Select</option>
            {US_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <TextField label="ZIP" value={a.zip} inputMode="numeric" maxLength={10} onChange={(v) => onField('zip', v)} />
      </div>
    </>
  );
};

// How many identity blanks a member still has - mirrors the per-member checks
// in kycCompleteness (store.jsx) so the summary badge and the household-level
// completeness can never disagree.
const identityGaps = (m) => {
  const id = memberIdentity(m);
  const employed = ['employed', 'self_employed'].includes(id.employmentStatus);
  return [
    (id.firstName && id.lastName) || (m.name || '').trim(),
    m.dateOfBirth,
    id.phone && id.email,
    id.maritalStatus,
    id.citizenship,
    id.employmentStatus && (!employed || (id.employer && id.occupation)),
    id.govIdType && id.govIdLast4,
    !id.differentAddress || (id.address.street1 && id.address.city && id.address.state && id.address.zip),
  ].filter(ok => !ok).length;
};

/* ─── Government ID (SSN) per household member - round 23 ──────────────
   The key to custodian account paperwork (Schwab/Fidelity prefill track).
   SECURITY RULES (do not relax):
   · The full value NEVER enters the profile JSON / profile_versions / prints /
     exports / AI contexts - it exists only in the transient input draft here
     and AES-GCM-encrypted in client_identifiers (migration 044), written and
     read solely through the `client-identifiers` edge function.
   · The UI shows last4 ("•••-••-1234"). Reveal is ADVISOR-only and every
     reveal is audit-logged server-side - it exists for paperwork moments.
   · Demo households get an explainer, never storage. Live clients see a
     "pending setup" hint until migration + IDENTIFIER_ENC_KEY + deploy land. */
const IdentifierField = ({ clientId, memberId, record, live, configured, isAdvisor, onChanged }) => {
  const { showToast } = useView();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [revealed, setRevealed] = React.useState(null);   // transient - auto-hides
  React.useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(null), 15000);
    return () => clearTimeout(t);
  }, [revealed]);

  const ROW = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12 };
  const hint = 'Stored encrypted, outside your plan data. Used to prefill custodian account paperwork. Only the last four digits display; a full reveal is advisor-only and recorded in the audit log.';

  if (!live) {
    return (
      <div style={{ ...ROW, color: 'var(--ink-faint)' }}>
        <Icons.Lock size={11} />
        <span>SSN <FieldHint text={hint} /> · secure storage is available once this household is a live client</span>
      </div>
    );
  }
  if (!configured) {
    // Live client but the encrypted store isn't provisioned yet - advisors see
    // the setup pointer; clients see nothing (no half-built field to puzzle over).
    return isAdvisor ? (
      <div style={{ ...ROW, color: 'var(--ink-faint)' }}>
        <Icons.Lock size={11} />
        <span>SSN · secure storage pending setup (migration 044 + IDENTIFIER_ENC_KEY + function deploy)</span>
      </div>
    ) : null;
  }

  const save = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    const r = await window.db.setIdentifier(clientId, memberId, draft);
    setBusy(false);
    if (r?.ok) { setDraft(''); setEditing(false); showToast(`SSN stored - ending ${r.last4}`); onChanged(); }
    else showToast(r?.error === 'not_configured' ? 'Secure storage is not provisioned yet' : (r?.error || 'Could not store - try again'));
  };
  const reveal = async () => {
    if (busy) return;
    setBusy(true);
    const r = await window.db.revealIdentifier(clientId, memberId);
    setBusy(false);
    if (r?.value) setRevealed(r.value.replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3'));
    else showToast(r?.error || 'Could not reveal');
  };
  const clear = async () => {
    if (busy) return;
    setBusy(true);
    const r = await window.db.clearIdentifier(clientId, memberId);
    setBusy(false);
    if (r?.ok) { setRevealed(null); showToast('SSN removed'); onChanged(); }
    else showToast(r?.error || 'Could not remove');
  };

  if (editing || !record) {
    return (
      <div style={ROW}>
        <span style={{ color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>SSN <FieldHint text={hint} /></span>
        <input type="text" inputMode="numeric" autoComplete="off" placeholder="###-##-####"
          value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: '1px solid var(--border-2)', borderRadius: 5,
                   background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 12 }} />
        <button className="px-btn px-btn-sm px-btn-primary" onClick={save} disabled={busy || !draft.trim()} style={{ padding: '3px 10px' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {record && (
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => { setEditing(false); setDraft(''); }} style={{ padding: '3px 8px' }}>
            Cancel
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={ROW}>
      <span style={{ color: 'var(--ink-mute)' }}>SSN <FieldHint text={hint} /></span>
      <span className="px-mono" style={{ color: 'var(--ink)' }}>{revealed || `•••-••-${record.last4}`}</span>
      {isAdvisor && !revealed && (
        <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={reveal}
          disabled={busy} title="Show the full number for paperwork - this reveal is recorded in the audit log">
          Reveal
        </button>
      )}
      <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={() => setEditing(true)}>
        Update
      </button>
      {isAdvisor && (
        <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', color: 'var(--ink-faint)' }}
          onClick={clear} title="Remove from secure storage">
          Remove
        </button>
      )}
    </div>
  );
};

// NumField must be at module scope - defining it inside a component
// causes React to remount the input on every render, losing focus mid-edit.
const NumField = ({ label, path, value, prefix = '$', step = 100, onUpdate, hint }) => (
  <label className="px-field">
    <span className="px-field-label">{label}{hint && <FieldHint text={hint} />}</span>
    <div className="px-input-affix">
      {prefix && <span className="px-affix">{prefix}</span>}
      <NumInput value={value} step={step} onCommit={(v) => onUpdate(path, v)} />
    </div>
  </label>
);

const NumbersDrawer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const { profile, update, setProfile, undoEdit, undoDepth, totalExpenses, surplus, netWorth,
          isOwner, homeEquity, mortgageBalance, mortgagePrincipalMonthly, mortgageInterestMonthly,
          escrowMonthly, extraPrincipalMonthly,
          propertiesEquity, primaryMember, planningAge, grossMonthlyIncome, effectiveTakehome,
          ledgerGate, pendingChange, withdrawPendingChange, saveNow } = useProfile();
  const { activeClientId } = useView();
  const { role } = useAuth();
  const hasIncomeSources = (profile.income.sources || []).length > 0;

  // Encrypted per-member government IDs (round 23). `identifiers` is null for
  // demo households AND while the secure store is unprovisioned - the field
  // component renders the right explainer for each. Loaded once per client.
  const isAdvisorViewer = role === 'advisor' || role === 'admin';
  const isLiveClient = !!window.db?.isUUID(activeClientId);
  const [identifiers, setIdentifiers] = React.useState(null);
  const refreshIdentifiers = React.useCallback(() => {
    if (!isLiveClient) { setIdentifiers(null); return; }
    window.db.getIdentifiers(activeClientId).then(setIdentifiers);
  }, [activeClientId, isLiveClient]);
  React.useEffect(() => { refreshIdentifiers(); }, [refreshIdentifiers]);
  // Contributions section entry period - display-only; storage stays annual.
  const [contribFreq, setContribFreq] = React.useState('yr');

  // ── Section jump nav + open-with-focus (round 25) ──────────────────
  // The drawer is ~14 sections deep; the chip bar under the header jumps to
  // any of them. Labels are collected from the rendered `.is-section`
  // eyebrows (first text node only - some embed a FieldHint), so adding a
  // section to the drawer adds it to the nav with no second list to maintain.
  const { numbersFocus } = useView();
  const bodyRef = React.useRef(null);
  const [navSections, setNavSections] = React.useState([]);
  const sectionEls = () => [...(bodyRef.current?.querySelectorAll('.px-eyebrow.is-section') || [])];
  const sectionLabel = (el) =>
    (el.childNodes[0]?.nodeType === 3 ? el.childNodes[0].textContent : el.textContent).trim();
  React.useEffect(() => { setNavSections(sectionEls().map(sectionLabel)); }, []);
  // Scroll the drawer body directly. Smooth programmatic scrolling silently
  // no-ops in some environments (reduced-motion / embedded Chromium), so a
  // short verify-step falls back to an instant jump - landing is guaranteed.
  const scrollBodyTo = (el, block) => {
    const body = bodyRef.current;
    if (!el || !body) return;
    const offset = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const top = block === 'center' ? offset - body.clientHeight / 2 + el.clientHeight / 2 : offset - 8;
    const target = Math.max(0, Math.round(top));
    const before = body.scrollTop;
    body.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(() => {
      if (body.scrollTop === before && Math.abs(target - before) > 4) body.scrollTop = target;
    }, 220);
  };
  // Foldable sections (round 26). Each .is-section eyebrow toggles its parent
  // <section> closed - same zero-maintenance DOM collection as the jump nav,
  // so new sections fold for free. Folds persist per client, with two guards:
  // a first open (nothing stored) shows everything, and a section with nothing
  // filled in ignores its stored fold so blanks always greet you expanded.
  const foldKey = `px-numfolds:${activeClientId}`;
  const [folded, setFolded] = React.useState(() => new Set());
  const toggleFold = (label) => setFolded(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    try { localStorage.setItem(foldKey, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  });
  // "Has anything been entered here yet?" - any non-empty, non-zero input.
  // Folded content stays in the DOM (display:none), so this works either way.
  const sectionHasData = (sec) => [...sec.querySelectorAll('input')].some(i => {
    if (i.type === 'checkbox' || i.type === 'radio') return i.checked;
    const v = (i.value || '').trim();
    return v !== '' && v !== '0';
  });
  React.useEffect(() => {
    if (numbersFocus) return;   // open-with-focus wants the full ledger visible
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(foldKey) || '[]'); } catch { /* ignore */ }
    if (!Array.isArray(stored)) stored = [];
    const keep = stored.filter(label => {
      const sec = sectionEls().find(e => sectionLabel(e) === label)?.closest('section');
      return sec && sectionHasData(sec);
    });
    if (keep.length > 0) setFolded(new Set(keep));
  }, []);
  // Sync fold state + toggle affordances onto the rendered eyebrows.
  React.useLayoutEffect(() => {
    sectionEls().forEach(el => {
      const sec = el.closest('section');
      if (!sec) return;
      const label = sectionLabel(el);
      sec.classList.toggle('is-folded', folded.has(label));
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-expanded', String(!folded.has(label)));
      el.onclick = (e) => { if (!e.target.closest('.px-hint')) toggleFold(label); };
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFold(label); }
      };
    });
  });
  // Unfolding the target doesn't move its own header, so jump straight away.
  const jumpTo = (label) => {
    if (folded.has(label)) toggleFold(label);
    scrollBodyTo(sectionEls().find(e => sectionLabel(e) === label), 'start');
  };
  // Open-with-focus: 'identity' (paperwork click-through / portal nudge) expands
  // every Identity & paperwork block and scrolls to the first remaining gap.
  // The drawer remounts per open, so a mount effect reads the focus once.
  React.useEffect(() => {
    if (numbersFocus !== 'identity') return;
    const t = setTimeout(() => {
      bodyRef.current?.querySelectorAll('details[data-identity]').forEach(d => { d.open = true; });
      scrollBodyTo(bodyRef.current?.querySelector('[data-kyc-gap]'), 'center');
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // Estate-category vault documents, for the "link a document" picker below. A
  // linked doc is what marks an estate item "Complete & shared" (solid green,
  // openable in the client portal). Demo clients use the seeded estate docs.
  const [estateDocs, setEstateDocs] = React.useState([]);
  React.useEffect(() => {
    if (window.db?.isUUID(activeClientId)) {
      window.db.getDocuments(activeClientId).then(rows =>
        setEstateDocs((rows || []).filter(d => d.category === 'estate')));
    } else {
      setEstateDocs((window.demoDocuments ? window.demoDocuments() : []).filter(d => d.category === 'estate'));
    }
  }, [activeClientId]);

  // Accounts on file, for the cash-reserve source picker below. The reserve can
  // link to any number of accounts; their summed balances are the source of
  // truth - stored savings.emergency is re-synced from fresh account data on
  // each open. The round-19 single savings.emergencyAccountId folds in as a
  // one-entry list until the first edit.
  const [acctRows, setAcctRows] = React.useState([]);
  React.useEffect(() => {
    if (window.db?.isUUID(activeClientId)) {
      window.db.getAccounts(activeClientId).then(rows => setAcctRows(rows || []));
    } else {
      setAcctRows((window.accountsData || {})[activeClientId] || []);
    }
  }, [activeClientId]);
  const reserveIds = Array.isArray(profile.savings.reserveAccountIds)
    ? profile.savings.reserveAccountIds
    : (profile.savings.emergencyAccountId ? [profile.savings.emergencyAccountId] : []);
  const acctBal = (id) => Number((acctRows.find(a => a.id === id) || {}).balance) || 0;
  const setReserveIds = (ids) => setProfile(p => ({ ...p, savings: { ...p.savings,
    reserveAccountIds: ids, emergencyAccountId: undefined,
    emergency: ids.length > 0 ? ids.reduce((s, id) => s + acctBal(id), 0) : Number(p.savings.emergency || 0) } }));
  React.useEffect(() => {
    if (reserveIds.length === 0 || acctRows.length === 0) return;
    const linked = reserveIds.filter(id => acctRows.some(a => a.id === id));   // drop deleted accounts
    const total = linked.reduce((s, id) => s + acctBal(id), 0);
    const stale = linked.length !== reserveIds.length
      || !Array.isArray(profile.savings.reserveAccountIds)
      || (linked.length > 0 && total !== Number(profile.savings.emergency || 0));
    if (stale) setReserveIds(linked);
  }, [reserveIds.join('|'), acctRows]);
  const addReserveAccount = () => {
    const next = acctRows.find(a => !reserveIds.includes(a.id));
    if (next) setReserveIds([...reserveIds, next.id]);
  };

  // Undo safety net. The drawer remounts each time it opens (the `if (!isOpen)`
  // guard short-circuits before any hook), so these refs capture the state as of
  // *this* opening: the snapshot to revert to, and the undo depth to measure
  // edits made since. `dirtyCount` drives the "revert everything" affordance.
  const openBaseline = React.useRef(profile);
  const openDepth    = React.useRef(undoDepth);
  const dirtyCount   = Math.max(0, undoDepth - openDepth.current);
  const revertAll    = () => { if (dirtyCount > 0) setProfile(openBaseline.current); };

  // Explicit Save: flushes the persist immediately (through the firm's
  // advisor-approval gate when it's on - the same switch firm admins toggle),
  // re-baselines the session so the strip flips to a confirmation, and Revert
  // all now means "back to what I just saved".
  const gatedClient = ledgerGate && window.__pxAuthActor?.role === 'client';
  const [justSaved, setJustSaved] = React.useState(null);   // null | 'saved' | 'review'
  const savedTimer  = React.useRef(null);
  React.useEffect(() => () => clearTimeout(savedTimer.current), []);
  const handleSave = () => {
    const result = saveNow();
    openBaseline.current = profile;
    openDepth.current    = undoDepth;
    setJustSaved(result);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(null), 5000);
  };

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
  // Identity & paperwork (round 24) - nested writes into member.identity.
  const updateIdentity = (id, field, value) => setProfile(p => ({
    ...p, members: (p.members || []).map(m => m.id === id
      ? { ...m, identity: { ...(m.identity || {}), [field]: value } } : m),
  }));
  const updateIdentityAddr = (id, field, value) => setProfile(p => ({
    ...p, members: (p.members || []).map(m => m.id === id
      ? { ...m, identity: { ...(m.identity || {}), address: { ...((m.identity || {}).address || {}), [field]: value } } } : m),
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

  // ── Equity compensation (concentrated single-stock positions) ──
  const eqc = (p) => Array.isArray(p.equityComp) ? p.equityComp : [];
  const addEquity = () => setProfile(p => ({ ...p, equityComp: [...eqc(p),
    { id: `eq${Date.now()}`, ticker: '', type: 'rsu', positionValue: 0, costBasis: 0, unvestedValue: 0 }] }));
  const removeEquity = (id) => setProfile(p => ({ ...p, equityComp: eqc(p).filter(e => e.id !== id) }));
  const updateEquity = (id, field, value) => setProfile(p => ({
    ...p, equityComp: eqc(p).map(e => e.id === id ? { ...e, [field]: value } : e) }));

  // ── Funding goals (education / home / custom) ──
  const gitems = (p) => (p.goals && Array.isArray(p.goals.items)) ? p.goals.items : [];
  const addGoal = () => setProfile(p => ({ ...p, goals: { ...p.goals, items: [...gitems(p),
    { id: `g${Date.now()}`, label: '', type: 'custom', targetAmount: 0, targetDate: '', currentFunding: 0, monthlyContribution: 0 }] } }));
  const removeGoal = (id) => setProfile(p => ({ ...p, goals: { ...p.goals, items: gitems(p).filter(g => g.id !== id) } }));
  const updateGoal = (id, field, value) => setProfile(p => ({ ...p, goals: { ...p.goals, items: gitems(p).map(g => g.id === id ? { ...g, [field]: value } : g) } }));

  // Planning age is now derived from members[].dateOfBirth in store.jsx - no setter needed.

  // ── Insurance (life / disability / LTC) ──
  const ins = (p) => Array.isArray(p.insurance) ? p.insurance : [];
  const addInsurance = () => setProfile(p => ({ ...p, insurance: [...ins(p),
    { id: `ins${Date.now()}`, type: 'life', carrier: '', owner: '', coverageAmount: 0, premiumMonthly: 0 }] }));
  const removeInsurance = (id) => setProfile(p => ({ ...p, insurance: ins(p).filter(i => i.id !== id) }));
  const updateInsurance = (id, field, value) => setProfile(p => ({
    ...p, insurance: ins(p).map(i => i.id === id ? { ...i, [field]: value } : i) }));

  // ── W-2s - one per earner/job (primary, spouse, second job) ──
  // Stored as taxes.w2s[]; the legacy single taxes.w2 (round 6) is surfaced as
  // the first entry until the list is first edited, so old profiles carry over.
  const w2s = (p) => {
    if (Array.isArray(p.taxes?.w2s)) return p.taxes.w2s;
    const legacy = p.taxes?.w2;
    return ((Number(legacy?.box1) || 0) > 0 || (Number(legacy?.box2) || 0) > 0)
      ? [{ id: 'w2-1', label: '', box1: Number(legacy.box1) || 0, box2: Number(legacy.box2) || 0 }]
      : [];
  };
  const setW2List = (arr) => update('taxes.w2s', arr);
  const addW2 = (seed = {}) => setW2List([...w2s(profile),
    { id: `w2${Date.now()}`, label: '', box1: 0, box2: 0, ...seed }]);
  const removeW2 = (id) => setW2List(w2s(profile).filter(w => w.id !== id));
  const updateW2 = (id, field, v) => setW2List(w2s(profile).map(w => w.id === id ? { ...w, [field]: v } : w));

  // AI W-2 import: read the uploaded image/PDF in the browser, send it to the
  // ai-assist edge function (advisor JWT; the Gemini key stays server-side),
  // and add a W-2 entry from the extracted boxes. Advisor-side only - the
  // edge function rejects client JWTs.
  const { showToast } = useView() || {};
  const [w2Importing, setW2Importing] = React.useState(false);
  const w2FileRef = React.useRef(null);
  const canAiImportW2 = ['advisor', 'admin'].includes(window.__pxAuthActor?.role);
  const importW2File = async (file) => {
    if (!file || w2Importing) return;
    if (file.size > 4 * 1024 * 1024) { showToast?.('That file is over 4 MB - try a smaller scan'); return; }
    setW2Importing(true);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const text = await window.db.aiAssist('w2_extract', {}, { data: b64, mimeType: file.type || 'application/pdf' });
      const parsed = JSON.parse(String(text || '').replace(/```json|```/g, '').trim());
      if (!parsed || !((Number(parsed.box1) || 0) > 0)) throw new Error('no W-2 boxes found');
      addW2({ label: parsed.employer || file.name, box1: Number(parsed.box1) || 0, box2: Number(parsed.box2) || 0 });
      showToast?.('W-2 imported - double-check the boxes against the form');
    } catch {
      showToast?.("Couldn't read that W-2 - enter the boxes manually");
    } finally {
      setW2Importing(false);
      if (w2FileRef.current) w2FileRef.current.value = '';
    }
  };

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
      <aside className="px-drawer is-wide" role="dialog" aria-label="Your numbers">
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
        {/* Section jump nav (round 25) - the drawer outgrew blind scrolling */}
        {navSections.length > 0 && (
          <div className="px-drawer-nav" role="navigation" aria-label="Jump to section">
            {navSections.map(s => (
              <button key={s} type="button" onClick={() => jumpTo(s)}>{s}</button>
            ))}
          </div>
        )}
        {/* Advisor-approval gate (clients only, per-firm opt-in). Informs without
            discouraging: editing stays fully open; the strip just explains where
            the numbers go and reflects the advisor's last decision. */}
        {ledgerGate && window.__pxAuthActor?.role === 'client' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11.5,
            background: pendingChange?.status === 'rejected' ? 'var(--gold-soft, var(--bg-elev))' : 'var(--bg-elev)',
            color: 'var(--ink-mute)' }}>
            {pendingChange?.status === 'pending' ? (
              <>
                <span>
                  <Icons.Info size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                  Your updates are with your advisor to review - keep editing anytime; they'll see the latest version.
                </span>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={withdrawPendingChange}
                  style={{ padding: '3px 9px', whiteSpace: 'nowrap' }} title="Withdraw the updates awaiting review">
                  Withdraw
                </button>
              </>
            ) : pendingChange?.status === 'rejected' ? (
              <span>
                Your advisor returned these updates{pendingChange.review_note ? <> - “{pendingChange.review_note}”</> : ''}. Adjust and save again whenever you're ready.
              </span>
            ) : pendingChange?.status === 'approved' ? (
              <span style={{ color: 'var(--forest)' }}>
                <Icons.Check size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                Your advisor confirmed your latest updates - your plan reflects them now.
              </span>
            ) : (
              <span>Updates you save here go to your advisor to confirm before they update your plan.</span>
            )}
          </div>
        )}
        {(dirtyCount > 0 || justSaved) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '8px 16px', background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)',
            fontSize: 11.5, color: 'var(--ink-mute)' }}>
            {dirtyCount > 0 ? (
              <>
                <span><b style={{ color: 'var(--ink)' }}>{dirtyCount}</b> change{dirtyCount === 1 ? '' : 's'} this session - nothing is locked in.</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button className="px-btn px-btn-sm px-btn-primary" onClick={handleSave}
                    style={{ padding: '3px 11px', whiteSpace: 'nowrap' }}
                    title={gatedClient ? 'Save and send to your advisor to confirm' : 'Save these changes now'}>
                    <Icons.Check size={11} /> {gatedClient ? 'Save for review' : 'Save'}
                  </button>
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={revertAll} style={{ padding: '3px 9px', whiteSpace: 'nowrap' }}>
                    <Icons.Refresh size={11} /> Revert all
                  </button>
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--forest)' }}>
                <Icons.Check size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                {justSaved === 'review'
                  ? 'Saved - sent to your advisor to confirm.'
                  : 'Saved - your plan is up to date.'}
              </span>
            )}
          </div>
        )}
        <div className="px-drawer-body" ref={bodyRef}>

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
              <div className="px-eyebrow is-section">Household</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addMember}>
                <Icons.Plus size={10} /> Add person
              </button>
            </div>
            {(profile.members || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Add the people in this household - their ages anchor the retirement and legacy projections.
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
                <IdentifierField clientId={activeClientId} memberId={m.id}
                  record={(identifiers || []).find(r => r.member_id === m.id && r.kind === 'ssn')}
                  live={isLiveClient} configured={identifiers !== null}
                  isAdvisor={isAdvisorViewer} onChanged={refreshIdentifiers} />

                {/* Identity & paperwork (round 24) - the KYC fields custodian
                    account-opening forms ask for. Collapsed by default; the
                    badge counts what is still blank so an advisor can scan. */}
                {(() => {
                  const id = memberIdentity(m);
                  const upd = (f, v) => updateIdentity(m.id, f, v);
                  const gaps = m.role !== 'dependent' ? identityGaps(m) : 0;
                  const nameParts = (m.name || '').trim().split(/\s+/).filter(Boolean);
                  const working = ['employed', 'self_employed'].includes(id.employmentStatus);
                  return (
                    <details data-identity="" {...(gaps > 0 ? { 'data-kyc-gap': '' } : {})}
                      style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--ink-mute)' }}>
                        Identity &amp; paperwork
                        <FieldHint text="What custodian account applications ask for. Filling it in here means new-account paperwork arrives prefilled, with nothing to chase at signing time." />
                        {gaps > 0 && <span style={{ color: 'var(--gold)', fontWeight: 600 }}> · {gaps} to capture</span>}
                      </summary>
                      <div style={{ paddingTop: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <TextField label="First name" value={id.firstName} placeholder={nameParts[0] || ''} onChange={(v) => upd('firstName', v)} />
                          <TextField label="Middle" value={id.middleName} onChange={(v) => upd('middleName', v)} />
                          <TextField label="Last name" value={id.lastName} placeholder={nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''} onChange={(v) => upd('lastName', v)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <TextField label="Email" value={id.email} placeholder="name@example.com" onChange={(v) => upd('email', v)} />
                          <TextField label="Phone" value={id.phone} placeholder="(555) 555-5555" onChange={(v) => upd('phone', v)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <label className="px-field">
                            <span className="px-field-label">Marital status</span>
                            <select className="px-select" value={id.maritalStatus} onChange={(e) => upd('maritalStatus', e.target.value)}>
                              <option value="">Select</option>
                              {KYC_OPTIONS.marital.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          <label className="px-field">
                            <span className="px-field-label">Citizenship</span>
                            <select className="px-select" value={id.citizenship} onChange={(e) => upd('citizenship', e.target.value)}>
                              <option value="">Select</option>
                              {KYC_OPTIONS.citizenship.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                        </div>
                        {id.citizenship && id.citizenship !== 'us' && (
                          <div style={{ marginBottom: 8 }}>
                            <TextField label="Country of citizenship" value={id.citizenshipCountry} onChange={(v) => upd('citizenshipCountry', v)} />
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: working ? '1fr 1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                          <label className="px-field">
                            <span className="px-field-label">Employment</span>
                            <select className="px-select" value={id.employmentStatus} onChange={(e) => upd('employmentStatus', e.target.value)}>
                              <option value="">Select</option>
                              {KYC_OPTIONS.employment.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          {working && <TextField label={id.employmentStatus === 'self_employed' ? 'Business name' : 'Employer'} value={id.employer} onChange={(v) => upd('employer', v)} />}
                          {working && <TextField label="Occupation" value={id.occupation} onChange={(v) => upd('occupation', v)} />}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <label className="px-field">
                            <span className="px-field-label">Government ID</span>
                            <select className="px-select" value={id.govIdType} onChange={(e) => upd('govIdType', e.target.value)}>
                              <option value="">Select</option>
                              {KYC_OPTIONS.govId.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                          <TextField label="ID · last 4" value={id.govIdLast4} inputMode="numeric" maxLength={4}
                            hint="Only the last four digits are stored, as a readiness check. The full ID number is keyed at signing or completed by the client inside the e-sign envelope."
                            onChange={(v) => upd('govIdLast4', v.replace(/\D/g, ''))} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-mute)', cursor: 'pointer', marginBottom: id.differentAddress ? 8 : 0 }}>
                          <input type="checkbox" checked={!!id.differentAddress} onChange={(e) => upd('differentAddress', e.target.checked)} />
                          Lives at a different address than the household
                        </label>
                        {id.differentAddress && (
                          <AddressFields value={id.address} onField={(f, v) => updateIdentityAddr(m.id, f, v)} />
                        )}
                      </div>
                    </details>
                  );
                })()}
              </div>
            ))}

            {/* Household address + trusted contact (round 24) - shared by every
                member unless they set their own above. The trusted contact is
                the FINRA Rule 4512 person custodians ask about on applications. */}
            {(profile.members || []).length > 0 && (() => {
              const a = (profile.contact || {}).address || {};
              const tc = (profile.contact || {}).trustedContact || {};
              const hhGap = !(a.street1 && a.city && a.state && a.zip) || !(tc.name && (tc.phone || tc.email));
              return (
              <div {...(hhGap ? { 'data-kyc-gap': '' } : {})}
                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-mute)', marginBottom: 8 }}>
                  Residential address
                  <FieldHint text="The household's legal address. It prefills custodian account paperwork; a member who lives elsewhere can set their own address under Identity & paperwork." />
                </div>
                <AddressFields value={(profile.contact || {}).address} onField={(f, v) => update(`contact.address.${f}`, v)} />
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-mute)', margin: '14px 0 8px' }}>
                  Trusted contact
                  <FieldHint text="Someone your custodian may reach if they cannot contact you or suspect financial exploitation (FINRA Rule 4512). Asked for on most account applications; they get no access to the account." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                  <TextField label="Name" value={(profile.contact || {}).trustedContact?.name} onChange={(v) => update('contact.trustedContact.name', v)} />
                  <TextField label="Relationship" value={(profile.contact || {}).trustedContact?.relationship} placeholder="e.g. Son" onChange={(v) => update('contact.trustedContact.relationship', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <TextField label="Phone" value={(profile.contact || {}).trustedContact?.phone} onChange={(v) => update('contact.trustedContact.phone', v)} />
                  <TextField label="Email" value={(profile.contact || {}).trustedContact?.email} onChange={(v) => update('contact.trustedContact.email', v)} />
                </div>
              </div>
              );
            })()}
          </section>

          {/* Income */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Income</div>
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
                hint="Income after taxes and payroll deductions - what actually lands in your account each month, not gross pay." />
            )}

            {/* Income sources - itemized lines that auto-sum into monthly take-home */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>Income sources (optional - these sum to take-home)</span>
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
                    <NumInput value={s.monthlyGross} step="500"
                      onCommit={(v) => updateSource(s.id, 'monthlyGross', v)} /></div>
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

          {/* Housing - rent vs. own */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Housing</div>
            <div className="px-seg" role="tablist" aria-label="Housing type" style={{ marginBottom: 10 }}>
              <button role="tab" aria-selected={!isOwner} className={`px-seg-btn ${!isOwner ? 'is-on' : ''}`}
                onClick={() => update('housing.type', 'rent')}>Rent</button>
              <button role="tab" aria-selected={isOwner} className={`px-seg-btn ${isOwner ? 'is-on' : ''}`}
                onClick={() => update('housing.type', 'own')}>Own - mortgage</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label={isOwner ? 'Total payment / mo' : 'Monthly rent'} path="expenses.housing" value={profile.expenses.housing} onUpdate={update}
                hint={isOwner ? 'The full monthly mortgage payment, including taxes & insurance if escrowed.' : 'The monthly rent payment - the guideline is to keep housing near 30% of take-home.'}/>
              {isOwner && <>
                <NumField label="Home value" path="housing.homeValue" value={profile.housing.homeValue} step="5000" onUpdate={update}
                  hint="Current market value - drives the home-equity portion of net worth."/>
                <NumField label="Mortgage balance" path="housing.mortgageBalance" value={profile.housing.mortgageBalance} step="5000" onUpdate={update}
                  hint="What's still owed on the loan."/>
                <NumField label="Mortgage rate (%)" path="housing.mortgageApr" value={profile.housing.mortgageApr} prefix={null} step="0.1" onUpdate={update}
                  hint="The loan's interest rate - drives the principal/interest split below and the payoff-accelerator tool."/>
                <NumField label="Taxes + ins / mo" path="housing.escrowMonthly" value={profile.housing.escrowMonthly} step="50" onUpdate={update}
                  hint="The escrow portion of the payment (property tax + homeowners insurance). Leave 0 if not escrowed."/>
                <NumField label="Loan term (yrs)" path="housing.termYears" value={profile.housing.termYears} prefix={null} step="5" onUpdate={update}
                  hint="Original mortgage term - 30 or 15 for most loans. Optional, but with the start year it anchors the scheduled payoff date and the payoff-accelerator tool." />
                <NumField label="Year loan started" path="housing.startYear" value={profile.housing.startYear} prefix={null} step="1" onUpdate={update}
                  hint="The year the mortgage (or latest refinance) originated. Optional - used with the term to show where you are in the amortization schedule." />
                <NumField label="Extra principal / mo" path="housing.extraPrincipal" value={profile.housing.extraPrincipal} step="50" onUpdate={update}
                  hint="Recurring extra principal paid on top of the regular payment. Optional - pulls the payoff date forward and seeds the payoff-accelerator tool." />
              </>}
            </div>
            {/* Housing-cost ratio coaching (FinFire donor) - outflow vs take-home,
                against the ~30% guideline. Renters and owners alike. */}
            {Number(profile.expenses.housing) > 0 && Number(profile.income?.monthlyTakehome) > 0 && (() => {
              const ratio = (Number(profile.expenses.housing) / Number(profile.income.monthlyTakehome)) * 100;
              const tone = ratio <= 30 ? 'var(--forest)' : ratio <= 40 ? 'var(--gold)' : 'var(--brick)';
              const verdict = ratio <= 30 ? 'On target' : ratio <= 40 ? 'A bit high' : 'Stretched';
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: 'var(--ink-mute)', marginBottom: 5 }}>
                    <span>Housing is <strong style={{ color: 'var(--ink)' }}>{Math.round(ratio)}%</strong> of take-home pay</span>
                    <span style={{ fontWeight: 600, color: tone }}>{verdict}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'var(--bg-elev)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, ratio)}%`, background: tone, borderRadius: 3, transition: 'width .3s' }} />
                    <span title="30% guideline" style={{ position: 'absolute', left: '30%', top: -2, bottom: -2, width: 2, background: 'var(--border-2)', borderRadius: 1 }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>Guideline: keep housing near or under ~30% of take-home pay.</div>
                </div>
              );
            })()}
            {/* Underwater-payment guard: total payment minus escrow doesn't cover the
                monthly interest, so the split shows $0 principal and the loan never
                amortizes. Almost always a data-entry mismatch, not a real situation. */}
            {isOwner && mortgageBalance > 0 && Number(profile.expenses.housing) > 0
              && mortgageInterestMonthly > 0 && mortgagePrincipalMonthly <= 0 && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 11.5, lineHeight: 1.5,
                background: 'var(--gold-soft)', border: '1px solid var(--gold)', color: 'var(--ink)' }}>
                After taxes + insurance, {fmt$(Math.max(0, Number(profile.expenses.housing) - escrowMonthly))}/mo
                is left for principal &amp; interest - less than the {fmt$(mortgageInterestMonthly)}/mo interest
                alone, so the loan never pays down at these numbers. Usually the total payment was entered
                without the escrow portion, or taxes + insurance are counted twice. Worth a second look.
              </div>
            )}
            {isOwner && Number(profile.housing.termYears) > 0 && Number(profile.housing.startYear) > 1900 && (() => {
              const payoffYear = Number(profile.housing.startYear) + Number(profile.housing.termYears);
              const thisYear = new Date().getFullYear();
              const yearsLeft = Math.max(0, payoffYear - thisYear);
              const yearsIn = Math.max(0, Number(profile.housing.termYears) - yearsLeft);
              // Recurring extra principal pulls the payoff forward: re-amortize the
              // current balance at payment + extra and compare against the schedule.
              const accel = (extraPrincipalMonthly > 0 && mortgageBalance > 0)
                ? PrismCalc.mortgagePayoff({
                    balance: mortgageBalance, aprPct: Number(profile.housing.mortgageApr) || 0,
                    paymentMonthly: Math.max(0, Number(profile.expenses.housing) - escrowMonthly),
                    extraMonthly: extraPrincipalMonthly,
                  })
                : null;
              const accelYear = (accel && accel.amortizes && isFinite(accel.accel.months))
                ? thisYear + Math.ceil(accel.accel.months / 12) : null;
              return (
                <>
                  <div className="px-split-equity" style={{ marginTop: 8 }}>
                    <span>Scheduled payoff · year {yearsIn} of {profile.housing.termYears}</span>
                    <strong>{payoffYear}{yearsLeft > 0 ? ` · ${yearsLeft} yrs left` : ' · done'}</strong>
                  </div>
                  {accelYear != null && accelYear < payoffYear && (
                    <div className="px-split-equity" style={{ marginTop: 4 }}>
                      <span>With {fmt$(extraPrincipalMonthly)}/mo extra principal</span>
                      <strong style={{ color: 'var(--forest)' }}>~{accelYear} · {payoffYear - accelYear} yrs sooner</strong>
                    </div>
                  )}
                </>
              );
            })()}
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
                    Only the non-principal portion is a true cost - principal is forced savings that builds equity.
                  </p>
                </div>
              );
            })()}
          </section>

          {/* Additional properties - second homes / rentals (equity → net worth) */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Additional properties</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addProperty}>
                <Icons.Plus size={10} /> Add property
              </button>
            </div>
            {(profile.properties || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Second homes or rentals - their equity counts toward net worth.
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
                        <NumInput value={p.value} step="5000"
                          onCommit={(v) => updateProperty(p.id, 'value', v)} /></div>
                    </label>
                    <label className="px-field">
                      <span className="px-field-label">Mortgage balance</span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <NumInput value={p.mortgageBalance} step="5000"
                          onCommit={(v) => updateProperty(p.id, 'mortgageBalance', v)} /></div>
                    </label>
                    <label className="px-field">
                      <span className="px-field-label">Payment / mo</span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <NumInput value={p.paymentMonthly} step="50"
                          onCommit={(v) => updateProperty(p.id, 'paymentMonthly', v)} /></div>
                    </label>
                    {isRental && (
                      <label className="px-field">
                        <span className="px-field-label">Rental income / mo</span>
                        <div className="px-input-affix"><span className="px-affix">$</span>
                          <NumInput value={p.rentalIncomeMonthly} step="50"
                            onCommit={(v) => updateProperty(p.id, 'rentalIncomeMonthly', v)} /></div>
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
              <div className="px-eyebrow is-section">Essential outflow</div>
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
            {/* Custom outflow boxes - editable title + amount */}
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
                    <NumInput value={c.amount} step="50"
                      onCommit={(v) => updateCustomExpense(c.id, 'amount', v)} /></div>
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
            {/* Essentials-ratio coaching, stacked on housing: the grey segment is
                take-home already spent on housing, the colored segment is the rest
                of the essentials starting where housing ends - so the open track is
                what's genuinely unspent. Verdict against the 50/30/20 guideline
                (all essentials, housing included, near or under ~50%). */}
            {totalExpenses > 0 && effectiveTakehome > 0 && (() => {
              const housingPct = (Math.min(Number(profile.expenses.housing) || 0, totalExpenses) / effectiveTakehome) * 100;
              const ratio = (totalExpenses / effectiveTakehome) * 100;   // housing + the rest
              const otherPct = Math.max(0, ratio - housingPct);
              const unspent = Math.max(0, 100 - ratio);
              const tone = ratio <= 50 ? 'var(--forest)' : ratio <= 65 ? 'var(--gold)' : 'var(--brick)';
              const verdict = ratio <= 50 ? 'On target' : ratio <= 65 ? 'A bit high' : 'Stretched';
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: 'var(--ink-mute)', marginBottom: 5 }}>
                    <span>Housing + essentials use <strong style={{ color: 'var(--ink)' }}>{Math.round(ratio)}%</strong> of take-home · <strong style={{ color: 'var(--ink)' }}>{Math.round(unspent)}%</strong> unspent</span>
                    <span style={{ fontWeight: 600, color: tone }}>{verdict}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'var(--bg-elev)', borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
                    <div title={`Housing ${Math.round(housingPct)}%`} style={{ height: '100%', width: `${Math.min(100, housingPct)}%`, background: 'var(--border-2)', transition: 'width .3s' }} />
                    <div title={`Other essentials ${Math.round(otherPct)}%`} style={{ height: '100%', width: `${Math.min(100 - Math.min(100, housingPct), otherPct)}%`, background: tone, transition: 'width .3s' }} />
                    <span title="50% guideline" style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 2, background: 'var(--border-2)', borderRadius: 1 }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                    <i className="px-split-dot" style={{ background: 'var(--border-2)' }} /> housing {Math.round(housingPct)}% ·{' '}
                    <i className="px-split-dot" style={{ background: tone }} /> other essentials {Math.round(otherPct)}% · guideline: keep all essentials near or under ~50% of take-home (50/30/20).
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Savings + reserve */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Cash reserve <FieldHint text="Link the reserve to one or more accounts on file and their summed balances become the reserve figure, kept in sync automatically. With no linked accounts, type the number yourself." /></div>
              {acctRows.length > 0 && reserveIds.length < acctRows.length && (
                <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addReserveAccount}>
                  <Icons.Plus size={10} /> Add reserve account
                </button>
              )}
            </div>
            {reserveIds.map(id => {
              const acct = acctRows.find(a => a.id === id);
              return (
                <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 24px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <select className="px-select" value={id}
                    onChange={(e) => setReserveIds(reserveIds.map(x => x === id ? e.target.value : x))}>
                    {acctRows.filter(a => a.id === id || !reserveIds.includes(a.id)).map(a => (
                      <option key={a.id} value={a.id}>
                        {(a.name || 'Account')}{a.custodian ? ` · ${a.custodian}` : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmt$(acctBal(id))}</span>
                  <button onClick={() => setReserveIds(reserveIds.filter(x => x !== id))} aria-label="Unlink account"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
              );
            })}
            {reserveIds.length > 0 ? (
              <div className="px-split-equity">
                <span>Liquidity reserve · {reserveIds.length === 1 ? 'from linked account' : `${reserveIds.length} linked accounts`}</span>
                <strong>{fmt$(reserveIds.reduce((s, id) => s + acctBal(id), 0))}</strong>
              </div>
            ) : (
              <NumField label="Liquidity reserve" path="savings.emergency" value={profile.savings.emergency}  onUpdate={update}/>
            )}
          </section>

          {/* Liabilities */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Liabilities</div>
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
                      <NumInput value={d.balance} step="100"
                        onCommit={(v) => updateDebt(d.id, 'balance', v)} />
                    </div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">APR</span>
                    <div className="px-input-affix">
                      <NumInput value={d.apr} step="0.1"
                        onCommit={(v) => updateDebt(d.id, 'apr', v)} />
                      <span className="px-affix px-affix-r">%</span>
                    </div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Min / mo</span>
                    <div className="px-input-affix">
                      <span className="px-affix">$</span>
                      <NumInput value={d.min} step="10"
                        onCommit={(v) => updateDebt(d.id, 'min', v)} />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Retirement */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Retirement assets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="HSA balance" path="retirement.hsaBalance" value={profile.retirement.hsaBalance} step="500"  onUpdate={update}/>
              <NumField label="IRA balance" path="retirement.iraBalance" value={profile.retirement.iraBalance} step="500"  onUpdate={update}/>
              <NumField label="401(k) balance" path="retirement.fourohonekBalance" value={profile.retirement.fourohonekBalance} step="500"  onUpdate={update}/>
              <NumField label="Roth IRA balance" path="retirement.rothBalance" value={profile.retirement.rothBalance} step="500"  onUpdate={update}/>
              <NumField label="HSA contrib / yr" path="retirement.hsaContrib" value={profile.retirement.hsaContrib} step="100"  onUpdate={update}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8, gap: 8 }}>
              <span className="px-field-label" style={{ margin: 0 }}>Contributions &amp; employer match</span>
              {/* Per-month / per-year entry toggle. Stored values are ALWAYS annual -
                  the monthly view just divides for display and multiplies on commit,
                  so every calculator keeps reading the same annual figures. */}
              <div className="px-seg" role="tablist" aria-label="Contribution entry period" style={{ margin: 0 }}>
                <button type="button" role="tab" aria-selected={contribFreq === 'mo'} className={`px-seg-btn ${contribFreq === 'mo' ? 'is-on' : ''}`}
                  onClick={() => setContribFreq('mo')}>Per month</button>
                <button type="button" role="tab" aria-selected={contribFreq === 'yr'} className={`px-seg-btn ${contribFreq === 'yr' ? 'is-on' : ''}`}
                  onClick={() => setContribFreq('yr')}>Per year</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['401(k) contributed', 'retirement.fourohonekContributed', profile.retirement.fourohonekContributed],
                ['401(k) limit',       'retirement.fourohonekLimit',       profile.retirement.fourohonekLimit],
                ['IRA contributed',    'retirement.iraContributed',        profile.retirement.iraContributed],
                ['IRA limit',          'retirement.iraLimit',              profile.retirement.iraLimit],
              ].map(([label, path, annual]) => (
                <NumField key={path}
                  label={`${label} / ${contribFreq}`}
                  path={path}
                  step={contribFreq === 'mo' ? '50' : '500'}
                  value={contribFreq === 'mo' ? Math.round(((Number(annual) || 0) / 12) * 100) / 100 : annual}
                  onUpdate={(p, v) => update(p, contribFreq === 'mo' ? Math.round(v * 12) : v)} />
              ))}
              <NumField label="Employer match (%)" path="retirement.employerMatchPct" value={profile.retirement.employerMatchPct} prefix={null} step="0.5" onUpdate={update}/>
            </div>
          </section>

          {/* Guaranteed retirement income - SS / pension / annuity */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Guaranteed income</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addStream}>
                <Icons.Plus size={10} /> Add stream
              </button>
            </div>
            {(profile.incomeStreams || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Social Security, pensions, or annuities - these reduce how much the portfolio must cover in retirement.
              </div>
            )}
            {(profile.incomeStreams || []).map(s => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input type="text" value={s.label} placeholder="e.g. Social Security - Robert"
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
                      <NumInput value={s.monthlyAmount} step="100"
                        onCommit={(v) => updateStream(s.id, 'monthlyAmount', v)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Starts at age</span>
                    <div className="px-input-affix">
                      <NumInput value={s.startAge} step="1" min="0"
                        onCommit={(v) => updateStream(s.id, 'startAge', Math.round(v))} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Annual COLA (%)</span>
                    <div className="px-input-affix">
                      <NumInput value={s.colaPct} step="0.1"
                        onCommit={(v) => updateStream(s.id, 'colaPct', v)} />
                      <span className="px-affix px-affix-r">%</span></div>
                  </label>
                  {s.type === 'social_security' && (
                    <label className="px-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="px-field-label">
                        PIA - benefit at full retirement age (67)
                        <FieldHint text="Your Primary Insurance Amount: the monthly Social Security benefit at full retirement age (67), from your SSA statement. Powers the claiming-age (62 / 67 / 70) optimizer." />
                      </span>
                      <div className="px-input-affix"><span className="px-affix">$</span>
                        <NumInput value={s.pia ?? ''} step="100" placeholder="from SSA statement"
                          onCommit={(v) => updateStream(s.id, 'pia', v)} /></div>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Taxable */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Taxable brokerage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumField label="Balance" path="taxable.balance" value={profile.taxable.balance} step="1000"  onUpdate={update}/>
              <NumField label="Monthly contribution" path="taxable.monthlyContrib" value={profile.taxable.monthlyContrib}  onUpdate={update}/>
            </div>
          </section>

          {/* Equity compensation - concentrated single-stock positions (RSU / ISO) */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Equity compensation</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addEquity}>
                <Icons.Plus size={10} /> Add position
              </button>
            </div>
            {(profile.equityComp || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                RSUs, options, or a concentrated single stock - capture it so the plan can size single-stock risk and the tax cost of diversifying.
              </div>
            )}
            {(profile.equityComp || []).map(e => (
              <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input type="text" value={e.ticker} placeholder="Ticker (e.g. NVDA)"
                    onChange={(ev) => updateEquity(e.id, 'ticker', ev.target.value)}
                    style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }} />
                  <button onClick={() => removeEquity(e.id)} title="Remove" aria-label="Remove position"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                    <Icons.X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label className="px-field">
                    <span className="px-field-label">Type</span>
                    <select className="px-select" value={e.type} onChange={(ev) => updateEquity(e.id, 'type', ev.target.value)}>
                      <option value="rsu">RSU</option>
                      <option value="iso">ISO (incentive)</option>
                      <option value="nso">NSO (non-qual)</option>
                      <option value="espp">ESPP</option>
                      <option value="other">Other / held shares</option>
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Vested value</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <NumInput value={e.positionValue} step="5000"
                        onCommit={(v) => updateEquity(e.id, 'positionValue', v)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">
                      Cost basis
                      <FieldHint text="What you paid (or the value when RSUs vested and were taxed). Vested value − cost basis = the unrealized gain that diversifying would realize." />
                    </span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <NumInput value={e.costBasis} step="5000"
                        onCommit={(v) => updateEquity(e.id, 'costBasis', v)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">
                      Unvested value
                      <FieldHint text="Grants not yet vested. They add to the position (and to ordinary income) as they vest, so concentration tends to rebuild without a plan." />
                    </span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <NumInput value={e.unvestedValue} step="5000"
                        onCommit={(v) => updateEquity(e.id, 'unvestedValue', v)} /></div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Insurance - protection capture (life / disability / LTC) */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Protection</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addInsurance}>
                <Icons.Plus size={10} /> Add policy
              </button>
            </div>
            {(profile.insurance || []).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                Life, disability, or long-term care coverage - capture what's in place so the plan reflects how the household is protected.
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
                    {/* Tied to the household members entered at the top of this drawer.
                        A legacy free-text owner that doesn't match a member stays
                        selectable so old profiles don't silently lose the value. */}
                    <select className="px-select" value={i.owner || ''}
                      onChange={(e) => updateInsurance(i.id, 'owner', e.target.value)}>
                      <option value="">Who's covered…</option>
                      {(profile.members || []).filter(m => (m.name || '').trim()).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                      {i.owner && !(profile.members || []).some(m => m.name === i.owner) && (
                        <option value={i.owner}>{i.owner}</option>
                      )}
                    </select>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Coverage</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <NumInput value={i.coverageAmount} step="10000"
                        onCommit={(v) => updateInsurance(i.id, 'coverageAmount', v)} /></div>
                  </label>
                  <label className="px-field">
                    <span className="px-field-label">Premium / mo</span>
                    <div className="px-input-affix"><span className="px-affix">$</span>
                      <NumInput value={i.premiumMonthly} step="10"
                        onCommit={(v) => updateInsurance(i.id, 'premiumMonthly', v)} /></div>
                  </label>
                </div>
              </div>
            ))}
          </section>

          {/* Estate readiness checklist */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Estate readiness</div>
            {ESTATE_DEFS.map(({ key, label }) => {
              const item = (profile.estate || {})[key] || { status: 'none', lastReviewed: '' };
              const isComplete = item.status === 'complete';
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 140px', gap: 8, alignItems: 'end' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                    <label className="px-field">
                      <span className="px-field-label">Status</span>
                      <select className="px-select" value={item.status || 'none'} onChange={(e) => updateEstate(key, 'status', e.target.value)}>
                        {ESTATE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="px-field">
                      <span className="px-field-label">Last reviewed</span>
                      <input type="date" className="px-input" value={item.lastReviewed || ''} style={{ width: '100%' }}
                        onChange={(e) => updateEstate(key, 'lastReviewed', e.target.value)} />
                    </label>
                  </div>
                  {/* Not done yet → offer the illustrative sample (discussion aid,
                      bannered as not-a-legal-document) to anchor the conversation. */}
                  {!isComplete && (
                    <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '2px 8px', marginTop: 4, fontSize: 10.5 }}
                      onClick={() => window.openEstateSample?.(key)}>
                      <Icons.FileText size={10} /> View sample {label.toLowerCase()}
                    </button>
                  )}
                  {/* Shared items link to a vault document the client can open. */}
                  {isComplete && (
                    <label className="px-field" style={{ marginTop: 6 }}>
                      <span className="px-field-label">Shared document{estateDocs.length === 0 ? ' - upload an estate document in the vault first' : ''}</span>
                      <select className="px-select" value={item.documentId || ''} style={{ width: '100%' }}
                        onChange={(e) => updateEstate(key, 'documentId', e.target.value || null)}>
                        <option value="">No document linked</option>
                        {estateDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </section>

          {/* Planning & tax */}
          <section style={{ marginBottom: 22 }}>
            <div className="px-eyebrow is-section" style={{ marginBottom: 10 }}>Planning &amp; tax</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="px-field">
                <span className="px-field-label">Planning age{primaryMember ? ` · ${primaryMember.name || 'primary'}` : ''}</span>
                <div className="px-input-affix" style={{ background: 'var(--bg)', cursor: 'default' }}>
                  <input type="text" readOnly value={planningAge > 0 ? `${planningAge} yrs` : '-'} style={{ cursor: 'default', color: 'var(--ink-mute)' }} />
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
                hint="Your combined top tax bracket - the rate on your next dollar of income. Drives tax-advantaged savings estimates. Import a W-2 below to set this from your actual wages instead of guessing." />
            </div>

            {/* W-2 capture → parsed marginal rate. One entry per earner/job -
                spouse W-2s and second jobs each get a line; the COMBINED Box 1
                locates the household's federal bracket via the shared
                bracketPosition engine (right answer for a joint return). */}
            {(() => {
              const list = w2s(profile);
              const box1 = list.reduce((a, w) => a + (Number(w.box1) || 0), 0);
              const box2 = list.reduce((a, w) => a + (Number(w.box2) || 0), 0);
              const filing = profile.taxes.filingStatus === 'single' ? 'single' : 'mfj';
              const res = w2Position({ box1, box2, filingStatus: filing });
              const hasW2 = box1 > 0;
              const applied = hasW2 && Number(profile.taxes.marginalRate) === res.marginalRatePct;
              return (
                <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                    <span className="px-eyebrow" style={{ margin: 0 }}>Import from W-2{list.length > 1 ? 's' : ''}</span>
                    <FieldHint text="One entry per W-2 - add a spouse's W-2 or a second job. Box 1 (wages, tips, other comp) and Box 2 (federal income tax withheld) come straight off each form; combined wages locate the household's federal bracket." />
                    <span style={{ flex: 1 }} />
                    {canAiImportW2 && (
                      <>
                        <input ref={w2FileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                          onChange={(e) => importW2File(e.target.files?.[0])} />
                        <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}
                          disabled={w2Importing} onClick={() => w2FileRef.current?.click()}>
                          <Icons.Upload size={10} /> {w2Importing ? 'Reading…' : 'Upload W-2'}
                        </button>
                      </>
                    )}
                    <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', whiteSpace: 'nowrap' }} onClick={() => addW2()}>
                      <Icons.Plus size={10} /> Add W-2
                    </button>
                  </div>
                  {list.length === 0 && (
                    <div style={{ padding: '6px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                      Add a W-2 per earner - we'll set the marginal rate from actual wages instead of a guess.
                    </div>
                  )}
                  {list.map(w => (
                    <div key={w.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8, background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <input type="text" value={w.label} placeholder="Whose W-2 / employer (e.g. Dana - Acme Corp)"
                          onChange={(e) => updateW2(w.id, 'label', e.target.value)}
                          style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', outline: 'none', flex: 1 }} />
                        <button onClick={() => removeW2(w.id)} title="Remove" aria-label="Remove W-2"
                          style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                          <Icons.X size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label className="px-field">
                          <span className="px-field-label">Box 1 - wages, tips, other comp</span>
                          <div className="px-input-affix"><span className="px-affix">$</span>
                            <NumInput value={w.box1} step="1000" onCommit={(v) => updateW2(w.id, 'box1', v)} /></div>
                        </label>
                        <label className="px-field">
                          <span className="px-field-label">Box 2 - federal tax withheld</span>
                          <div className="px-input-affix"><span className="px-affix">$</span>
                            <NumInput value={w.box2} step="100" onCommit={(v) => updateW2(w.id, 'box2', v)} /></div>
                        </label>
                      </div>
                    </div>
                  ))}
                  {hasW2 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                        {list.length > 1 ? 'Combined wages land' : 'Box 1 lands'} in the <b>{res.marginalRatePct}%</b> federal bracket
                        {res.withholdingRate > 0 && <> · withheld <b>{Math.round(res.withholdingRate * 100)}%</b> of wages</>}.
                      </div>
                      <button className="px-btn px-btn-sm" disabled={applied} style={{ whiteSpace: 'nowrap' }}
                        onClick={() => update('taxes.marginalRate', res.marginalRatePct)}>
                        {applied ? 'Applied' : `Use ${res.marginalRatePct}%`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 1040 capture → planning observations (Holistiplan-lite). Key lines
                off the filed return; tax1040Insights turns them into deterministic
                observations surfaced in the Phase-04 "Tax-return insights" tool. */}
            {(() => {
              const t = profile.taxes.t1040 || {};
              const filing = profile.taxes.filingStatus === 'single' ? 'single' : 'mfj';
              const res = tax1040Insights({ filingStatus: filing, age: planningAge, lines: t });
              const ratePct = res ? Math.round(res.marginalRate * 100) : null;
              const applied = res && Number(profile.taxes.marginalRate) === ratePct;
              const FIELDS = [
                ['agi',               'Line 11 - adjusted gross income', 1000],
                ['deduction',         'Line 12 - deduction taken',       500],
                ['taxableIncome',     'Line 15 - taxable income',        1000],
                ['totalTax',          'Line 24 - total tax',             500],
                ['withholding',       'Line 25d - tax withheld',         500],
                ['capGains',          'Line 7 - capital gain or (loss)', 500],
                ['taxableInterest',   'Line 2b - taxable interest',      100],
                ['ordinaryDividends', 'Line 3b - ordinary dividends',    100],
                ['qualifiedDividends','Line 3a - qualified dividends',   100],
                ['iraDistributions',  'Line 4b - taxable IRA distributions', 500],
                ['ssBenefits',        'Line 6b - taxable Social Security', 500],
              ];
              return (
                <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                    <span className="px-eyebrow" style={{ margin: 0 }}>Import from your 1040</span>
                    <FieldHint text="Key lines from your most recent federal return (Form 1040). They unlock the tax-return insights in your roadmap - bracket position, withholding check, 0% gains room, and more. Enter what you have; every line is optional except AGI." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {FIELDS.map(([key, label, step]) => (
                      <NumField key={key} label={label} path={`taxes.t1040.${key}`} value={t[key]} step={String(step)} onUpdate={update} />
                    ))}
                  </div>
                  {res && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                        Return lands in the <b>{ratePct}%</b> bracket
                        {res.effectiveRate != null && <> · effective <b>{Math.round(res.effectiveRate * 100)}%</b> of AGI</>}
                        {' '}· <b>{res.observations.length}</b> insight{res.observations.length !== 1 ? 's' : ''} in the Phase-04 tax tool.
                      </div>
                      <button className="px-btn px-btn-sm" disabled={applied} style={{ whiteSpace: 'nowrap' }}
                        onClick={() => update('taxes.marginalRate', ratePct)}>
                        {applied ? 'Applied' : `Use ${ratePct}%`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Funding goals - education / home / custom, tracked to a target date */}
          <section style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="px-eyebrow is-section">Goals</div>
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px' }} onClick={addGoal}>
                <Icons.Plus size={10} /> Add goal
              </button>
            </div>
            {gitems(profile).length === 0 && (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12 }}>
                A home, education, or any milestone with a target amount and date - we'll track whether it's on pace.
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
                      <NumInput value={g.targetAmount} step="1000"
                        onCommit={(v) => updateGoal(g.id, 'targetAmount', v)} /></div>
                  </label>
                  {/* Retirement-type goals never hand-track funding - the retirement
                      accounts ARE the funding (calc-core.resolveGoal, round 23). The
                      linked figures mirror the round-20 cash-reserve account linking. */}
                  {g.type === 'retirement' ? (() => {
                    const rlink = PrismCalc.retirementGoalLink(profile.retirement);
                    return (
                      <React.Fragment>
                        <label className="px-field">
                          <span className="px-field-label">Saved so far
                            <FieldHint text="Linked to your retirement accounts: IRA + 401(k) + Roth balances from the Retirement assets section. Update the balances there and this follows automatically." /></span>
                          <div className="px-input-affix"><span className="px-affix">$</span>
                            <input type="text" readOnly value={fmtN(rlink.currentFunding)}
                              aria-label="Saved so far (linked to retirement balances)"
                              style={{ color: 'var(--ink-mute)', background: 'var(--bg-elev)', cursor: 'default' }} /></div>
                        </label>
                        <label className="px-field" style={{ gridColumn: '1 / -1' }}>
                          <span className="px-field-label">Monthly contribution
                            <FieldHint text="Pre-filled from your annual IRA + 401(k) contributions. Type a number to override; clear it to go back to automatic." /></span>
                          <div className="px-input-affix"><span className="px-affix">$</span>
                            <NumInput value={g.monthlyContribution} step="50"
                              placeholder={String(rlink.monthlyContribution || 0)}
                              onCommit={(v) => updateGoal(g.id, 'monthlyContribution', v)} /></div>
                        </label>
                      </React.Fragment>
                    );
                  })() : (
                    <React.Fragment>
                      <label className="px-field">
                        <span className="px-field-label">Saved so far</span>
                        <div className="px-input-affix"><span className="px-affix">$</span>
                          <NumInput value={g.currentFunding} step="1000"
                            onCommit={(v) => updateGoal(g.id, 'currentFunding', v)} /></div>
                      </label>
                      <label className="px-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="px-field-label">Monthly contribution</span>
                        <div className="px-input-affix"><span className="px-affix">$</span>
                          <NumInput value={g.monthlyContribution} step="50"
                            onCommit={(v) => updateGoal(g.id, 'monthlyContribution', v)} /></div>
                      </label>
                    </React.Fragment>
                  )}
                </div>
              </div>
            ))}
          </section>

          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
            Changes save automatically and are visible to {advisor.name} in real time - but nothing is locked in: use <b>Undo</b> (top right) to step back, or <b>Revert all</b> to undo everything since you opened this. Use the <b>Discuss with advisor</b> action on any task to flag questions.
          </div>
        </div>
      </aside>
    </>
  );
};

Object.assign(window, { NumbersDrawer, KYC_OPTIONS, kycLabel });

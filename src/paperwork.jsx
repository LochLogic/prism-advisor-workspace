// Prism - custodian account-paperwork POC (round 23, industry-advisor ask).
// "Schwab + Fidelity use Quik! for document integration and routing - can we
// integrate and auto-populate those documents for advisors?"
//
// WHAT THIS IS (and is not): the in-code proof of concept. It maps everything
// Prism already knows about a household into the field set custodian
// account-opening forms ask for, shows the advisor exactly what would prefill
// and what is missing, and exports the payload (JSON download) that a forms
// engine would consume. It does NOT submit to Quik!/Schwab/Fidelity yet - the
// adapter registry below documents precisely which blanks unlock that.
//
// HOW THE REAL INTEGRATION SLOTS IN (keep this comment current):
//   Quik! (Efficient Technology Inc) is the forms engine both Schwab Advisor
//   Services and Fidelity Institutional ride on. Their API takes a form id +
//   a field dictionary and returns a prefilled, e-sign-ready package; Prism
//   already has DocuSign plumbing (docusign-envelope / docusign-connect) for
//   the signature leg. `buildPaperworkPayload` is the field dictionary
//   producer; an adapter's job is only transport + form-id mapping.
//
// ADVISOR BUNDLE ONLY - loaded after store/components, before advisor-modal
// (build-files.mjs). Never reference from portal files.

/* ─── Adapter registry - the blanks list lives HERE ──────────────────────
   `ready: false` adapters render as a checklist in the modal so the founder
   can see exactly what to chase. When the pieces exist, implement
   `submit(payload)` on the adapter and flip `ready`. */
const PAPERWORK_ADAPTERS = {
  manual: {
    id: 'manual', label: 'Manual - JSON export / advisor retype', ready: true,
    note: 'Available today: export the prefill payload and key it into the custodian form, or attach it to the client file.',
  },
  quik: {
    id: 'quik', label: 'Quik! Forms API (Schwab / Fidelity library)', ready: false,
    // The pieces the founder must supply before this adapter can be built:
    missing: [
      'Quik! Forms API agreement + credentials (customer id, API key) - sales@quikforms.com / quikforms.com',
      'Custodian relationship: the firm\'s Schwab master-account "G-number" (and/or Fidelity firm id) for form routing',
      'Per-custodian form ids to support first (e.g. Schwab Individual/Joint/IRA new-account, Fidelity equivalents)',
      'Field-dictionary mapping confirmation against Quik\'s field names (their docs ship a per-form dictionary)',
      'DocuSign envelope routing decision: Quik\'s built-in e-sign vs. Prism\'s existing docusign-envelope flow',
      'Compliance sign-off: SSN release into the form payload happens server-side only (client-identifiers edge fn)',
    ],
  },
};

/* Account registrations the POC understands. `owners` picks which household
   members land on the form; `needsEin` flags trust-style registrations. */
const PAPERWORK_ACCOUNT_TYPES = [
  { value: 'individual', label: 'Individual brokerage',        owners: 'primary',  needsEin: false },
  { value: 'joint',      label: 'Joint brokerage (JTWROS)',    owners: 'adults',   needsEin: false },
  { value: 'ira',        label: 'Traditional IRA',             owners: 'primary',  needsEin: false },
  { value: 'roth',       label: 'Roth IRA',                    owners: 'primary',  needsEin: false },
  { value: 'sma',        label: 'Separately managed account',  owners: 'adults',   needsEin: false },
  { value: 'trust',      label: 'Trust account',               owners: 'adults',   needsEin: true  },
  { value: 'utma',       label: 'UTMA / minor',                owners: 'all',      needsEin: false },
];

const PAPERWORK_CUSTODIANS = [
  { value: 'schwab',   label: 'Charles Schwab',  firmIdLabel: 'Schwab G-number (master account)' },
  { value: 'fidelity', label: 'Fidelity',        firmIdLabel: 'Fidelity firm id (G-number equivalent)' },
];

// One prefill field: { key, label, value, source, status: 'ok'|'missing'|'gated' }
// 'gated' = Prism holds it but releases it only server-side (SSN full value).
const _pwField = (key, label, value, source, status) => ({
  key, label, value: value ?? '', source,
  status: status || (value != null && value !== '' ? 'ok' : 'missing'),
});

/* ─── The payload builder - what Prism can prefill TODAY ─────────────────
   identifiers = rows from db.getIdentifiers() (last4 only - the full value
   never reaches this code; a live adapter asks the client-identifiers edge
   fn to release it directly into the form engine server-side). */
function buildPaperworkPayload({ client, profile, identifiers, custodian, accountType, firmName, advisorName }) {
  const p = profile || {};
  const typeDef = PAPERWORK_ACCOUNT_TYPES.find(t => t.value === accountType) || PAPERWORK_ACCOUNT_TYPES[0];
  const custDef = PAPERWORK_CUSTODIANS.find(c => c.value === custodian) || PAPERWORK_CUSTODIANS[0];
  const members = Array.isArray(p.members) ? p.members : [];
  const adults = members.filter(m => m.role !== 'dependent');
  const owners = typeDef.owners === 'primary' ? adults.filter(m => m.role === 'primary').slice(0, 1)
    : typeDef.owners === 'adults' ? adults
    : members;
  const ids = Array.isArray(identifiers) ? identifiers : [];

  const ownerBlocks = owners.map(m => {
    const ssn = ids.find(r => r.member_id === m.id && r.kind === 'ssn');
    return {
      memberId: m.id,
      fields: [
        _pwField('full_name', 'Full legal name', m.name, 'Numbers panel · Household'),
        _pwField('date_of_birth', 'Date of birth', m.dateOfBirth, 'Numbers panel · Household'),
        _pwField('ssn', 'Social Security number',
          ssn ? `•••-••-${ssn.last4} (released at submission)` : '',
          'Encrypted identifier store', ssn ? 'gated' : 'missing'),
        _pwField('residential_address', 'Residential address', '', 'NOT CAPTURED YET - profile gap'),
        _pwField('employment', 'Employer / occupation', '', 'NOT CAPTURED YET - profile gap'),
        _pwField('citizenship', 'Citizenship', '', 'NOT CAPTURED YET - profile gap'),
      ],
    };
  });

  const grossMonthly = (Array.isArray(p.income?.sources) ? p.income.sources : [])
    .reduce((s, x) => s + (Number(x.monthlyGross) || 0), 0);
  const invested = (Number(p.taxable?.balance) || 0)
    + (Number(p.retirement?.iraBalance) || 0) + (Number(p.retirement?.fourohonekBalance) || 0)
    + (Number(p.retirement?.rothBalance) || 0) + (Number(p.retirement?.hsaBalance) || 0);

  const account = [
    _pwField('custodian', 'Custodian', custDef.label, 'Selected'),
    _pwField('registration', 'Registration', typeDef.label, 'Selected'),
    _pwField('household', 'Household / account title', client?.name, 'Client record'),
    ...(typeDef.needsEin ? [_pwField('trust_ein', 'Trust EIN', '', 'Encrypted identifier store (kind: ein) - capture when the trust docs land')] : []),
    _pwField('annual_income', 'Annual income (est.)', grossMonthly > 0 ? Math.round(grossMonthly * 12) : (Number(p.income?.monthlyTakehome) || 0) * 12 || '', 'Numbers panel · Income'),
    _pwField('net_worth', 'Investable assets (est.)', invested || '', 'Numbers panel · balances'),
    _pwField('risk_profile', 'Risk profile', p.risk?.answers?.length ? 'On file (questionnaire complete)' : '', 'Risk questionnaire'),
    _pwField('filing_state', 'State (tax filing)', p.taxes?.state, 'Numbers panel · Planning & tax'),
  ];

  const firm = [
    _pwField('firm_name', 'Firm', firmName, 'Firm record'),
    _pwField('advisor', 'Advisor of record', advisorName, 'Advisor record'),
    _pwField('firm_custodian_id', custDef.firmIdLabel, '', 'BLANK - founder queue (custodian relationship)'),
  ];

  const allFields = [...ownerBlocks.flatMap(o => o.fields), ...account, ...firm];
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    custodian: custDef.value, registration: typeDef.value,
    owners: ownerBlocks, account, firm,
    readiness: {
      prefilled: allFields.filter(f => f.status === 'ok').length,
      gated: allFields.filter(f => f.status === 'gated').length,
      missing: allFields.filter(f => f.status === 'missing').length,
      adapter: PAPERWORK_ADAPTERS.quik.ready ? 'quik' : 'manual',
    },
  };
}

/* ─── The modal - advisor-facing POC surface (client quick-view button) ── */
const PaperworkModal = ({ client, profileData, onClose }) => {
  const [custodian, setCustodian] = React.useState('schwab');
  const [accountType, setAccountType] = React.useState('individual');
  const [identifiers, setIdentifiers] = React.useState(null);
  const { authUser } = useAuth();

  React.useEffect(() => {
    let on = true;
    if (window.db?.isUUID(client?.id)) {
      window.db.getIdentifiers(client.id).then(r => { if (on) setIdentifiers(r); });
    }
    return () => { on = false; };
  }, [client?.id]);

  const payload = buildPaperworkPayload({
    client, profile: profileData, identifiers, custodian, accountType,
    firmName: authUser?.firms?.name || authUser?.firm_name || advisor.firm,
    advisorName: authUser?.full_name || advisor.fullName,
  });

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `paperwork-${custodian}-${accountType}-${(client?.name || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const STATUS = {
    ok:      { label: 'prefills',  color: 'var(--forest)' },
    gated:   { label: 'on file · released at submission', color: 'var(--gold)' },
    missing: { label: 'missing',   color: 'var(--brick, #a14d3a)' },
  };
  const FieldRow = ({ f }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '4px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--ink-mute)', flex: '0 0 38%' }}>{f.label}</span>
      <span style={{ color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {String(f.value || '')}{!f.value && <em style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>{f.source}</em>}
      </span>
      <span style={{ color: STATUS[f.status].color, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{STATUS[f.status].label}</span>
    </div>
  );

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div style={{ padding: 28, minWidth: 460, maxWidth: 640, maxHeight: '82vh', overflowY: 'auto' }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: '0 0 6px', color: 'var(--ink)' }}>
        Account paperwork · {client?.name || ''}
      </h2>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 12 }}>
        Proof of concept: what Prism prefills onto custodian account-opening forms today, what is held
        back for server-side release (SSNs), and what is still uncaptured. Export the payload below -
        the Quik! adapter consumes the same structure once the integration blanks are filled.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <label className="px-field">
          <span className="px-field-label">Custodian</span>
          <select className="px-select" value={custodian} onChange={e => setCustodian(e.target.value)}>
            {PAPERWORK_CUSTODIANS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="px-field">
          <span className="px-field-label">Registration</span>
          <select className="px-select" value={accountType} onChange={e => setAccountType(e.target.value)}>
            {PAPERWORK_ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginBottom: 10 }}>
        <b style={{ color: 'var(--forest)' }}>{payload.readiness.prefilled}</b> prefill ·{' '}
        <b style={{ color: 'var(--gold)' }}>{payload.readiness.gated}</b> gated (SSN) ·{' '}
        <b style={{ color: 'var(--brick, #a14d3a)' }}>{payload.readiness.missing}</b> missing
      </div>

      {payload.owners.map((o, i) => (
        <div key={o.memberId} style={{ marginBottom: 10 }}>
          <div className="px-eyebrow" style={{ marginBottom: 4 }}>Owner {i + 1}</div>
          {o.fields.map(f => <FieldRow key={f.key} f={f} />)}
        </div>
      ))}
      <div className="px-eyebrow" style={{ marginBottom: 4 }}>Account</div>
      {payload.account.map(f => <FieldRow key={f.key} f={f} />)}
      <div className="px-eyebrow" style={{ margin: '10px 0 4px' }}>Firm routing</div>
      {payload.firm.map(f => <FieldRow key={f.key} f={f} />)}

      {/* The integration checklist - the founder's blanks list, in-product */}
      <details style={{ margin: '12px 0', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elev)' }}>
        <summary style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
          Quik! adapter - what unlocks auto-routing ({PAPERWORK_ADAPTERS.quik.missing.length} blanks)
        </summary>
        <div style={{ padding: '0 12px 10px', fontSize: 12, lineHeight: 1.55, color: 'var(--ink-mute)' }}>
          {PAPERWORK_ADAPTERS.quik.missing.map((m, i) => <div key={i} style={{ padding: '2px 0' }}>· {m}</div>)}
        </div>
      </details>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="px-btn px-btn-ghost" onClick={onClose}>Close</button>
        <button className="px-btn px-btn-primary" onClick={downloadJson}>
          <Icons.FileText size={12} /> Download prefill payload (JSON)
        </button>
      </div>
      </div>
    </Modal>
  );
};

Object.assign(window, { PaperworkModal, buildPaperworkPayload, PAPERWORK_ADAPTERS, PAPERWORK_ACCOUNT_TYPES, PAPERWORK_CUSTODIANS });

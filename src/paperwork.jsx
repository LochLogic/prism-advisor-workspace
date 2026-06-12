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
// HOW THE REAL INTEGRATION SLOTS IN (keep this comment current; full research
// notes in docs/quik-field-taxonomy.md, public-docs pass 2026-06-12):
//   Quik! (Efficient Technology Inc) is the forms engine both Schwab Advisor
//   Services and Fidelity Institutional ride on. Generation is one POST to
//   https://websvcs.quikforms.com/rest/quikformsengine/qfe/execute/pdf
//   (UAT: uatwebsvcs...; OAuthToken header) with a body of
//   { QuikFormID, FormFields: [{ FieldName, FieldValue }], ... } where
//   FieldName follows Quik!'s `<n><role>.<Base>` taxonomy (1own.FName,
//   1acc.Reg). `ForSign: true` returns a signable PDF; under their DocuSign
//   "Self Service" model Prism's own docusign-envelope flow then owns the
//   envelope (one audit trail). `buildPaperworkPayload` already emits the
//   Execute-shaped `quik.formFields` block; an adapter's job is only
//   transport + per-custodian QuikFormID mapping, server-side (the SSN is
//   released by the client-identifiers edge fn directly into that call).
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
    // Taxonomy research done 2026-06-12 (docs/quik-field-taxonomy.md) - the payload
    // below already exports Execute-shaped FormFields. The pieces the founder must
    // still supply before this adapter can be built:
    missing: [
      'Quik! Forms API agreement + credentials (customer id, OAuthToken; ask for UAT first) - sales@quikforms.com',
      'Custodian relationship: the firm\'s Schwab master-account "G-number" (and/or Fidelity firm id) for form routing',
      'Quik! Form IDs for the first form set - discover via GET /forms/search once credentialed (e.g. Schwab Individual/Joint/IRA new-account)',
      'Field-dictionary confirmation (GET /forms/fields) for the names the export flags as unverified (* in the rows below)',
      'E-sign: adopt Quik!\'s DocuSign Self Service model - Quik! returns the signable PDF, Prism\'s docusign-envelope flow owns the envelope (confirm the API tier includes it)',
      'Compliance sign-off: SSN release into the form payload happens server-side only (client-identifiers edge fn)',
    ],
  },
};

/* ─── Action packages - how advisors actually think ──────────────────────
   Advisors pick a task ("open account", "transfer assets in"), not a form;
   each task implies a bundle of custodian forms, and Quik!'s Execute call
   takes a QuikFormID LIST, so one call generates the whole package.
   `formId: null` = the slot is the design contract; real Form IDs come from
   GET /forms/search once credentialed (founder queue) - never guess them.
   `appliesTo` filters a slot to the registrations it exists for.
   The picker UI (multi-select, Create, PDF preview, DocuSign routing) is
   deliberately NOT built until UAT credentials exist, so it is built once
   against the real catalog. */
const PAPERWORK_PACKAGES = [
  { value: 'open', label: 'Open account', forms: [
    { slot: 'application', label: 'Account application', formId: null },
    { slot: 'beneficiary', label: 'Beneficiary designation', formId: null, appliesTo: ['ira', 'roth'] },
    { slot: 'advisory',    label: 'Advisory agreement / fee authorization', formId: null },
  ] },
  { value: 'transfer', label: 'Transfer assets in (ACAT)', forms: [
    { slot: 'acat', label: 'Transfer of assets (ACAT)', formId: null },
  ] },
  { value: 'beneficiary', label: 'Update beneficiaries', forms: [
    { slot: 'beneficiary', label: 'Beneficiary designation / change', formId: null, appliesTo: ['ira', 'roth'] },
  ] },
  { value: 'money', label: 'Money movement (ACH)', forms: [
    { slot: 'ach', label: 'ACH / MoneyLink authorization', formId: null },
  ] },
];

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

// One prefill field: { key, label, value, source, status: 'ok'|'missing'|'gated', quik }
// 'gated' = Prism holds it but releases it only server-side (SSN full value).
// `quik` = the Quik! taxonomy mapping for the field: an array of
// { name, value, verified } because one Prism field can fan out to several
// Quik! names (full name -> 1own.FName + 1own.LName). verified:false = the
// name follows Quik!'s convention but is NOT yet confirmed against a per-form
// dictionary (GET /forms/fields) - see docs/quik-field-taxonomy.md §6.
const _pwField = (key, label, value, source, status, quik) => ({
  key, label, value: value ?? '', source,
  status: status || (value != null && value !== '' ? 'ok' : 'missing'),
  quik: quik || null,
});
const _qf = (name, value, verified) => ({ name, value: value ?? '', verified: !!verified });

/* ─── The payload builder - what Prism can prefill TODAY ─────────────────
   identifiers = rows from db.getIdentifiers() (last4 only - the full value
   never reaches this code; a live adapter asks the client-identifiers edge
   fn to release it directly into the form engine server-side). */
function buildPaperworkPayload({ client, profile, identifiers, custodian, accountType, action, firmName, advisorName }) {
  const p = profile || {};
  const typeDef = PAPERWORK_ACCOUNT_TYPES.find(t => t.value === accountType) || PAPERWORK_ACCOUNT_TYPES[0];
  const custDef = PAPERWORK_CUSTODIANS.find(c => c.value === custodian) || PAPERWORK_CUSTODIANS[0];
  const pkgDef = PAPERWORK_PACKAGES.find(a => a.value === action) || PAPERWORK_PACKAGES[0];
  const pkgForms = pkgDef.forms.filter(f => !f.appliesTo || f.appliesTo.includes(typeDef.value));
  const members = Array.isArray(p.members) ? p.members : [];
  const adults = members.filter(m => m.role !== 'dependent');
  const owners = typeDef.owners === 'primary' ? adults.filter(m => m.role === 'primary').slice(0, 1)
    : typeDef.owners === 'adults' ? adults
    : members;
  const ids = Array.isArray(identifiers) ? identifiers : [];

  const ownerBlocks = owners.map((m, idx) => {
    const ssn = ids.find(r => r.member_id === m.id && r.kind === 'ssn');
    const role = `${idx + 1}own`; // Quik! role instance: 1own, 2own, ... (max 50)
    // Quik! wants FName/LName; Prism stores one name string. Best-effort split
    // (first word / last word, middles dropped) until first/last capture exists.
    const nameParts = String(m.name || '').trim().split(/\s+/).filter(Boolean);
    const fname = nameParts[0] || '';
    const lname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    return {
      memberId: m.id,
      quikRole: role,
      fields: [
        _pwField('full_name', 'Full legal name', m.name, 'Numbers panel · Household', undefined,
          [_qf(`${role}.FName`, fname, true), _qf(`${role}.LName`, lname, true)]),
        _pwField('date_of_birth', 'Date of birth', m.dateOfBirth, 'Numbers panel · Household', undefined,
          [_qf(`${role}.DOB`, m.dateOfBirth, false)]),
        _pwField('ssn', 'Social Security number',
          ssn ? `•••-••-${ssn.last4} (released at submission)` : '',
          'Encrypted identifier store', ssn ? 'gated' : 'missing',
          [_qf(`${role}.SSN`, '', true)]),
        _pwField('residential_address', 'Residential address', '', 'NOT CAPTURED YET - profile gap', undefined,
          [_qf(`${role}.H.Addr1`, '', true)]),
        _pwField('employment', 'Employer / occupation', '', 'NOT CAPTURED YET - profile gap', undefined,
          [_qf(`${role}.Emp.Occupation`, '', false)]),
        _pwField('citizenship', 'Citizenship', '', 'NOT CAPTURED YET - profile gap', undefined,
          [_qf(`${role}.Citizenship`, '', false)]),
      ],
    };
  });

  const grossMonthly = (Array.isArray(p.income?.sources) ? p.income.sources : [])
    .reduce((s, x) => s + (Number(x.monthlyGross) || 0), 0);
  const invested = (Number(p.taxable?.balance) || 0)
    + (Number(p.retirement?.iraBalance) || 0) + (Number(p.retirement?.fourohonekBalance) || 0)
    + (Number(p.retirement?.rothBalance) || 0) + (Number(p.retirement?.hsaBalance) || 0);
  const annualIncome = grossMonthly > 0 ? Math.round(grossMonthly * 12) : (Number(p.income?.monthlyTakehome) || 0) * 12 || '';

  // NOTE on 1acc.RegType: the registration-type checkbox is lookup-coded with
  // per-form positional values (docs/quik-field-taxonomy.md §3) - emit it only
  // once the per-form dictionary lands; 1acc.Reg (title text) is safe today.
  const account = [
    _pwField('custodian', 'Custodian', custDef.label, 'Selected'), // routing choice, not a form field
    _pwField('registration', 'Registration', typeDef.label, 'Selected', undefined,
      [_qf('1acc.Reg', typeDef.label, true)]),
    _pwField('household', 'Household / account title', client?.name, 'Client record'),
    ...(typeDef.needsEin ? [_pwField('trust_ein', 'Trust EIN', '', 'Encrypted identifier store (kind: ein) - capture when the trust docs land', undefined,
      [_qf('1trust.TaxID', '', false)])] : []),
    _pwField('annual_income', 'Annual income (est.)', annualIncome, 'Numbers panel · Income', undefined,
      [_qf('1own.AnnualIncome', annualIncome, false)]),
    _pwField('net_worth', 'Investable assets (est.)', invested || '', 'Numbers panel · balances', undefined,
      [_qf('1own.NetWorth', invested || '', false)]),
    _pwField('risk_profile', 'Risk profile', p.risk?.answers?.length ? 'On file (questionnaire complete)' : '', 'Risk questionnaire'),
    _pwField('filing_state', 'State (tax filing)', p.taxes?.state, 'Numbers panel · Planning & tax', undefined,
      [_qf('1own.H.State', p.taxes?.state, false)]),
  ];

  const firm = [
    _pwField('firm_name', 'Firm', firmName, 'Firm record', undefined,
      [_qf('1ria.FirmName', firmName, false)]),
    _pwField('advisor', 'Advisor of record', advisorName, 'Advisor record', undefined,
      [_qf('1rep.FullName', advisorName, false)]),
    _pwField('firm_custodian_id', custDef.firmIdLabel, '', 'BLANK - founder queue (custodian relationship)', undefined,
      [_qf('1macc.AcctNum', '', false)]), // macc = master-account role: the G-number's likely home (confirm)
  ];

  const allFields = [...ownerBlocks.flatMap(o => o.fields), ...account, ...firm];

  // The Execute-call shape (docs/quik-field-taxonomy.md §4): the live adapter
  // posts { QuikFormID, FormFields } to /qfe/execute/pdf server-side, appending
  // the SSN FormFields (gatedFields) from the client-identifiers edge fn.
  const quikEntries = allFields.flatMap(f => (f.quik || []).map(q => ({ ...q, status: f.status })));
  const quik = {
    service: 'POST https://websvcs.quikforms.com/rest/quikformsengine/qfe/execute/pdf',
    // QuikFormID is a list: one Execute call generates the whole action package.
    // All null until GET /forms/search runs with real credentials (founder queue).
    quikFormIds: pkgForms.map(f => f.formId),
    formFields: quikEntries
      .filter(q => q.status === 'ok' && q.value !== '' && q.value != null)
      .map(q => ({ FieldName: q.name, FieldValue: String(q.value) })),
    gatedFields: quikEntries.filter(q => q.status === 'gated').map(q => q.name),
    unverifiedFields: [...new Set(quikEntries.filter(q => !q.verified).map(q => q.name))],
  };

  return {
    version: 3,
    generated_at: new Date().toISOString(),
    custodian: custDef.value, registration: typeDef.value,
    package: {
      action: pkgDef.value, label: pkgDef.label,
      forms: pkgForms.map(({ slot, label, formId }) => ({ slot, label, formId })),
    },
    owners: ownerBlocks, account, firm, quik,
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
  const [action, setAction] = React.useState('open');
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
    client, profile: profileData, identifiers, custodian, accountType, action,
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
      <span style={{ color: 'var(--ink-mute)', flex: '0 0 38%' }}>
        {f.label}
        {Array.isArray(f.quik) && f.quik.length > 0 && (
          <span style={{ display: 'block', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--ink-faint)' }}>
            {f.quik.map(q => q.name + (q.verified ? '' : '*')).join(' · ')}
          </span>
        )}
      </span>
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
        back for server-side release (SSNs), and what is still uncaptured. Field names follow the
        Quik! taxonomy (shown under each label); * marks names pending confirmation against the
        per-form Quik! dictionary. The export below already carries the Quik!-shaped FormFields.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <label className="px-field" style={{ gridColumn: '1 / -1' }}>
          <span className="px-field-label">Action</span>
          <select className="px-select" value={action} onChange={e => setAction(e.target.value)}>
            {PAPERWORK_PACKAGES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
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

      {/* The action's form package - slots are the design contract; real Form
          IDs (and the multi-select + Create + preview flow) arrive with UAT
          credentials, built once against GET /forms/search. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, background: 'var(--bg-elev)' }}>
        <div className="px-eyebrow" style={{ marginBottom: 4 }}>Forms in this package</div>
        {payload.package.forms.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic', padding: '2px 0' }}>
            No forms in this package for the selected registration.
          </div>
        )}
        {payload.package.forms.map(f => (
          <div key={f.slot} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 12, padding: '2px 0' }}>
            <span style={{ color: 'var(--ink)' }}>{f.label}</span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 10.5, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
              {f.formId ? `Quik! form ${f.formId}` : 'Form ID pending Quik! credentials'}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>
          One Execute call generates the whole package (QuikFormID list); generated and signed
          documents land in the vault and can satisfy milestone document gates.
        </div>
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

Object.assign(window, { PaperworkModal, buildPaperworkPayload, PAPERWORK_ADAPTERS, PAPERWORK_PACKAGES, PAPERWORK_ACCOUNT_TYPES, PAPERWORK_CUSTODIANS });

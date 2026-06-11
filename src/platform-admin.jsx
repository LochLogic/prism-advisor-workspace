// Prism — Platform-owner dashboard (founder tier, above firm admin).
// Advisor bundle only — never ships to /portal. All authorization is
// server-side: every call goes through the platform-admin edge function,
// which checks the caller against the px_platform_owners allowlist and runs
// on the service role (no user RLS policy was touched). This view just
// renders whatever that function will admit to.

const PLATFORM_PLANS = ['starter', 'growth', 'enterprise'];

const PlatformFirmRow = ({ firm, onAction, busyId, showToast }) => {
  const [planEdit, setPlanEdit] = React.useState(null); // {plan, seats} | null
  const [roster, setRoster] = React.useState(null);     // advisors | null (closed)
  const [roleBusy, setRoleBusy] = React.useState(null); // advisor id mid-toggle
  const busy = busyId === firm.id;
  const suspended = firm.status === 'suspended';
  const sub = firm.subscription;

  const toggleRoster = async () => {
    if (roster) { setRoster(null); return; }
    const r = await window.db.platformAdmin('firm_detail', { firm_id: firm.id });
    setRoster(r?.advisors || []);
  };
  // Promote/demote a seat (admin ⇄ advisor) through the service-role action.
  const setRole = async (a, role) => {
    setRoleBusy(a.id);
    const r = await window.db.platformAdmin('set_advisor_role', { advisor_id: a.id, role });
    setRoleBusy(null);
    if (r?.advisor) {
      setRoster(prev => (prev || []).map(x => x.id === a.id ? { ...x, role: r.advisor.role } : x));
      showToast(`${r.advisor.full_name} is now ${r.advisor.role === 'admin' ? 'a firm admin' : 'an advisor'}`);
    } else showToast(r?.error || 'Could not change the role');
  };
  return (
    <>
      <tr style={suspended ? { opacity: 0.6 } : undefined}>
        <td>
          <div className="px-client-meta">
            <div className="px-client-name">{firm.name}{suspended && (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--brick)', textTransform: 'uppercase', letterSpacing: '.05em' }}>suspended</span>
            )}</div>
            <div className="px-client-tag" style={{ fontFamily: 'var(--mono)' }}>{firm.slug}.prismaw.com</div>
          </div>
        </td>
        <td>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'capitalize' }}>
            {firm.plan} · {firm.seats_purchased} seat{firm.seats_purchased === 1 ? '' : 's'}
          </span>
          {sub && (
            <div style={{ fontSize: 10.5, color: sub.status === 'active' ? 'var(--forest)' : 'var(--ink-faint)' }}>
              Stripe: {sub.status}
            </div>
          )}
        </td>
        <td className="is-num"><span className="px-num-serif">{firm.advisor_count}</span></td>
        <td className="is-num"><span className="px-num-serif">{firm.client_count}</span></td>
        <td>
          {firm.usage ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--ink)' }}>
                {firm.usage.events_30d} event{firm.usage.events_30d === 1 ? '' : 's'}
              </span>
              {firm.usage.last_event_at && (
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                  last {window.db.timeAgo(firm.usage.last_event_at)}
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }} title="No product events in the last 30 days (or analytics not yet enabled)">quiet</span>
          )}
        </td>
        <td>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {new Date(firm.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={toggleRoster}>
            {roster ? 'Hide' : 'Advisors'}
          </button>
          <button className="px-btn px-btn-sm px-btn-ghost" disabled={busy}
            onClick={() => setPlanEdit(planEdit ? null : { plan: firm.plan, seats: firm.seats_purchased })}>
            Plan
          </button>
          {suspended ? (
            <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--forest)' }} disabled={busy}
              onClick={() => onAction('reactivate_firm', firm)}>Reactivate</button>
          ) : (
            <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }} disabled={busy}
              onClick={() => onAction('suspend_firm', firm)}>Suspend</button>
          )}
        </td>
      </tr>
      {roster && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--bg-elev)' }}>
            {roster.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>
                No advisor seats yet.
              </div>
            ) : roster.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 12.5 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.full_name}</span>
                <span style={{ color: 'var(--ink-mute)' }}>{a.email}</span>
                <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em',
                  color: a.role === 'admin' ? 'var(--forest)' : 'var(--ink-faint)' }}>{a.role}</span>
                {a.active === false && <span style={{ fontSize: 10.5, color: 'var(--brick)' }}>inactive</span>}
                <div style={{ flex: 1 }} />
                {a.role === 'admin' ? (
                  <button className="px-btn px-btn-sm px-btn-ghost" disabled={roleBusy === a.id}
                    onClick={() => setRole(a, 'advisor')}>Make advisor</button>
                ) : (
                  <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--forest)' }} disabled={roleBusy === a.id}
                    onClick={() => setRole(a, 'admin')}>Make firm admin</button>
                )}
              </div>
            ))}
          </td>
        </tr>
      )}
      {planEdit && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--bg-elev)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Billing override:</span>
              <select className="px-select" style={{ width: 'auto' }} value={planEdit.plan}
                onChange={e => setPlanEdit(p => ({ ...p, plan: e.target.value }))} aria-label="Plan">
                {PLATFORM_PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="px-input" type="number" min="1" max="500" style={{ width: 80 }} value={planEdit.seats}
                onChange={e => setPlanEdit(p => ({ ...p, seats: e.target.value }))} aria-label="Seats" />
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>seats</span>
              <div style={{ flex: 1 }} />
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setPlanEdit(null)}>Cancel</button>
              <button className="px-btn px-btn-sm px-btn-primary" disabled={busy}
                onClick={async () => { await onAction('set_plan', firm, { plan: planEdit.plan, seats: Number(planEdit.seats) || 1 }); setPlanEdit(null); }}>
                Apply
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const PlatformOwnerDashboard = () => {
  const { setView, showToast } = useView();
  const { isDemo } = useAuth();
  const [state, setState]   = React.useState('loading'); // loading | denied | ready | error
  const [firms, setFirms]   = React.useState([]);
  const [busyId, setBusyId] = React.useState(null);
  const [provForm, setProvForm] = React.useState(null);
  const [provBusy, setProvBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (isDemo || !window.__sb) { setState('denied'); return; } // no platform tier in demo
    const r = await window.db.platformAdmin('overview');
    if (r?.firms) { setFirms(r.firms); setState('ready'); }
    else if (/authorized/i.test(r?.error || '')) setState('denied');
    else setState('error');
  }, [isDemo]);
  React.useEffect(() => { load(); }, [load]);

  const onAction = async (action, firm, payload = {}) => {
    setBusyId(firm.id);
    const r = await window.db.platformAdmin(action, { firm_id: firm.id, ...payload });
    setBusyId(null);
    if (r?.firm) {
      setFirms(prev => prev.map(f => f.id === firm.id ? { ...f, ...r.firm } : f));
      showToast(action === 'suspend_firm' ? `${firm.name} suspended — their workspace is locked`
        : action === 'reactivate_firm' ? `${firm.name} reactivated`
        : `${firm.name} → ${r.firm.plan} · ${r.firm.seats_purchased} seats`);
    } else showToast(r?.error || 'Action failed — check console');
  };

  const provision = async () => {
    if (!provForm?.name?.trim() || !provForm?.owner_email?.trim()) { showToast('Firm name and owner email are required'); return; }
    setProvBusy(true);
    const r = await window.db.platformAdmin('provision_firm', {
      name: provForm.name.trim(), plan: provForm.plan,
      owner_email: provForm.owner_email.trim(), owner_name: provForm.owner_name?.trim() || '',
    });
    setProvBusy(false);
    if (r?.firm) {
      setProvForm(null);
      showToast(r.invited ? `Firm created — ${provForm.owner_email} has an invite email` : 'Firm created and linked to the existing account');
      load();
    } else showToast(r?.error || 'Provisioning failed');
  };

  if (state === 'loading') return (
    <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
      Checking platform access…
    </div>
  );
  if (state !== 'ready') return (
    <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
      <Icons.Lock size={22} style={{ color: 'var(--ink-faint)' }} />
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>
        {state === 'denied' ? 'Platform tier is owner-only' : 'Could not reach the platform service'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-mute)', maxWidth: 380 }}>
        {state === 'denied'
          ? 'This view administers every firm on Prism and is limited to the platform owner allowlist.'
          : 'Try again in a moment — the platform-admin function did not respond.'}
      </div>
      <button className="px-btn px-btn-ghost" onClick={() => setView('advisor')}>
        <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Back to dashboard
      </button>
    </div>
  );

  const totals = firms.reduce((t, f) => ({
    advisors: t.advisors + (f.advisor_count || 0),
    clients: t.clients + (f.client_count || 0),
    active: t.active + (f.status !== 'suspended' ? 1 : 0),
  }), { advisors: 0, clients: 0, active: 0 });

  return (
    <div className="px-adv">
      <div className="px-adv-main">
        <div className="px-greet">
          <div className="px-eyebrow px-greet-eyebrow">Platform owner</div>
          <h1><em>Prism</em> across every firm</h1>
          <p className="px-greet-sub">
            {firms.length} firm{firms.length !== 1 ? 's' : ''} ({totals.active} active) · {totals.advisors} advisor seat{totals.advisors !== 1 ? 's' : ''} · {totals.clients} client household{totals.clients !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="px-section-head">
          <h2>Firms</h2>
          <div className="px-section-tools">
            {!provForm && (
              <button className="px-btn px-btn-sm px-btn-primary"
                onClick={() => setProvForm({ name: '', plan: 'starter', owner_email: '', owner_name: '' })}>
                <Icons.Plus size={11} /> Provision firm
              </button>
            )}
          </div>
        </div>

        {provForm && (
          <div style={{ padding: 14, background: 'var(--bg-elev)', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
              <input className="px-input" placeholder="Firm name" value={provForm.name} autoFocus
                onChange={e => setProvForm(f => ({ ...f, name: e.target.value }))} />
              <select className="px-select" value={provForm.plan} onChange={e => setProvForm(f => ({ ...f, plan: e.target.value }))}>
                {PLATFORM_PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="px-input" placeholder="Firm admin email" type="email" value={provForm.owner_email}
                onChange={e => setProvForm(f => ({ ...f, owner_email: e.target.value }))} />
              <input className="px-input" placeholder="Firm admin name (optional)" value={provForm.owner_name}
                onChange={e => setProvForm(f => ({ ...f, owner_name: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-faint)', alignSelf: 'center' }}>
                New emails get a Supabase invite and land as the firm's admin; existing accounts are linked directly.
              </div>
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setProvForm(null)}>Cancel</button>
              <button className="px-btn px-btn-sm px-btn-primary" onClick={provision} disabled={provBusy}>
                {provBusy ? 'Provisioning…' : 'Create firm'}
              </button>
            </div>
          </div>
        )}

        {firms.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No firms yet — provision the first one above.
          </div>
        ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Firm</th>
                  <th style={{ width: '18%' }}>Plan</th>
                  <th className="is-num">Advisors</th>
                  <th className="is-num">Clients</th>
                  <th style={{ width: 110 }}>Activity · 30d</th>
                  <th>Since</th>
                  <th style={{ width: 190 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {firms.map(f => <PlatformFirmRow key={f.id} firm={f} onAction={onAction} busyId={busyId} showToast={showToast} />)}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 28, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icons.Lock size={13} />
          <span>
            Platform tier — every action here runs through the <b>platform-admin</b> edge function against the
            founder allowlist, is <b>audit-logged</b>, and leaves firm-level row security untouched. Suspending a
            firm locks its advisor workspace; client data is never deleted.
          </span>
        </div>
      </div>
    </div>
  );
};

window.PlatformOwnerDashboard = PlatformOwnerDashboard;

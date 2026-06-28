// Prism - Platform-owner dashboard (founder tier, above firm admin).
// Advisor bundle only - never ships to /portal. All authorization is
// server-side: every call goes through the platform-admin edge function,
// which checks the caller against the px_platform_owners allowlist and runs
// on the service role (no user RLS policy was touched). This view just
// renders whatever that function will admit to.

const PLATFORM_PLANS = ['starter', 'growth', 'enterprise'];

// Cross-firm activation funnel + retention (30d), from px_events (round 5c).
const FUNNEL_STAGES = [
  ['login', 'Advisor logins'], ['invite_created', 'Client invites sent'],
  ['invite_claimed', 'Invites claimed'], ['portal_opened', 'Portal opens'],
  ['message_sent', 'Messages'], ['plan_updated', 'Plan updates'],
  ['report_printed', 'Reports printed'], ['push_subscribed', 'Push enabled'],
];
const FunnelPanel = ({ funnel }) => {
  if (!funnel) return null;
  const counts = funnel.counts || {};
  const max = Math.max(1, ...FUNNEL_STAGES.map(([k]) => counts[k] || 0));
  return (
    <div style={{ marginBottom: 22, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>Activation funnel <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)' }}>· last {funnel.window_days} days</span></h2>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          Active client households: <b style={{ color: 'var(--ink)' }}>{funnel.portal_clients_7d}</b> in 7d · <b style={{ color: 'var(--ink)' }}>{funnel.portal_clients_30d}</b> in 30d
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {FUNNEL_STAGES.map(([k, label]) => {
          const n = counts[k] || 0;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 140, fontSize: 12, color: 'var(--ink-mute)' }}>{label}</span>
              <div style={{ flex: 1, height: 14, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((n / max) * 100)}%`, height: '100%', background: 'var(--brand, var(--ink))', opacity: n ? 0.85 : 0 }} />
              </div>
              <span className="px-num-serif" style={{ width: 56, textAlign: 'right', fontSize: 13, color: 'var(--ink)' }}>{n}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 10 }}>
        {funnel.total} total events. Portal opens are the client-return signal; the 7d/30d active counts are the retention read.
      </div>
    </div>
  );
};

const PlatformFirmRow = ({ firm, onAction, busyId, showToast }) => {
  const [planEdit, setPlanEdit] = React.useState(null); // {plan, seats, subStatus, subPeriod} | null
  const [roster, setRoster] = React.useState(null);     // advisors | null (closed)
  const [roleBusy, setRoleBusy] = React.useState(null); // advisor id mid-toggle
  const [resetArm, setResetArm] = React.useState(null); // advisor id armed for 2FA reset
  const [resetBusy, setResetBusy] = React.useState(null);
  const [clients, setClients] = React.useState(null);   // read-only roster | null (closed)
  const [subBusy, setSubBusy] = React.useState(false);
  const [sub, setSub] = React.useState(firm.subscription); // local so an override re-renders
  const busy = busyId === firm.id;
  const suspended = firm.status === 'suspended';

  const toggleRoster = async () => {
    if (roster) { setRoster(null); return; }
    const r = await window.db.platformAdmin('firm_detail', { firm_id: firm.id });
    setRoster(r?.advisors || []);
  };
  const toggleClients = async () => {
    if (clients) { setClients(null); return; }
    const r = await window.db.platformAdmin('firm_clients', { firm_id: firm.id });
    setClients(r?.clients || []);
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
  // Recovery: clear a locked-out advisor's TOTP factor so they can sign in again.
  const resetMfa = async (a) => {
    setResetBusy(a.id); setResetArm(null);
    const r = await window.db.platformAdmin('reset_mfa', { advisor_id: a.id });
    setResetBusy(null);
    if (r && !r.error) showToast(r.removed ? `Two-factor reset for ${a.full_name} - they can sign in with their password` : `${a.full_name} had no two-factor enrolled`);
    else showToast(r?.error || 'Could not reset two-factor');
  };
  // Manual subscription override (comp / correct a stuck status).
  const applySubscription = async () => {
    setSubBusy(true);
    const r = await window.db.platformAdmin('set_subscription', {
      firm_id: firm.id, plan: planEdit.plan, status: planEdit.subStatus,
      period_end: planEdit.subPeriod || null,
    });
    setSubBusy(false);
    if (r?.subscription) { setSub(r.subscription); showToast(`Subscription set to ${r.subscription.status}`); }
    else showToast(r?.error || 'Could not set the subscription');
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
          {firm.last_login_at ? (
            <span style={{ fontSize: 12, color: 'var(--ink)' }} title={new Date(firm.last_login_at).toLocaleString()}>
              {window.db.timeAgo(firm.last_login_at)}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }} title="No login events recorded yet (analytics may not be enabled)">never</span>
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
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={toggleClients}>
            {clients ? 'Hide' : 'Clients'}
          </button>
          <button className="px-btn px-btn-sm px-btn-ghost" disabled={busy}
            onClick={() => setPlanEdit(planEdit ? null : { plan: firm.plan, seats: firm.seats_purchased,
              subStatus: sub?.status || 'active', subPeriod: '' })}>
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
          <td colSpan={8} style={{ background: 'var(--bg-elev)' }}>
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
                {resetArm === a.id ? (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--brick)' }}>Clear their 2FA?</span>
                    <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setResetArm(null)}>No</button>
                    <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                      disabled={resetBusy === a.id} onClick={() => resetMfa(a)}>
                      {resetBusy === a.id ? 'Resetting…' : 'Yes, reset'}
                    </button>
                  </>
                ) : (
                  <button className="px-btn px-btn-sm px-btn-ghost" title="Recovery: clear a locked-out advisor's two-factor"
                    disabled={resetBusy === a.id} onClick={() => setResetArm(a.id)}>Reset 2FA</button>
                )}
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
      {clients && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--bg-elev)' }}>
            {clients.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>
                No client households yet.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', padding: '2px 0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {clients.length} household{clients.length === 1 ? '' : 's'} · read-only · no financial data
                </div>
                {clients.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.name}</span>
                    {c.phase != null && <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>phase {String(c.phase + 1).padStart(2, '0')}</span>}
                    {c.advisor && <span style={{ color: 'var(--ink-mute)' }}>· {c.advisor}</span>}
                    {!c.active && <span style={{ fontSize: 10.5, color: 'var(--brick)' }}>archived</span>}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                      {c.last_meeting_at ? `met ${window.db.timeAgo(c.last_meeting_at)}` : 'no meeting logged'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </td>
        </tr>
      )}
      {planEdit && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--bg-elev)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Plan override:</span>
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
                onClick={async () => { await onAction('set_plan', firm, { plan: planEdit.plan, seats: Number(planEdit.seats) || 1 }); }}>
                Apply plan
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0 4px', borderTop: '1px solid var(--border)', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Subscription override:</span>
              <select className="px-select" style={{ width: 'auto' }} value={planEdit.subStatus}
                onChange={e => setPlanEdit(p => ({ ...p, subStatus: e.target.value }))} aria-label="Subscription status">
                {['active', 'trialing', 'past_due', 'canceled', 'incomplete'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="px-input" type="date" style={{ width: 'auto' }} value={planEdit.subPeriod}
                onChange={e => setPlanEdit(p => ({ ...p, subPeriod: e.target.value }))} aria-label="Period end" title="Renews / ends (optional)" />
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>comp or correct a stuck Stripe status</span>
              <div style={{ flex: 1 }} />
              <button className="px-btn px-btn-sm px-btn-ghost" disabled={subBusy} onClick={applySubscription}>
                {subBusy ? 'Saving…' : 'Apply subscription'}
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
  const [funnel, setFunnel] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [provForm, setProvForm] = React.useState(null);
  const [provBusy, setProvBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (isDemo || !window.__sb) { setState('denied'); return; } // no platform tier in demo
    const r = await window.db.platformAdmin('overview');
    if (r?.firms) { setFirms(r.firms); setState('ready'); }
    else if (/authorized/i.test(r?.error || '')) setState('denied');
    else setState('error');
    window.db.platformAdmin('funnel').then(f => { if (f?.funnel) setFunnel(f.funnel); });
  }, [isDemo]);
  React.useEffect(() => { load(); }, [load]);

  const onAction = async (action, firm, payload = {}) => {
    setBusyId(firm.id);
    const r = await window.db.platformAdmin(action, { firm_id: firm.id, ...payload });
    setBusyId(null);
    if (r?.firm) {
      setFirms(prev => prev.map(f => f.id === firm.id ? { ...f, ...r.firm } : f));
      showToast(action === 'suspend_firm' ? `${firm.name} suspended - their workspace is locked`
        : action === 'reactivate_firm' ? `${firm.name} reactivated`
        : `${firm.name} → ${r.firm.plan} · ${r.firm.seats_purchased} seats`);
    } else showToast(r?.error || 'Action failed - check console');
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
      showToast(r.invited ? `Firm created - ${provForm.owner_email} has an invite email` : 'Firm created and linked to the existing account');
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
          : 'Try again in a moment - the platform-admin function did not respond.'}
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

        <FunnelPanel funnel={funnel} />

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
            No firms yet - provision the first one above.
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
                  <th style={{ width: 100 }}>Last login</th>
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
            Platform tier - every action here runs through the <b>platform-admin</b> edge function against the
            founder allowlist, is <b>audit-logged</b>, and leaves firm-level row security untouched. Suspending a
            firm locks its advisor workspace; client data is never deleted.
          </span>
        </div>
      </div>
    </div>
  );
};

window.PlatformOwnerDashboard = PlatformOwnerDashboard;

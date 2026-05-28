// Prism — Advisor Dashboard (View A). Command center for the RIA.
// KPIs · Client Roster · Alerts feed · Flagged Questions inbox.

const { useMemo: useMemoAdv, useState: useStateAdv } = React;

/* ─── KPI tiles ──────────────────────────────────────────────────── */
const KpiTile = ({ label, value, sub, delta, deltaDir, sparkSeed, sparkTrend }) => (
  <div className="px-kpi">
    <div className="px-kpi-label">{label}</div>
    <div className="px-kpi-value">{value}</div>
    {sub && <div className="px-kpi-delta" style={{ color: 'var(--ink-mute)' }}>{sub}</div>}
    {delta && (
      <div className={`px-kpi-delta ${deltaDir === 'down' ? 'is-down' : ''}`}>
        {deltaDir === 'down' ? <Icons.TrendDown size={11} /> : <Icons.TrendUp size={11} />}
        {delta}
      </div>
    )}
    {sparkSeed && (
      <div className="px-kpi-spark">
        <Sparkline seed={sparkSeed} trend={sparkTrend} color="var(--gold)" width={64} height={22} />
      </div>
    )}
  </div>
);

/* ─── Phase label helper ─────────────────────────────────────────── */
const phaseLabel = (id) => {
  const p = phasesData.find(p => p.id === id);
  if (!p) return '—';
  return p;
};

/* ─── Roster row ─────────────────────────────────────────────────── */
const RosterRow = ({ client, onOpen }) => {
  const phase = phaseLabel(client.phase);
  return (
    <tr onClick={() => onOpen(client)}>
      <td>
        <div className="px-client-cell">
          <ClientAvatar client={client} size={32} />
          <div className="px-client-meta">
            <div className="px-client-name">{client.name}</div>
            <div className="px-client-tag">{client.tag}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="px-phase-pill">
          <span className="px-phase-pill-num">P{phase.num}</span>
          <span style={{ color: 'var(--ink)' }}>{phase.title}</span>
          <span className="px-progress">
            <span className="px-progress-fill" style={{ width: `${client.phaseProgress * 100}%` }} />
          </span>
        </div>
      </td>
      <td className="is-num">
        <span className="px-num-serif" style={{ fontSize: 16, color: 'var(--ink)' }}>
          {fmt$(client.aum, { short: true })}
        </span>
      </td>
      <td className="is-num px-hide-mobile">
        <span style={{ color: client.uninvestedCash > 80_000 ? 'var(--brick)' : 'var(--ink-mute)' }}>
          {client.uninvestedCash ? fmt$(client.uninvestedCash, { short: true }) : '—'}
        </span>
      </td>
      <td>
        <span className={`px-activity-dot ${client.recent ? 'is-recent' : client.lastActivity.includes('d') && parseInt(client.lastActivity) >= 7 ? 'is-warn' : ''}`}></span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{client.lastActivity}</span>
      </td>
      <td className="is-num px-hide-mobile">
        <Sparkline seed={client.id.charCodeAt(2) + client.id.charCodeAt(3)} trend={client.recent ? 'up' : 'flat'} color="var(--ink-faint)" width={48} height={16} />
      </td>
    </tr>
  );
};

/* ─── Alert card ─────────────────────────────────────────────────── */
const AlertCard = ({ alert, onSnooze, clients }) => {
  const { setView, setActiveClientId, showToast } = useView();
  const client = clients.find(c => c.id === alert.clientId);
  const I = Icons[alert.icon] || Icons.Bell;

  const handleCta = () => {
    if ((alert.cta === 'Open modeler' || alert.cta === 'Review plan') && alert.clientId) {
      setActiveClientId(alert.clientId);
      setView('client');
    } else if (alert.cta === 'Schedule call') {
      showToast(`Scheduling call with ${client?.shortName || 'client'} — calendar integration coming soon`);
    } else if (alert.cta === 'Draft note') {
      showToast(`Note drafted for ${client?.shortName || 'client'} — save to client file in Sprint 3`);
    } else {
      showToast(`${alert.cta} · ${client?.shortName || ''} — connected in a future sprint`);
    }
  };

  return (
    <div className="px-alert">
      <div className="px-alert-head">
        <span className={`px-alert-priority is-${alert.priority}`}>
          {alert.priority === 'high' ? 'Action' : alert.priority === 'med' ? 'Watch' : 'FYI'}
        </span>
        <span style={{ color: 'var(--ink-mute)' }}><I size={12} /></span>
        <span style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
          {alert.headline}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{alert.timeAgo} ago</span>
      </div>
      {client && (
        <div className="px-alert-client">
          <ClientAvatar client={client} size={16} /> &nbsp;
          <b>{client.shortName}</b> · {client.tag}
        </div>
      )}
      <div className="px-alert-msg" dangerouslySetInnerHTML={{ __html: alert.body }} />
      <div className="px-alert-actions">
        <button className="px-btn px-btn-sm px-btn-primary" onClick={handleCta}>
          <Icons.ArrowRight size={11} /> {alert.cta}
        </button>
        <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => onSnooze(alert.id)}>Snooze</button>
      </div>
    </div>
  );
};

/* ─── Flagged Question card ──────────────────────────────────────── */
const FlaggedQuestion = ({ q, onDismiss, clients }) => {
  const { showToast } = useView();
  const client = clients.find(c => c.id === q.clientId);
  return (
    <div className="px-question">
      <div className="px-question-head">
        <span className="px-question-client">
          {client && <><ClientAvatar client={client} size={14} /> &nbsp;</>}
          <b>{client?.shortName || 'Unknown'}</b>
        </span>
        <span className="px-question-time">{q.timeAgo} ago</span>
      </div>
      <div className="px-question-quote">{q.quote}</div>
      <div className="px-question-ctx">{q.context}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="px-btn px-btn-sm px-btn-primary"
          onClick={() => showToast(`Reply to ${client?.shortName || 'client'} — messaging coming in Sprint 3`)}>
          <Icons.Message size={10} /> Reply
        </button>
        <button className="px-btn px-btn-sm px-btn-ghost"
          onClick={() => { showToast('Added to next meeting agenda'); onDismiss && onDismiss(q.id); }}>
          <Icons.Calendar size={10} /> Add to agenda
        </button>
      </div>
    </div>
  );
};

/* ─── Roster section ─────────────────────────────────────────────── */
const RosterTable = ({ onOpenClient, clients, onAddClient, isLiveMode }) => {
  const [q, setQ] = useStateAdv('');
  const [sort, setSort] = useStateAdv('aum');
  const filtered = useMemoAdv(() => {
    const term = q.toLowerCase().trim();
    let list = clients;
    if (term) list = list.filter(c => c.name.toLowerCase().includes(term) || c.tag.toLowerCase().includes(term));
    if (sort === 'aum') list = [...list].sort((a, b) => b.aum - a.aum);
    if (sort === 'phase') list = [...list].sort((a, b) => b.phase - a.phase);
    if (sort === 'activity') list = [...list].sort((a, b) => Number(b.recent) - Number(a.recent));
    return list;
  }, [q, sort, clients]);

  return (
    <>
      <div className="px-section-head">
        <h2>Client roster {isLiveMode && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>live</span>}</h2>
        <div className="px-section-tools">
          <div className="px-search">
            <Icons.Search size={12} />
            <input placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="px-select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--sans)' }}
                  value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="aum">Sort · AUM</option>
            <option value="phase">Sort · Horizon</option>
            <option value="activity">Sort · Activity</option>
          </select>
          {isLiveMode && onAddClient && (
            <button className="px-btn px-btn-sm px-btn-primary" onClick={onAddClient}>
              <Icons.Plus size={11} /> Add client
            </button>
          )}
        </div>
      </div>
      <div className="px-roster">
        <table className="px-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>Client</th>
              <th style={{ width: '28%' }}>Current Horizon</th>
              <th className="is-num">AUM</th>
              <th className="is-num px-hide-mobile">Uninvested cash</th>
              <th style={{ width: 90 }}>Activity</th>
              <th className="is-num px-hide-mobile" style={{ width: 64 }}>YTD</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => <RosterRow key={c.id} client={c} onOpen={onOpenClient} />)}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─── New Client modal ───────────────────────────────────────────── */
const PHASES = phasesData.map(p => ({ value: p.id, label: `Phase ${p.num} — ${p.title}` }));

const NewClientModal = ({ isOpen, onClose, advisorId, onCreated }) => {
  const { showToast } = useView();
  const [saving, setSaving] = useStateAdv(false);
  const [form, setForm] = useStateAdv({ household_name: '', short_name: '', household_tag: '', current_phase: 0 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.household_name.trim()) return;
    setSaving(true);
    const row = await window.db.createClient(advisorId, form);
    setSaving(false);
    if (row) {
      showToast(`${form.short_name || form.household_name} added to your roster`);
      onCreated(window.db.mapClient(row));
      setForm({ household_name: '', short_name: '', household_tag: '', current_phase: 0 });
      onClose();
    } else {
      showToast('Could not save — check console for details');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ padding: 28, minWidth: 360 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: '0 0 20px', color: 'var(--ink)' }}>
          Add new client
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Household name *</span>
              <input className="px-input" placeholder="e.g. Johnson Household" required
                value={form.household_name} onChange={e => set('household_name', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Short name</span>
              <input className="px-input" placeholder="e.g. Johnsons (shown in compact views)"
                value={form.short_name} onChange={e => set('short_name', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Tag / description</span>
              <input className="px-input" placeholder="e.g. Accumulation · 2 members"
                value={form.household_tag} onChange={e => set('household_tag', e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Starting horizon</span>
              <select className="px-select" value={form.current_phase}
                onChange={e => set('current_phase', Number(e.target.value))}>
                {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
            <button type="button" className="px-btn px-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="px-btn px-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

/* ─── Client preview modal (when an advisor clicks a row) ─────────── */
const ClientPreviewModal = ({ client, onClose, onNotesChange }) => {
  const { setView, setActiveClientId, showToast } = useView();
  const [editingNotes, setEditingNotes] = useStateAdv(false);
  const [notes, setNotes] = useStateAdv('');

  React.useEffect(() => {
    if (client) setNotes(client.notes || '');
  }, [client?.id]);

  if (!client) return null;
  const phase = phaseLabel(client.phase);
  const openRoadmap = () => { setActiveClientId(client.id); setView('client'); onClose(); };
  const isLiveClient = window.db?.isUUID(client.id);

  const saveNotes = () => {
    setEditingNotes(false);
    if (!isLiveClient) return;
    window.db.updateClientNotes(client.id, notes);
    onNotesChange && onNotesChange(client.id, notes);
    showToast('Notes saved');
  };

  return (
    <Modal isOpen={!!client} onClose={onClose}>
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          <ClientAvatar client={client} size={48} />
          <div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>{client.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{client.tag} · last activity {client.lastActivity}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6 }}>
            <div className="px-portstat-label">AUM</div>
            <div className="px-portstat-value" style={{ fontSize: 19 }}>{client.aum ? fmt$(client.aum, { short: true }) : '—'}</div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6 }}>
            <div className="px-portstat-label">Current Horizon</div>
            <div style={{ marginTop: 5 }}>
              <div className="px-phase-pill-num">P{phase.num}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)', marginTop: 2 }}>{phase.title}</div>
            </div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6 }}>
            <div className="px-portstat-label">Uninvested cash</div>
            <div className="px-portstat-value" style={{ fontSize: 19, color: client.uninvestedCash > 80_000 ? 'var(--brick)' : 'var(--ink)' }}>
              {client.uninvestedCash ? fmt$(client.uninvestedCash, { short: true }) : '—'}
            </div>
          </div>
        </div>

        {/* Notes — editable for real clients */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Notes</span>
            {isLiveClient && !editingNotes && (
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setEditingNotes(true)}>
                <Icons.Edit size={10} /> Edit
              </button>
            )}
          </div>
          {editingNotes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                className="px-input"
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13 }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="px-btn px-btn-sm px-btn-primary" onClick={saveNotes}>Save</button>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => { setEditingNotes(false); setNotes(client.notes || ''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, minHeight: 42 }}>
              {notes ? `"${notes}"` : <span style={{ color: 'var(--ink-faint)' }}>No notes yet.</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="px-btn px-btn-ghost"><Icons.Phone size={12} /> Call</button>
          <button className="px-btn px-btn-ghost"><Icons.Message size={12} /> Message</button>
          <button className="px-btn px-btn-primary" onClick={openRoadmap}><Icons.Eye size={12} /> Open client roadmap</button>
        </div>
      </div>
    </Modal>
  );
};

/* ─── Empty roster state ─────────────────────────────────────────── */
const EmptyRoster = ({ onAddClient }) => (
  <div style={{ padding: '52px 0', textAlign: 'center', borderRadius: 8, border: '1px dashed var(--border-2)', marginTop: 8 }}>
    <div style={{ width: 44, height: 44, background: 'var(--bg-elev)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
      <Icons.Users size={18} style={{ color: 'var(--ink-mute)' }} />
    </div>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>No clients yet</div>
    <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 18 }}>Add your first client to start building your book.</div>
    <button className="px-btn px-btn-primary" onClick={onAddClient}>
      <Icons.Plus size={12} /> Add first client
    </button>
  </div>
);

/* ─── Main Advisor Dashboard ─────────────────────────────────────── */
const AdvisorDashboard = () => {
  const { authUser } = useAuth();
  const [previewClient, setPreviewClient] = useStateAdv(null);
  const [addingClient, setAddingClient] = useStateAdv(false);
  const [snoozed, setSnoozed] = useStateAdv(new Set());
  const [dismissedQs, setDismissedQs] = useStateAdv(new Set());

  // undefined = not yet fetched; [] = fetched, empty; [...] = has rows
  const [dbClients,   setDbClients]   = useStateAdv(undefined);
  const [dbAlerts,    setDbAlerts]    = useStateAdv(undefined);
  const [dbQuestions, setDbQuestions] = useStateAdv(undefined);

  // Fetch from Supabase when advisor auth record is available
  React.useEffect(() => {
    if (!authUser?.id || !window.db) return;
    const id = authUser.id;
    window.db.getClients(id).then(rows => {
      setDbClients(rows ? rows.map(window.db.mapClient) : []);
    });
    window.db.getAlerts(id).then(rows => {
      setDbAlerts(rows ? rows.map(window.db.mapAlert) : []);
    });
    window.db.getFlaggedQuestions(id).then(rows => {
      setDbQuestions(rows ? rows.map(window.db.mapFlaggedQuestion) : []);
    });
  }, [authUser?.id]);

  const isLiveMode = dbClients !== undefined;  // true once fetch completes

  // Use real data when fetched; fall back to mock in demo / no-auth mode
  const activeClients   = isLiveMode ? dbClients   : clientsData;
  const activeAlerts    = isLiveMode ? (dbAlerts    || []) : alertsData;
  const activeQuestions = isLiveMode ? (dbQuestions || []) : questionsData;

  const handleClientCreated = (newClient) => {
    setDbClients(prev => [...(prev || []), newClient]);
  };

  const handleNotesChange = (clientId, notes) => {
    setDbClients(prev => (prev || []).map(c => c.id === clientId ? { ...c, notes } : c));
    if (previewClient?.id === clientId) setPreviewClient(p => ({ ...p, notes }));
  };

  const snooze = (id) => {
    setSnoozed(prev => new Set([...prev, id]));
    window.db?.snoozeAlert(id);
  };
  const dismissQ = (id) => {
    setDismissedQs(prev => new Set([...prev, id]));
    window.db?.resolveQuestion(id);
  };

  const visibleAlerts = useMemoAdv(() => activeAlerts.filter(a => !snoozed.has(a.id)), [activeAlerts, snoozed]);
  const visibleQs     = useMemoAdv(() => activeQuestions.filter(q => !dismissedQs.has(q.id)), [activeQuestions, dismissedQs]);

  const greetDate = (() => {
    const d = new Date();
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const mon = d.toLocaleDateString('en-US', { month: 'short' });
    return `${day} · ${mon} ${d.getDate()}`;
  })();
  const greetTime = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; })();
  const greetName = authUser?.full_name?.split(' ')[0] || advisor.name;

  const kpis = useMemoAdv(() => {
    const list = activeClients;
    return {
      totalAUM:      list.reduce((a, c) => a + c.aum, 0),
      totalCashDrag: list.reduce((a, c) => a + c.uninvestedCash, 0),
      activeCount:   list.length,
      inLateHorizon: list.filter(c => c.phase >= 5).length,
    };
  }, [activeClients]);

  return (
    <div className="px-adv">
      <ClientPreviewModal client={previewClient} onClose={() => setPreviewClient(null)} onNotesChange={handleNotesChange} />
      <NewClientModal
        isOpen={addingClient}
        onClose={() => setAddingClient(false)}
        advisorId={authUser?.id}
        onCreated={handleClientCreated}
      />

      <div className="px-adv-main">
        {/* Greeting */}
        <div className="px-greet">
          <div className="px-eyebrow px-greet-eyebrow">
            <span>{greetDate}</span>
          </div>
          <h1>Good {greetTime}, <em>{greetName}</em>.</h1>
          <p className="px-greet-sub">
            {isLiveMode
              ? `${activeClients.length} client${activeClients.length !== 1 ? 's' : ''} in your book · ${visibleAlerts.filter(a => a.priority === 'high').length} action item${visibleAlerts.filter(a => a.priority === 'high').length !== 1 ? 's' : ''} · ${visibleQs.length} question${visibleQs.length !== 1 ? 's' : ''} pending`
              : `${visibleAlerts.filter(a => a.priority === 'high').length} action items this ${greetTime} and ${visibleQs.length} client questions awaiting reply.`
            }
          </p>
        </div>

        {/* KPIs */}
        <div className="px-kpis">
          <KpiTile label="Book AUM" value={kpis.totalAUM ? fmt$(kpis.totalAUM, { short: true, decimals: 1 }) : '—'}
                   delta={isLiveMode ? null : '+ $1.8M MTD'} deltaDir="up"
                   sparkSeed={7} sparkTrend="up" />
          <KpiTile label="Active clients" value={kpis.activeCount}
                   sub={isLiveMode ? null : '2 onboarding'}
                   sparkSeed={3} sparkTrend="up" />
          <KpiTile label="Late-horizon" value={kpis.inLateHorizon}
                   sub="Phase 06 +"
                   sparkSeed={11} sparkTrend="up" />
          <KpiTile label="Cash drag" value={kpis.totalCashDrag ? fmt$(kpis.totalCashDrag, { short: true }) : '—'}
                   delta={isLiveMode ? null : '3 clients over target'} deltaDir="down"
                   sparkSeed={19} sparkTrend="up" />
        </div>

        {/* Roster */}
        {activeClients.length === 0
          ? <>
              <div className="px-section-head"><h2>Client roster</h2></div>
              <EmptyRoster onAddClient={() => setAddingClient(true)} />
            </>
          : <RosterTable
              onOpenClient={setPreviewClient}
              clients={activeClients}
              onAddClient={() => setAddingClient(true)}
              isLiveMode={isLiveMode}
            />
        }

        {/* Footer note */}
        <div style={{ marginTop: 28, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icons.Info size={13} />
          <span>
            {isLiveMode
              ? <>Roster shows your live book. <b>Row-level security</b> ensures each advisor sees only their clients.</>
              : <>Running in <b>demo mode</b> — sign in to see your live roster. <b>RLS</b> ensures advisors see only their own book.</>
            }
          </span>
        </div>
      </div>

      <aside className="px-adv-side">
        <div className="px-side-section">
          <div className="px-side-head">
            <h3><Icons.Bell size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Alerts & nudges</h3>
            <span className="px-side-count">{visibleAlerts.length} open</span>
          </div>
          {visibleAlerts.map(a => <AlertCard key={a.id} alert={a} onSnooze={snooze} clients={activeClients} />)}
          {visibleAlerts.length === 0 && (
            <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 13 }}>
              All clear — no open alerts.
            </div>
          )}
        </div>

        <div className="px-side-section">
          <div className="px-side-head">
            <h3><Icons.Inbox size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Flagged questions</h3>
            <span className="px-side-count">{visibleQs.length} unread</span>
          </div>
          {visibleQs.map(q => <FlaggedQuestion key={q.id} q={q} onDismiss={dismissQ} clients={activeClients} />)}
          {visibleQs.length === 0 && (
            <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 13 }}>
              Inbox empty — no pending questions.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

window.AdvisorDashboard = AdvisorDashboard;

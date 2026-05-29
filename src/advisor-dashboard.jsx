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
        {client.lastReview && (
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 1 }}>
            reviewed {client.lastReview}
          </div>
        )}
      </td>
      <td className="is-num px-hide-mobile">
        <Sparkline seed={client.id.charCodeAt(2) + client.id.charCodeAt(3)} trend={client.recent ? 'up' : 'flat'} color="var(--ink-faint)" width={48} height={16} />
      </td>
    </tr>
  );
};

/* ─── Alert card ─────────────────────────────────────────────────── */
const AlertCard = ({ alert, onSnooze, clients }) => {
  const { openClientPortal, showToast } = useView();
  const client = clients.find(c => c.id === alert.clientId);
  const I = Icons[alert.icon] || Icons.Bell;

  const handleCta = () => {
    if ((alert.cta === 'Open modeler' || alert.cta === 'Review plan') && client) {
      openClientPortal(client);
    } else if (alert.cta === 'Schedule call') {
      showToast(`Scheduling call with ${client?.shortName || 'client'} — calendar integration coming soon`);
    } else if (alert.cta === 'Draft note') {
      showToast(`Note drafted for ${client?.shortName || 'client'} — visible in the client record`);
    } else {
      showToast(`${alert.cta} · ${client?.shortName || ''}`);
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
const FlaggedQuestion = ({ q, onDismiss, clients, authUser, onOpenClient }) => {
  const { showToast } = useView();
  const client = clients.find(c => c.id === q.clientId);
  const [expanded,  setExpanded]  = React.useState(false);
  const [messages,  setMessages]  = React.useState(null); // null = not yet loaded
  const [replyText, setReplyText] = React.useState('');
  const [sending,   setSending]   = React.useState(false);
  const replyRef = React.useRef(null);

  const loadMessages = React.useCallback(async () => {
    if (!q._dbId || !window.db) return;
    const msgs = await window.db.getFlagMessages(q._dbId);
    setMessages(msgs || []);
  }, [q._dbId]);

  React.useEffect(() => {
    if (expanded) {
      loadMessages();
      // Focus the reply input when thread opens
      setTimeout(() => replyRef.current?.focus(), 80);
    }
  }, [expanded, loadMessages]);

  const sendReply = async () => {
    if (!replyText.trim() || !authUser?.id || !q._dbId) return;
    setSending(true);
    const msg = await window.db.addFlagMessage(q._dbId, authUser.id, 'advisor', replyText);
    setSending(false);
    if (msg) {
      setMessages(prev => [...(prev || []), msg]);
      setReplyText('');
      showToast(`Reply sent to ${client?.shortName || 'client'}`);
    } else {
      showToast('Could not send reply — check console');
    }
  };

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

      {/* Reply thread */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {messages === null && (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8 }}>Loading…</div>
          )}
          {messages?.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', marginBottom: 8 }}>
              No replies yet — start the conversation below.
            </div>
          )}
          {messages?.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: m.author_role === 'advisor' ? 'flex-end' : 'flex-start',
              marginBottom: 6,
            }}>
              <div style={{
                fontSize: 12, lineHeight: 1.45,
                background: m.author_role === 'advisor' ? 'var(--ink)' : 'var(--surface-raised)',
                color: m.author_role === 'advisor' ? 'white' : 'var(--ink)',
                padding: '7px 11px', borderRadius: 8, maxWidth: '82%',
              }}>
                {m.body}
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 3 }}>
                  {m.author_role === 'advisor' ? 'You' : (client?.shortName || 'Client')}
                  {' · '}{window.db?.timeAgo(m.created_at) || ''}
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              ref={replyRef}
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendReply(); } }}
              placeholder="Write a reply…"
              style={{
                flex: 1, padding: '6px 9px', fontSize: 12,
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--ink)',
              }}
            />
            <button className="px-btn px-btn-sm px-btn-primary"
              onClick={sendReply} disabled={sending || !replyText.trim()}>
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="px-btn px-btn-sm px-btn-primary"
          onClick={() => setExpanded(v => !v)}>
          <Icons.Message size={10} /> {expanded ? 'Hide thread' : 'Reply'}
        </button>
        {onOpenClient && client && (
          <button className="px-btn px-btn-sm px-btn-ghost"
            onClick={() => onOpenClient(client)}>
            <Icons.ArrowRight size={10} /> Open client
          </button>
        )}
        <button className="px-btn px-btn-sm px-btn-ghost"
          onClick={() => { showToast('Added to next meeting agenda'); onDismiss && onDismiss(q.id); }}>
          <Icons.Calendar size={10} /> Agenda
        </button>
      </div>
    </div>
  );
};

/* ─── Roster section ─────────────────────────────────────────────── */
const RosterTable = ({ onOpenClient, clients, onAddClient, isLiveMode, onExportCSV }) => {
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
          {isLiveMode && onExportCSV && (
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={onExportCSV}
              title="Download roster as CSV">
              <Icons.Download size={11} /> CSV
            </button>
          )}
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

const NewClientModal = ({ isOpen, onClose, advisorId, firmId, onCreated }) => {
  const { showToast } = useView();
  const [saving, setSaving] = useStateAdv(false);
  const [form, setForm] = useStateAdv({ household_name: '', short_name: '', household_tag: '', current_phase: 0 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.household_name.trim()) return;
    setSaving(true);
    const row = await window.db.createClient(advisorId, firmId, form);
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

/* ─── Client preview modal ───────────────────────────────────────── */
const TAB_STYLE = (active) => ({
  padding: '8px 16px', fontSize: 12,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--ink)' : 'var(--ink-mute)',
  background: 'none', border: 'none',
  borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
  cursor: 'pointer', textTransform: 'capitalize',
  letterSpacing: '.03em', marginBottom: -1,
});

const LABEL_STYLE = {
  fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)',
  textTransform: 'uppercase', letterSpacing: '.05em',
};

const ClientPreviewModal = ({ client, onClose, onNotesChange, onUpdated, onArchived, advisorId }) => {
  const { openClientPortal, showToast } = useView();
  const [tab, setTab] = useStateAdv('overview');

  // Notes state
  const [editingNotes, setEditingNotes] = useStateAdv(false);
  const [notes, setNotes] = useStateAdv('');

  // Accounts state
  const [accounts, setAccounts] = useStateAdv(undefined);
  const [accForm, setAccForm] = useStateAdv(null);
  const [savingAcc, setSavingAcc] = useStateAdv(false);

  // Meetings state
  const [meetings,      setMeetings]      = useStateAdv(undefined);
  const [meetingForm,   setMeetingForm]   = useStateAdv(null);
  const [savingMeeting, setSavingMeeting] = useStateAdv(false);

  // Edit client state
  const [editForm, setEditForm] = useStateAdv({});
  const [savingEdit, setSavingEdit] = useStateAdv(false);
  const [archiving, setArchiving] = useStateAdv(false);

  // Inline confirmation guards (replace window.confirm / immediate deletes)
  const [confirmArchive,      setConfirmArchive]      = useStateAdv(false);
  const [confirmDeleteAccId,  setConfirmDeleteAccId]  = useStateAdv(null);
  const [confirmDeleteMtgId,  setConfirmDeleteMtgId]  = useStateAdv(null);

  React.useEffect(() => {
    if (client) {
      setNotes(client.notes || '');
      setTab('overview');
      setAccounts(undefined);
      setAccForm(null);
      setMeetings(undefined);
      setMeetingForm(null);
      setEditForm({
        household_name: client.name,
        short_name:     client.shortName,
        household_tag:  client.tag === '—' ? '' : client.tag,
        current_phase:  client.phase,
      });
      setConfirmArchive(false);
      setConfirmDeleteAccId(null);
      setConfirmDeleteMtgId(null);
    }
  }, [client?.id]);

  // Load accounts when tab becomes active
  React.useEffect(() => {
    if (tab === 'accounts' && client && window.db?.isUUID(client.id) && accounts === undefined) {
      window.db.getAccounts(client.id).then(rows => setAccounts(rows || []));
    }
  }, [tab]);

  // Load meetings whenever a live client opens
  React.useEffect(() => {
    if (client && window.db?.isUUID(client.id)) {
      window.db.getMeetings(client.id).then(rows => setMeetings(rows || []));
    }
  }, [client?.id]);

  if (!client) return null;

  const phase = phaseLabel(client.phase);
  const isLiveClient = window.db?.isUUID(client.id);
  const openRoadmap = () => { openClientPortal(client); onClose(); };

  /* notes */
  const saveNotes = () => {
    setEditingNotes(false);
    if (!isLiveClient) return;
    window.db.updateClientNotes(client.id, notes);
    onNotesChange && onNotesChange(client.id, notes);
    showToast('Notes saved');
  };

  /* accounts */
  const setAcc = (k, v) => setAccForm(f => ({ ...f, [k]: v }));

  const saveAccount = async () => {
    setSavingAcc(true);
    const row = await window.db.upsertAccount({
      ...accForm,
      client_id: client.id,
      balance: Number(accForm.balance) || 0,
      cash:    Number(accForm.cash)    || 0,
    });
    if (row) {
      const totals = await window.db.syncClientTotals(client.id);
      setSavingAcc(false);
      setAccounts(prev => {
        const idx = (prev || []).findIndex(a => a.id === row.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
        return [...(prev || []), row];
      });
      setAccForm(null);
      showToast('Account saved');
      if (totals && onUpdated) {
        onUpdated({ ...client, aum: totals.aum, uninvestedCash: totals.uninvested_cash });
      }
    } else {
      setSavingAcc(false);
      showToast('Could not save account — check console');
    }
  };

  const deleteAccount = async (id) => {
    await window.db.deleteAccount(id, client.id);
    const totals = await window.db.syncClientTotals(client.id);
    setAccounts(prev => (prev || []).filter(a => a.id !== id));
    showToast('Account removed');
    if (totals && onUpdated) {
      onUpdated({ ...client, aum: totals.aum, uninvestedCash: totals.uninvested_cash });
    }
  };

  /* meetings */
  const saveMeeting = async () => {
    if (!advisorId) { showToast('No advisor ID — cannot log meeting'); return; }
    setSavingMeeting(true);
    const met_at = meetingForm.met_at
      ? new Date(meetingForm.met_at).toISOString()
      : new Date().toISOString();
    const row = await window.db.logMeeting(client.id, advisorId, { ...meetingForm, met_at });
    setSavingMeeting(false);
    if (row) {
      setMeetings(prev => [row, ...(prev || [])]);
      setMeetingForm(null);
      showToast('Meeting logged');
    } else {
      showToast('Could not log meeting — check console');
    }
  };

  const deleteMeeting = async (id) => {
    await window.db.deleteMeeting(id, client.id);
    setMeetings(prev => (prev || []).filter(m => m.id !== id));
    showToast('Meeting removed');
  };

  /* edit client */
  const setEdit = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const saveEdit = async () => {
    setSavingEdit(true);
    const row = await window.db.updateClient(client.id, editForm);
    setSavingEdit(false);
    if (row) {
      const updated = window.db.mapClient(row);
      onUpdated && onUpdated(updated);
      showToast('Client updated');
    } else {
      showToast('Could not save — check console');
    }
  };

  const archiveClient = async () => {
    setArchiving(true);
    await window.db.archiveClient(client.id);
    setArchiving(false);
    setConfirmArchive(false);
    onArchived && onArchived(client.id);
    onClose();
    showToast(`${client.shortName} archived`);
  };

  return (
    <Modal isOpen={!!client} onClose={onClose}>
      {/* ── Header ── */}
      <div style={{ padding: '28px 28px 0' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <ClientAvatar client={client} size={44} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>{client.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3 }}>
              {client.tag} · last activity {client.lastActivity}
              {meetings?.length > 0 && ` · reviewed ${timeAgo(meetings[0].met_at)} ago`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="px-btn px-btn-sm px-btn-ghost"
              aria-label="Print client report"
              onClick={() => window.printClientReport?.(client, phase, meetings || [])}>
              <Icons.Download size={12} /> Print
            </button>
            <button className="px-btn px-btn-primary" onClick={openRoadmap}>
              <Icons.Eye size={12} /> View roadmap
            </button>
          </div>
        </div>

        {/* Tabs — only for live (real UUID) clients */}
        {isLiveClient && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
            {['overview', 'accounts', 'edit'].map(t => (
              <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '20px 28px 28px', maxHeight: '62vh', overflowY: 'auto', minWidth: 440 }}>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'AUM', value: client.aum ? fmt$(client.aum, { short: true }) : '—', color: 'var(--ink)' },
                { label: 'Current Horizon', value: `P${phase.num} · ${phase.title}`, color: 'var(--ink)', small: true },
                { label: 'Uninvested cash', value: client.uninvestedCash ? fmt$(client.uninvestedCash, { short: true }) : '—', color: client.uninvestedCash > 80_000 ? 'var(--brick)' : 'var(--ink)' },
              ].map(({ label, value, color, small }) => (
                <div key={label} style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6 }}>
                  <div className="px-portstat-label">{label}</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: small ? 14 : 19, fontWeight: 500, color, marginTop: 5, lineHeight: 1.3 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={LABEL_STYLE}>Notes</span>
                {isLiveClient && !editingNotes && (
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setEditingNotes(true)}>
                    <Icons.Edit size={10} /> Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea className="px-input" rows={3}
                    style={{ resize: 'vertical', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13 }}
                    value={notes} onChange={e => setNotes(e.target.value)} autoFocus />
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

            {!isLiveClient && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="px-btn px-btn-ghost" aria-label="Call client"><Icons.Phone size={12} /> Call</button>
                <button className="px-btn px-btn-ghost" aria-label="Message client"><Icons.Message size={12} /> Message</button>
              </div>
            )}

            {/* ── Meeting log (live clients only) ── */}
            {isLiveClient && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={LABEL_STYLE}>Meeting log</span>
                  {!meetingForm && (
                    <button className="px-btn px-btn-sm px-btn-ghost"
                      onClick={() => setMeetingForm({
                        notes: '', duration_min: '',
                        met_at: new Date().toISOString().slice(0, 16),
                      })}>
                      <Icons.Plus size={10} /> Log meeting
                    </button>
                  )}
                </div>

                {/* Inline log form */}
                {meetingForm && (
                  <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Date & time</span>
                        <input className="px-input" type="datetime-local"
                          value={meetingForm.met_at}
                          onChange={e => setMeetingForm(f => ({ ...f, met_at: e.target.value }))} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Min</span>
                        <input className="px-input" type="number" placeholder="60"
                          value={meetingForm.duration_min}
                          onChange={e => setMeetingForm(f => ({ ...f, duration_min: e.target.value }))} />
                      </label>
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Notes</span>
                      <textarea className="px-input" rows={2}
                        placeholder="Topics covered, decisions made…"
                        style={{ resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 13 }}
                        value={meetingForm.notes}
                        onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))} />
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="px-btn px-btn-sm px-btn-primary" onClick={saveMeeting} disabled={savingMeeting}>
                        {savingMeeting ? 'Saving…' : 'Log meeting'}
                      </button>
                      <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setMeetingForm(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Meeting list */}
                {meetings === undefined && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading…</div>
                )}
                {meetings !== undefined && meetings.length === 0 && !meetingForm && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>
                    No meetings logged yet.
                  </div>
                )}
                {(meetings || []).map(m => (
                  <div key={m.id} className="px-meeting-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                        {new Date(m.met_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {m.duration_min && (
                          <span style={{ fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>{m.duration_min} min</span>
                        )}
                      </div>
                      {m.notes && (
                        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.4 }}>{m.notes}</div>
                      )}
                    </div>
                    {confirmDeleteMtgId === m.id ? (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        <button style={{ background: 'none', border: 'none', color: 'var(--brick)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: 'var(--sans)' }}
                          onClick={() => { deleteMeeting(m.id); setConfirmDeleteMtgId(null); }}>Remove</button>
                        <button style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: 'var(--sans)' }}
                          onClick={() => setConfirmDeleteMtgId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '2px 0', lineHeight: 1, flexShrink: 0 }}
                        onClick={() => setConfirmDeleteMtgId(m.id)}>
                        <Icons.X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Accounts ── */}
        {tab === 'accounts' && (
          <>
            {accounts === undefined && (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Loading accounts…</div>
            )}

            {accounts !== undefined && accounts.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Type', 'Custodian', 'Balance', 'Cash', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Balance' || h === 'Cash' ? 'right' : 'left', padding: '4px 8px 8px', color: 'var(--ink-mute)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 8px 9px 8px', color: 'var(--ink)', fontFamily: 'var(--serif)' }}>
                        {window.db.ACCOUNT_TYPE_LABELS[a.type] || a.type}
                        {a.name && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--sans)', fontStyle: 'normal' }}>{a.name}</div>}
                      </td>
                      <td style={{ padding: '9px 8px', color: 'var(--ink-mute)' }}>{a.custodian || '—'}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--mono, monospace)', color: 'var(--ink)' }}>{fmt$(a.balance, { short: true })}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--mono, monospace)', color: a.cash > 0 ? 'var(--brick)' : 'var(--ink-mute)' }}>{a.cash ? fmt$(a.cash, { short: true }) : '—'}</td>
                      <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="px-btn px-btn-sm px-btn-ghost" style={{ marginRight: 4 }}
                          onClick={() => setAccForm({ id: a.id, type: a.type, custodian: a.custodian || '', name: a.name || '', balance: a.balance, cash: a.cash })}>
                          <Icons.Edit size={10} />
                        </button>
                        {confirmDeleteAccId === a.id ? (
                          <>
                            <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                              onClick={() => { deleteAccount(a.id); setConfirmDeleteAccId(null); }}>Remove</button>
                            <button className="px-btn px-btn-sm px-btn-ghost"
                              onClick={() => setConfirmDeleteAccId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                            onClick={() => setConfirmDeleteAccId(a.id)}>
                            <Icons.X size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {accounts !== undefined && accounts.length === 0 && !accForm && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, marginBottom: 10 }}>
                No accounts linked — add the first one below.
              </div>
            )}

            {/* Account form */}
            {accForm && (
              <div style={{ padding: 14, background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 12 }}>
                <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>{accForm.id ? 'Edit account' : 'New account'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Type</span>
                    <select className="px-select" value={accForm.type || 'other'} onChange={e => setAcc('type', e.target.value)}>
                      {Object.entries(window.db.ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Custodian</span>
                    <input className="px-input" placeholder="e.g. Fidelity" value={accForm.custodian || ''} onChange={e => setAcc('custodian', e.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Balance ($)</span>
                    <input className="px-input" type="number" step="1000" placeholder="0" value={accForm.balance || ''} onChange={e => setAcc('balance', e.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Uninvested cash ($)</span>
                    <input className="px-input" type="number" step="100" placeholder="0" value={accForm.cash || ''} onChange={e => setAcc('cash', e.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Account label (optional)</span>
                    <input className="px-input" placeholder="e.g. Joint brokerage" value={accForm.name || ''} onChange={e => setAcc('name', e.target.value)} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="px-btn px-btn-sm px-btn-primary" onClick={saveAccount} disabled={savingAcc}>
                    {savingAcc ? 'Saving…' : 'Save account'}
                  </button>
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setAccForm(null)}>Cancel</button>
                </div>
              </div>
            )}

            {accounts !== undefined && !accForm && (
              <button className="px-btn px-btn-sm px-btn-ghost"
                onClick={() => setAccForm({ type: 'taxable', custodian: '', name: '', balance: '', cash: '' })}>
                <Icons.Plus size={11} /> Add account
              </button>
            )}
          </>
        )}

        {/* ── Edit client ── */}
        {tab === 'edit' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Household name', key: 'household_name' },
                { label: 'Short name', key: 'short_name' },
                { label: 'Tag / description', key: 'household_tag' },
              ].map(({ label, key }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={LABEL_STYLE}>{label}</span>
                  <input className="px-input" value={editForm[key] || ''}
                    onChange={e => setEdit(key, e.target.value)} />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={LABEL_STYLE}>Horizon</span>
                <select className="px-select" value={editForm.current_phase ?? client.phase}
                  onChange={e => setEdit('current_phase', Number(e.target.value))}>
                  {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              {confirmArchive ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--brick)', fontStyle: 'italic' }}>Archive {client.shortName}?</span>
                  <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                    onClick={archiveClient} disabled={archiving}>
                    {archiving ? 'Archiving…' : 'Confirm'}
                  </button>
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setConfirmArchive(false)}>Cancel</button>
                </div>
              ) : (
                <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }}
                  onClick={() => setConfirmArchive(true)}>
                  Archive client
                </button>
              )}
              <button className="px-btn px-btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

/* ─── Roster skeleton (while DB fetch is in-flight) ─────────────── */
const RosterSkeleton = () => (
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
        {[1, 2, 3, 4].map(i => (
          <tr key={i} style={{ pointerEvents: 'none' }}>
            <td>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="px-skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                <div>
                  <span className="px-skeleton" style={{ width: 110 + i * 8, height: 13, marginBottom: 5 }} />
                  <span className="px-skeleton" style={{ width: 70, height: 10 }} />
                </div>
              </div>
            </td>
            <td><span className="px-skeleton" style={{ width: 130, height: 13 }} /></td>
            <td className="is-num"><span className="px-skeleton" style={{ width: 56, height: 13, marginLeft: 'auto' }} /></td>
            <td className="is-num px-hide-mobile"><span className="px-skeleton" style={{ width: 40, height: 12, marginLeft: 'auto' }} /></td>
            <td><span className="px-skeleton" style={{ width: 28, height: 10 }} /></td>
            <td className="is-num px-hide-mobile"><span className="px-skeleton" style={{ width: 48, height: 16, marginLeft: 'auto' }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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

/* ─── Firm Admin Dashboard ───────────────────────────────────────── */
const AUDIT_ACTION_LABELS = {
  'client.create': 'Client created', 'client.update': 'Client updated',
  'client.archive': 'Client archived', 'client.notes': 'Notes updated',
  'account.create': 'Account added', 'account.update': 'Account updated',
  'account.archive': 'Account archived', 'meeting.create': 'Meeting logged',
  'meeting.archive': 'Meeting archived', 'profile.save': 'Profile saved',
  'auth.signin': 'Signed in', 'auth.signout': 'Signed out',
  'mfa.enroll': '2FA enabled', 'mfa.unenroll': '2FA disabled',
};

const FirmAdminDashboard = () => {
  const { authUser } = useAuth();
  const [advisors,    setAdvisors]    = useStateAdv(undefined);
  const [firmClients, setFirmClients] = useStateAdv(undefined);
  const [auditLog,    setAuditLog]    = useStateAdv(undefined);

  React.useEffect(() => {
    if (!authUser?.id || !window.db) return;
    window.db.getAdvisors().then(rows => setAdvisors(rows || []));
    window.db.getFirmClients().then(rows => setFirmClients(rows || []));
    window.db.getAuditLog({ limit: 100 }).then(rows => setAuditLog(rows || []));
  }, [authUser?.id]);

  const firmName = authUser?.firms?.name || 'Your Firm';

  // Per-advisor client count + AUM derived from firm-wide client list
  const advisorStats = useMemoAdv(() => {
    const stats = {};
    (advisors || []).forEach(a => { stats[a.id] = { clientCount: 0, aum: 0 }; });
    (firmClients || []).forEach(c => {
      if (stats[c.advisor_id]) {
        stats[c.advisor_id].clientCount++;
        stats[c.advisor_id].aum += Number(c.aum) || 0;
      }
    });
    return stats;
  }, [advisors, firmClients]);

  const totalAUM = useMemoAdv(() =>
    (firmClients || []).reduce((s, c) => s + (Number(c.aum) || 0), 0),
    [firmClients]
  );

  return (
    <div className="px-adv">
      <div className="px-adv-main">
        <div className="px-greet">
          <div className="px-eyebrow px-greet-eyebrow">Firm Administration</div>
          <h1><em>{firmName}</em></h1>
          <p className="px-greet-sub">
            {advisors?.length ?? '…'} advisor{advisors?.length !== 1 ? 's' : ''} ·{' '}
            {firmClients?.length ?? '…'} active client{firmClients?.length !== 1 ? 's' : ''} ·{' '}
            {fmt$(totalAUM, { short: true, decimals: 1 })} book AUM
          </p>
        </div>

        <div className="px-section-head">
          <h2>Advisor roster {advisors !== undefined && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>live</span>
          )}</h2>
        </div>

        {advisors === undefined ? <RosterSkeleton /> : advisors.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No advisors found.
          </div>
        ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>Advisor</th>
                  <th style={{ width: '16%' }}>Role</th>
                  <th className="is-num">Clients</th>
                  <th className="is-num">Book AUM</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {advisors.map(a => {
                  const stats = advisorStats[a.id] || { clientCount: 0, aum: 0 };
                  const isMe  = a.id === authUser?.id;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="px-client-cell">
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--ink)', color: 'white', fontSize: 11,
                            fontWeight: 600, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', letterSpacing: '.02em',
                          }}>
                            {a.full_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="px-client-meta">
                            <div className="px-client-name">
                              {a.full_name}
                              {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink-faint)' }}>you</span>}
                            </div>
                            <div className="px-client-tag">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'capitalize' }}>
                          {a.role}{a.credentials ? ` · ${a.credentials}` : ''}
                        </span>
                      </td>
                      <td className="is-num">
                        <span className="px-num-serif">{stats.clientCount}</span>
                      </td>
                      <td className="is-num">
                        <span className="px-num-serif">
                          {stats.aum ? fmt$(stats.aum, { short: true }) : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                          {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Compliance audit trail ── */}
        <div className="px-section-head" style={{ marginTop: 32 }}>
          <h2>Compliance audit trail <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>append-only · SEC 17a-3</span></h2>
        </div>

        {auditLog === undefined ? (
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '12px 0' }}>Loading audit trail…</div>
        ) : auditLog.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No audit entries yet — material actions (client edits, meetings, profile saves, sign-ins) will appear here.
          </div>
        ) : (
          <div className="px-roster">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>When</th>
                  <th style={{ width: '24%' }}>Actor</th>
                  <th style={{ width: '20%' }}>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(e => (
                  <tr key={e.id} style={{ cursor: 'default' }}>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--mono, monospace)' }}>
                        {new Date(e.occurred_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink)' }}>{e.actor_email || '—'}</span>
                      {e.actor_role && <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{e.actor_role}</span>}
                    </td>
                    <td>
                      <span className="px-phase-pill-num" style={{ fontSize: 11 }}>
                        {AUDIT_ACTION_LABELS[e.action] || e.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{e.summary || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 28, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icons.Lock size={13} />
          <span>
            Firm admin view — exclusive to the <b>admin</b> role. The audit trail is <b>append-only</b> (no update/delete policy) and records are <b>archived, never erased</b>, per SEC Rule 17a-4. <b>Row-level security</b> still restricts each advisor to their own book.
          </span>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Advisor Dashboard ─────────────────────────────────────── */
const AdvisorDashboard = () => {
  const { authUser } = useAuth();
  const { openClientPortal } = useView();
  const [previewClient, setPreviewClient] = useStateAdv(null);
  const [addingClient, setAddingClient] = useStateAdv(false);
  const [snoozed, setSnoozed] = useStateAdv(new Set());
  const [dismissedQs, setDismissedQs] = useStateAdv(new Set());

  // undefined = not yet fetched; [] = fetched, empty; [...] = has rows
  const [dbClients,     setDbClients]     = useStateAdv(undefined);
  const [dbClientPage,  setDbClientPage]  = useStateAdv(0);
  const [dbClientTotal, setDbClientTotal] = useStateAdv(0);
  const [dbAlerts,      setDbAlerts]      = useStateAdv(undefined);
  const [dbQuestions,   setDbQuestions]   = useStateAdv(undefined);

  // Fetch from Supabase when advisor auth record is available
  React.useEffect(() => {
    if (!authUser?.id || !window.db) return;
    const id = authUser.id;
    window.db.getClients(id, { page: 0 }).then(result => {
      setDbClients(result?.rows ? result.rows.map(window.db.mapClient) : []);
      setDbClientTotal(result?.total ?? 0);
      setDbClientPage(0);
    });
    window.db.getAlerts(id).then(rows => {
      setDbAlerts(rows ? rows.map(window.db.mapAlert) : []);
    });
    window.db.getFlaggedQuestions(id).then(rows => {
      setDbQuestions(rows ? rows.map(window.db.mapFlaggedQuestion) : []);
    });
  }, [authUser?.id]);

  const isLiveMode = dbClients !== undefined;

  const activeClients   = isLiveMode ? dbClients   : clientsData;
  const activeAlerts    = isLiveMode ? (dbAlerts    || []) : alertsData;
  const activeQuestions = isLiveMode ? (dbQuestions || []) : questionsData;

  const handleClientCreated = (newClient) => {
    setDbClients(prev => [...(prev || []), newClient]);
  };

  const handleClientUpdated = (updatedClient) => {
    setDbClients(prev => (prev || []).map(c => c.id === updatedClient.id ? updatedClient : c));
    setPreviewClient(updatedClient);
  };

  const handleClientArchived = (clientId) => {
    setDbClients(prev => (prev || []).filter(c => c.id !== clientId));
    setPreviewClient(null);
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

  // Auto-generate alerts from roster data (cash drag, stale relationships)
  const generatedAlerts = useMemoAdv(() => {
    if (!isLiveMode) return [];
    const alerts = [];
    activeClients.forEach(c => {
      // Cash drag: >5% of AUM sitting uninvested
      if (c.aum > 0 && c.uninvestedCash / c.aum > 0.05) {
        const pct = ((c.uninvestedCash / c.aum) * 100).toFixed(0);
        alerts.push({
          id:       `gen_cash_${c.id}`,
          priority: c.uninvestedCash > 100_000 ? 'high' : 'medium',
          clientId: c.id,
          icon:     'Dollar',
          headline: `${c.shortName} — ${pct}% cash drag`,
          body:     `${fmt$(c.uninvestedCash, { short: true })} uninvested of ${fmt$(c.aum, { short: true })} AUM`,
          timeAgo:  'auto',
          cta:      'Deploy cash',
        });
      }
      // Stale relationship: no advisor activity in 14+ days, still in early horizons
      if (c.updatedAt && c.phase < 5) {
        const daysSince = Math.floor((Date.now() - new Date(c.updatedAt)) / 86_400_000);
        if (daysSince >= 14) {
          alerts.push({
            id:       `gen_stale_${c.id}`,
            priority: daysSince >= 30 ? 'high' : 'medium',
            clientId: c.id,
            icon:     'Phone',
            headline: `${c.shortName} — no activity ${daysSince}d`,
            body:     'Consider scheduling a check-in',
            timeAgo:  'auto',
            cta:      'Schedule call',
          });
        }
      }
    });
    return alerts;
  }, [activeClients, isLiveMode]);

  const visibleAlerts = useMemoAdv(() =>
    [...activeAlerts, ...generatedAlerts].filter(a => !snoozed.has(a.id)),
    [activeAlerts, generatedAlerts, snoozed]);
  const visibleQs     = useMemoAdv(() => activeQuestions.filter(q => !dismissedQs.has(q.id)), [activeQuestions, dismissedQs]);

  const greetDate = (() => {
    const d = new Date();
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const mon = d.toLocaleDateString('en-US', { month: 'short' });
    return `${day} · ${mon} ${d.getDate()}`;
  })();
  const greetTime = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; })();
  const greetName = authUser?.full_name?.split(' ')[0] || advisor.name;

  const loadMoreClients = () => {
    if (!authUser?.id || !window.db) return;
    const nextPage = dbClientPage + 1;
    window.db.getClients(authUser.id, { page: nextPage }).then(result => {
      if (result?.rows?.length) {
        setDbClients(prev => [...(prev || []), ...result.rows.map(window.db.mapClient)]);
        setDbClientPage(nextPage);
      }
    });
  };

  const exportCSV = () => {
    const headers = ['Client', 'Tag', 'Horizon', 'AUM', 'Uninvested Cash', 'Last Activity', 'Last Review', 'Notes'];
    const rows = activeClients.map(c => [
      c.name, c.tag, c.phase, c.aum, c.uninvestedCash,
      c.lastActivity, c.lastReview || '', c.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `roster-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

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
      <ClientPreviewModal
        client={previewClient}
        onClose={() => setPreviewClient(null)}
        onNotesChange={handleNotesChange}
        onUpdated={handleClientUpdated}
        onArchived={handleClientArchived}
        advisorId={authUser?.id}
      />
      <NewClientModal
        isOpen={addingClient}
        onClose={() => setAddingClient(false)}
        advisorId={authUser?.id}
        firmId={authUser?.firm_id}
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

        {/* Roster — skeleton while fetching, empty state, or data */}
        {!isLiveMode ? (
          <>
            <div className="px-section-head">
              <h2>Client roster <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 6 }}>loading…</span></h2>
            </div>
            <RosterSkeleton />
          </>
        ) : activeClients.length === 0 ? (
          <>
            <div className="px-section-head"><h2>Client roster</h2></div>
            <EmptyRoster onAddClient={() => setAddingClient(true)} />
          </>
        ) : (
          <RosterTable
            onOpenClient={setPreviewClient}
            clients={activeClients}
            onAddClient={() => setAddingClient(true)}
            isLiveMode={isLiveMode}
            onExportCSV={isLiveMode ? exportCSV : null}
          />
        )}

        {/* Load more — shown when the roster has more pages */}
        {isLiveMode && dbClients && dbClients.length < dbClientTotal && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="px-btn px-btn-ghost" onClick={loadMoreClients}>
              <Icons.ChevronDown size={12} /> Load more
              <span style={{ color: 'var(--ink-faint)', fontSize: 12, marginLeft: 4 }}>
                ({dbClientTotal - dbClients.length} remaining)
              </span>
            </button>
          </div>
        )}

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
          {visibleQs.map(q => (
            <FlaggedQuestion key={q.id} q={q} onDismiss={dismissQ}
              clients={activeClients} authUser={authUser}
              onOpenClient={openClientPortal} />
          ))}
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

window.AdvisorDashboard    = AdvisorDashboard;
window.FirmAdminDashboard  = FirmAdminDashboard;

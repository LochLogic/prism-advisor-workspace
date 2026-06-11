// Prism — Advisor Dashboard (View A). Command center for the RIA.
// KPIs · Client Roster · Alerts feed · Flagged Questions inbox.

const { useMemo: useMemoAdv, useState: useStateAdv } = React;

/* ─── KPI tiles ──────────────────────────────────────────────────── */
const KpiTile = ({ label, value, sub, delta, deltaDir, sparkData }) => (
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
    {Array.isArray(sparkData) && sparkData.length >= 2 && (
      <div className="px-kpi-spark">
        <Sparkline data={sparkData} width={64} height={22}
          color={sparkData[sparkData.length - 1] >= sparkData[0] ? 'var(--forest)' : 'var(--brick)'} />
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

/* ─── Pipeline stage helpers (CRM) ───────────────────────────────── */
const PIPELINE_STAGES = [
  { value: 'lead',        label: 'Lead',        color: 'var(--gold)' },
  { value: 'onboarding',  label: 'Onboarding',  color: 'var(--forest)' },
  { value: 'active',      label: 'Active',      color: 'var(--ink-mute)' },
  { value: 'review_due',  label: 'Review due',  color: 'var(--brick)' },
  { value: 'inactive',    label: 'Inactive',    color: 'var(--ink-faint)' },
];
const stageMeta = (v) => PIPELINE_STAGES.find(s => s.value === v) || PIPELINE_STAGES[2];

const StagePill = ({ stage }) => {
  const s = stageMeta(stage);
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600, letterSpacing: '.03em',
      color: s.color, border: `1px solid ${s.color}`, borderRadius: 20,
      padding: '1px 8px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
};

// Relative due-date label + tone for tasks
const dueMeta = (dueAt) => {
  if (!dueAt) return { label: 'No due date', tone: 'var(--ink-faint)' };
  const days = Math.floor((new Date(dueAt) - Date.now()) / 86_400_000);
  if (days < 0)  return { label: `Overdue ${Math.abs(days)}d`, tone: 'var(--brick)' };
  if (days === 0) return { label: 'Due today', tone: 'var(--brick)' };
  if (days <= 3) return { label: `Due in ${days}d`, tone: 'var(--gold)' };
  return { label: `Due ${new Date(dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, tone: 'var(--ink-mute)' };
};

/* ─── Performance math (Theme D) ─────────────────────────────────── */
// buildValueSeries / modifiedDietz / perfPeriods now live in src/calc-core.cjs
// (single source of truth, unit-tested) and are in the shared bundle scope.

// Compounded benchmark return over a period given an assumed annual rate
function benchmarkPct(start, end, annualRate) {
  const yrs = Math.max(0, (new Date(end) - new Date(start)) / (365 * 86400000));
  return (Math.pow(1 + annualRate, yrs) - 1) * 100;
}
const BENCHMARKS = [
  { label: 'S&P 500 (~10%)', rate: 0.10 },
  { label: '60/40 blend (~7%)', rate: 0.07 },
  { label: 'Conservative (~5%)', rate: 0.05 },
];

// Compact portfolio-value area chart
// PerfChart now lives in src/components.jsx (shared by the advisor + client bundles).

// annualFeeForAum now lives in src/calc-core.cjs (single source of truth, tested);
// it's in the shared bundle scope, referenced by bare name below.
const INVOICE_STATUS_TONE = { draft: 'var(--ink-mute)', approved: 'var(--forest)', paid: 'var(--forest)', void: 'var(--ink-faint)' };

/* ─── Roster row ─────────────────────────────────────────────────── */
/* On phones the row renders as a stacked card (styles.css ≤680px); a left
   swipe reveals quick actions (quick view · roadmap · numbers). Touch-only —
   the action strip never renders on desktop, so the table shape is unchanged. */
const RosterRow = ({ client, onOpen }) => {
  const phase = phaseLabel(client.phase);
  const { openClientPortal, openClientNumbers } = useView();
  const [swiped, setSwiped] = useStateAdv(false);
  const touchRef = React.useRef(null);
  const onTouchStart = (e) => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    const s = touchRef.current; if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dy) < 40) {
      if (dx < -40) setSwiped(true);
      else if (dx > 40) setSwiped(false);
    }
    touchRef.current = null;
  };
  return (
    <tr onClick={() => { if (swiped) { setSwiped(false); return; } onOpen(client); }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <td>
        <div className="px-client-cell">
          <ClientAvatar client={client} size={32} />
          <div className="px-client-meta">
            <div className="px-client-name">
              {client.name}
              {client.hasUnread && (
                <span title="New message" aria-label="New message" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 0 3px var(--gold-soft)', marginLeft: 7, verticalAlign: 'middle' }} />
              )}
            </div>
            <div className="px-client-tag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {client.tag}
              {client.isProspect ? (
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600, letterSpacing: '.03em',
                  color: 'var(--gold)', background: 'var(--gold-soft)', borderRadius: 20,
                  padding: '1px 8px', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>Prospect</span>
              ) : (client.pipelineStage && client.pipelineStage !== 'active' && <StagePill stage={client.pipelineStage} />)}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Horizon">
        <div className="px-phase-pill">
          <span className="px-phase-pill-num">P{phase.num}</span>
          <span style={{ color: 'var(--ink)' }}>{phase.title}</span>
          <span className="px-progress">
            <span className="px-progress-fill" style={{ width: `${client.phaseProgress * 100}%` }} />
          </span>
        </div>
      </td>
      <td className="is-num" data-label="AUM">
        <span className="px-num-serif" style={{ fontSize: 16, color: 'var(--ink)' }}>
          {fmt$(client.aum, { short: true })}
        </span>
      </td>
      <td className="is-num px-hide-mobile" data-label="Cash">
        <span style={{ color: client.uninvestedCash > 80_000 ? 'var(--brick)' : 'var(--ink-mute)' }}>
          {client.uninvestedCash ? fmt$(client.uninvestedCash, { short: true }) : '—'}
        </span>
      </td>
      <td data-label="Activity">
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
      {swiped && (
        <td className="px-swipe-actions">
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={(e) => { e.stopPropagation(); setSwiped(false); onOpen(client); }}>
            <Icons.Eye size={12} /> Quick view
          </button>
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={(e) => { e.stopPropagation(); setSwiped(false); openClientPortal(client); }}>
            <Icons.ArrowRight size={12} /> Roadmap
          </button>
          {!client.isProspect && (
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={(e) => { e.stopPropagation(); setSwiped(false); openClientNumbers(client); }}>
              <Icons.Calculator size={12} /> Numbers
            </button>
          )}
        </td>
      )}
    </tr>
  );
};

/* ─── Alert card ─────────────────────────────────────────────────── */
// CTAs that open the client roadmap, deep-linked to the relevant phase
const ALERT_REVIEW_PHASE = { 'Deploy cash': 5, 'Open Roth modeler': 6 }; // others open without a specific phase

const AlertCard = ({ alert, onSnooze, clients, onAgenda }) => {
  const { openClientPortal, setPendingPhaseId, showToast } = useView();
  const client = clients.find(c => c.id === alert.clientId);
  const I = Icons[alert.icon] || Icons.Bell;

  const handleCta = () => {
    if (alert.cta === 'Add to agenda') {        // → create a real follow-up task
      onAgenda?.(client, alert);
      return;
    }
    // Everything else opens the client, deep-linked to the relevant phase when known
    if (client) {
      openClientPortal(client);
      const ph = ALERT_REVIEW_PHASE[alert.cta];
      if (ph != null) setPendingPhaseId(ph);
    } else {
      showToast('Open the client to review');
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
      <div className="px-alert-msg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(alert.body) }} />
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
    // Demo/mock question (no DB row) → an empty local thread, not a perpetual spinner.
    if (!q._dbId || !window.db) { setMessages([]); return; }
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
    const body = replyText.trim();
    if (!body) return;
    // Demo/mock question (no DB row) — keep the thread usable with local state.
    if (!q._dbId || !window.db) {
      setMessages(prev => [...(prev || []), { id: 'demo-' + Date.now(), author_role: 'advisor', body, created_at: new Date().toISOString() }]);
      setReplyText('');
      return;
    }
    if (!authUser?.id) return;
    setSending(true);
    const msg = await window.db.addFlagMessage(q._dbId, authUser.id, 'advisor', body);
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

/* ─── Calendar (Google / Outlook sync) ───────────────────────────── */
const CAL_PROVIDERS = [
  { id: 'google',    label: 'Google Calendar' },
  { id: 'microsoft', label: 'Outlook Calendar' },
];

const _calDayLabel = (iso) => {
  const d = new Date(iso), today = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(today)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const _calTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const DEMO_CAL_EVENTS = (() => {
  const at = (days, h, dur) => {
    const s = new Date(); s.setDate(s.getDate() + days); s.setHours(h, 0, 0, 0);
    return { start: s.toISOString(), end: new Date(s.getTime() + dur * 60000).toISOString() };
  };
  return [
    { id: 'd1', provider: 'google', title: 'Quarterly review — The Hartwells', allDay: false, link: null, ...at(0, 14, 60) },
    { id: 'd2', provider: 'google', title: 'Intro call — Rivera prospect',     allDay: false, link: null, ...at(1, 10, 30) },
    { id: 'd3', provider: 'google', title: 'Roth conversion walkthrough — The Okafors', allDay: false, link: null, ...at(3, 15, 45) },
  ];
})();

const CalendarCard = ({ isLive }) => {
  const [conns, setConns]   = useStateAdv(null);  // null = loading · [] = none connected
  const [events, setEvents] = useStateAdv(null);
  const [err, setErr]       = useStateAdv('');
  const [busy, setBusy]     = useStateAdv(false);

  const load = React.useCallback(async () => {
    if (!isLive) { setConns([{ provider: 'google', email: 'you@yourfirm.com' }]); setEvents(DEMO_CAL_EVENTS); return; }
    const c = await window.db.getCalendarStatus();
    setConns(c || []);
    if (c && c.length) {
      const r = await window.db.getCalendarEvents(7);
      if (r && !r.error) setEvents(r.events || []);
      else setErr(r?.error === 'not_connected' ? '' : (r?.error || ''));
    }
  }, [isLive]);
  React.useEffect(() => { load(); }, [load]);

  const connect = async (provider) => {
    setBusy(true); setErr('');
    const r = await window.db.connectCalendar(provider); // navigates away on success
    if (r?.error) { setErr(r.error); setBusy(false); }
  };
  const disconnect = async (provider) => {
    if (!window.confirm('Disconnect this calendar? Prism keeps no copy of its events.')) return;
    await window.db.disconnectCalendar(provider);
    setEvents(null); load();
  };

  const connected = conns || [];
  return (
    <div className="px-side-section">
      <div className="px-side-head">
        <h3><Icons.Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> This week</h3>
        {connected.length > 0 && <span className="px-side-count">{(events || []).length} event{(events || []).length !== 1 ? 's' : ''}</span>}
      </div>

      {err && <div style={{ fontSize: 11.5, color: 'var(--brick)', marginBottom: 8 }}>{err}</div>}

      {conns === null ? (
        <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Checking calendar…</div>
      ) : connected.length === 0 ? (
        <div style={{ padding: '6px 0 2px' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 10 }}>
            Connect your calendar to see the week ahead and push scheduled client meetings automatically.
          </div>
          {CAL_PROVIDERS.map(p => (
            <button key={p.id} className="px-btn px-btn-sm px-btn-ghost" disabled={busy}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }}
              onClick={() => connect(p.id)}>
              <Icons.Calendar size={12} /> Connect {p.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          {(events || []).slice(0, 6).map(e => (
            <div key={`${e.provider}-${e.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flexShrink: 0, width: 64 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{_calDayLabel(e.start)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{e.allDay ? 'All day' : _calTime(e.start)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.title}
              </div>
              {e.link && (
                <a href={e.link} target="_blank" rel="noopener noreferrer" title="Open in calendar"
                  style={{ flexShrink: 0, color: 'var(--ink-faint)', marginTop: 2 }}>
                  <Icons.ExternalLink size={11} />
                </a>
              )}
            </div>
          ))}
          {events !== null && events.length === 0 && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 12.5 }}>
              Nothing on the calendar this week.
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {connected.map(c => (
              <span key={c.provider} title={c.email || ''} style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                {CAL_PROVIDERS.find(p => p.id === c.provider)?.label || c.provider}
                {isLive && (
                  <button onClick={() => disconnect(c.provider)} title="Disconnect"
                    style={{ border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 10.5, padding: '0 2px', textDecoration: 'underline' }}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {isLive && connected.length < CAL_PROVIDERS.length && (
              <button className="px-btn px-btn-sm px-btn-ghost" disabled={busy} style={{ marginLeft: 'auto' }}
                onClick={() => connect(CAL_PROVIDERS.find(p => !connected.some(c => c.provider === p.id)).id)}>
                + {CAL_PROVIDERS.find(p => !connected.some(c => c.provider === p.id)).label.split(' ')[0]}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Roster section ─────────────────────────────────────────────── */
/* ─── Pipeline board (CRM) ───────────────────────────────────────── */
const PipelineBoard = ({ clients, onOpen, onMove }) => (
  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
    {PIPELINE_STAGES.map(stage => {
      const inStage = clients.filter(c => (c.pipelineStage || 'active') === stage.value);
      return (
        <div key={stage.value} style={{ flex: '0 0 210px', minWidth: 210, background: 'var(--bg-elev)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: stage.color }}>{stage.label}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{inStage.length}</span>
          </div>
          {inStage.map(c => (
            <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
              <div onClick={() => onOpen(c)} style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{c.shortName || c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '2px 0 6px' }}>{fmt$(c.aum, { short: true })}</div>
              <select className="px-select" style={{ width: '100%', padding: '3px 6px', fontSize: 11 }}
                value={c.pipelineStage || 'active'} onChange={e => onMove(c, e.target.value)}>
                {PIPELINE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          ))}
          {inStage.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '6px 0' }}>—</div>}
        </div>
      );
    })}
  </div>
);

const RosterTable = ({ onOpenClient, clients, onAddClient, onAddProspect, onImport, isLiveMode, onExportCSV, view, onView, onMoveStage }) => {
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
          <div className="px-viewswitch" role="tablist" aria-label="Roster view" style={{ marginRight: 4 }}>
            <button className={view === 'board' ? '' : 'is-on'} onClick={() => onView('table')} role="tab" aria-selected={view !== 'board'}>
              <Icons.TableCol size={12} /> Roster
            </button>
            <button className={view === 'board' ? 'is-on' : ''} onClick={() => onView('board')} role="tab" aria-selected={view === 'board'}>
              <Icons.Layers size={12} /> Pipeline
            </button>
          </div>
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
          {isLiveMode && onImport && (
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={onImport}
              title="Import clients from a CSV export">
              <Icons.Upload size={11} /> Import
            </button>
          )}
          {onAddProspect && (
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={onAddProspect}
              title="Run a prospect through the roadmap before they sign">
              <Icons.Sparkles size={11} /> New prospect
            </button>
          )}
          {isLiveMode && onAddClient && (
            <button className="px-btn px-btn-sm px-btn-primary" onClick={onAddClient}>
              <Icons.Plus size={11} /> Add client
            </button>
          )}
        </div>
      </div>
      {view === 'board' ? (
        <PipelineBoard clients={filtered} onOpen={onOpenClient} onMove={onMoveStage} />
      ) : (
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
      )}
    </>
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
const EmptyRoster = ({ onAddClient, onAddProspect, onAddSample, onImport, sampling }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border-2)', marginTop: 8 }}>
    <div style={{ width: 46, height: 46, background: 'var(--gold-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
      <Icons.Users size={19} style={{ color: 'var(--gold)' }} />
    </div>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>Welcome — let's set up your book</div>
    <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', marginBottom: 20, maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.55 }}>
      Add your first client to start building lifecycle plans — or drop in a fully-populated
      sample household to explore the roadmap, calculators, and reports right away.
    </div>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      <button className="px-btn px-btn-primary" onClick={onAddClient}>
        <Icons.Plus size={12} /> Add your first client
      </button>
      {onAddProspect && (
        <button className="px-btn px-btn-ghost" onClick={onAddProspect}>
          <Icons.Sparkles size={12} /> Start a prospect
        </button>
      )}
      {onImport && (
        <button className="px-btn px-btn-ghost" onClick={onImport}>
          <Icons.Upload size={12} /> Import from CSV
        </button>
      )}
      {onAddSample && (
        <button className="px-btn px-btn-ghost" onClick={onAddSample} disabled={sampling}>
          <Icons.Sparkles size={12} /> {sampling ? 'Adding…' : 'Load a sample household'}
        </button>
      )}
    </div>
  </div>
);

/* ─── Firm Admin Dashboard ───────────────────────────────────────── */
// AUDIT_ACTION_LABELS now lives in db.jsx (single source of truth, shared scope).


/* ─── Main Advisor Dashboard ─────────────────────────────────────── */
/* ─── Client ledger updates awaiting review (commit gate, migration 036) ───
   Shown only when the firm has the approval gate on AND a client draft exists
   (the section stays silent otherwise — the gate is per-firm opt-in, default
   OFF). Approve writes the proposed profile through the advisor's own RLS
   path; decline returns it to the client with a note. */
const LedgerApprovalCard = ({ row, authUser, onDone, onOpenClient, clients }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [current, setCurrent] = React.useState(undefined); // saved profile, for the section diff
  const name = row.clients?.short_name || row.clients?.household_name || 'Client';
  const client = (clients || []).find(c => c.id === row.client_id);

  React.useEffect(() => {
    if (!expanded || current !== undefined) return;
    window.db.getProfile(row.client_id).then(p => setCurrent(p || {}));
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const SECTION_LABELS = { members: 'Household', income: 'Income', incomeStreams: 'Income streams',
    expenses: 'Expenses', debts: 'Debts', savings: 'Savings', retirement: 'Retirement',
    taxable: 'Taxable investing', housing: 'Housing', properties: 'Properties', insurance: 'Insurance',
    goals: 'Goals', estate: 'Estate', taxes: 'Taxes', equityComp: 'Equity comp', risk: 'Risk profile' };
  const changedSections = React.useMemo(() => {
    if (!current) return null;
    const keys = new Set([...Object.keys(row.payload || {}), ...Object.keys(current || {})]);
    return [...keys]
      .filter(k => JSON.stringify(row.payload?.[k]) !== JSON.stringify(current?.[k]))
      .map(k => SECTION_LABELS[k] || k);
  }, [current, row.payload]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (approve) => {
    setBusy(true);
    const out = await window.db.reviewLedgerChange(row, authUser?.id, approve, approve ? null : note.trim());
    setBusy(false);
    if (out) onDone(row.id, approve);
  };

  return (
    <div className="px-card" style={{ padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', cursor: client ? 'pointer' : 'default' }}
            onClick={() => client && onOpenClient(client)}
            title={client ? `Open ${name}` : undefined}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>
            Updated their numbers {window.db.timeAgo ? window.db.timeAgo(row.updated_at) : ''}
          </div>
        </div>
        <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Hide' : 'What changed'}
        </button>
      </div>
      {expanded && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '8px 0 2px' }}>
          {changedSections === null ? 'Comparing…'
            : changedSections.length === 0 ? 'No differences from the saved profile — safe to approve.'
            : <>Changed: <b style={{ color: 'var(--ink)' }}>{changedSections.join(', ')}</b>. Open the household's Numbers drawer for the full picture.</>}
        </div>
      )}
      {declining ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="px-input" style={{ flex: 1, fontSize: 12 }} value={note} autoFocus
            placeholder="A short note for the client (optional)"
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') decide(false); }} />
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setDeclining(false)}>Cancel</button>
          <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }} disabled={busy}
            onClick={() => decide(false)}>Return</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="px-btn px-btn-sm px-btn-primary" disabled={busy} onClick={() => decide(true)}>
            <Icons.Check size={11} /> {busy ? 'Saving…' : 'Approve & save'}
          </button>
          <button className="px-btn px-btn-sm px-btn-ghost" disabled={busy} onClick={() => setDeclining(true)}>
            Return with note
          </button>
        </div>
      )}
    </div>
  );
};

const AdvisorDashboard = () => {
  const { authUser, isDemo } = useAuth();
  const { openClientPortal, showToast, activeClientId, activeClient, setActiveClient } = useView();
  const { prospects = [], onConvert } = useProspects() || {};
  const [previewClient, setPreviewClient] = useStateAdv(null);
  const [addingClient, setAddingClient] = useStateAdv(false);
  const [addingProspect, setAddingProspect] = useStateAdv(false);
  const [importing, setImporting] = useStateAdv(false);
  const [snoozed, setSnoozed] = useStateAdv(new Set());
  const [dismissedQs, setDismissedQs] = useStateAdv(new Set());
  const [rosterView, setRosterView] = useStateAdv('table');
  const [stageOverride, setStageOverride] = useStateAdv({});

  // undefined = not yet fetched; [] = fetched, empty; [...] = has rows
  const [dbClients,     setDbClients]     = useStateAdv(undefined);
  const [dbClientPage,  setDbClientPage]  = useStateAdv(0);
  const [dbClientTotal, setDbClientTotal] = useStateAdv(0);
  const [dbAlerts,      setDbAlerts]      = useStateAdv(undefined);
  const [dbQuestions,   setDbQuestions]   = useStateAdv(undefined);
  const [dbTasks,       setDbTasks]       = useStateAdv(undefined);
  const [dbTotals,      setDbTotals]      = useStateAdv(null);
  const [dbLedgerDrafts, setDbLedgerDrafts] = useStateAdv([]);

  // Fetch from Supabase when advisor auth record is available
  React.useEffect(() => {
    if (!authUser?.id || !window.db) return;
    const id = authUser.id;
    window.db.getBookTotals(id).then(t => setDbTotals(t));
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
    window.db.getTasks(id, { includeDone: false }).then(rows => {
      setDbTasks(rows ? rows.map(window.db.mapTask) : []);
    });
    // Approval-gate inbox (null until migration 036 / when the gate is off —
    // the section renders nothing in that case).
    window.db.getPendingLedgerChanges?.().then(rows => setDbLedgerDrafts(rows || []));
  }, [authUser?.id]);

  const [demoDoneTasks, setDemoDoneTasks] = useStateAdv(new Set());

  const completeDashTask = async (t) => {
    if (isDemo) { setDemoDoneTasks(prev => new Set([...prev, t.id])); return; }
    const row = await window.db?.updateTask(t.id, { status: 'done' }, t.clientId);
    if (row) setDbTasks(prev => (prev || []).filter(x => x.id !== t.id));
  };

  const isLiveMode = dbClients !== undefined;

  const activeClients   = isLiveMode ? dbClients   : clientsData;
  const activeAlerts    = isLiveMode ? (dbAlerts    || []) : alertsData;

  // Resolve the active client's display object from a deep-linked id (#/client/<id>)
  // once the roster is loaded — data already keys off activeClientId; this fills in
  // the name/initials the portal header reads when arriving via a shared/bookmarked link.
  React.useEffect(() => {
    if (!activeClientId) return;
    if (activeClient?.id === activeClientId) return;
    const match = (activeClients || []).find(c => c.id === activeClientId);
    if (match) setActiveClient(match);
  }, [activeClientId, activeClient, activeClients, setActiveClient]);

  // Book AUM trend (sparkline): real balance history when live; summed demo
  // histories across the roster otherwise.
  const [bookBal, setBookBal] = useStateAdv(undefined);
  React.useEffect(() => {
    if (!isLiveMode || !window.db?.getBookBalanceHistory) return;
    window.db.getBookBalanceHistory().then(r => setBookBal(r || []));
  }, [isLiveMode]);
  const bookSpark = useMemoAdv(() => {
    let series;
    if (isLiveMode) {
      series = buildValueSeries(bookBal || []);
    } else if (window.demoBalanceHistory) {
      const byDate = {};
      for (const c of activeClients) {
        for (const r of window.demoBalanceHistory(c.aum || 0)) byDate[r.as_of] = (byDate[r.as_of] || 0) + r.balance;
      }
      series = Object.keys(byDate).sort().map(d => ({ date: d, value: byDate[d] }));
    } else series = [];
    return series.map(p => p.value);
  }, [isLiveMode, bookBal, activeClients]);

  const activeQuestions = isLiveMode ? (dbQuestions || []) : questionsData;
  const activeTasks     = isLiveMode ? (dbTasks || []) : tasksData.filter(t => !demoDoneTasks.has(t.id));

  // Clients with unread client→advisor messages (refreshes when a preview closes,
  // i.e. after the advisor has likely read + cleared the thread).
  const [unreadIds, setUnreadIds] = useStateAdv(() => new Set());
  React.useEffect(() => {
    if (!isLiveMode || !window.db?.getUnreadMessageClients) return;
    window.db.getUnreadMessageClients().then(ids => setUnreadIds(new Set(ids || [])));
  }, [isLiveMode, previewClient]);

  // Defense-in-depth for the realtime stream (clean-room M4). subscribeAllMessages
  // receives EVERY message insert and relies on Supabase Realtime RLS to scope the
  // feed to this advisor's book. As a backstop against a Realtime-RLS misconfig,
  // keep a live set of the client ids we already know (RLS-scoped roster/unread
  // fetches) and ignore any payload outside it — so a misconfiguration degrades to
  // "no dot" instead of this browser processing another tenant's message.
  const knownClientIds = React.useRef(new Set());
  React.useEffect(() => {
    const ids = new Set((activeClients || []).map(c => c.id));
    for (const id of unreadIds) ids.add(id);   // ids from the RLS-scoped unread fetch
    knownClientIds.current = ids;
  }, [activeClients, unreadIds]);

  // Passive realtime (W4): light the roster unread dot the moment a client messages —
  // no modal needed. RLS scopes the stream to this advisor's book. Complements the
  // fetch above (which paints the initial state + clears on modal close).
  React.useEffect(() => {
    if (!isLiveMode || !window.db?.subscribeAllMessages) return;
    const unsub = window.db.subscribeAllMessages((m) => {
      if (m?.author_role === 'client' && m.client_id && knownClientIds.current.has(m.client_id)) {
        setUnreadIds(prev => prev.has(m.client_id) ? prev : new Set(prev).add(m.client_id));
      }
    });
    return () => unsub && unsub();
  }, [isLiveMode]);

  // Apply in-session pipeline-stage overrides (demo) + unread-message flags so the
  // roster reflects moves and surfaces clients awaiting a reply.
  const boardClients = useMemoAdv(
    () => activeClients.map(c => {
      const stage = stageOverride[c.id];
      const hasUnread = unreadIds.has(c.id);
      if (!stage && !hasUnread) return c;
      return { ...c, ...(stage ? { pipelineStage: stage } : {}), ...(hasUnread ? { hasUnread: true } : {}) };
    }),
    [activeClients, stageOverride, unreadIds]);

  // Prospects ride at the top of the roster (newest first) but stay out of the
  // book KPIs (they aren't clients yet — see `kpis`, which keys off activeClients).
  const rosterClients = useMemoAdv(() => [...prospects, ...boardClients], [prospects, boardClients]);

  const moveStage = async (c, stage) => {
    if (isLiveMode) {
      const row = await window.db.updateClient(c.id, { pipeline_stage: stage });
      if (row) setDbClients(prev => (prev || []).map(x => x.id === c.id ? window.db.mapClient(row) : x));
    } else {
      setStageOverride(prev => ({ ...prev, [c.id]: stage }));
    }
    showToast(`${c.shortName || 'Client'} → ${stage.replace('_', ' ')}`);
  };

  // Turn an alert into a real CRM task ("Add to agenda")
  const addAgendaItem = async (clientObj, alert) => {
    const title = alert?.headline || 'Follow-up';
    if (!isLiveMode || !authUser?.id) { // demo / no live session
      showToast(`Added to ${clientObj?.shortName || 'client'}'s agenda`);
      return;
    }
    const row = await window.db.createTask(authUser.id, authUser.firm_id, {
      title, client_id: clientObj?.id, priority: alert?.priority === 'high' ? 'high' : 'normal',
    });
    if (row) { setDbTasks(prev => [window.db.mapTask(row), ...(prev || [])]); showToast('Added to agenda'); }
    else showToast('Could not add to agenda — check console');
  };

  const handleClientCreated = (newClient) => {
    setDbClients(prev => [...(prev || []), newClient]);
  };

  // When a prospect is converted, splice the now-real client into the live
  // roster so it appears immediately without a refetch.
  React.useEffect(() => {
    if (!onConvert) return;
    return onConvert((mapped) => {
      setDbClients(prev => prev === undefined ? prev : [mapped, ...prev]);
      setDbClientTotal(t => t + 1);
    });
  }, [onConvert]);

  const handleClientsImported = (newClients) => {
    setDbClients(prev => [...(prev || []), ...newClients]);
    setDbClientTotal(t => t + newClients.length);
    showToast(`${newClients.length} client${newClients.length !== 1 ? 's' : ''} imported`);
  };

  // Onboarding: create a fully-populated sample household so a brand-new advisor
  // immediately sees a living roadmap (they can edit or archive it any time).
  const [sampling, setSampling] = useStateAdv(false);
  const handleAddSample = async () => {
    if (!authUser?.id || !authUser?.firm_id || !window.db) return;
    setSampling(true);
    const row = await window.db.createClient(authUser.id, authUser.firm_id, {
      household_name: 'Sample Household', short_name: 'Sample',
      household_tag: 'Sample · age 45', current_phase: 2,
    });
    if (row) {
      if (window.mergeProfile) {
        try {
          await window.db.saveProfile(row.id, window.mergeProfile(window.emptyProfile, {
            income:   { monthlyTakehome: 14000 },
            expenses: { housing: 3200, food: 1400, transport: 900, utilities: 500, healthcare: 600, other: 1800 },
            savings:  { emergency: 45000 },
            retirement: { hsaBalance: 12000, iraBalance: 180000, fourohonekBalance: 320000, hsaContrib: 4000 },
            taxable:  { balance: 210000, monthlyContrib: 2500 },
            debts:    [{ id: 'd1', name: 'Mortgage', balance: 280000, apr: 6.4, min: 1800 }],
            goals:    { age: 45, retireAt: 65 },
          }));
        } catch {}
      }
      handleClientCreated(window.db.mapClient(row));
      showToast('Sample household added — open it to explore the roadmap');
    } else {
      showToast('Could not add sample — check console');
    }
    setSampling(false);
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
          priority: c.uninvestedCash > 100_000 ? 'high' : 'med',
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
            priority: daysSince >= 30 ? 'high' : 'med',
            clientId: c.id,
            icon:     'Phone',
            headline: `${c.shortName} — no activity ${daysSince}d`,
            body:     'Consider scheduling a check-in',
            timeAgo:  'auto',
            cta:      'Add to agenda',
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
    downloadCSV(`roster-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const kpis = useMemoAdv(() => {
    // Live: use book-wide totals so KPIs reflect the WHOLE book, not just the
    // loaded roster page. Falls back to the loaded slice if the totals query is
    // unavailable (and for demo mode, which has no pagination).
    if (isLiveMode && dbTotals) return dbTotals;
    const list = activeClients;
    return {
      totalAUM:      list.reduce((a, c) => a + c.aum, 0),
      totalCashDrag: list.reduce((a, c) => a + c.uninvestedCash, 0),
      activeCount:   list.length,
      inLateHorizon: list.filter(c => c.phase >= 5).length,
    };
  }, [activeClients, isLiveMode, dbTotals]);

  return (
    <div className="px-adv">
      <ClientPreviewModal
        client={previewClient}
        onClose={() => setPreviewClient(null)}
        onNotesChange={handleNotesChange}
        onUpdated={handleClientUpdated}
        onArchived={handleClientArchived}
        advisorId={authUser?.id}
        firmId={authUser?.firm_id}
      />
      <NewClientModal
        isOpen={addingClient}
        onClose={() => setAddingClient(false)}
        advisorId={authUser?.id}
        firmId={authUser?.firm_id}
        onCreated={handleClientCreated}
      />
      <BulkImportModal
        isOpen={importing}
        onClose={() => setImporting(false)}
        advisorId={authUser?.id}
        firmId={authUser?.firm_id}
        onImported={handleClientsImported}
      />
      <NewProspectModal
        isOpen={addingProspect}
        onClose={() => setAddingProspect(false)}
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
              ? `${kpis.activeCount} client${kpis.activeCount !== 1 ? 's' : ''} in your book · ${visibleAlerts.filter(a => a.priority === 'high').length} action item${visibleAlerts.filter(a => a.priority === 'high').length !== 1 ? 's' : ''} · ${visibleQs.length} question${visibleQs.length !== 1 ? 's' : ''} pending`
              : `${visibleAlerts.filter(a => a.priority === 'high').length} action items this ${greetTime} and ${visibleQs.length} client questions awaiting reply.`
            }
          </p>
        </div>

        {/* KPIs */}
        <div className="px-kpis">
          <KpiTile label="Book AUM" value={kpis.totalAUM ? fmt$(kpis.totalAUM, { short: true, decimals: 1 }) : '—'}
                   delta={isLiveMode ? null : '+ $1.8M MTD'} deltaDir="up" sparkData={bookSpark} />
          <KpiTile label="Active clients" value={kpis.activeCount}
                   sub={isLiveMode ? null : '2 onboarding'} />
          <KpiTile label="Late-horizon" value={kpis.inLateHorizon}
                   sub="Phase 06 +" />
          <KpiTile label="Cash drag" value={kpis.totalCashDrag ? fmt$(kpis.totalCashDrag, { short: true }) : '—'}
                   delta={isLiveMode ? null : '3 clients over target'} deltaDir="down" />
        </div>

        {/* Roster — skeleton only while a real fetch is in flight (not demo) */}
        {(!isLiveMode && !isDemo) ? (
          <>
            <div className="px-section-head">
              <h2>Client roster <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 6 }}>loading…</span></h2>
            </div>
            <RosterSkeleton />
          </>
        ) : rosterClients.length === 0 ? (
          <>
            <div className="px-section-head"><h2>Client roster</h2></div>
            <EmptyRoster onAddClient={() => setAddingClient(true)}
              onAddProspect={() => setAddingProspect(true)}
              onImport={isLiveMode ? () => setImporting(true) : undefined}
              onAddSample={isLiveMode ? handleAddSample : undefined} sampling={sampling} />
          </>
        ) : (
          <RosterTable
            onOpenClient={(c) => c.isProspect ? openClientPortal(c) : setPreviewClient(c)}
            clients={rosterClients}
            onAddClient={() => setAddingClient(true)}
            onAddProspect={() => setAddingProspect(true)}
            onImport={isLiveMode ? () => setImporting(true) : null}
            isLiveMode={isLiveMode}
            onExportCSV={isLiveMode ? exportCSV : null}
            view={rosterView}
            onView={setRosterView}
            onMoveStage={moveStage}
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
        {/* AI assistant — book triage ("who needs attention") */}
        <div className="px-side-section">
          <AiAssistCard
            isLive={isLiveMode}
            note="AI triage from your live book — a starting point, not a verdict."
            actions={[{
              key: 'attention', label: 'Who needs attention?', action: 'attention',
              context: () => ({
                clients: (activeClients || []).slice(0, 60).map(c => ({
                  name: c.shortName || c.name,
                  phase: c.phase,
                  aum: c.aum || undefined,
                  uninvestedCash: c.uninvestedCash || undefined,
                  lastActivityAgo: c.lastActivity || undefined,
                  lastReviewAgo: c.lastReview || undefined,
                  unreadMessages: unreadIds.has(c.id) || undefined,
                })),
                openAlerts: (activeAlerts || []).slice(0, 20).map(a => {
                  const c = (activeClients || []).find(x => x.id === a.clientId);
                  return { client: c ? (c.shortName || c.name) : undefined, headline: a.headline, ago: a.timeAgo };
                }),
                openQuestions: (activeQuestions || []).slice(0, 20).map(q => ({ client: q._clientName, question: (q.quote || '').slice(0, 160), ago: q.timeAgo })),
                openTasks: (activeTasks || []).slice(0, 20).map(t => ({ client: t.clientName, title: t.title, due: t.dueAt })),
              }),
            }]}
            demoText={{
              attention: `- The Hartwells — large idle cash balance against an on-track plan; propose an investment schedule this week.\n- The Naylors — an unanswered flagged question is sitting in your inbox; a same-day reply keeps trust high.\n- The Okafors — no meeting logged this quarter; a short check-in call would close the gap.`,
            }}
          />
        </div>

        {/* Calendar — week ahead from the connected Google/Outlook calendar */}
        <CalendarCard isLive={isLiveMode} />

        {/* Tasks — next actions across the book (CRM) */}
        {(isLiveMode || isDemo) && (
          <div className="px-side-section">
            <div className="px-side-head">
              <h3><Icons.Check size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Tasks & next actions</h3>
              <span className="px-side-count">{activeTasks.length} open</span>
            </div>
            {activeTasks.slice(0, 8).map(t => {
              const due = dueMeta(t.dueAt);
              const taskClient = (activeClients || []).find(c => c.id === t.clientId);
              const openTaskClient = () => { if (taskClient) openClientPortal(taskClient); else showToast?.('No client view linked to this task'); };
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => completeDashTask(t)} aria-label="Complete task"
                    style={{ marginTop: 1, width: 15, height: 15, flexShrink: 0, borderRadius: 4, cursor: 'pointer',
                      border: '1.5px solid var(--border-2)', background: 'transparent', padding: 0 }} />
                  {/* Click the task body to jump to that client's workspace */}
                  <div role="button" tabIndex={0}
                    onClick={openTaskClient}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaskClient(); } }}
                    title={taskClient ? `Open ${t.clientName || taskClient.shortName || taskClient.name}` : undefined}
                    className="px-task-row"
                    style={{ flex: 1, minWidth: 0, cursor: taskClient ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.3 }}>
                        {t.priority === 'high' && <span style={{ color: 'var(--brick)', marginRight: 4 }}>●</span>}
                        {t.title}
                      </div>
                      <div style={{ fontSize: 11, color: due.tone, marginTop: 2 }}>
                        {due.label}{t.clientName ? ` · ${t.clientName}` : ''}
                      </div>
                    </div>
                    {taskClient && <Icons.ChevronRight size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--ink-faint)' }} />}
                  </div>
                </div>
              );
            })}
            {activeTasks.length === 0 && (
              <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 13 }}>
                No open tasks — you're clear.
              </div>
            )}
          </div>
        )}

        {dbLedgerDrafts.length > 0 && (
          <div className="px-side-section">
            <div className="px-side-head">
              <h3><Icons.Check size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Client updates to review</h3>
              <span className="px-side-count">{dbLedgerDrafts.length} waiting</span>
            </div>
            {dbLedgerDrafts.map(row => (
              <LedgerApprovalCard key={row.id} row={row} authUser={authUser}
                clients={activeClients} onOpenClient={openClientPortal}
                onDone={(id, approved) => {
                  setDbLedgerDrafts(prev => prev.filter(r => r.id !== id));
                  showToast(approved ? 'Approved — household profile updated' : 'Returned to the client with your note');
                }} />
            ))}
          </div>
        )}

        <div className="px-side-section">
          <div className="px-side-head">
            <h3><Icons.Bell size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Alerts & nudges</h3>
            <span className="px-side-count">{visibleAlerts.length} open</span>
          </div>
          {visibleAlerts.map(a => <AlertCard key={a.id} alert={a} onSnooze={snooze} clients={activeClients} onAgenda={addAgendaItem} />)}
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

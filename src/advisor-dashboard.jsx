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
      <td className="is-num">
        <span className={`px-num ${client.uninvestedCash > 80_000 ? '' : ''}`} style={{ color: client.uninvestedCash > 80_000 ? 'var(--brick)' : 'var(--ink-mute)' }}>
          {fmt$(client.uninvestedCash, { short: true })}
        </span>
      </td>
      <td>
        <span className={`px-activity-dot ${client.recent ? 'is-recent' : client.lastActivity.includes('d') && parseInt(client.lastActivity) >= 7 ? 'is-warn' : ''}`}></span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{client.lastActivity}</span>
      </td>
      <td className="is-num">
        <Sparkline seed={client.id.charCodeAt(2) + client.id.charCodeAt(3)} trend={client.recent ? 'up' : 'flat'} color="var(--ink-faint)" width={48} height={16} />
      </td>
    </tr>
  );
};

/* ─── Alert card ─────────────────────────────────────────────────── */
const AlertCard = ({ alert }) => {
  const client = clientsData.find(c => c.id === alert.clientId);
  const I = Icons[alert.icon] || Icons.Bell;
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
        <button className="px-btn px-btn-sm px-btn-primary">
          <Icons.ArrowRight size={11} /> {alert.cta}
        </button>
        <button className="px-btn px-btn-sm px-btn-ghost">Snooze</button>
      </div>
    </div>
  );
};

/* ─── Flagged Question card ──────────────────────────────────────── */
const FlaggedQuestion = ({ q }) => {
  const client = clientsData.find(c => c.id === q.clientId);
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
        <button className="px-btn px-btn-sm px-btn-primary">
          <Icons.Message size={10} /> Reply
        </button>
        <button className="px-btn px-btn-sm px-btn-ghost">
          <Icons.Calendar size={10} /> Add to agenda
        </button>
      </div>
    </div>
  );
};

/* ─── Roster section ─────────────────────────────────────────────── */
const RosterTable = ({ onOpenClient }) => {
  const [q, setQ] = useStateAdv('');
  const [sort, setSort] = useStateAdv('aum');
  const filtered = useMemoAdv(() => {
    const term = q.toLowerCase().trim();
    let list = clientsData;
    if (term) list = list.filter(c => c.name.toLowerCase().includes(term) || c.tag.toLowerCase().includes(term));
    if (sort === 'aum') list = [...list].sort((a, b) => b.aum - a.aum);
    if (sort === 'phase') list = [...list].sort((a, b) => b.phase - a.phase);
    if (sort === 'activity') list = [...list].sort((a, b) => Number(b.recent) - Number(a.recent));
    return list;
  }, [q, sort]);

  return (
    <>
      <div className="px-section-head">
        <h2>Client roster</h2>
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
        </div>
      </div>
      <div className="px-roster">
        <table className="px-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>Client</th>
              <th style={{ width: '28%' }}>Current Horizon</th>
              <th className="is-num">AUM</th>
              <th className="is-num">Uninvested cash</th>
              <th style={{ width: 90 }}>Activity</th>
              <th className="is-num" style={{ width: 64 }}>YTD</th>
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

/* ─── Client preview modal (when an advisor clicks a row) ─────────── */
const ClientPreviewModal = ({ client, onClose }) => {
  if (!client) return null;
  const phase = phaseLabel(client.phase);
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
            <div className="px-portstat-value" style={{ fontSize: 19 }}>{fmt$(client.aum, { short: true })}</div>
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
              {fmt$(client.uninvestedCash, { short: true })}
            </div>
          </div>
        </div>

        <div style={{ padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 }}>
          "{client.notes}"
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="px-btn px-btn-ghost"><Icons.Phone size={12} /> Call</button>
          <button className="px-btn px-btn-ghost"><Icons.Message size={12} /> Message</button>
          <button className="px-btn px-btn-primary"><Icons.Eye size={12} /> Open client roadmap</button>
        </div>
      </div>
    </Modal>
  );
};

/* ─── Main Advisor Dashboard ─────────────────────────────────────── */
const AdvisorDashboard = () => {
  const [previewClient, setPreviewClient] = useStateAdv(null);

  const kpis = useMemoAdv(() => {
    const totalAUM = clientsData.reduce((a, c) => a + c.aum, 0);
    const totalCashDrag = clientsData.reduce((a, c) => a + c.uninvestedCash, 0);
    const activeCount = clientsData.length;
    const inLateHorizon = clientsData.filter(c => c.phase >= 5).length;
    return { totalAUM, totalCashDrag, activeCount, inLateHorizon };
  }, []);

  return (
    <div className="px-adv">
      <ClientPreviewModal client={previewClient} onClose={() => setPreviewClient(null)} />

      <div className="px-adv-main">
        {/* Greeting */}
        <div className="px-greet">
          <div className="px-eyebrow px-greet-eyebrow">
            <span>Thursday · Oct 23</span>
          </div>
          <h1>Good morning, <em>Madeline</em>.</h1>
          <p className="px-greet-sub">
            {alertsData.filter(a => a.priority === 'high').length} action items this morning and {questionsData.length} client questions awaiting reply. The Patel Trust distribution has settled and is sitting in cash — that's the first call.
          </p>
        </div>

        {/* KPIs */}
        <div className="px-kpis">
          <KpiTile label="Book AUM" value={fmt$(kpis.totalAUM, { short: true, decimals: 1 })}
                   delta="+ $1.8M MTD" deltaDir="up"
                   sparkSeed={7} sparkTrend="up" />
          <KpiTile label="Active clients" value={kpis.activeCount}
                   sub="2 onboarding"
                   sparkSeed={3} sparkTrend="up" />
          <KpiTile label="Late-horizon" value={kpis.inLateHorizon}
                   sub="Phase 06 +"
                   sparkSeed={11} sparkTrend="up" />
          <KpiTile label="Cash drag" value={fmt$(kpis.totalCashDrag, { short: true })}
                   delta="3 clients over target" deltaDir="down"
                   sparkSeed={19} sparkTrend="up" />
        </div>

        {/* Roster */}
        <RosterTable onOpenClient={setPreviewClient} />

        {/* Footer note */}
        <div style={{ marginTop: 28, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icons.Info size={13} />
          <span>
            Roster is filtered by your advisor seat. <b>Row-level security</b> ensures advisors see only their book. White-label content is editable in <a href="#" style={{ color: 'var(--gold)' }}>Firm settings → Phase library</a>.
          </span>
        </div>
      </div>

      <aside className="px-adv-side">
        <div className="px-side-section">
          <div className="px-side-head">
            <h3><Icons.Bell size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Alerts & nudges</h3>
            <span className="px-side-count">{alertsData.length} open</span>
          </div>
          {alertsData.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>

        <div className="px-side-section">
          <div className="px-side-head">
            <h3><Icons.Inbox size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--gold)' }} /> Flagged questions</h3>
            <span className="px-side-count">{questionsData.length} unread</span>
          </div>
          {questionsData.map(q => <FlaggedQuestion key={q.id} q={q} />)}
        </div>
      </aside>
    </div>
  );
};

window.AdvisorDashboard = AdvisorDashboard;

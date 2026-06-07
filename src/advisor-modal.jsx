// Prism — Advisor modals: NewClientModal + ClientPreviewModal.
// Extracted from advisor-dashboard.jsx; shares the global bundle scope (no imports/exports).

/* ─── New Client modal ───────────────────────────────────────────── */
const PHASES = phasesData.map(p => ({ value: p.id, label: `Phase ${p.num} — ${p.title}` }));

const NewClientModal = ({ isOpen, onClose, advisorId, firmId, onCreated }) => {
  const { showToast } = useView();
  const [saving, setSaving] = useStateAdv(false);
  const [form, setForm] = useStateAdv({ household_name: '', short_name: '', household_tag: '', current_phase: 0 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Optional starting financials — a quick pre-entry so the new client's roadmap
  // and calculators have real numbers from day one. Fully optional; advisors can
  // fill the rest later in the numbers panel.
  const [showFin, setShowFin] = useStateAdv(false);
  const [fin, setFin] = useStateAdv({ monthlyTakehome: '', emergency: '', taxableBalance: '', retirementBalance: '' });
  const setF = (k, v) => setFin(f => ({ ...f, [k]: v }));

  const resetAll = () => {
    setForm({ household_name: '', short_name: '', household_tag: '', current_phase: 0 });
    setFin({ monthlyTakehome: '', emergency: '', taxableBalance: '', retirementBalance: '' });
    setShowFin(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.household_name.trim()) return;
    setSaving(true);
    const row = await window.db.createClient(advisorId, firmId, form);
    if (row) {
      // If any starting numbers were entered, seed the client's profile.
      const num = (v) => (v === '' || v == null ? undefined : Number(v));
      const partial = {};
      if (num(fin.monthlyTakehome)  != null) partial.income     = { monthlyTakehome: num(fin.monthlyTakehome) };
      if (num(fin.emergency)        != null) partial.savings    = { emergency: num(fin.emergency) };
      if (num(fin.taxableBalance)   != null) partial.taxable    = { balance: num(fin.taxableBalance) };
      if (num(fin.retirementBalance)!= null) partial.retirement = { fourohonekBalance: num(fin.retirementBalance) };
      if (Object.keys(partial).length && window.mergeProfile) {
        try { await window.db.saveProfile(row.id, window.mergeProfile(window.emptyProfile, partial)); } catch {}
      }
      showToast(`${form.short_name || form.household_name} added to your roster`);
      onCreated(window.db.mapClient(row));
      resetAll();
      onClose();
    } else {
      showToast('Could not save — check console for details');
    }
    setSaving(false);
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

            {/* Optional: pre-enter a few headline numbers so the roadmap isn't blank */}
            {!showFin ? (
              <button type="button" className="px-btn px-btn-sm px-btn-ghost" style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowFin(true)}>
                <Icons.Plus size={11} /> Add starting numbers (optional)
              </button>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--bg-elev)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                  Starting financials — optional
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['monthlyTakehome',  'Monthly take-home'],
                    ['emergency',        'Cash / emergency'],
                    ['taxableBalance',   'Investment assets'],
                    ['retirementBalance','Retirement assets'],
                  ].map(([k, label]) => (
                    <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{label}</span>
                      <div className="px-input-affix">
                        <span className="px-affix">$</span>
                        <input type="number" min="0" placeholder="0" value={fin[k]}
                          onChange={e => setF(k, e.target.value)} />
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 8, fontStyle: 'italic' }}>
                  Optional — fill in the full picture anytime from the client's “Your numbers” panel.
                </div>
              </div>
            )}
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

// Member age from dateOfBirth (W4 DOB model), falling back to a legacy `age` field.
// Mirrors store.jsx so the advisor-side inline readiness calc ages DOB-based members.
const advMemberAge = (m) => {
  if (!m) return 0;
  if (m.dateOfBirth) {
    const bd = new Date(m.dateOfBirth), t = new Date();
    let a = t.getFullYear() - bd.getFullYear();
    if (t.getMonth() < bd.getMonth() || (t.getMonth() === bd.getMonth() && t.getDate() < bd.getDate())) a--;
    return a > 0 ? a : 0;
  }
  return Number(m.age) || 0;
};

const ClientPreviewModal = ({ client, onClose, onNotesChange, onUpdated, onArchived, advisorId, firmId }) => {
  const { openClientPortal, openClientNumbers, showToast } = useView();
  const { authUser } = useAuth();
  const [tab, setTab] = useStateAdv('overview');

  // Notes state
  const [editingNotes, setEditingNotes] = useStateAdv(false);
  const [notes, setNotes] = useStateAdv('');
  const [acks, setAcks] = useStateAdv(undefined);
  const [ackForm, setAckForm] = useStateAdv(null);

  // Accounts state
  const [accounts, setAccounts] = useStateAdv(undefined);
  const [accForm, setAccForm] = useStateAdv(null);
  const [savingAcc, setSavingAcc] = useStateAdv(false);
  const [linking, setLinking] = useStateAdv(false);

  // Meetings state
  const [meetings,      setMeetings]      = useStateAdv(undefined);
  const [meetingForm,   setMeetingForm]   = useStateAdv(null);
  const [savingMeeting, setSavingMeeting] = useStateAdv(false);

  // Edit client state
  const [editForm, setEditForm] = useStateAdv({});
  const [savingEdit, setSavingEdit] = useStateAdv(false);
  const [archiving, setArchiving] = useStateAdv(false);
  const [feeSchedules, setFeeSchedules] = useStateAdv([]);

  // Inline confirmation guards (replace window.confirm / immediate deletes)
  const [confirmArchive,      setConfirmArchive]      = useStateAdv(false);
  const [confirmDeleteAccId,  setConfirmDeleteAccId]  = useStateAdv(null);
  const [confirmDeleteMtgId,  setConfirmDeleteMtgId]  = useStateAdv(null);

  // CRM tasks + timeline (audit) state
  const [tasks,     setTasks]     = useStateAdv(undefined);
  const [taskForm,  setTaskForm]  = useStateAdv(null);
  const [savingTask, setSavingTask] = useStateAdv(false);
  const [modalAdvisors, setModalAdvisors] = useStateAdv([]);
  const advisorName = (id) => modalAdvisors.find(a => a.id === id)?.full_name || null;
  const [timeline,  setTimeline]  = useStateAdv(undefined);
  const [versionCount, setVersionCount] = useStateAdv(0);

  // Household profile (for members + asset reconciliation in Overview)
  const [profileData, setProfileData] = useStateAdv(null);

  // Performance state
  const [perfBal,   setPerfBal]   = useStateAdv(undefined);
  const [perfFlows, setPerfFlows] = useStateAdv([]);
  const [flowForm,  setFlowForm]  = useStateAdv(null);
  const [benchRate, setBenchRate] = useStateAdv(0.07);
  const perfSeries = useMemoAdv(() => buildValueSeries(perfBal || []), [perfBal]);
  const perfStats  = useMemoAdv(() => perfPeriods(perfSeries, perfFlows), [perfSeries, perfFlows]);
  const acctMix = useMemoAdv(() => {
    const rows = accounts || [];
    const total = rows.reduce((s, a) => s + (Number(a.balance) || 0), 0) || 1;
    const byType = {};
    rows.forEach(a => { byType[a.type] = (byType[a.type] || 0) + (Number(a.balance) || 0); });
    return Object.entries(byType).map(([type, bal]) => ({ type, bal, pct: (bal / total) * 100 }))
      .sort((a, b) => b.bal - a.bal);
  }, [accounts]);

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
        pipeline_stage: client.pipelineStage || 'active',
        fee_schedule_id: client.feeScheduleId || '',
      });
      if (window.db?.isUUID(client.id)) window.db.getFeeSchedules().then(r => setFeeSchedules(r || []));
      if (window.db?.isUUID(client.id)) window.db.getAcknowledgements(client.id).then(r => setAcks(r || [])); else setAcks([]);
      setAckForm(null);
      setConfirmArchive(false);
      setConfirmDeleteAccId(null);
      setConfirmDeleteMtgId(null);
      setTasks(undefined);
      setTaskForm(null);
      setTimeline(undefined);
      setVersionCount(0);
      setPerfBal(undefined);
      setPerfFlows([]);
      setFlowForm(null);
    }
  }, [client?.id]);

  // Load performance data when the Performance tab opens (DB for live, mock for demo)
  React.useEffect(() => {
    if (tab !== 'performance' || !client || perfBal !== undefined) return;
    if (window.db?.isUUID(client.id)) {
      window.db.getBalanceHistory(client.id).then(rows => setPerfBal(rows || []));
      window.db.getCashFlows(client.id).then(rows => setPerfFlows(rows || []));
      if (accounts === undefined) window.db.getAccounts(client.id).then(rows => setAccounts(rows || []));
    } else {
      setPerfBal(demoBalanceHistory(client.aum || 0));
      setPerfFlows(demoCashFlows());
      if (accounts === undefined) setAccounts(accountsData[client.id] || []);
    }
  }, [tab]);

  // Load accounts when tab becomes active (DB for live, mock for demo)
  React.useEffect(() => {
    if (tab !== 'accounts' || !client || accounts !== undefined) return;
    if (window.db?.isUUID(client.id)) window.db.getAccounts(client.id).then(rows => setAccounts(rows || []));
    else setAccounts(accountsData[client.id] || []);
  }, [tab]);

  // Load tasks when the Tasks tab opens (DB for live clients, mock for demo)
  React.useEffect(() => {
    if (tab !== 'tasks' || !client || tasks !== undefined) return;
    if (window.db?.isUUID(client.id) && advisorId) {
      window.db.getTasks(advisorId, { clientId: client.id, includeDone: true })
        .then(rows => setTasks(rows ? rows.map(window.db.mapTask) : []));
      if (!modalAdvisors.length) window.db.getAdvisors().then(r => setModalAdvisors(r || []));
    } else {
      setTasks(tasksData.filter(t => t.clientId === client.id));
    }
  }, [tab]);

  // Load timeline (audit + version count) when the Timeline tab opens
  React.useEffect(() => {
    if (tab !== 'timeline' || !client || timeline !== undefined) return;
    if (window.db?.isUUID(client.id)) {
      window.db.getAuditLog({ clientId: client.id, limit: 100 }).then(rows => setTimeline(rows || []));
      window.db.getProfileVersions(client.id).then(rows => setVersionCount((rows || []).length));
    } else {
      setTimeline(demoTimeline(client));
      setVersionCount(4);
    }
  }, [tab]);

  // Load meetings whenever a live client opens
  React.useEffect(() => {
    if (client && window.db?.isUUID(client.id)) {
      window.db.getMeetings(client.id).then(rows => setMeetings(rows || []));
    }
  }, [client?.id]);

  // Load the household profile (members + invested balances) for the Overview
  React.useEffect(() => {
    setProfileData(null);
    if (client && window.db?.isUUID(client.id)) {
      window.db.getProfile(client.id).then(d => setProfileData(d || null));
    }
  }, [client?.id]);

  // Mark the client's messages read when the advisor opens the Messages tab.
  React.useEffect(() => {
    if (tab === 'messages' && client && window.db?.isUUID(client.id)) {
      window.db.markMessagesRead(client.id);
    }
  }, [tab, client?.id]);

  if (!client) return null;

  const phase = phaseLabel(client.phase);
  const isLiveClient = window.db?.isUUID(client.id);
  const openRoadmap = () => { openClientPortal(client); onClose(); };

  /* notes */
  const requestAck = async () => {
    if (!ackForm?.title?.trim()) { showToast('Give the acknowledgement a title'); return; }
    const row = await window.db.createAcknowledgement(client.id, firmId, advisorId,
      { title: ackForm.title.trim(), body: ackForm.body?.trim() || null });
    if (row) { setAcks(prev => [row, ...(prev || [])]); setAckForm(null); showToast('Acknowledgement requested'); }
    else showToast('Could not create — check console');
  };

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
    if (!isLiveClient) {
      const a = { id: accForm.id || ('demo-' + Date.now()), client_id: client.id, type: accForm.type || 'other',
        custodian: accForm.custodian || '', name: accForm.name || '', balance: Number(accForm.balance) || 0,
        cash: Number(accForm.cash) || 0, source: 'manual' };
      setAccounts(prev => {
        const idx = (prev || []).findIndex(x => x.id === a.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = a; return n; }
        return [...(prev || []), a];
      });
      setAccForm(null); showToast('Account saved'); return;
    }
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
    if (!isLiveClient) { setAccounts(prev => (prev || []).filter(a => a.id !== id)); showToast('Account removed'); return; }
    await window.db.deleteAccount(id, client.id);
    const totals = await window.db.syncClientTotals(client.id);
    setAccounts(prev => (prev || []).filter(a => a.id !== id));
    showToast('Account removed');
    if (totals && onUpdated) {
      onUpdated({ ...client, aum: totals.aum, uninvestedCash: totals.uninvested_cash });
    }
  };

  // Link held-away accounts via Plaid (requires Plaid keys set as Edge secrets)
  const linkPlaid = async () => {
    if (!window.Plaid) { showToast('Plaid Link unavailable — reload the page'); return; }
    if (!window.__sb) { showToast('Account linking needs a live session'); return; }
    setLinking(true);
    try {
      const { data, error } = await window.__sb.functions.invoke('plaid-create-link-token',
        { body: { clientId: client.id } });
      if (error || !data?.link_token) throw new Error(error?.message || 'Plaid not configured');
      const handler = window.Plaid.create({
        token: data.link_token,
        onSuccess: async (publicToken, metadata) => {
          showToast('Importing accounts…');
          const { data: res, error: exErr } = await window.__sb.functions.invoke('plaid-exchange-token',
            { body: { clientId: client.id, publicToken, institutionName: metadata?.institution?.name } });
          if (exErr || res?.error) { showToast('Import failed — check console'); console.warn(exErr || res); return; }
          const rows = await window.db.getAccounts(client.id);
          setAccounts(rows || []);
          if (onUpdated) onUpdated({ ...client, aum: res.aum, uninvestedCash: res.cash });
          showToast(`Linked ${res.imported} account${res.imported !== 1 ? 's' : ''}`);
        },
        onExit: () => {},
      });
      handler.open();
    } catch (e) {
      showToast(e.message || 'Could not start Plaid Link');
      console.warn(e);
    } finally { setLinking(false); }
  };

  /* meetings */
  const saveMeeting = async () => {
    if (!advisorId) { showToast('No advisor ID — cannot save meeting'); return; }
    setSavingMeeting(true);
    const met_at = meetingForm.met_at
      ? new Date(meetingForm.met_at).toISOString()
      : new Date().toISOString();
    // Future date → a scheduled (confirmed) meeting; past/now → a logged one
    const status = new Date(met_at).getTime() > Date.now() ? 'confirmed' : 'logged';
    const row = await window.db.logMeeting(client.id, advisorId, { ...meetingForm, met_at, status });
    setSavingMeeting(false);
    if (row) {
      setMeetings(prev => [row, ...(prev || [])]);
      setMeetingForm(null);
      showToast(status === 'confirmed' ? 'Meeting scheduled' : 'Meeting logged');
    } else {
      showToast('Could not save meeting — check console');
    }
  };

  const setMeetingStatus = async (id, status) => {
    const row = await window.db.updateMeetingStatus(id, status, client.id);
    if (row) setMeetings(prev => (prev || []).map(m => m.id === id ? { ...m, status } : m));
    showToast(status === 'confirmed' ? 'Meeting confirmed' : status === 'canceled' ? 'Meeting canceled' : `Meeting ${status}`);
  };

  const deleteMeeting = async (id) => {
    await window.db.deleteMeeting(id, client.id);
    setMeetings(prev => (prev || []).filter(m => m.id !== id));
    showToast('Meeting removed');
  };

  /* tasks (CRM) — interactive for live clients; local-only for demo/mock */
  const mockTask = (fields) => ({
    id: 'demo-' + Date.now(), clientId: client.id, clientName: client.shortName,
    title: fields.title, detail: fields.detail || '', priority: fields.priority || 'normal',
    status: 'open', dueAt: fields.due_at || null, createdAt: new Date().toISOString(), completedAt: null,
  });

  const saveTask = async () => {
    if (!taskForm.title?.trim()) { showToast('Task needs a title'); return; }
    const due_at = taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null;
    if (!isLiveClient) {
      setTasks(prev => [mockTask({ ...taskForm, title: taskForm.title.trim(), due_at }), ...(prev || [])]);
      setTaskForm(null); showToast('Task created'); return;
    }
    setSavingTask(true);
    const row = await window.db.createTask(advisorId, firmId, { ...taskForm, due_at, client_id: client.id });
    setSavingTask(false);
    if (row) {
      setTasks(prev => [window.db.mapTask(row), ...(prev || [])]);
      setTaskForm(null);
      showToast('Task created');
    } else { showToast('Could not create task — check console'); }
  };

  const toggleTask = async (t) => {
    const next = t.status === 'done' ? 'open' : 'done';
    if (!isLiveClient) {
      setTasks(prev => (prev || []).map(x => x.id === t.id ? { ...x, status: next, completedAt: next === 'done' ? new Date().toISOString() : null } : x));
      return;
    }
    const row = await window.db.updateTask(t.id, { status: next }, client.id);
    if (row) setTasks(prev => (prev || []).map(x => x.id === t.id ? window.db.mapTask(row) : x));
  };

  const removeTask = async (t) => {
    if (!isLiveClient) { setTasks(prev => (prev || []).filter(x => x.id !== t.id)); showToast('Task deleted'); return; }
    await window.db.deleteTask(t.id, client.id);
    setTasks(prev => (prev || []).filter(x => x.id !== t.id));
    showToast('Task deleted');
  };

  // Quick cadence — schedule a review task N months out
  const scheduleCadence = async (months, label) => {
    const due = new Date(); due.setMonth(due.getMonth() + months);
    const stamp = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!isLiveClient) {
      setTasks(prev => prev === undefined ? prev : [mockTask({ title: `${label} — ${client.shortName}`, due_at: due.toISOString() }), ...(prev || [])]);
      showToast(`${label} scheduled for ${stamp}`); return;
    }
    const row = await window.db.createTask(advisorId, firmId,
      { title: `${label} — ${client.shortName}`, due_at: due.toISOString(), client_id: client.id, priority: 'normal' });
    if (row) {
      setTasks(prev => prev === undefined ? prev : [window.db.mapTask(row), ...(prev || [])]);
      showToast(`${label} scheduled for ${stamp}`);
    }
  };

  /* cash flows (performance) */
  const addFlow = async () => {
    if (!flowForm?.amount) { showToast('Enter an amount'); return; }
    const signed = flowForm.kind === 'withdrawal' || flowForm.kind === 'fee'
      ? -Math.abs(Number(flowForm.amount)) : Math.abs(Number(flowForm.amount));
    if (!isLiveClient) {
      setPerfFlows(prev => [{ id: 'demo-' + Date.now(), flow_date: flowForm.flow_date, amount: signed, kind: flowForm.kind }, ...(prev || [])]);
      setFlowForm(null); showToast('Cash flow logged'); return;
    }
    const row = await window.db.addCashFlow(client.id, { ...flowForm, amount: signed });
    if (row) { setPerfFlows(prev => [row, ...(prev || [])]); setFlowForm(null); showToast('Cash flow logged'); }
  };
  const removeFlow = async (id) => {
    if (!isLiveClient) { setPerfFlows(prev => (prev || []).filter(f => f.id !== id)); return; }
    await window.db.deleteCashFlow(id, client.id);
    setPerfFlows(prev => (prev || []).filter(f => f.id !== id));
  };

  /* compliance export */
  const exportCompliance = async () => {
    showToast('Compiling compliance record…');
    const [audit, versions] = await Promise.all([
      window.db.getAuditLog({ clientId: client.id, limit: 500 }),
      window.db.getProfileVersions(client.id),
    ]);
    window.printComplianceReport?.(client, audit || [], meetings || [], (versions || []).length);
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
            <div className="px-eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>Quick view</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>{client.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3 }}>
              {client.tag} · last activity {client.lastActivity}
              {meetings?.length > 0 && ` · reviewed ${timeAgo(meetings[0].met_at)} ago`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {isLiveClient && (
              <button className="px-btn px-btn-sm px-btn-ghost"
                aria-label="Export compliance record"
                onClick={exportCompliance}>
                <Icons.Lock size={12} /> Compliance
              </button>
            )}
            <button className="px-btn px-btn-sm px-btn-ghost"
              aria-label="Edit this client's numbers"
              onClick={() => { openClientNumbers(client); onClose(); }}>
              <Icons.Calculator size={12} /> Edit numbers
            </button>
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
            {['overview', 'accounts', 'messages', 'documents', 'tasks', 'timeline', 'performance', 'edit'].map(t => (
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

            {/* Retirement-readiness verdict (live clients with profile data) */}
            {(() => {
              if (!profileData) return null;
              const m = Array.isArray(profileData.members) ? profileData.members : [];
              const primary = m.find(x => x.role === 'primary') || m[0];
              const age = advMemberAge(primary) || Number(profileData.goals?.age || 0);
              const r = profileData.retirement || {};
              const invested = (Number(r.hsaBalance) || 0) + (Number(r.iraBalance) || 0)
                + (Number(r.fourohonekBalance) || 0) + (Number(profileData.taxable?.balance) || 0);
              const expenses = Object.values(profileData.expenses || {}).reduce((a, b) => a + (Number(b) || 0), 0) * 12;
              const contrib = (Number(profileData.taxable?.monthlyContrib) || 0) * 12
                + (Number(r.hsaContrib) || 0) + (Number(r.iraContributed) || 0) + (Number(r.fourohonekContributed) || 0);
              if (!age && !invested && !expenses) return null;
              const rr = (window.PrismCalc || {}).retirementReadiness?.({
                currentAge: age, retireAt: Number(profileData.goals?.retireAt) || 65,
                currentInvested: invested, annualContribution: contrib,
                annualExpenses: expenses, streams: profileData.incomeStreams || [] });
              if (!rr) return null;
              const tone = rr.verdict === 'On track' ? 'var(--forest)'
                : rr.verdict === 'Nearly there' ? 'var(--gold)' : 'var(--brick)';
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16,
                  padding: '10px 12px', background: 'var(--bg-elev)', borderRadius: 6 }}>
                  <span style={LABEL_STYLE}>Retirement readiness</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-mute)' }}>
                    {Math.round(rr.fundedRatio * 100)}% funded
                    <span style={{ fontWeight: 600, color: tone, border: `1px solid ${tone}`, borderRadius: 20, padding: '1px 9px' }}>{rr.verdict}</span>
                  </span>
                </div>
              );
            })()}

            {/* Household members + asset reconciliation (live clients with profile data) */}
            {profileData && Array.isArray(profileData.members) && profileData.members.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>Household</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profileData.members.map(m => (
                    <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                      background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px' }}>
                      <span style={{ color: 'var(--ink)' }}>{m.name || 'Unnamed'}</span>
                      <span style={{ color: 'var(--ink-faint)', textTransform: 'capitalize' }}>
                        {m.role}{advMemberAge(m) > 0 ? ` · ${advMemberAge(m)}` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Funding goals summary (live clients with goals on file) */}
            {(() => {
              const items = profileData?.goals?.items;
              if (!Array.isArray(items) || !items.length) return null;
              const gf = (window.PrismCalc || {}).goalFunding;
              if (!gf) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>Goals</div>
                  {items.map(g => {
                    const f = gf(g);
                    const tone = (f.status === 'funded' || f.status === 'on pace') ? 'var(--forest)'
                      : f.status === 'behind' ? 'var(--gold)' : 'var(--brick)';
                    const label = { funded: 'Funded', 'on pace': 'On pace', behind: 'Behind', 'past due': 'Past due' }[f.status] || f.status;
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--ink)' }}>{g.label || 'Goal'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ink-mute)', fontSize: 12 }}>
                          {g.targetAmount > 0 ? Math.min(100, Math.round((g.currentFunding / g.targetAmount) * 100)) : 0}%
                          <span style={{ fontWeight: 600, color: tone, border: `1px solid ${tone}`, borderRadius: 20, padding: '1px 8px' }}>{label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Protection & estate summary (unsoftened, advisor-side) */}
            {(() => {
              if (!profileData) return null;
              const insurance = Array.isArray(profileData.insurance) ? profileData.insurance : [];
              const estate = (profileData.estate && typeof profileData.estate === 'object') ? profileData.estate : {};
              const estateKeys = ['will', 'trust', 'poa', 'healthcareDirective', 'beneficiaries'];
              const estateComplete = estateKeys.filter(k => estate[k]?.status === 'complete').length;
              if (!insurance.length && !estateComplete) return null;
              const lifeCoverage = insurance.filter(i => i.type === 'life').reduce((s, i) => s + (Number(i.coverageAmount) || 0), 0);
              const grossAnnual = (Array.isArray(profileData.income?.sources) ? profileData.income.sources : [])
                .reduce((s, x) => s + (Number(x.monthlyGross) || 0), 0) * 12 || (Number(profileData.income?.monthlyTakehome) || 0) * 12;
              const totalDebt = (Array.isArray(profileData.debts) ? profileData.debts : []).reduce((s, d) => s + (Number(d.balance) || 0), 0);
              const cg = (window.PrismCalc || {}).lifeCoverageGap?.({
                annualIncome: grossAnnual, incomeMultiple: 10, liabilities: totalDebt,
                existingCoverage: lifeCoverage, liquidAssets: Number(profileData.savings?.emergency) || 0 }) || {};
              const tone = cg.covered ? 'var(--forest)' : 'var(--gold)';
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16,
                  padding: '10px 12px', background: 'var(--bg-elev)', borderRadius: 6 }}>
                  <span style={LABEL_STYLE}>Protection &amp; estate</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-mute)' }}>
                    Life {fmt$(lifeCoverage, { short: true })}{cg.recommended > 0 ? ` / ${fmt$(cg.recommended, { short: true })}` : ''}
                    {!cg.covered && cg.gap > 0 && (
                      <span style={{ fontWeight: 600, color: tone, border: `1px solid ${tone}`, borderRadius: 20, padding: '1px 9px' }}>
                        gap {fmt$(cg.gap, { short: true })}
                      </span>
                    )}
                    <span style={{ color: 'var(--ink-faint)' }}>· estate {estateComplete}/{estateKeys.length}</span>
                  </span>
                </div>
              );
            })()}

            {/* Asset-truth composition (W6) — managed + held-away = total, or a stale-data flag */}
            {(() => {
              if (!profileData) return null;
              const r = profileData.retirement || {};
              const investedOnFile = (Number(r.hsaBalance) || 0) + (Number(r.iraBalance) || 0)
                + (Number(r.fourohonekBalance) || 0) + (Number(profileData.taxable?.balance) || 0);
              const comp = (window.PrismCalc || {}).assetComposition?.({ managedAum: client.aum, investedOnFile });
              if (!comp || comp.total <= 0) return null;
              if (comp.stale) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                    padding: '10px 12px', background: 'var(--bg-elev)', borderLeft: '3px solid var(--gold)',
                    borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold)', display: 'flex', flexShrink: 0 }}><Icons.AlertCircle size={15} /></span>
                    <span>Managed AUM ({fmt$(comp.managed, { short: true })}) exceeds invested balances on file ({fmt$(investedOnFile, { short: true })}) — the household's numbers are likely stale.</span>
                  </div>
                );
              }
              if (!comp.hasHeldAway) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16,
                  padding: '10px 12px', background: 'var(--bg-elev)', borderRadius: 6, fontSize: 12, color: 'var(--ink-mute)' }}>
                  <span style={LABEL_STYLE}>Invested</span>
                  <span><span style={{ color: 'var(--forest)', fontWeight: 600 }}>{fmt$(comp.managed, { short: true })}</span> managed</span>
                  <span style={{ color: 'var(--border-2)' }}>+</span>
                  <span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt$(comp.heldAway, { short: true })}</span> held away</span>
                  <span style={{ color: 'var(--border-2)' }}>=</span>
                  <span><span style={{ color: 'var(--ink)', fontWeight: 700 }}>{fmt$(comp.total, { short: true })}</span> total · {comp.managedPct}% managed</span>
                </div>
              );
            })()}

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

            {/* ── Acknowledgements (live clients) — request a client e-sign ── */}
            {isLiveClient && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={LABEL_STYLE}>Acknowledgements</span>
                  {!ackForm && (
                    <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setAckForm({ title: '', body: '' })}>
                      <Icons.Plus size={10} /> Request
                    </button>
                  )}
                </div>
                {ackForm && (
                  <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 10 }}>
                    <input className="px-input" placeholder="Title (e.g. Investment Policy Statement)" value={ackForm.title} autoFocus
                      onChange={e => setAckForm(f => ({ ...f, title: e.target.value }))} style={{ marginBottom: 8 }} />
                    <textarea className="px-input" rows={2} placeholder="Statement the client will read and sign (optional)"
                      value={ackForm.body} onChange={e => setAckForm(f => ({ ...f, body: e.target.value }))}
                      style={{ resize: 'vertical', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="px-btn px-btn-sm px-btn-primary" onClick={requestAck}>Send request</button>
                      <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setAckForm(null)}>Cancel</button>
                    </div>
                  </div>
                )}
                {acks === undefined && <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading…</div>}
                {Array.isArray(acks) && acks.length === 0 && !ackForm && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>No acknowledgements yet.</div>
                )}
                {Array.isArray(acks) && acks.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--ink)' }}>{a.title}</span>
                    {a.status === 'acknowledged' ? (
                      <span style={{ fontSize: 11, color: 'var(--forest)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <Icons.CheckCircle size={12} /> Signed{a.signer_name ? ` · ${a.signer_name}` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gold)' }}>Pending</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Meeting log (live clients only) ── */}
            {isLiveClient && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={LABEL_STYLE}>Meetings</span>
                  {!meetingForm && (
                    <button className="px-btn px-btn-sm px-btn-ghost"
                      onClick={() => setMeetingForm({
                        notes: '', duration_min: '',
                        met_at: new Date().toISOString().slice(0, 16),
                      })}>
                      <Icons.Plus size={10} /> Log / schedule
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="px-btn px-btn-sm px-btn-primary" onClick={saveMeeting} disabled={savingMeeting}>
                        {savingMeeting ? 'Saving…'
                          : (meetingForm.met_at && new Date(meetingForm.met_at).getTime() > Date.now() ? 'Schedule meeting' : 'Log meeting')}
                      </button>
                      <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setMeetingForm(null)}>Cancel</button>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                        {meetingForm.met_at && new Date(meetingForm.met_at).getTime() > Date.now() ? 'Future date → scheduled' : 'Past date → logged'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Meeting list */}
                {meetings === undefined && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading…</div>
                )}
                {meetings !== undefined && meetings.length === 0 && !meetingForm && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>
                    No meetings yet.
                  </div>
                )}
                {(meetings || []).filter(m => m.status !== 'canceled').map(m => {
                  const st = m.status || 'logged';
                  const upcoming = new Date(m.met_at).getTime() > Date.now();
                  const badge = st === 'requested' ? { label: 'Requested', color: 'var(--gold)' }
                    : (st === 'confirmed' && upcoming) ? { label: 'Upcoming', color: 'var(--forest)' }
                    : null;
                  return (
                    <div key={m.id} className="px-meeting-row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                          {new Date(m.met_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {(st === 'requested' || st === 'confirmed') && (
                            <span style={{ fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>
                              {new Date(m.met_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {m.duration_min && <span style={{ fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 6 }}>{m.duration_min} min</span>}
                          {badge && (
                            <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
                              color: badge.color, border: `1px solid ${badge.color}`, borderRadius: 20, padding: '0 6px' }}>{badge.label}</span>
                          )}
                        </div>
                        {m.notes && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.4 }}>{m.notes}</div>}
                      </div>
                      {st === 'requested' ? (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: 'var(--sans)' }}
                            onClick={() => setMeetingStatus(m.id, 'confirmed')}>Confirm</button>
                          <button style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: 'var(--sans)' }}
                            onClick={() => setMeetingStatus(m.id, 'canceled')}>Decline</button>
                        </div>
                      ) : (st === 'confirmed' && upcoming) ? (
                        <button style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: 'var(--sans)', flexShrink: 0 }}
                          onClick={() => setMeetingStatus(m.id, 'canceled')}>Cancel</button>
                      ) : confirmDeleteMtgId === m.id ? (
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
                  );
                })}
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
                        {a.source && a.source !== 'manual' && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, letterSpacing: '.04em',
                            color: 'var(--forest)', border: '1px solid var(--forest)', borderRadius: 20,
                            padding: '0 6px', textTransform: 'uppercase', fontFamily: 'var(--sans)', verticalAlign: 'middle' }}>
                            ⟲ Linked
                          </span>
                        )}
                        {a.name && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--sans)', fontStyle: 'normal' }}>{a.name}</div>}
                      </td>
                      <td style={{ padding: '9px 8px', color: 'var(--ink-mute)' }}>{a.custodian || '—'}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--mono, monospace)', color: 'var(--ink)' }}>{fmt$(a.balance, { short: true })}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--mono, monospace)', color: a.cash > 0 ? 'var(--brick)' : 'var(--ink-mute)' }}>{a.cash ? fmt$(a.cash, { short: true }) : '—'}</td>
                      <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="px-btn px-btn-sm px-btn-ghost" style={{ marginRight: 4 }} aria-label="Edit account"
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
                          <button className="px-btn px-btn-sm px-btn-ghost" style={{ color: 'var(--brick)' }} aria-label="Delete account"
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="px-btn px-btn-sm px-btn-ghost"
                  onClick={() => setAccForm({ type: 'taxable', custodian: '', name: '', balance: '', cash: '' })}>
                  <Icons.Plus size={11} /> Add account
                </button>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={linkPlaid} disabled={linking}>
                  <Icons.Refresh size={11} /> {linking ? 'Connecting…' : 'Link via Plaid'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Messages (two-way thread) ── */}
        {tab === 'messages' && (
          <MessageThread
            clientId={client.id}
            role="advisor"
            authorId={advisorId}
            firmId={firmId}
            counterpartName={client.shortName || client.name}
            emptyHint={`No messages yet — open the conversation with ${client.shortName || client.name}.`}
            demoSeed={window.demoMessages ? window.demoMessages() : []}
            height={360}
          />
        )}

        {/* ── Documents (vault) ── */}
        {tab === 'documents' && (
          <DocumentVault
            clientId={client.id}
            role="advisor"
            firmId={firmId}
            advisorId={advisorId}
            demoSeed={window.demoDocuments ? window.demoDocuments() : []}
            emptyHint={`No documents yet — upload an IPS, statement, or disclosure for ${client.shortName || client.name}.`}
          />
        )}

        {/* ── Tasks (CRM) ── */}
        {tab === 'tasks' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={LABEL_STYLE}>Open & recent tasks</span>
              {!taskForm && (
                <button className="px-btn px-btn-sm px-btn-ghost"
                  onClick={() => setTaskForm({ title: '', detail: '', priority: 'normal', due_at: '', assigned_to: advisorId || '' })}>
                  <Icons.Plus size={10} /> New task
                </button>
              )}
            </div>

            {/* Quick cadences */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[['Annual review', 12], ['Semi-annual check-in', 6], ['Quarterly review', 3], ['Onboarding follow-up', 1]].map(([label, m]) => (
                <button key={label} className="px-btn px-btn-sm px-btn-ghost" style={{ fontSize: 11 }}
                  onClick={() => scheduleCadence(m, label)}>
                  <Icons.Calendar size={10} /> {label}
                </button>
              ))}
            </div>

            {/* Inline new-task form */}
            {taskForm && (
              <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 12 }}>
                <input className="px-input" placeholder="Task title" value={taskForm.title} autoFocus
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  style={{ marginBottom: 8 }} />
                <textarea className="px-input" rows={2} placeholder="Detail (optional)"
                  value={taskForm.detail} onChange={e => setTaskForm(f => ({ ...f, detail: e.target.value }))}
                  style={{ resize: 'vertical', marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Due date</span>
                    <input className="px-input" type="date" value={taskForm.due_at}
                      onChange={e => setTaskForm(f => ({ ...f, due_at: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Priority</span>
                    <select className="px-select" value={taskForm.priority}
                      onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                    </select>
                  </label>
                </div>
                {modalAdvisors.length > 1 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Assign to</span>
                    <select className="px-select" value={taskForm.assigned_to || ''}
                      onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))}>
                      {modalAdvisors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </label>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="px-btn px-btn-sm px-btn-primary" onClick={saveTask} disabled={savingTask}>
                    {savingTask ? 'Saving…' : 'Create task'}
                  </button>
                  <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setTaskForm(null)}>Cancel</button>
                </div>
              </div>
            )}

            {tasks === undefined && <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading tasks…</div>}
            {tasks !== undefined && tasks.length === 0 && !taskForm && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>No tasks yet.</div>
            )}
            {(tasks || []).map(t => {
              const due = dueMeta(t.dueAt);
              const done = t.status === 'done';
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleTask(t)} aria-label="Toggle task"
                    style={{ marginTop: 1, width: 16, height: 16, flexShrink: 0, borderRadius: 4, cursor: 'pointer',
                      border: `1.5px solid ${done ? 'var(--forest)' : 'var(--border-2)'}`,
                      background: done ? 'var(--forest)' : 'transparent', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    {done && <Icons.Check size={10} strokeWidth={3} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                      {t.priority === 'high' && <span style={{ color: 'var(--brick)', marginRight: 4 }}>●</span>}
                      {t.title}
                    </div>
                    {t.detail && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{t.detail}</div>}
                    <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                      {!done && <span style={{ color: due.tone }}>{due.label}</span>}
                      {t.assignedTo && advisorName(t.assignedTo) && (
                        <span style={{ color: 'var(--ink-faint)' }}>→ {advisorName(t.assignedTo)}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeTask(t)} aria-label="Delete task"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
                    <Icons.X size={11} />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ── Timeline (interaction history from the audit trail + meetings) ── */}
        {tab === 'timeline' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={LABEL_STYLE}>Interaction timeline</span>
              {versionCount > 0 && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{versionCount} profile version{versionCount !== 1 ? 's' : ''} on record</span>}
            </div>
            {timeline === undefined && <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading timeline…</div>}
            {timeline !== undefined && timeline.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>No recorded activity yet.</div>
            )}
            {(timeline || []).map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flexShrink: 0, width: 96, fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono, monospace)' }}>
                  {new Date(e.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <div>{new Date(e.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{AUDIT_ACTION_LABELS[e.action] || e.action}</div>
                  {e.summary && <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1 }}>{e.summary}</div>}
                  {e.actor_email && <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 1 }}>{e.actor_email}</div>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Performance (Theme D) ── */}
        {tab === 'performance' && (
          <>
            {perfBal === undefined ? (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Loading performance…</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <div>
                    <div style={LABEL_STYLE}>Portfolio value</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, color: 'var(--ink)', marginTop: 2 }}>
                      {perfSeries.length ? fmt$(perfSeries[perfSeries.length - 1].value, { short: true }) : '—'}
                    </div>
                  </div>
                  <button className="px-btn px-btn-sm px-btn-ghost"
                    onClick={() => window.printPerformanceReport?.({
                      client, series: perfSeries, periods: perfStats, flows: perfFlows,
                      advisorName: authUser?.full_name, advisorFirm: authUser?.firms?.name,
                    })}>
                    <Icons.Download size={11} /> Report
                  </button>
                </div>

                <PerfChart series={perfSeries} />

                {/* Benchmark selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Benchmark</span>
                  <select className="px-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                    value={benchRate} onChange={e => setBenchRate(Number(e.target.value))}>
                    {BENCHMARKS.map(b => <option key={b.rate} value={b.rate}>{b.label}</option>)}
                  </select>
                </div>

                {/* Period returns vs benchmark (Modified Dietz) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
                  {perfStats.map(s => {
                    // Advisor view leads with the GROSS (pre-fee) return — that's what
                    // benchmarks the manager's skill. Net of fees is shown beneath when
                    // fee debits are on record (it's what the client sees in their portal).
                    const gross = s.grossPct != null ? s.grossPct : s.pct;
                    const has = gross != null && isFinite(gross);
                    const pos = (gross || 0) >= 0;
                    const bench = benchmarkPct(s.start, s.end, benchRate);
                    const delta = has ? gross - bench : null;
                    return (
                      <div key={s.label} style={{ padding: '8px 6px', background: 'var(--bg-elev)', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: !has ? 'var(--ink-faint)' : pos ? 'var(--forest)' : 'var(--brick)' }}>
                          {has ? `${pos ? '+' : ''}${gross.toFixed(1)}%` : '—'}
                        </div>
                        {has && (
                          <div style={{ fontSize: 9.5, marginTop: 2, color: delta >= 0 ? 'var(--forest)' : 'var(--brick)' }}>
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} vs bm
                          </div>
                        )}
                        {has && s.fees > 0 && s.pct != null && (
                          <div style={{ fontSize: 9, marginTop: 2, color: 'var(--ink-faint)' }}>
                            net {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.5, marginBottom: 18 }}>
                  Gross of advisory fees, time-weighted (Modified Dietz) vs an assumed benchmark — clients see the net-of-fee return in their portal. Log flows below (including fee debits, kind “fee”) for accurate returns; per-security attribution arrives with holdings feeds (Plaid investments / custodian).
                </div>

                {/* Account mix (by account type; true asset-class attribution needs holdings) */}
                {acctMix.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>Account mix</div>
                    {acctMix.map(m => (
                      <div key={m.type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)', width: 130, flexShrink: 0 }}>
                          {window.db?.ACCOUNT_TYPE_LABELS?.[m.type] || m.type}
                        </span>
                        <div style={{ flex: 1, height: 8, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${m.pct}%`, height: '100%', background: 'var(--gold)' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--ink)', width: 78, textAlign: 'right' }}>
                          {fmt$(m.bal, { short: true })} · {m.pct.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cash flow log */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={LABEL_STYLE}>Cash flows</span>
                  {!flowForm && (
                    <button className="px-btn px-btn-sm px-btn-ghost"
                      onClick={() => setFlowForm({ amount: '', kind: 'contribution', flow_date: new Date().toISOString().slice(0, 10), note: '' })}>
                      <Icons.Plus size={10} /> Log flow
                    </button>
                  )}
                </div>

                {flowForm && (
                  <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Date</span>
                        <input className="px-input" type="date" value={flowForm.flow_date}
                          onChange={e => setFlowForm(f => ({ ...f, flow_date: e.target.value }))} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Type</span>
                        <select className="px-select" value={flowForm.kind}
                          onChange={e => setFlowForm(f => ({ ...f, kind: e.target.value }))}>
                          <option value="contribution">Contribution (+)</option>
                          <option value="withdrawal">Withdrawal (−)</option>
                          <option value="dividend">Dividend (+)</option>
                          <option value="fee">Fee (−)</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Amount ($)</span>
                        <input className="px-input" type="number" step="100" placeholder="0" value={flowForm.amount}
                          onChange={e => setFlowForm(f => ({ ...f, amount: e.target.value }))} />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="px-btn px-btn-sm px-btn-primary" onClick={addFlow}>Log flow</button>
                      <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setFlowForm(null)}>Cancel</button>
                    </div>
                  </div>
                )}

                {perfFlows.length === 0 && !flowForm && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>No cash flows logged.</div>
                )}
                {perfFlows.map(f => {
                  const pos = Number(f.amount) >= 0;
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', width: 78, flexShrink: 0 }}>
                        {new Date(f.flow_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-mute)', textTransform: 'capitalize' }}>{f.kind}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: pos ? 'var(--forest)' : 'var(--brick)' }}>
                        {pos ? '+' : '−'}{fmt$(Math.abs(Number(f.amount)), { short: true })}
                      </span>
                      <button onClick={() => removeFlow(f.id)} aria-label="Delete flow"
                        style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 2px' }}>
                        <Icons.X size={11} />
                      </button>
                    </div>
                  );
                })}
              </>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={LABEL_STYLE}>Horizon</span>
                  <select className="px-select" value={editForm.current_phase ?? client.phase}
                    onChange={e => setEdit('current_phase', Number(e.target.value))}>
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={LABEL_STYLE}>Pipeline stage</span>
                  <select className="px-select" value={editForm.pipeline_stage ?? 'active'}
                    onChange={e => setEdit('pipeline_stage', e.target.value)}>
                    {PIPELINE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={LABEL_STYLE}>Advisory fee schedule</span>
                <select className="px-select" value={editForm.fee_schedule_id ?? ''}
                  onChange={e => setEdit('fee_schedule_id', e.target.value)}>
                  <option value="">— None (not billed) —</option>
                  {feeSchedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {feeSchedules.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>No schedules yet — create one in the Admin → Revenue &amp; billing view.</span>
                )}
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

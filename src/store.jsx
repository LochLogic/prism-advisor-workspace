// Prism — client-side store. View switcher, profile state, derived metrics,
// task progress, and a "flag question for advisor" mechanism.

const { useState, useEffect, useMemo, createContext, useContext, useCallback } = React;

/* ─── Profile context (per-client view) ───────────────────────────── */
const defaultProfile = {
  income:   { monthlyTakehome: 28400 },
  expenses: { housing: 7200, food: 2400, transport: 1800, utilities: 950, healthcare: 1100, other: 5450 },
  debts: [
    { id: 'd1', name: 'HELOC', balance: 38000, apr: 8.1, min: 420 },
  ],
  savings:  { emergency: 112000 },
  retirement: {
    hsaBalance: 41200, iraBalance: 318000, fourohonekBalance: 1_240_000,
    hsaContrib: 4400, iraContributed: 7000, iraLimit: 7000,
    fourohonekContributed: 23500, fourohonekLimit: 23500, employerMatchPct: 5,
  },
  taxes:   { marginalRate: 24, filingStatus: 'mfj' },
  taxable: { balance: 1_628_000, monthlyContrib: 8500 },
  goals:   { age: 62, retireAt: 67 },
};

const ProfileContext = createContext(null);

function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(defaultProfile);
  const { activeClientId } = useView();
  const dbSaveTimer = React.useRef(null);
  const isLoading   = React.useRef(false);

  // On client switch: clear state then load from the right source
  useEffect(() => {
    clearTimeout(dbSaveTimer.current);
    if (window.db?.isUUID(activeClientId)) {
      // Real client — reset to defaults, then load from DB
      isLoading.current = true;
      setProfile(defaultProfile);
      window.db.getProfile(activeClientId).then(data => {
        if (data) setProfile(data);
        isLoading.current = false;
      }).catch(() => { isLoading.current = false; });
    } else {
      // Mock/demo — load from per-client localStorage key
      try {
        const saved = JSON.parse(localStorage.getItem(`px_profile:${activeClientId}`));
        setProfile(saved || defaultProfile);
      } catch { setProfile(defaultProfile); }
    }
  }, [activeClientId]);

  // Persist (skip during loading to avoid writing stale data)
  useEffect(() => {
    if (isLoading.current) return;
    if (window.db?.isUUID(activeClientId)) {
      clearTimeout(dbSaveTimer.current);
      dbSaveTimer.current = setTimeout(() => {
        window.db.saveProfile(activeClientId, profile);
      }, 1500);
    } else {
      try { localStorage.setItem(`px_profile:${activeClientId}`, JSON.stringify(profile)); } catch {}
    }
  }, [profile]); // intentionally omit activeClientId — load effect handles switches

  const update = useCallback((path, value) => {
    setProfile(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  // ── Derived ─────────────────────────────────────────────────────
  const totalExpenses = Object.values(profile.expenses).reduce((a, b) => a + Number(b || 0), 0);
  const totalDebt     = profile.debts.reduce((a, d) => a + Number(d.balance || 0), 0);
  const toxicDebt     = profile.debts.filter(d => Number(d.apr) > 6).reduce((a, d) => a + Number(d.balance || 0), 0);
  const surplus       = profile.income.monthlyTakehome - totalExpenses;
  const savingsRate   = profile.income.monthlyTakehome > 0 ? (surplus / profile.income.monthlyTakehome) * 100 : 0;
  const retirementAssets = (profile.retirement.hsaBalance || 0)
                         + (profile.retirement.iraBalance || 0)
                         + (profile.retirement.fourohonekBalance || 0);
  const taxableBalance = profile.taxable.balance || 0;
  const totalInvested  = retirementAssets + taxableBalance;
  const netWorth       = totalInvested + profile.savings.emergency - totalDebt;
  const reserveTarget  = totalExpenses * 6;
  const reservePct     = reserveTarget > 0 ? Math.min(100, (profile.savings.emergency / reserveTarget) * 100) : 0;
  const hsaTaxSavings  = profile.retirement.hsaContrib * profile.taxes.marginalRate / 100;
  const annualExpenses = totalExpenses * 12;
  const fireNumber     = annualExpenses * 25;
  const fireProgress   = fireNumber > 0 ? Math.min(100, (totalInvested / fireNumber) * 100) : 0;
  const legacyValue    = totalInvested * Math.pow(1.06, Math.max(0, profile.goals.retireAt - profile.goals.age + 20));

  const metrics = {
    totalExpenses, totalDebt, toxicDebt, surplus, savingsRate,
    retirementAssets, taxableBalance, totalInvested, netWorth,
    reserveTarget, reservePct, hsaTaxSavings, annualExpenses,
    fireNumber, fireProgress, legacyValue,
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile, update, ...metrics }}>
      {children}
    </ProfileContext.Provider>
  );
}
const useProfile = () => useContext(ProfileContext);

/* ─── Phase / task progress ───────────────────────────────────────── */
const TaskContext = createContext(null);

function TaskProvider({ children }) {
  const { activeClientId } = useView();
  const { role, authUser } = (window.useAuth?.() || {});

  const mockSeed = () => {
    const seed = {};
    phasesData.forEach((p, i) => {
      seed[p.id] = {};
      p.tasks.forEach((t, ti) => {
        if (i < 4) seed[p.id][t.id] = true;
        else if (i === 4 && ti < 2) seed[p.id][t.id] = true;
      });
    });
    return seed;
  };

  const [taskStates, setTaskStates] = useState({});
  const [openPhases, setOpenPhases] = useState({ 4: true });
  const [flaggedQs,  setFlaggedQs]  = useState({});

  // On client switch: load from correct source (DB for real UUIDs, localStorage for mock)
  useEffect(() => {
    if (window.db?.isUUID(activeClientId)) {
      // Real client — clear first, then load from DB (even if DB returns empty)
      setTaskStates({});
      setFlaggedQs({});
      window.db.getTaskStates(activeClientId).then(dbStates => {
        setTaskStates(dbStates || {});
      });
    } else {
      // Mock/demo — load from namespaced localStorage
      try {
        const saved = JSON.parse(localStorage.getItem(`px_tasks:${activeClientId}`));
        setTaskStates(saved || mockSeed());
      } catch { setTaskStates(mockSeed()); }
      try {
        const saved = JSON.parse(localStorage.getItem(`px_flagged:${activeClientId}`));
        setFlaggedQs(saved || {});
      } catch { setFlaggedQs({}); }
      try {
        const saved = JSON.parse(localStorage.getItem(`px_open:${activeClientId}`));
        setOpenPhases(saved || { 4: true });
      } catch { setOpenPhases({ 4: true }); }
    }
  }, [activeClientId]);

  // Persist mock/demo state to namespaced localStorage keys
  useEffect(() => {
    if (window.db?.isUUID(activeClientId)) return;
    try { localStorage.setItem(`px_tasks:${activeClientId}`, JSON.stringify(taskStates)); } catch {}
  }, [taskStates, activeClientId]);
  useEffect(() => {
    if (window.db?.isUUID(activeClientId)) return;
    try { localStorage.setItem(`px_open:${activeClientId}`, JSON.stringify(openPhases)); } catch {}
  }, [openPhases, activeClientId]);
  useEffect(() => {
    if (window.db?.isUUID(activeClientId)) return;
    try { localStorage.setItem(`px_flagged:${activeClientId}`, JSON.stringify(flaggedQs)); } catch {}
  }, [flaggedQs, activeClientId]);

  const toggleTask = (phaseId, taskId) => {
    // Compute nextDone before setTaskStates to avoid stale-closure DB write
    const nextDone = !(taskStates[phaseId]?.[taskId]);
    setTaskStates(prev => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] || {}), [taskId]: nextDone },
    }));
    if (window.db?.isUUID(activeClientId)) {
      window.db.upsertTask(activeClientId, phaseId, taskId, nextDone);
    }
  };
  const togglePhase = (phaseId) => setOpenPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const flagForAdvisor = (phaseId, taskId) => {
    const k = `${phaseId}:${taskId}`;
    const next = !flaggedQs[k];
    setFlaggedQs(prev => ({ ...prev, [k]: next }));
    if (window.db?.isUUID(activeClientId) && window.db?.isUUID(authUser?.advisor_id)) {
      window.db.flagQuestion(activeClientId, authUser.advisor_id, phaseId, taskId, next);
    }
  };
  const isFlagged = (phaseId, taskId) => !!flaggedQs[`${phaseId}:${taskId}`];

  const completedByPhase = useMemo(() => {
    const out = {};
    phasesData.forEach(p => {
      out[p.id] = p.tasks.filter(t => taskStates[p.id]?.[t.id]).length;
    });
    return out;
  }, [taskStates]);

  const activePhase = useMemo(() => {
    for (const p of phasesData) {
      if ((completedByPhase[p.id] || 0) < p.tasks.length) return p.id;
    }
    return phasesData.length - 1;
  }, [completedByPhase]);

  const totalTasks     = phasesData.reduce((a, p) => a + p.tasks.length, 0);
  const completedCount = Object.values(completedByPhase).reduce((a, b) => a + b, 0);
  const overallPct     = Math.round((completedCount / totalTasks) * 100);

  return (
    <TaskContext.Provider value={{
      taskStates, toggleTask,
      openPhases, togglePhase, setOpenPhases,
      flaggedQs, flagForAdvisor, isFlagged,
      completedByPhase, activePhase, totalTasks, completedCount, overallPct,
    }}>
      {children}
    </TaskContext.Provider>
  );
}
const useTasks = () => useContext(TaskContext);

/* ─── View switcher (advisor / client) ────────────────────────────── */
const ViewContext = createContext(null);

function ViewProvider({ children }) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('px_view') || 'advisor'; }
    catch { return 'advisor'; }
  });
  const [activeClientId, setActiveClientId] = useState(currentClientId);
  const [activeClient,   setActiveClient]   = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { try { localStorage.setItem('px_view', view); } catch {} }, [view]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(t => t === text ? null : t), 3200);
  };

  // Convenience: open a client in the client portal
  const openClientPortal = useCallback((client) => {
    setActiveClientId(client.id);
    setActiveClient(client);
    setView('client');
  }, []);

  return (
    <ViewContext.Provider value={{
      view, setView,
      activeClientId, setActiveClientId,
      activeClient,   setActiveClient,
      openClientPortal,
      toast, showToast,
    }}>
      {children}
    </ViewContext.Provider>
  );
}
const useView = () => useContext(ViewContext);

/* ─── Formatters ──────────────────────────────────────────────────── */
const fmt$ = (n, opts = {}) => {
  if (!isFinite(n) || n === null) return '—';
  if (Math.abs(n) >= 1_000_000 && opts.short) {
    return '$' + (n / 1_000_000).toFixed(opts.decimals ?? 2) + 'M';
  }
  if (Math.abs(n) >= 1_000 && opts.short) {
    return '$' + (n / 1_000).toFixed(0) + 'k';
  }
  const v = Math.round(n);
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};
const fmtPct = (n, d = 1) => isFinite(n) ? `${n.toFixed(d)}%` : '—';
const fmtN = (n) => isFinite(n) ? n.toLocaleString('en-US') : '—';

/* ─── Notifications + Realtime subscriptions ──────────────────────── */
const NotificationContext = createContext(null);

function NotificationProvider({ children }) {
  const { authUser } = window.useAuth?.() || {};
  const [notifications, setNotifications] = useState([]);
  const [unread,         setUnread]        = useState(0);
  // 'off' | 'connecting' | 'live' | 'error'
  const [realtimeStatus, setRealtimeStatus] = useState('off');
  const channelRef = React.useRef(null);
  const seenIds    = React.useRef(new Set());

  const addNotification = useCallback((n) => {
    if (seenIds.current.has(n.id)) return;
    seenIds.current.add(n.id);
    setNotifications(prev => [n, ...prev].slice(0, 20));
    setUnread(prev => prev + 1);
  }, []);

  const markAllRead = useCallback(() => setUnread(0), []);

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Open / reopen channel whenever the advisor logs in (or changes)
  useEffect(() => {
    if (!authUser?.id || !window.__sb) {
      setRealtimeStatus('off');
      return;
    }

    setRealtimeStatus('connecting');

    // Category → icon map (mirrors db.jsx ALERT_ICON)
    const ALERT_ICON = {
      cash_drag: 'Dollar', roth_window: 'Calendar', tlh: 'TrendDown',
      drift: 'AlertCircle', schedule_call: 'Phone', fx_exposure: 'Building',
    };

    const channel = window.__sb
      .channel(`advisor-rt:${authUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alerts',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: a }) => {
        addNotification({
          id:       a.id,
          type:     'alert',
          priority: a.priority,
          icon:     ALERT_ICON[a.category] || 'Bell',
          headline: a.headline,
          body:     a.body || '',
          timeAgo:  'just now',
          clientId: a.client_id,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'flagged_questions',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: q }) => {
        addNotification({
          id:       q.id,
          type:     'question',
          icon:     'Message',
          headline: 'New question flagged',
          body:     q.question_text || 'A client flagged a discussion item',
          timeAgo:  'just now',
          clientId: q.client_id,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meetings',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: m }) => {
        addNotification({
          id:       `m:${m.id}`,
          type:     'meeting',
          icon:     'Calendar',
          headline: 'Meeting logged',
          body:     m.notes ? m.notes.slice(0, 80) : 'New meeting recorded',
          timeAgo:  'just now',
          clientId: m.client_id,
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')         setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR') setRealtimeStatus('error');
        else if (status === 'TIMED_OUT')     setRealtimeStatus('error');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && window.__sb) {
        window.__sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setRealtimeStatus('off');
    };
  }, [authUser?.id]);

  return (
    <NotificationContext.Provider value={{ notifications, unread, markAllRead, dismiss, realtimeStatus }}>
      {children}
    </NotificationContext.Provider>
  );
}
const useNotifications = () => useContext(NotificationContext);

/* ─── Theme (light / dark) ────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem('px_theme') === 'dark'; }
    catch { return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false; }
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('px_theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  const toggleTheme = () => setDark(d => !d);
  return { dark, toggleTheme };
}

/* ─── Print helpers ───────────────────────────────────────────────── */
const escapeHtml = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const _printStyles = `
  body{font-family:Georgia,serif;color:#1c2e4a;padding:44px;max-width:720px;margin:0 auto;font-size:13px;}
  h1{font-size:22px;font-weight:500;margin:0 0 3px;}
  .sub{color:#5d7a8e;font-size:12px;margin-bottom:22px;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px;}
  .stat{border:1px solid #e4dfd0;border-radius:6px;padding:11px;}
  .stat-lbl{font-size:10px;color:#5d7a8e;text-transform:uppercase;letter-spacing:.06em;}
  .stat-val{font-size:17px;font-weight:500;margin-top:4px;}
  .section-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5d7a8e;margin:20px 0 8px;}
  .task{padding:5px 0;border-bottom:1px solid #e4dfd0;display:flex;gap:8px;font-size:12px;}
  .check{color:#3d5a4a;font-weight:700;}
  .mtg{padding:7px 0;border-bottom:1px solid #e4dfd0;}
  .mtg-date{font-weight:600;font-size:12px;}
  .mtg-notes{color:#5d7a8e;font-size:12px;margin-top:2px;}
  .note-block{border-left:2px solid #a98c4b;padding-left:12px;font-style:italic;color:#5d7a8e;font-size:13px;}
  .footer{margin-top:36px;padding-top:14px;border-top:1px solid #e4dfd0;font-size:10px;color:#8da3b6;}
  @media print{body{padding:20px;}}
`;

function _openPrint(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) { console.warn('[print] popup blocked — allow popups for this site'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${_printStyles}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 450);
}

function _fmtShort(n) {
  if (!n || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

// Client overview report — called from ClientPreviewModal "Print report" button
function printClientReport(client, phase, meetings) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const meetingsHtml = (meetings || []).length > 0
    ? `<div class="section-lbl">Meeting history</div>
       ${meetings.slice(0, 6).map(m => `
         <div class="mtg">
           <div class="mtg-date">
             ${new Date(m.met_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
             ${m.duration_min ? ` &middot; ${Number(m.duration_min)} min` : ''}
           </div>
           ${m.notes ? `<div class="mtg-notes">${escapeHtml(m.notes)}</div>` : ''}
         </div>`).join('')}`
    : '';
  const notesHtml = client.notes
    ? `<div class="section-lbl">Advisor notes</div><div class="note-block">&ldquo;${escapeHtml(client.notes)}&rdquo;</div>`
    : '';

  _openPrint(`Client Report — ${escapeHtml(client.name)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">${escapeHtml(client.tag)} &middot; Generated ${date}</div></div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">Prism Advisor Workspace<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">AUM</div><div class="stat-val">${_fmtShort(client.aum)}</div></div>
      <div class="stat"><div class="stat-lbl">Current Horizon</div><div class="stat-val" style="font-size:13px;margin-top:6px">Phase ${escapeHtml(phase.num)} &middot; ${escapeHtml(phase.title)}</div></div>
      <div class="stat"><div class="stat-lbl">Uninvested cash</div><div class="stat-val" style="color:${client.uninvestedCash > 80000 ? '#8c3d3d' : 'inherit'}">${_fmtShort(client.uninvestedCash)}</div></div>
    </div>
    ${meetingsHtml}
    ${notesHtml}
    <div class="footer">This report is confidential and intended solely for the named client and their advisor. Prism Advisor Workspace.</div>
  `);
}

// Milestone phase report — called from MilestoneAchievedModal "Download PDF" button
function printMilestoneReport(phase, taskStates, advisorName, advisorFirm) {
  const completed = (phase?.tasks || []).filter(t => taskStates?.[phase.id]?.[t.id]);
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  _openPrint(`Milestone Report — Phase ${escapeHtml(phase.num)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5d7a8e;margin-bottom:4px">Milestone Achieved &middot; Phase ${escapeHtml(phase.num)}</div>
        <h1>${escapeHtml(phase.title)}</h1>
        <div class="sub">Reviewed ${date} &middot; ${escapeHtml(advisorName)}${advisorFirm ? ', ' + escapeHtml(advisorFirm) : ''}</div>
      </div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">Prism Advisor Workspace<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Tasks completed</div><div class="stat-val">${completed.length} / ${phase.tasks.length}</div></div>
      <div class="stat"><div class="stat-lbl">Phase</div><div class="stat-val">${escapeHtml(phase.num)}</div></div>
      <div class="stat"><div class="stat-lbl">Status</div><div class="stat-val" style="font-size:14px;color:#3d5a4a;margin-top:5px">&#10003; Complete</div></div>
    </div>
    <div class="section-lbl">Milestones completed in this phase</div>
    ${phase.tasks.map(t => `
      <div class="task">
        <span class="check">${taskStates?.[phase.id]?.[t.id] ? '✓' : '○'}</span>
        <span>${escapeHtml(t.label)}</span>
      </div>`).join('')}
    <div class="footer">This summary report is retained in the client vault. Prism Advisor Workspace &middot; ${escapeHtml(advisorFirm || '')}</div>
  `);
}

Object.assign(window, {
  ProfileProvider, useProfile,
  TaskProvider, useTasks,
  ViewProvider, useView,
  NotificationProvider, useNotifications,
  useTheme,
  printClientReport,
  printMilestoneReport,
  escapeHtml,
  fmt$, fmtPct, fmtN,
});

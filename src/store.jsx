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
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('px_profile')) || defaultProfile; }
    catch { return defaultProfile; }
  });
  const { activeClientId } = useView();
  const dbSaveTimer = React.useRef(null);

  // Load from DB when the active client changes to a real UUID
  useEffect(() => {
    if (!window.db?.isUUID(activeClientId)) return;
    window.db.getProfile(activeClientId).then(data => {
      if (data) setProfile(data);
    });
  }, [activeClientId]);

  // Persist to localStorage; debounce-sync to DB for real clients
  useEffect(() => {
    try { localStorage.setItem('px_profile', JSON.stringify(profile)); } catch {}
    if (!window.db?.isUUID(activeClientId)) return;
    clearTimeout(dbSaveTimer.current);
    dbSaveTimer.current = setTimeout(() => {
      window.db.saveProfile(activeClientId, profile);
    }, 1500);
  }, [profile, activeClientId]);

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

  const seedTasks = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('px_tasks'));
      if (saved) return saved;
    } catch {}
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

  const [taskStates, setTaskStates] = useState(seedTasks);
  const [openPhases, setOpenPhases] = useState(() => {
    try { return JSON.parse(localStorage.getItem('px_open')) || { 4: true }; }
    catch { return { 4: true }; }
  });
  const [flaggedQs, setFlaggedQs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('px_flagged')) || {}; }
    catch { return {}; }
  });

  useEffect(() => { try { localStorage.setItem('px_tasks', JSON.stringify(taskStates)); } catch {} }, [taskStates]);
  useEffect(() => { try { localStorage.setItem('px_open', JSON.stringify(openPhases)); } catch {} }, [openPhases]);
  useEffect(() => { try { localStorage.setItem('px_flagged', JSON.stringify(flaggedQs)); } catch {} }, [flaggedQs]);

  // Load real task states from DB when client changes
  useEffect(() => {
    if (!window.db?.isUUID(activeClientId)) return;
    window.db.getTaskStates(activeClientId).then(dbStates => {
      if (dbStates && Object.keys(dbStates).length > 0) {
        setTaskStates(dbStates);
      }
    });
  }, [activeClientId]);

  const toggleTask = (phaseId, taskId) => {
    let nextDone;
    setTaskStates(prev => {
      const cur = prev[phaseId] || {};
      nextDone = !cur[taskId];
      return { ...prev, [phaseId]: { ...cur, [taskId]: nextDone } };
    });
    if (window.db?.isUUID(activeClientId)) {
      window.db.upsertTask(activeClientId, phaseId, taskId, !((taskStates[phaseId] || {})[taskId]));
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
  const [toast, setToast] = useState(null);

  useEffect(() => { try { localStorage.setItem('px_view', view); } catch {} }, [view]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(t => t === text ? null : t), 3200);
  };

  return (
    <ViewContext.Provider value={{ view, setView, activeClientId, setActiveClientId, toast, showToast }}>
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

Object.assign(window, {
  ProfileProvider, useProfile,
  TaskProvider, useTasks,
  ViewProvider, useView,
  fmt$, fmtPct, fmtN,
});

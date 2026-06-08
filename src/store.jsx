// Prism — client-side store. View switcher, profile state, derived metrics,
// task progress, and a "flag question for advisor" mechanism.

const { useState, useEffect, useMemo, createContext, useContext, useCallback } = React;

/* ─── Profile context (per-client view) ───────────────────────────── */
const defaultProfile = {
  // Household members — the people behind the plan. The "primary" member's age
  // drives planning math (retirement horizon, legacy projection); spouse/dependents
  // give the advisor the relationship context the roadmap promises.
  members: [
    { id: 'm1', name: 'Robert Marsh', role: 'primary', dateOfBirth: '1962-04-15' },
    { id: 'm2', name: 'Eileen Marsh', role: 'spouse',  dateOfBirth: '1964-09-22' },
  ],
  // income.monthlyTakehome is the spendable cash that drives the cash-flow math.
  // income.sources is optional composition (salary / RSU / bonus / self-employment)
  // captured for tax planning — it does NOT alter take-home or surplus.
  income:   { monthlyTakehome: 28400, sources: [
    { id: 's1', label: 'Salary — Robert', type: 'salary', monthlyGross: 22000 },
    { id: 's2', label: 'RSU vesting',      type: 'rsu',    monthlyGross: 9000 },
  ] },
  expenses: { housing: 7200, food: 2400, transport: 1800, utilities: 950, healthcare: 1100, other: 5450, custom: [] },
  // expenses.housing is the TOTAL monthly housing outflow. `housing` below records what that
  // money does: pure rent (consumed) vs. a mortgage payment that's partly principal (builds equity).
  housing: { type: 'own', homeValue: 1_250_000, mortgageBalance: 280_000, mortgageApr: 3.5, escrowMonthly: 1_400 },
  // Additional real estate beyond the primary residence (second homes / rentals).
  // Each property's equity (value − mortgage) rolls into net worth. Empty for most
  // households; common for the later-stage, asset-heavy clients who seek an advisor.
  properties: [
    { id: 'p1', label: 'Rental — Maple St', use: 'rental', value: 540_000, mortgageBalance: 180_000, paymentMonthly: 2_100, rentalIncomeMonthly: 3_200 },
  ],
  debts: [
    { id: 'd1', name: 'HELOC', balance: 38000, apr: 8.1, min: 420 },
  ],
  savings:  { emergency: 112000 },
  retirement: {
    hsaBalance: 41200, iraBalance: 318000, fourohonekBalance: 1_240_000,
    hsaContrib: 4400, iraContributed: 7000, iraLimit: 7000,
    fourohonekContributed: 23500, fourohonekLimit: 23500, employerMatchPct: 5,
  },
  taxes:   { marginalRate: 24, filingStatus: 'mfj', state: 'CA' },
  // Taxable set so the demo's total invested exceeds managed AUM ($4.28M) — this
  // makes the W6 asset-truth strip show a real "managed + held-away = total" split.
  taxable: { balance: 3_200_000, monthlyContrib: 8500 },
  // goals.age / retireAt anchor the retirement projection; goals.items are
  // discrete funding goals (education / home / custom) tracked to a target date.
  goals:   { age: 62, retireAt: 67, items: [
    { id: 'g1', label: 'Grandchildren 529', type: 'education', targetAmount: 200_000, targetDate: '2032-09-01', currentFunding: 90_000, monthlyContribution: 1200 },
    { id: 'g2', label: 'Lake house',         type: 'home',      targetAmount: 600_000, targetDate: '2029-06-01', currentFunding: 180_000, monthlyContribution: 2500 },
  ] },
  // Guaranteed income in retirement — Social Security / pension / annuity. Each
  // turns on at startAge and grows by its COLA. Netted against spending by the
  // retirement-readiness engine.
  incomeStreams: [
    { id: 'is1', label: 'Social Security — Robert', type: 'social_security', monthlyAmount: 3800, startAge: 67, colaPct: 2.5 },
    { id: 'is2', label: 'Social Security — Eileen',  type: 'social_security', monthlyAmount: 2600, startAge: 67, colaPct: 2.5 },
  ],
  // Protection (W5) — capture, not advise. Coverage feeds a simple gap check vs. an
  // income-multiple guideline; the advisor coaches, Prism doesn't underwrite.
  insurance: [
    { id: 'ins1', type: 'life',       carrier: 'Northwestern', owner: 'Robert Marsh', coverageAmount: 1_500_000, premiumMonthly: 320 },
    { id: 'ins2', type: 'disability', carrier: 'Guardian',     owner: 'Robert Marsh', coverageAmount: 180_000,   premiumMonthly: 140 },
  ],
  // Estate readiness checklist — status + last-reviewed per instrument.
  estate: {
    will:                { status: 'complete',    lastReviewed: '2023-03-01' },
    trust:               { status: 'complete',    lastReviewed: '2023-03-01' },
    poa:                 { status: 'in_progress', lastReviewed: '' },
    healthcareDirective: { status: 'complete',    lastReviewed: '2023-03-01' },
    beneficiaries:       { status: 'none',        lastReviewed: '' },
  },
  // Risk tolerance questionnaire (C4) — per-question scores (0..4). Feeds the
  // strategic allocation and the draft IPS. Completed in the sample household.
  risk: { answers: [3, 3, 2, 3, 2, 3], completedAt: '2026-02-10' },
};

// A fully-shaped but zeroed profile. Real (newly created) clients start here so
// the roadmap renders a blank-slate plan instead of crashing on a missing key —
// and so advisors aren't shown the demo's sample numbers as if they were real.
const emptyProfile = {
  members:  [],
  income:   { monthlyTakehome: 0, sources: [] },
  expenses: { housing: 0, food: 0, transport: 0, utilities: 0, healthcare: 0, other: 0, custom: [] },
  housing: { type: 'rent', homeValue: 0, mortgageBalance: 0, mortgageApr: 0, escrowMonthly: 0 },
  properties: [],
  debts: [],
  savings:  { emergency: 0 },
  retirement: {
    hsaBalance: 0, iraBalance: 0, fourohonekBalance: 0,
    hsaContrib: 0, iraContributed: 0, iraLimit: 7000,
    fourohonekContributed: 0, fourohonekLimit: 23500, employerMatchPct: 0,
  },
  taxes:   { marginalRate: 24, filingStatus: 'mfj', state: '' },
  taxable: { balance: 0, monthlyContrib: 0 },
  goals:   { age: 45, retireAt: 65, items: [] },
  incomeStreams: [],
  insurance: [],
  estate: {
    will:                { status: 'none', lastReviewed: '' },
    trust:               { status: 'none', lastReviewed: '' },
    poa:                 { status: 'none', lastReviewed: '' },
    healthcareDirective: { status: 'none', lastReviewed: '' },
    beneficiaries:       { status: 'none', lastReviewed: '' },
  },
  risk: { answers: [], completedAt: null },
};

// Deep-merge a (possibly partial / empty) stored profile onto a complete base,
// so every expected key always exists. Top-level scalars/arrays from `data`
// win; nested objects are filled in from `base` where missing.
function mergeProfile(base, data) {
  if (Array.isArray(base)) return Array.isArray(data) ? data : base;
  if (base && typeof base === 'object') {
    const out = { ...base, ...(data && typeof data === 'object' ? data : {}) };
    for (const k of Object.keys(base)) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = mergeProfile(base[k], data ? data[k] : undefined);
      }
    }
    return out;
  }
  return data !== undefined ? data : base;
}

const ProfileContext = createContext(null);

function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(defaultProfile);
  const { activeClientId } = useView();
  const dbSaveTimer = React.useRef(null);
  const isLoading   = React.useRef(false);
  // Tracks the latest debounced-but-not-yet-written save: { clientId, profile }.
  // Lets us FLUSH it before a client switch (or unmount) so the last <1.5s of
  // edits aren't dropped when the load effect cancels the pending timer.
  const pendingSave = React.useRef(null);

  const flushPendingSave = () => {
    const p = pendingSave.current;
    pendingSave.current = null;
    if (p && window.db?.isUUID(p.clientId)) window.db.saveProfile(p.clientId, p.profile);
  };
  // Flush any pending save on unmount (e.g. sign-out / app teardown).
  useEffect(() => () => flushPendingSave(), []);

  // On client switch: flush the previous client's pending save, then load the new one
  useEffect(() => {
    flushPendingSave();
    clearTimeout(dbSaveTimer.current);
    if (window.db?.isUUID(activeClientId)) {
      // Real client — reset to a blank shape, then merge in whatever the DB has.
      // A new client's profile is an empty {}; merging keeps every key present so
      // the roadmap and calculators render instead of crashing on undefined.
      isLoading.current = true;
      setProfile(emptyProfile);
      window.db.getProfile(activeClientId).then(data => {
        setProfile(mergeProfile(emptyProfile, data));
        isLoading.current = false;
      }).catch(() => { isLoading.current = false; });
    } else {
      // Mock/demo — load from per-client localStorage key.
      // Merge onto defaultProfile so every key exists even for profiles saved
      // before a field (e.g. `housing`) was added — otherwise toggling housing
      // type would write into an undefined parent and crash.
      try {
        const saved = JSON.parse(localStorage.getItem(`px_profile:${activeClientId}`));
        setProfile(saved ? mergeProfile(defaultProfile, saved) : defaultProfile);
      } catch { setProfile(defaultProfile); }
    }
  }, [activeClientId]);

  // Persist (skip during loading to avoid writing stale data)
  useEffect(() => {
    if (isLoading.current) return;
    if (window.db?.isUUID(activeClientId)) {
      clearTimeout(dbSaveTimer.current);
      pendingSave.current = { clientId: activeClientId, profile };
      dbSaveTimer.current = setTimeout(() => {
        window.db.saveProfile(activeClientId, profile);
        pendingSave.current = null;
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
      for (let i = 0; i < keys.length - 1; i++) {
        // Create missing intermediate objects so paths into a not-yet-present
        // branch (e.g. `housing.type` on an older profile) never throw.
        if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
        o = o[keys[i]];
      }
      o[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  // ── Household members ───────────────────────────────────────────
  // The "primary" member's age is the planning anchor (retirement horizon, legacy
  // projection). Falls back to goals.age only when no members are recorded yet, so
  // the age driving the math is always a real, edited value — not a phantom default.
  const members        = Array.isArray(profile.members) ? profile.members : [];
  const primaryMember  = members.find(m => m.role === 'primary') || members[0] || null;
  // Derive age from dateOfBirth when available; fall back to explicit age field (legacy profiles),
  // then to goals.age. This ensures the planning anchor is always a real, edited value.
  const _ageFromDob = (dob) => {
    if (!dob) return 0;
    const bd = new Date(dob), today = new Date();
    let a = today.getFullYear() - bd.getFullYear();
    if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) a--;
    return a > 0 ? a : 0;
  };
  const _memberAge = (m) => m ? (_ageFromDob(m.dateOfBirth) || Number(m.age) || 0) : 0;
  const planningAge    = _memberAge(primaryMember) || Number(profile.goals?.age || 0);
  const dependentsCount = members.filter(m => m.role === 'dependent').length;
  const householdSize  = members.length;

  // ── Income composition ──
  // When the household itemizes income sources, those line items are the single
  // source of truth and AUTO-SUM into monthly take-home (no double entry). With no
  // sources, the manually-entered take-home stands.
  const incomeSources    = Array.isArray(profile.income.sources) ? profile.income.sources : [];
  const grossMonthlyIncome = incomeSources.reduce((a, s) => a + Number(s.monthlyGross || 0), 0);
  const grossAnnualIncome  = grossMonthlyIncome * 12;
  const effectiveTakehome  = incomeSources.length > 0
    ? grossMonthlyIncome
    : (Number(profile.income.monthlyTakehome) || 0);

  // ── Derived ─────────────────────────────────────────────────────
  // Expenses = the fixed categories + any custom outflow boxes the user added.
  const _exp = profile.expenses || {};
  const customExpenses = Array.isArray(_exp.custom) ? _exp.custom : [];
  const totalExpenses =
      ['housing', 'food', 'transport', 'utilities', 'healthcare', 'other']
        .reduce((a, k) => a + Number(_exp[k] || 0), 0)
    + customExpenses.reduce((a, c) => a + Number(c.amount || 0), 0);
  const totalDebt     = profile.debts.reduce((a, d) => a + Number(d.balance || 0), 0);
  const toxicDebt     = profile.debts.filter(d => Number(d.apr) > 6).reduce((a, d) => a + Number(d.balance || 0), 0);
  const surplus       = effectiveTakehome - totalExpenses;

  // ── Housing: rent vs. own ───────────────────────────────────────
  // expenses.housing is the total monthly outflow. For owners we split that payment into
  // principal (builds equity), interest, and escrow (taxes + insurance). Principal is not a
  // true expense — it's forced savings — so it counts toward the savings rate, and home equity
  // (value − mortgage) counts toward net worth.
  const _h = profile.housing || { type: 'rent' };
  const isOwner         = _h.type === 'own';
  const homeValue       = isOwner ? Number(_h.homeValue || 0) : 0;
  const mortgageBalance = isOwner ? Number(_h.mortgageBalance || 0) : 0;
  const escrowMonthly   = isOwner ? Number(_h.escrowMonthly || 0) : 0;
  const housingOutflow  = Number(profile.expenses.housing || 0);
  const mortgageInterestMonthly  = mortgageBalance > 0 ? mortgageBalance * (Number(_h.mortgageApr || 0) / 100) / 12 : 0;
  const housingPI                = isOwner ? Math.max(0, housingOutflow - escrowMonthly) : 0; // principal + interest
  const mortgagePrincipalMonthly = mortgageBalance > 0 ? Math.max(0, housingPI - mortgageInterestMonthly) : 0;
  const homeEquity      = isOwner ? (homeValue - mortgageBalance) : 0;

  // ── Additional properties (second homes / rentals) ──────────────
  // Equity (value − mortgage) rolls into net worth. Net monthly cash flow is shown
  // per-property for context but is NOT folded into the household surplus, to avoid
  // double-counting rental income that may already sit in monthly take-home.
  const properties = Array.isArray(profile.properties) ? profile.properties : [];
  const propertiesEquity = properties.reduce((a, p) => a + (Number(p.value || 0) - Number(p.mortgageBalance || 0)), 0);
  const propertiesNetCashflow = properties.reduce((a, p) =>
    a + (p.use === 'rental' ? Number(p.rentalIncomeMonthly || 0) : 0) - Number(p.paymentMonthly || 0), 0);
  const hasProperties = properties.length > 0;

  // Mortgage principal is forced savings (builds equity), so it lifts the savings rate.
  const savingsRate   = effectiveTakehome > 0 ? ((surplus + mortgagePrincipalMonthly) / effectiveTakehome) * 100 : 0;
  const retirementAssets = (profile.retirement.hsaBalance || 0)
                         + (profile.retirement.iraBalance || 0)
                         + (profile.retirement.fourohonekBalance || 0);
  const taxableBalance = profile.taxable.balance || 0;
  const totalInvested  = retirementAssets + taxableBalance;
  const investedOnFile = totalInvested;   // alias for asset reconciliation vs. managed AUM
  const netWorth       = totalInvested + profile.savings.emergency - totalDebt + homeEquity + propertiesEquity;
  const reserveTarget  = totalExpenses * 6;
  const reservePct     = reserveTarget > 0 ? Math.min(100, (profile.savings.emergency / reserveTarget) * 100) : 0;
  const hsaTaxSavings  = profile.retirement.hsaContrib * profile.taxes.marginalRate / 100;
  const annualExpenses = totalExpenses * 12;
  const fireNumber     = annualExpenses * 25;
  const fireProgress   = fireNumber > 0 ? Math.min(100, (totalInvested / fireNumber) * 100) : 0;
  const legacyValue    = totalInvested * Math.pow(1.06, Math.max(0, profile.goals.retireAt - planningAge + 20));

  // ── Retirement readiness — the "are we on track?" answer ─────────
  const incomeStreams = Array.isArray(profile.incomeStreams) ? profile.incomeStreams : [];
  const annualRetirementContribution =
      (Number(profile.taxable.monthlyContrib) || 0) * 12
    + (Number(profile.retirement.hsaContrib) || 0)
    + (Number(profile.retirement.iraContributed) || 0)
    + (Number(profile.retirement.fourohonekContributed) || 0);
  const _calc = (typeof PrismCalc !== 'undefined' ? PrismCalc : window.PrismCalc);
  // Memoized: these are pure functions of profile-derived inputs and otherwise
  // recompute on every ProfileProvider render (including parent-provider renders
  // unrelated to the profile). Keyed on their actual inputs.
  const retirementReadiness = useMemo(() => _calc.retirementReadiness({
    currentAge: planningAge, retireAt: profile.goals.retireAt,
    currentInvested: totalInvested, annualContribution: annualRetirementContribution,
    annualExpenses, streams: incomeStreams,
  }), [planningAge, profile.goals.retireAt, totalInvested, annualRetirementContribution, annualExpenses, incomeStreams]);

  // ── Funding goals (education / home / custom) ───────────────────
  const goalItems   = Array.isArray(profile.goals?.items) ? profile.goals.items : [];
  const goalsFunding = useMemo(() => goalItems.map(g => ({ goal: g, ...(_calc.goalFunding(g)) })), [goalItems]);

  // ── Protection & estate (W5) ────────────────────────────────────
  const insurance     = Array.isArray(profile.insurance) ? profile.insurance : [];
  const lifeCoverage  = insurance.filter(i => i.type === 'life')
                                 .reduce((s, i) => s + (Number(i.coverageAmount) || 0), 0);
  // Guideline: ~10× gross income + debts to retire, less the liquidity reserve.
  const lifeCoverageGap = _calc.lifeCoverageGap({
    annualIncome: grossAnnualIncome || effectiveTakehome * 12,
    incomeMultiple: 10, liabilities: totalDebt,
    existingCoverage: lifeCoverage, liquidAssets: profile.savings.emergency || 0,
  });
  const estate = (profile.estate && typeof profile.estate === 'object') ? profile.estate : {};
  const estateKeys = ['will', 'trust', 'poa', 'healthcareDirective', 'beneficiaries'];
  const estateComplete = estateKeys.filter(k => estate[k]?.status === 'complete').length;
  const estateProgress = Math.round((estateComplete / estateKeys.length) * 100);

  // ── Risk tolerance → strategic allocation (C4) ──────────────────
  const riskAnswers = Array.isArray(profile.risk?.answers) ? profile.risk.answers : [];
  const riskComplete = riskAnswers.filter(x => x != null && x !== '').length;
  const yearsToRetire = Math.max(0, (Number(profile.goals?.retireAt) || 65) - planningAge);
  const riskProfile = useMemo(() => _calc.riskProfile({ answers: riskAnswers, horizonYears: yearsToRetire }),
    [riskAnswers, yearsToRetire]);

  // ── Monte Carlo probability-of-success band (C4) ────────────────
  // Surfaces the existing seeded simulation as a confidence band on the
  // retirement horizon. Deterministic per client so the figure is stable.
  const mcSeed = (activeClientId || 'demo').split('').reduce((s, c) => s + c.charCodeAt(0), 0) || 42;
  const mcYears = Math.max(20, (Number(profile.goals?.retireAt) || 65) - planningAge + 25);
  const mcWithdrawal = Math.round(annualExpenses / 1000) * 1000;
  // Memoized: monteCarlo runs 600 sims — without this it re-ran on every keystroke
  // in the Numbers drawer (ProfileProvider re-renders on every profile change).
  const successBand = useMemo(
    () => (totalInvested > 0 && annualExpenses > 0
      ? _calc.monteCarlo({ principal: totalInvested, years: mcYears, withdrawal: mcWithdrawal,
          seed: mcSeed, runs: 600, mean: 0.07, sd: 0.16 })
      : null),
    [totalInvested, annualExpenses, mcYears, mcWithdrawal, mcSeed]);

  const metrics = {
    totalExpenses, totalDebt, toxicDebt, surplus, savingsRate,
    retirementAssets, taxableBalance, totalInvested, investedOnFile, netWorth,
    reserveTarget, reservePct, hsaTaxSavings, annualExpenses,
    fireNumber, fireProgress, legacyValue,
    isOwner, homeValue, mortgageBalance, escrowMonthly,
    mortgageInterestMonthly, mortgagePrincipalMonthly, homeEquity,
    propertiesEquity, propertiesNetCashflow, hasProperties,
    members, primaryMember, planningAge, dependentsCount, householdSize,
    incomeSources, grossMonthlyIncome, grossAnnualIncome, effectiveTakehome, customExpenses,
    incomeStreams, annualRetirementContribution, retirementReadiness,
    goalItems, goalsFunding,
    insurance, lifeCoverage, lifeCoverageGap, estate, estateProgress, estateComplete,
    riskAnswers, riskComplete, riskProfile, successBand,
  };

  // Asset-truth composition (managed AUM is passed in by the view, which knows the
  // client record); expose the helper so portal/modal compose one honest total.
  metrics.assetComposition = (managedAum) => _calc.assetComposition({ managedAum, investedOnFile });

  // Stabilize the context value identity. Every metric above is a pure function
  // of `profile` + `activeClientId` (the latter only via the Monte Carlo seed), so
  // keying on those two prevents a new value object — and a re-render of every
  // profile consumer — when a parent provider re-renders without a profile change.
  const value = useMemo(() => ({ profile, setProfile, update, ...metrics }),
    [profile, activeClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProfileContext.Provider value={value}>
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

  const flagForAdvisor = (phaseId, taskId, questionText = '') => {
    const k = `${phaseId}:${taskId}`;
    const next = !flaggedQs[k];
    setFlaggedQs(prev => ({ ...prev, [k]: next }));
    if (window.db?.isUUID(activeClientId) && window.db?.isUUID(authUser?.advisor_id)) {
      window.db.flagQuestion(activeClientId, authUser.advisor_id, phaseId, taskId, next, questionText);
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
  const [activeClientId,  setActiveClientId]  = useState(currentClientId);
  const [activeClient,    setActiveClient]    = useState(null);
  const [pendingPhaseId,  setPendingPhaseId]  = useState(null);
  const [toast, setToast] = useState(null);
  const [numbersOpen, setNumbersOpen] = useState(false);

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

  // Numbers (household ledger) drawer — shared so any surface can open it.
  const openNumbers  = useCallback(() => setNumbersOpen(true), []);
  const closeNumbers = useCallback(() => setNumbersOpen(false), []);
  // Edit a specific client's numbers (advisor editing from the client modal):
  // point the profile context at that client, then open the drawer.
  const openClientNumbers = useCallback((client) => {
    setActiveClientId(client.id);
    setActiveClient(client);
    setNumbersOpen(true);
  }, []);

  return (
    <ViewContext.Provider value={{
      view, setView,
      activeClientId, setActiveClientId,
      activeClient,   setActiveClient,
      pendingPhaseId, setPendingPhaseId,
      openClientPortal,
      numbersOpen, openNumbers, closeNumbers, openClientNumbers,
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

  // Live-updating relative timestamps — tick every 60 s
  useEffect(() => {
    const tick = () => setNotifications(prev =>
      prev.map(n => n.createdAt
        ? { ...n, timeAgo: window.db?.timeAgo(n.createdAt) || n.timeAgo }
        : n
      )
    );
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
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

      const channel = window.__sb
      .channel(`advisor-rt:${authUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alerts',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: a }) => {
        addNotification({
          id:        a.id,
          type:      'alert',
          priority:  a.priority,
          icon:      ALERT_ICON[a.category] || 'Bell',
          headline:  a.headline,
          body:      a.body || '',
          timeAgo:   'just now',
          createdAt: a.created_at || new Date().toISOString(),
          clientId:  a.client_id,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'flagged_questions',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: q }) => {
        addNotification({
          id:        q.id,
          type:      'question',
          icon:      'Message',
          headline:  'New question flagged',
          body:      q.question_text || 'A client flagged a discussion item',
          timeAgo:   'just now',
          createdAt: q.created_at || new Date().toISOString(),
          clientId:  q.client_id,
          phaseId:   q.phase_id,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meetings',
        filter: `advisor_id=eq.${authUser.id}`,
      }, ({ new: m }) => {
        const st = m.status || 'logged';
        addNotification({
          id:        `m:${m.id}`,
          type:      'meeting',
          icon:      'Calendar',
          headline:  st === 'requested' ? 'Meeting requested' : st === 'confirmed' ? 'Meeting scheduled' : 'Meeting logged',
          body:      m.notes ? m.notes.slice(0, 80) : (st === 'requested' ? `Client requested ${new Date(m.met_at).toLocaleString()}` : 'New meeting recorded'),
          timeAgo:   'just now',
          createdAt: m.created_at || new Date().toISOString(),
          clientId:  m.client_id,
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

  // Surface overdue / due-soon CRM tasks in the notification stream on login
  // (covers tasks assigned to me by another advisor too — getTasks ORs both).
  // One-time scan; deep-links to the client like other notifications.
  useEffect(() => {
    if (!authUser?.id || !window.db) return;
    let cancelled = false;
    (async () => {
      const tasks = await window.db.getTasks(authUser.id);
      if (cancelled || !Array.isArray(tasks)) return;
      const now = Date.now(), soonMs = 3 * 86_400_000;
      let shown = 0;
      for (const t of tasks) {                 // ordered by due_at asc (soonest first)
        if (shown >= 8 || t.status !== 'open' || !t.due_at) continue;
        const due = new Date(t.due_at).getTime();
        if (due - now > soonMs) break;          // rest are further out
        const overdue = due < now;
        const who = t.clients?.short_name || t.clients?.household_name;
        const when = new Date(t.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        addNotification({
          id:        `task-due:${t.id}`,
          type:      'task',
          priority:  overdue ? 'high' : 'med',
          icon:      'Check',
          headline:  overdue ? `Overdue task — ${t.title}` : `Task due soon — ${t.title}`,
          body:      `${who ? who + ' · ' : ''}due ${when}`,
          timeAgo:   'now',
          createdAt: new Date().toISOString(),
          clientId:  t.client_id || null,
        });
        shown++;
      }
    })();
    return () => { cancelled = true; };
  }, [authUser?.id, addNotification]);

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

// Escape everything, then re-allow ONLY a tiny formatting whitelist (no
// attributes). Safe to feed into dangerouslySetInnerHTML — scripts, event
// handlers, and styled tags are all neutralised to text.
const sanitizeHtml = (s) => escapeHtml(s)
  .replace(/&lt;(\/?)(b|i|em|strong|br)\s*\/?&gt;/gi, '<$1$2>');

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
      <div class="stat"><div class="stat-lbl">AUM</div><div class="stat-val">${fmt$(client.aum, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Current Horizon</div><div class="stat-val" style="font-size:13px;margin-top:6px">Phase ${escapeHtml(phase.num)} &middot; ${escapeHtml(phase.title)}</div></div>
      <div class="stat"><div class="stat-lbl">Uninvested cash</div><div class="stat-val" style="color:${client.uninvestedCash > 80000 ? '#8c3d3d' : 'inherit'}">${fmt$(client.uninvestedCash, { short: true })}</div></div>
    </div>
    ${meetingsHtml}
    ${notesHtml}
    <div class="footer">This report is confidential and intended solely for the named client and their advisor. Prism Advisor Workspace.</div>
  `);
}

// Milestone phase report — called from MilestoneAchievedModal "Download PDF" button
function printMilestoneReport(phase, taskStates, advisorName, advisorFirm, numbers) {
  const completed = (phase?.tasks || []).filter(t => taskStates?.[phase.id]?.[t.id]);
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const n = numbers || {};
  const reviewHtml = numbers ? `
    <div class="section-lbl">Financial review</div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Net worth</div><div class="stat-val">${fmt$(n.netWorth, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Invested assets</div><div class="stat-val">${fmt$(n.invested, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Liquidity reserve</div><div class="stat-val" style="font-size:15px;margin-top:6px">${fmt$(n.reserve, { short: true })} <span style="font-size:11px;color:#8da3b6">/ ${fmt$(n.reserveTarget, { short: true })}</span></div></div>
      <div class="stat"><div class="stat-lbl">Retirement assets</div><div class="stat-val">${fmt$(n.retirementAssets, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Taxable assets</div><div class="stat-val">${fmt$(n.taxableBalance, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Monthly surplus</div><div class="stat-val" style="color:${(n.surplus || 0) < 0 ? '#8c3d3d' : '#3d5a4a'}">${fmt$(n.surplus)}</div></div>
    </div>` : '';

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
    ${reviewHtml}
    <div class="section-lbl">Milestones completed in this phase</div>
    ${phase.tasks.map(t => `
      <div class="task">
        <span class="check">${taskStates?.[phase.id]?.[t.id] ? '✓' : '○'}</span>
        <span>${escapeHtml(t.label)}</span>
      </div>`).join('')}
    <div class="footer">This summary report is retained in the client vault. Prism Advisor Workspace &middot; ${escapeHtml(advisorFirm || '')}</div>
  `);
}

// Compliance export — full audit trail + records for one client (SEC 17a-3/17a-4)
function printComplianceReport(client, auditEntries, meetings, versionCount) {
  const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  // ACTION labels: shared map from db.jsx (single source of truth, bare-name global).
  const auditRows = (auditEntries || []).length
    ? (auditEntries || []).map(e => `
        <div class="task">
          <span style="color:#5d7a8e;font-size:11px;white-space:nowrap">${new Date(e.occurred_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span style="flex:0 0 140px">${escapeHtml(AUDIT_ACTION_LABELS[e.action] || e.action)}</span>
          <span style="color:#5d7a8e">${escapeHtml(e.actor_email || '')}</span>
          <span>${escapeHtml(e.summary || '')}</span>
        </div>`).join('')
    : '<div class="task" style="color:#8da3b6">No recorded actions for this client.</div>';
  const meetingsHtml = (meetings || []).length
    ? `<div class="section-lbl">Meeting record</div>${(meetings || []).map(m => `
        <div class="mtg"><div class="mtg-date">${new Date(m.met_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${m.duration_min ? ` &middot; ${Number(m.duration_min)} min` : ''}</div>${m.notes ? `<div class="mtg-notes">${escapeHtml(m.notes)}</div>` : ''}</div>`).join('')}`
    : '';

  _openPrint(`Compliance Record — ${escapeHtml(client.name)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">Compliance & audit record &middot; Generated ${date}</div></div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">Prism Advisor Workspace<br/>Confidential &middot; SEC 17a-3 / 17a-4</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Household tag</div><div class="stat-val" style="font-size:13px;margin-top:6px">${escapeHtml(client.tag || '—')}</div></div>
      <div class="stat"><div class="stat-lbl">Audited actions</div><div class="stat-val">${(auditEntries || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Profile versions</div><div class="stat-val">${Number(versionCount) || 0}</div></div>
    </div>
    <div class="section-lbl">Audit trail (append-only)</div>
    ${auditRows}
    ${meetingsHtml}
    <div class="footer">Records are retained and never erased per SEC Rule 17a-4. This export reflects the append-only audit trail as of generation time. Prism Advisor Workspace.</div>
  `);
}

// Client-facing performance report — branded, printable PDF (Theme D, 18b).
// Takes pre-computed data so it has no dependency on where the math lives.
//   opts: { client, series:[{date,value}], periods:[{label,pct}], flows:[{flow_date,amount,kind}], advisorName, advisorFirm }
function printPerformanceReport(opts) {
  const { client, series = [], periods = [], flows = [], advisorName, advisorFirm } = opts || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const cur = series.length ? series[series.length - 1].value : 0;

  let chartHtml = '<div style="color:#8da3b6;font-style:italic;font-size:12px;padding:8px 0">Not enough history to chart yet.</div>';
  if (series.length >= 2) {
    const W = 640, H = 170;
    const vals = series.map(p => p.value);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1, n = series.length;
    const x = i => (i / (n - 1)) * W;
    const y = v => H - ((v - min) / range) * (H - 20) - 10;
    const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const up = vals[n - 1] >= vals[0], color = up ? '#3d5a4a' : '#8c3d3d';
    chartHtml = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="border:1px solid #e4dfd0;border-radius:6px;background:#fff">
      <path d="${line} L${W},${H} L0,${H} Z" fill="${color}" opacity="0.08"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  const periodCells = (periods || []).map(s => {
    const has = s.pct != null && isFinite(s.pct), pos = (s.pct || 0) >= 0;
    return `<div class="stat"><div class="stat-lbl">${escapeHtml(s.label)}</div><div class="stat-val" style="color:${!has ? '#8da3b6' : pos ? '#3d5a4a' : '#8c3d3d'}">${has ? `${pos ? '+' : ''}${s.pct.toFixed(1)}%` : '—'}</div></div>`;
  }).join('');

  const capital = (flows || []).filter(f => f.kind !== 'fee');
  const fees    = (flows || []).filter(f => f.kind === 'fee').reduce((s, f) => s + Math.abs(Number(f.amount) || 0), 0);
  const contrib = capital.filter(f => Number(f.amount) > 0).reduce((s, f) => s + Number(f.amount), 0);
  const withdr  = capital.filter(f => Number(f.amount) < 0).reduce((s, f) => s + Math.abs(Number(f.amount)), 0);
  const netOfFees = fees > 0;

  _openPrint(`Performance Report — ${escapeHtml(client.name)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">Performance report &middot; ${date}</div></div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}${advisorName ? `<br/>Prepared by ${escapeHtml(advisorName)}` : ''}</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Portfolio value</div><div class="stat-val">${fmt$(cur, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Net contributions</div><div class="stat-val" style="font-size:15px;margin-top:6px">${fmt$(contrib - withdr, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">As of</div><div class="stat-val" style="font-size:13px;margin-top:7px">${date}</div></div>
    </div>
    <div class="section-lbl">Portfolio value over time</div>
    ${chartHtml}
    <div class="section-lbl" style="margin-top:22px">Time-weighted return${netOfFees ? ' &middot; net of advisory fees' : ''}</div>
    <div class="grid" style="grid-template-columns:repeat(5,1fr)">${periodCells}</div>
    <div class="section-lbl" style="margin-top:22px">Cash flow summary</div>
    <div style="font-size:12px;color:#2d4258">Contributions: <b>${fmt$(contrib, { short: true })}</b> &nbsp;&middot;&nbsp; Withdrawals: <b>${fmt$(withdr, { short: true })}</b>${netOfFees ? ` &nbsp;&middot;&nbsp; Advisory fees: <b>${fmt$(fees, { short: true })}</b>` : ''}</div>
    <div class="footer">Returns are time-weighted (Modified Dietz). ${netOfFees ? 'Returns are shown <b>net of advisory fees</b> debited from the account over the period.' : 'No advisory-fee debits were recorded for this period, so returns are shown <b>before advisory fees</b>.'} Returns reflect account value change where transaction-level cash flows have not been recorded. Past performance is not indicative of future results; this report is informational and is not investment advice. Prism Advisor Workspace${advisorFirm ? ' &middot; ' + escapeHtml(advisorFirm) : ''}.</div>
  `);
}

// One-click QBR packet (C4). Assembles a client-ready quarterly business review
// from data already in the system: roadmap progress + retirement readiness +
// net-of-fee performance + goals + protection. A pure renderer — the advisor
// modal gathers the pieces and passes pre-computed display values.
function printQBRReport(opts) {
  const o = opts || {};
  const client = o.client || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Roadmap progress strip
  const phaseRows = (o.phases || []).map(p => {
    const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
    const tone = pct === 100 ? '#3d5a4a' : pct > 0 ? '#a98c4b' : '#8da3b6';
    return `<div class="task"><span style="flex:1">Phase ${escapeHtml(p.num)} · ${escapeHtml(p.title)}</span>
      <span style="color:${tone};font-weight:600">${p.completed}/${p.total} · ${pct}%</span></div>`;
  }).join('');

  // Retirement readiness + probability band
  let readinessHtml = '';
  if (o.readiness) {
    const r = o.readiness;
    const pct = Math.round((r.fundedRatio || 0) * 100);
    const band = o.successBand
      ? ` &middot; Monte Carlo success ${Math.round(o.successBand.successPct)}% (bear ${fmt$(o.successBand.p10, { short: true })} · median ${fmt$(o.successBand.medianFinal, { short: true })} · bull ${fmt$(o.successBand.p90, { short: true })})`
      : '';
    readinessHtml = `<div class="section-lbl">Retirement readiness</div>
      <div style="font-size:12.5px;color:#2d4258">${pct}% funded &middot; <b>${escapeHtml(r.verdict)}</b>${r.lasts ? ' — plan funded through age 95' : (r.depletionAge ? ` — projected to age ${r.depletionAge}` : '')}${band}</div>`;
  }

  // Goals
  const goalsHtml = (o.goals || []).length
    ? `<div class="section-lbl">Goals</div>${o.goals.map(g => `
        <div class="task"><span style="flex:1">${escapeHtml(g.label)}</span><span style="color:#5d7a8e">${g.pct}% · ${escapeHtml(g.status)}</span></div>`).join('')}`
    : '';

  // Protection
  let protHtml = '';
  if (o.protection) {
    const p = o.protection;
    protHtml = `<div class="section-lbl">Protection &amp; estate</div>
      <div style="font-size:12.5px;color:#2d4258">Life coverage ${fmt$(p.lifeCoverage, { short: true })}${p.recommended > 0 ? ` of ${fmt$(p.recommended, { short: true })} guideline` : ''}${p.gap > 0 ? ` &middot; gap ${fmt$(p.gap, { short: true })}` : ' &middot; well covered'} &middot; estate ${p.estateComplete}/${p.estateTotal} in place</div>`;
  }

  // Performance chart + period returns
  const series = o.series || [], periods = o.periods || [], flows = o.flows || [];
  let chartHtml = '';
  if (series.length >= 2) {
    const W = 640, H = 150;
    const vals = series.map(p => p.value);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1, n = series.length;
    const x = i => (i / (n - 1)) * W, y = v => H - ((v - min) / range) * (H - 20) - 10;
    const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const up = vals[n - 1] >= vals[0], color = up ? '#3d5a4a' : '#8c3d3d';
    chartHtml = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="border:1px solid #e4dfd0;border-radius:6px;background:#fff">
      <path d="${line} L${W},${H} L0,${H} Z" fill="${color}" opacity="0.08"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  const netOfFees = (flows || []).some(f => f.kind === 'fee');
  const periodCells = periods.map(s => {
    const has = s.pct != null && isFinite(s.pct), pos = (s.pct || 0) >= 0;
    return `<div class="stat"><div class="stat-lbl">${escapeHtml(s.label)}</div><div class="stat-val" style="color:${!has ? '#8da3b6' : pos ? '#3d5a4a' : '#8c3d3d'}">${has ? `${pos ? '+' : ''}${s.pct.toFixed(1)}%` : '—'}</div></div>`;
  }).join('');
  const perfHtml = series.length >= 2
    ? `<div class="section-lbl">Performance — portfolio value</div>${chartHtml}
       <div class="section-lbl" style="margin-top:18px">Time-weighted return${netOfFees ? ' &middot; net of advisory fees' : ''}</div>
       <div class="grid" style="grid-template-columns:repeat(5,1fr)">${periodCells}</div>`
    : '';

  // Risk allocation
  const allocHtml = (o.risk && o.risk.allocation)
    ? `<div class="section-lbl">Strategic allocation (${escapeHtml(o.risk.band)})</div>
       <div style="font-size:12.5px;color:#2d4258">Equity ${o.risk.allocation.equity}% &middot; Fixed income ${o.risk.allocation.fixedIncome}% &middot; Cash ${o.risk.allocation.cash}%</div>`
    : '';

  _openPrint(`Quarterly Review — ${escapeHtml(client.name)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><h1>Quarterly Business Review</h1><div class="sub">${escapeHtml(client.name)} &middot; ${date}</div></div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">${escapeHtml(o.advisorFirm || 'Prism Advisor Workspace')}${o.advisorName ? `<br/>Prepared by ${escapeHtml(o.advisorName)}` : ''}<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Net worth</div><div class="stat-val">${fmt$(o.netWorth, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Managed assets</div><div class="stat-val">${fmt$(o.aum, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Current horizon</div><div class="stat-val" style="font-size:13px;margin-top:6px">Phase ${escapeHtml(o.phase?.num || '—')} · ${escapeHtml(o.phase?.title || '')}</div></div>
    </div>
    <div class="section-lbl">Plan progress</div>
    ${phaseRows}
    ${readinessHtml}
    ${allocHtml}
    ${goalsHtml}
    ${protHtml}
    ${perfHtml}
    <div class="footer">This review summarizes your plan as of ${date} and is prepared for discussion with your advisor. Returns are time-weighted (Modified Dietz)${netOfFees ? ', shown net of advisory fees' : ''}. Projections are illustrative; past performance is not indicative of future results. Prism Advisor Workspace${o.advisorFirm ? ' &middot; ' + escapeHtml(o.advisorFirm) : ''}.</div>
  `);
}

// Draft Investment Policy Statement (C4). Built from the client's risk profile
// (band + strategic allocation from calc-core.riskProfile). A starting draft the
// advisor reviews, prints for the vault, and sends for e-sign via acknowledgements.
//   opts: { client, risk:{ score, band, allocation }, planningAge, retireAt, advisorName, advisorFirm }
function printIPSReport(opts) {
  const { client, risk, planningAge, retireAt, advisorName, advisorFirm } = opts || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const a = risk?.allocation || { equity: 60, fixedIncome: 35, cash: 5 };
  const horizon = (retireAt && planningAge) ? Math.max(0, retireAt - planningAge) : null;
  const allocRows = [
    ['Equity (global, diversified)', a.equity],
    ['Fixed income / bonds', a.fixedIncome],
    ['Cash & equivalents', a.cash],
  ].map(([label, pct]) => `
    <div class="task"><span style="flex:1">${escapeHtml(label)}</span><span style="font-weight:600">${pct}%</span></div>`).join('');

  _openPrint(`Investment Policy Statement — ${escapeHtml(client.name)}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><h1>Investment Policy Statement</h1><div class="sub">${escapeHtml(client.name)} &middot; Draft ${date}</div></div>
      <div style="font-size:10px;color:#8da3b6;text-align:right">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}${advisorName ? `<br/>Prepared by ${escapeHtml(advisorName)}` : ''}<br/>DRAFT — for review</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Risk profile</div><div class="stat-val" style="font-size:15px;margin-top:6px">${escapeHtml(risk?.band || '—')}</div></div>
      <div class="stat"><div class="stat-lbl">Risk score</div><div class="stat-val">${risk?.score != null ? risk.score + ' / 100' : '—'}</div></div>
      <div class="stat"><div class="stat-lbl">Time horizon</div><div class="stat-val" style="font-size:15px;margin-top:6px">${horizon != null ? `${horizon} yrs to retirement` : 'Long-term'}</div></div>
    </div>
    <div class="section-lbl">1 · Purpose</div>
    <div style="font-size:12.5px;line-height:1.6;color:#2d4258">This Investment Policy Statement sets the objectives, risk tolerance, and target asset allocation for the assets managed on behalf of ${escapeHtml(client.name)}. It is a working framework reviewed with the advisor and updated as circumstances change.</div>
    <div class="section-lbl">2 · Investment objective &amp; risk tolerance</div>
    <div style="font-size:12.5px;line-height:1.6;color:#2d4258">Based on a completed risk questionnaire, the household's tolerance is assessed as <b>${escapeHtml(risk?.band || 'Balanced')}</b>. The portfolio is constructed to pursue long-term growth consistent with this tolerance${horizon != null ? ` over an approximately ${horizon}-year horizon to retirement` : ''}, accepting the interim volatility this allocation implies.</div>
    <div class="section-lbl">3 · Target strategic asset allocation</div>
    <div class="task" style="font-weight:600;color:#5d7a8e;font-size:11px;text-transform:uppercase;letter-spacing:.04em"><span style="flex:1">Asset class</span><span>Target</span></div>
    ${allocRows}
    <div class="section-lbl">4 · Rebalancing</div>
    <div style="font-size:12.5px;line-height:1.6;color:#2d4258">Allocations are reviewed at least annually and rebalanced when any asset class drifts more than ±5% from its target, or upon a material change in the household's circumstances.</div>
    <div class="section-lbl">5 · Review &amp; acknowledgement</div>
    <div style="font-size:12.5px;line-height:1.6;color:#2d4258">This statement is reviewed at each periodic meeting. By signing, the client acknowledges they have reviewed and agree to this policy as a basis for ongoing management.</div>
    <div style="display:flex;gap:40px;margin-top:34px">
      <div style="flex:1;border-top:1px solid #1c2e4a;padding-top:6px;font-size:11px;color:#5d7a8e">Client signature &amp; date</div>
      <div style="flex:1;border-top:1px solid #1c2e4a;padding-top:6px;font-size:11px;color:#5d7a8e">Advisor signature &amp; date</div>
    </div>
    <div class="footer">Draft Investment Policy Statement generated by Prism Advisor Workspace${advisorFirm ? ' &middot; ' + escapeHtml(advisorFirm) : ''}. This draft is informational, is not investment advice, and is finalized only upon signature by both parties.</div>
  `);
}

// Branded advisory-fee invoice (Theme D, 18d)
function printInvoiceReport(invoice, clientName, advisorFirm) {
  const fmtD = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const num = ('INV-' + String(invoice.id).replace(/-/g, '').slice(0, 8)).toUpperCase();
  _openPrint(`Invoice ${num}`, `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
      <div><h1>Invoice</h1><div class="sub">${num} &middot; Issued ${fmtD(invoice.created_at || new Date())}</div></div>
      <div style="font-size:11px;color:#5d7a8e;text-align:right">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}<br/>Advisory fee statement</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Bill to</div><div class="stat-val" style="font-size:14px;margin-top:6px">${escapeHtml(clientName || 'Client')}</div></div>
      <div class="stat"><div class="stat-lbl">Billing period</div><div class="stat-val" style="font-size:13px;margin-top:7px">${fmtD(invoice.period_start)} – ${fmtD(invoice.period_end)}</div></div>
      <div class="stat"><div class="stat-lbl">Status</div><div class="stat-val" style="font-size:14px;margin-top:6px;text-transform:capitalize">${escapeHtml(invoice.status || 'draft')}</div></div>
    </div>
    <div class="section-lbl">Detail</div>
    <div class="task" style="font-weight:600;color:#5d7a8e;font-size:11px;text-transform:uppercase;letter-spacing:.04em">
      <span style="flex:1">Description</span><span>Amount</span>
    </div>
    <div class="task">
      <span style="flex:1">Advisory fee on billing assets of ${fmt$(invoice.basis_amount, { short: true })}</span>
      <span style="font-weight:600">${fmt$(invoice.fee_amount)}</span>
    </div>
    <div class="task" style="border-bottom:none;padding-top:12px">
      <span style="flex:1;font-weight:700;font-size:14px">Total due</span>
      <span style="font-weight:700;font-size:16px">${fmt$(invoice.fee_amount)}</span>
    </div>
    <div class="footer">Advisory fees are calculated per your firm's fee schedule. Questions? Contact your advisor. Prism Advisor Workspace${advisorFirm ? ' &middot; ' + escapeHtml(advisorFirm) : ''}.</div>
  `);
}

Object.assign(window, {
  ProfileProvider, useProfile, emptyProfile, mergeProfile,
  TaskProvider, useTasks,
  ViewProvider, useView,
  NotificationProvider, useNotifications,
  useTheme,
  printClientReport,
  printMilestoneReport,
  printComplianceReport,
  printPerformanceReport,
  printInvoiceReport,
  printQBRReport,
  printIPSReport,
  escapeHtml, sanitizeHtml,
  fmt$, fmtPct, fmtN,
});

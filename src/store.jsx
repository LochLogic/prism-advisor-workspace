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
    hsaBalance: 41200, iraBalance: 318000, fourohonekBalance: 1_240_000, rothBalance: 280000,
    hsaContrib: 4400, iraContributed: 7000, iraLimit: 7000,
    fourohonekContributed: 23500, fourohonekLimit: 23500, employerMatchPct: 5,
  },
  taxes:   { marginalRate: 24, filingStatus: 'mfj', state: 'CA', w2: { box1: 0, box2: 0 } },
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
    { id: 'is1', label: 'Social Security — Robert', type: 'social_security', monthlyAmount: 3800, startAge: 67, colaPct: 2.5, pia: 3800 },
    { id: 'is2', label: 'Social Security — Eileen',  type: 'social_security', monthlyAmount: 2600, startAge: 67, colaPct: 2.5, pia: 2600 },
  ],
  // Equity compensation (W6 / Phase 06) — concentrated single-stock positions from
  // RSU/ISO grants. `positionValue` is vested market value, `unvestedValue` is grants
  // not yet vested. Feeds the concentration / diversification planner; empty for most
  // households, common for the tech/founder clients who seek an advisor.
  equityComp: [
    { id: 'eq1', ticker: 'NVDA', type: 'rsu', positionValue: 680_000, costBasis: 180_000, unvestedValue: 240_000 },
  ],
  // Protection (W5) — capture, not advise. Coverage feeds a simple gap check vs. an
  // income-multiple guideline; the advisor coaches, Prism doesn't underwrite.
  insurance: [
    { id: 'ins1', type: 'life',       carrier: 'Northwestern', owner: 'Robert Marsh', coverageAmount: 1_500_000, premiumMonthly: 320 },
    { id: 'ins2', type: 'disability', carrier: 'Guardian',     owner: 'Robert Marsh', coverageAmount: 180_000,   premiumMonthly: 140 },
  ],
  // Estate readiness checklist — status + last-reviewed + linked vault doc per
  // instrument. documentId points at a `documents` row (category 'estate'); its
  // presence is what an advisor sets when marking an item "Complete & shared".
  estate: {
    will:                { status: 'complete',      lastReviewed: '2023-03-01', documentId: 'doc4' },
    trust:               { status: 'have_unshared', lastReviewed: '2023-03-01' },
    poa:                 { status: 'in_progress',   lastReviewed: '' },
    healthcareDirective: { status: 'complete',      lastReviewed: '2023-03-01', documentId: 'doc5' },
    beneficiaries:       { status: 'none',          lastReviewed: '' },
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
    hsaBalance: 0, iraBalance: 0, fourohonekBalance: 0, rothBalance: 0,
    hsaContrib: 0, iraContributed: 0, iraLimit: 7000,
    fourohonekContributed: 0, fourohonekLimit: 23500, employerMatchPct: 0,
  },
  taxes:   { marginalRate: 24, filingStatus: 'mfj', state: '', w2: { box1: 0, box2: 0 } },
  taxable: { balance: 0, monthlyContrib: 0 },
  goals:   { age: 45, retireAt: 65, items: [] },
  incomeStreams: [],
  equityComp: [],
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

// Synchronous local-profile load for mock/demo/prospect ids. Prospects merge
// onto emptyProfile — NOT defaultProfile — so the demo household's sample data
// (members, balances, completed risk questionnaire) never bleeds into a
// prospect's roadmap.
const loadLocalProfile = (id) => {
  const base = (typeof id === 'string' && id.startsWith('prospect-')) ? emptyProfile : defaultProfile;
  try {
    const saved = JSON.parse(localStorage.getItem(`px_profile:${id}`));
    return saved ? mergeProfile(base, saved) : base;
  } catch { return base; }
};

function ProfileProvider({ children }) {
  const { activeClientId } = useView();
  // Lazy init from the right source so the first paint never flashes the demo
  // sample profile (the old behaviour briefly showed a completed sample risk
  // profile on prospects, which then "vanished" once the real load landed).
  const [profile, _setProfile] = useState(() =>
    (window.db?.isUUID(activeClientId)) ? emptyProfile : loadLocalProfile(activeClientId));
  const dbSaveTimer = React.useRef(null);
  const isLoading   = React.useRef(false);

  // ── Undo history ────────────────────────────────────────────────
  // A client experimenting in the Numbers drawer can make a tangle of edits and
  // not know how to get back. We snapshot the profile *before* each user edit so
  // they can step back one change at a time (or revert everything in the drawer).
  // Edits auto-save as before — this is a client-side safety net, not a commit
  // gate (the formal advisor-approval gate is a separate, larger roadmap item).
  const history     = React.useRef([]);   // pre-edit snapshots, oldest → newest
  const profileRef  = React.useRef(profile);
  const [undoDepth, setUndoDepth] = useState(0);
  React.useEffect(() => { profileRef.current = profile; }, [profile]);

  // Public setter (used by editing UI) — records the pre-edit snapshot so it can
  // be undone. Loads/client-switches use the raw _setProfile and never enter the
  // undo stack.
  const setProfile = React.useCallback((updater) => {
    history.current.push(profileRef.current);
    if (history.current.length > 80) history.current.shift();
    setUndoDepth(history.current.length);
    _setProfile(updater);
  }, []);

  const undoEdit = React.useCallback(() => {
    if (!history.current.length) return;
    const prev = history.current.pop();
    setUndoDepth(history.current.length);
    _setProfile(prev);   // the pop IS the undo — don't re-record it
  }, []);
  // Tracks the latest debounced-but-not-yet-written save: { clientId, profile }.
  // Lets us FLUSH it before a client switch (or unmount) so the last <1.5s of
  // edits aren't dropped when the load effect cancels the pending timer.
  const pendingSave = React.useRef(null);
  // Set when an async DB load lands: the next [profile]-keyed persist run is the
  // load's own echo, not a user edit, and must not be written back.
  const skipNextSave = React.useRef(false);

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
    history.current = []; setUndoDepth(0);   // undo never crosses a client boundary
    if (window.db?.isUUID(activeClientId)) {
      // Real client — reset to a blank shape, then merge in whatever the DB has.
      // A new client's profile is an empty {}; merging keeps every key present so
      // the roadmap and calculators render instead of crashing on undefined.
      isLoading.current = true;
      _setProfile(emptyProfile);
      window.db.getProfile(activeClientId).then(data => {
        // The persist effect (keyed on [profile]) fires once more for this set —
        // after isLoading is already false — so flag it to skip that one run:
        // it would only write back the bytes we just read.
        skipNextSave.current = true;
        _setProfile(mergeProfile(emptyProfile, data));
        isLoading.current = false;
      }).catch(() => { isLoading.current = false; });
    } else {
      // Mock/demo/prospect — load from per-client localStorage key. The merge
      // base (defaultProfile, or emptyProfile for prospects) keeps every key
      // present even for profiles saved before a field (e.g. `housing`) was
      // added — otherwise toggling housing type would write into an undefined
      // parent and crash.
      _setProfile(loadLocalProfile(activeClientId));
    }
  }, [activeClientId]);

  // Persist (skip during loading to avoid writing stale data)
  useEffect(() => {
    if (isLoading.current) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }   // post-load echo
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

  // When a vault document is deleted (DocumentVault fires px:document-deleted),
  // clear any estate-checklist link pointing at it so the profile never carries a
  // dangling documentId. Raw _setProfile: a system cleanup, not an undoable edit;
  // returning prev unchanged keeps the persist effect quiet.
  useEffect(() => {
    const onDocDeleted = (e) => {
      const { documentId, clientId } = e.detail || {};
      if (!documentId || clientId !== activeClientId) return;
      _setProfile(prev => {
        const est = prev?.estate;
        if (!est || typeof est !== 'object') return prev;
        let changed = false;
        const next = {};
        for (const [k, item] of Object.entries(est)) {
          if (item && item.documentId === documentId) { next[k] = { ...item, documentId: null }; changed = true; }
          else next[k] = item;
        }
        return changed ? { ...prev, estate: next } : prev;
      });
    };
    window.addEventListener('px:document-deleted', onDocDeleted);
    return () => window.removeEventListener('px:document-deleted', onDocDeleted);
  }, [activeClientId]);

  const update = useCallback((path, value) => {
    setProfile(prev => {
      // Shallow path-copy: clone only the spine of objects along the edited path
      // (this runs per keystroke — a whole-profile deep clone was measurable on
      // large profiles). Untouched branches keep their references, which is also
      // what lets memoized consumers skip re-deriving.
      const keys = path.split('.');
      const next = { ...prev };
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        // Create missing intermediate objects so paths into a not-yet-present
        // branch (e.g. `housing.type` on an older profile) never throw.
        const cur = o[k];
        o[k] = (cur == null || typeof cur !== 'object') ? {} : (Array.isArray(cur) ? [...cur] : { ...cur });
        o = o[k];
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
  const _calc = (typeof PrismCalc !== 'undefined' ? PrismCalc : window.PrismCalc);
  // Single source of truth (calc-core) — same total the advisor QBR/overview use.
  const totalExpenses = _calc.monthlyExpenseTotal(_exp);
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
                         + (profile.retirement.fourohonekBalance || 0)
                         + (profile.retirement.rothBalance || 0);
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
  // "In place" = the instrument exists — whether shared (complete) or held but
  // not shared (have_unshared). Both count toward readiness.
  const estateComplete = estateKeys.filter(k => estateInPlace(estate[k]?.status)).length;
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

  // ── Equity compensation → concentration (Phase 06) ──────────────
  // Concentrated single-stock positions from RSU/ISO grants. The total equity-comp
  // value rolls into invested totals via the largest-position concentration check
  // against the whole portfolio (totalInvested already includes typed balances; the
  // position is treated as part of that total by the calc).
  const equityComp = Array.isArray(profile.equityComp) ? profile.equityComp : [];
  const equityCompValue   = equityComp.reduce((a, e) => a + (Number(e.positionValue) || 0), 0);
  const equityUnvested    = equityComp.reduce((a, e) => a + (Number(e.unvestedValue) || 0), 0);
  const largestPosition   = equityComp.reduce((b, e) =>
    (Number(e.positionValue) || 0) > (Number(b?.positionValue) || 0) ? e : b, null);
  const equityConcentration = largestPosition ? _calc.equityCompConcentration({
    positionValue: Number(largestPosition.positionValue) || 0,
    costBasis: Number(largestPosition.costBasis) || 0,
    totalInvested, unvestedValue: Number(largestPosition.unvestedValue) || 0,
    capGainsRatePct: 15, thresholdPct: 10,
  }) : null;

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
    equityComp, equityCompValue, equityUnvested, largestPosition, equityConcentration,
  };

  // Asset-truth composition (managed AUM is passed in by the view, which knows the
  // client record); expose the helper so portal/modal compose one honest total.
  metrics.assetComposition = (managedAum) => _calc.assetComposition({ managedAum, investedOnFile });

  // Stabilize the context value identity. Every metric above is a pure function
  // of `profile` + `activeClientId` (the latter only via the Monte Carlo seed), so
  // keying on those two prevents a new value object — and a re-render of every
  // profile consumer — when a parent provider re-renders without a profile change.
  const value = useMemo(() => ({ profile, setProfile, update, undoEdit, undoDepth, ...metrics }),
    [profile, activeClientId, undoDepth]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Mock/demo — load from namespaced localStorage. The demo mid-journey
      // seed is for the sample household only; a prospect with no saved state
      // starts blank (createProspect seeds its chosen starting phase).
      const fallback = () => isProspectId(activeClientId) ? {} : mockSeed();
      try {
        const saved = JSON.parse(localStorage.getItem(`px_tasks:${activeClientId}`));
        setTaskStates(saved || fallback());
      } catch { setTaskStates(fallback()); }
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

// ── Deep-linkable routing ─────────────────────────────────────────────
// The advisor/admin app reflects nav state in the URL hash so any view is
// bookmarkable / shareable / support-linkable:
//   #/advisor · #/admin · #/client · #/client/<uuid> · #/client/<uuid>/p<phaseId>
// The slim client portal is single-view, so hash routing is advisor-app only.
const HASH_ROUTING = typeof window !== 'undefined' && !window.__pxIsPortal;

function parseHashRoute() {
  try {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    if (!h) return null;
    const [v, id, ph] = h.split('/');
    const view = (v === 'advisor' || v === 'admin' || v === 'client') ? v : null;
    if (!view) return null;
    const clientId = id || null;
    const pendingPhaseId = (ph && /^p\d+$/.test(ph)) ? parseInt(ph.slice(1), 10) : null;
    return { view, clientId, pendingPhaseId };
  } catch { return null; }
}

function buildHashRoute(view, clientId, pendingPhaseId) {
  let h = '#/' + view;
  if (view === 'client' && clientId) {
    h += '/' + clientId;
    if (pendingPhaseId != null) h += '/p' + pendingPhaseId;
  }
  return h;
}

function ViewProvider({ children }) {
  const initialRoute = HASH_ROUTING ? parseHashRoute() : null;

  const [view, setView] = useState(() => {
    if (initialRoute?.view) return initialRoute.view;
    try { return localStorage.getItem('px_view') || 'advisor'; }
    catch { return 'advisor'; }
  });
  const [activeClientId,  setActiveClientId]  = useState(initialRoute?.clientId || currentClientId);
  const [activeClient,    setActiveClient]    = useState(null);
  const [pendingPhaseId,  setPendingPhaseId]  = useState(initialRoute?.pendingPhaseId ?? null);
  const [toast, setToast] = useState(null);
  const [numbersOpen, setNumbersOpen] = useState(false);

  useEffect(() => { try { localStorage.setItem('px_view', view); } catch {} }, [view]);

  // Mirror nav state → URL hash (replaceState: shareable URL without history spam).
  useEffect(() => {
    if (!HASH_ROUTING) return;
    const next = buildHashRoute(view, activeClientId, pendingPhaseId);
    if (next !== window.location.hash) {
      try { window.history.replaceState(null, '', next); } catch {}
    }
  }, [view, activeClientId, pendingPhaseId]);

  // URL hash → nav state (a pasted/edited deep link in the same tab).
  useEffect(() => {
    if (!HASH_ROUTING) return;
    const onHash = () => {
      const r = parseHashRoute();
      if (!r) return;
      setView(r.view);
      if (r.clientId) setActiveClientId(r.clientId);
      if (r.pendingPhaseId != null) setPendingPhaseId(r.pendingPhaseId);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

/* ─── Prospect / proposal mode (C3) ───────────────────────────────────
   A prospect is an UNSAVED household an advisor runs through the full
   seven-horizon roadmap before they sign — the wedge turned into a closing
   tool. It reuses the entire non-UUID client machinery: the roadmap,
   calculators, retirement readiness, and Monte Carlo already render for any
   mock/demo client whose profile + horizon progress live in localStorage. A
   prospect is exactly that, surfaced in the roster with a "Prospect" badge
   plus a one-click "Convert to client" that promotes it to a real DB row
   (profile + horizon progress carried over). Nothing touches Supabase until
   conversion, so a prospect costs nothing and leaves no trace if it never
   closes. */
const ProspectContext = createContext(null);

// Representative starting numbers for the "Use sample numbers" shortcut, so a
// cold prospect roadmap is substantive without hand-entry.
const SAMPLE_PROSPECT_NUMBERS = {
  monthlyTakehome: 14000, emergency: 45000, taxableBalance: 210000, retirementBalance: 320000,
};

const isProspectId = (id) => typeof id === 'string' && id.startsWith('prospect-');

function ProspectProvider({ children }) {
  const { authUser } = window.useAuth?.() || {};
  const { openClientPortal, showToast } = useView();
  const scope = authUser?.id || 'demo';
  const storeKey = `px_prospects:${scope}`;

  const [prospects, setProspects] = useState([]);

  // (Re)load the list whenever the signed-in advisor resolves (login is async).
  useEffect(() => {
    try { setProspects(JSON.parse(localStorage.getItem(storeKey)) || []); }
    catch { setProspects([]); }
  }, [storeKey]);

  const persist = (list) => {
    setProspects(list);
    try { localStorage.setItem(storeKey, JSON.stringify(list)); } catch {}
  };

  const isProspect = useCallback((id) => isProspectId(id), []);

  // Convert subscribers let the dashboard splice a freshly-converted client
  // into its live roster without this provider owning that state.
  const convertHandlers = React.useRef(new Set());
  const onConvert = useCallback((fn) => {
    convertHandlers.current.add(fn);
    return () => convertHandlers.current.delete(fn);
  }, []);

  // Build a roster-shaped (mapClient-compatible) prospect object.
  const buildProspect = (fields, numbers) => {
    const id = `prospect-${Date.now()}`;
    const name = fields.household_name.trim();
    const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const aum = (Number(numbers.taxableBalance) || 0) + (Number(numbers.retirementBalance) || 0);
    return {
      id, name,
      shortName: fields.short_name?.trim() || name,
      tag: fields.household_tag?.trim() || '—',
      initials, aum,
      phase: Number(fields.current_phase) || 0, phaseProgress: 0,
      lastActivity: 'just now', recent: true,
      uninvestedCash: 0, monthlyOutflow: 0,
      accentHue: (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 19) % 360,
      notes: '', pipelineStage: 'lead', isProspect: true,
      createdAt: new Date().toISOString(),
    };
  };

  // Seed the prospect's localStorage profile from the entered numbers so the
  // roadmap renders THEIR figures. Built on emptyProfile (not the demo sample)
  // so blank fields stay blank instead of inheriting the Marsh defaults.
  const createProspect = (fields, numbers = {}) => {
    const p = buildProspect(fields, numbers);
    const num = (v) => (v === '' || v == null ? undefined : Number(v));
    const partial = {};
    if (num(numbers.monthlyTakehome)   != null) partial.income     = { monthlyTakehome: num(numbers.monthlyTakehome) };
    if (num(numbers.emergency)         != null) partial.savings    = { emergency: num(numbers.emergency) };
    if (num(numbers.taxableBalance)    != null) partial.taxable    = { balance: num(numbers.taxableBalance) };
    if (num(numbers.retirementBalance) != null) partial.retirement = { fourohonekBalance: num(numbers.retirementBalance) };
    const seeded = mergeProfile(emptyProfile, partial);
    try { localStorage.setItem(`px_profile:${p.id}`, JSON.stringify(seeded)); } catch {}
    // Seed horizon progress to the chosen starting phase: everything before it
    // is marked complete, so the roadmap opens ON that phase. Without this the
    // TaskProvider fell back to the demo seed (mid-phase-5 progress) — a
    // "starts at phase 1" prospect appeared at phase 5.
    const seedTasks = {};
    phasesData.forEach(ph => {
      if (ph.id < p.phase) {
        seedTasks[ph.id] = {};
        ph.tasks.forEach(t => { seedTasks[ph.id][t.id] = true; });
      }
    });
    try { localStorage.setItem(`px_tasks:${p.id}`, JSON.stringify(seedTasks)); } catch {}
    try { localStorage.setItem(`px_open:${p.id}`, JSON.stringify({ [p.phase]: true })); } catch {}
    persist([p, ...prospects]);
    return p;
  };

  const discardProspect = (id) => {
    persist(prospects.filter(p => p.id !== id));
    ['px_profile', 'px_tasks', 'px_open', 'px_flagged'].forEach(k => {
      try { localStorage.removeItem(`${k}:${id}`); } catch {}
    });
  };

  // Promote a prospect to a real client: create the DB row, carry over the
  // profile + horizon progress, clean up the in-memory prospect, then open the
  // now-real client. Live session only — nothing to write to without it.
  const convertProspect = async (prospect, profileOverride) => {
    if (!prospect || !window.db?.isUUID(authUser?.id) || !window.db?.isUUID(authUser?.firm_id)) {
      showToast?.('Sign in to convert a prospect into a client');
      return null;
    }
    const row = await window.db.createClient(authUser.id, authUser.firm_id, {
      household_name: prospect.name,
      short_name:     prospect.shortName,
      household_tag:  (prospect.tag === 'Prospect' || prospect.tag === '—') ? '' : prospect.tag,
      current_phase:  prospect.phase,
    });
    if (!row) { showToast?.('Could not convert — check console'); return null; }

    // Profile — prefer the live in-context profile, else the localStorage seed.
    let profile = profileOverride;
    if (!profile) { try { profile = JSON.parse(localStorage.getItem(`px_profile:${prospect.id}`)); } catch {} }
    if (profile) { try { await window.db.saveProfile(row.id, profile); } catch {} }

    // Horizon progress — replay the prospect's completed milestones onto the row.
    let states = null;
    try { states = JSON.parse(localStorage.getItem(`px_tasks:${prospect.id}`)); } catch {}
    if (states && typeof states === 'object') {
      for (const phaseId of Object.keys(states)) {
        for (const taskId of Object.keys(states[phaseId] || {})) {
          if (states[phaseId][taskId]) {
            try { await window.db.upsertTask(row.id, Number(phaseId), taskId, true); } catch {}
          }
        }
      }
    }

    const mapped = window.db.mapClient(row);
    discardProspect(prospect.id);
    convertHandlers.current.forEach(fn => { try { fn(mapped); } catch {} });
    showToast?.(`${mapped.shortName} converted to a client`);
    openClientPortal?.(mapped);
    return mapped;
  };

  return (
    <ProspectContext.Provider value={{
      prospects, isProspect, createProspect, convertProspect, discardProspect, onConvert,
    }}>
      {children}
    </ProspectContext.Provider>
  );
}
const useProspects = () => useContext(ProspectContext);

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
    // Cap the dedupe set — over a long-lived session it otherwise grows without
    // bound. Evict oldest first (Set iterates in insertion order); 500 is far
    // beyond the 20-notification display window.
    if (seenIds.current.size > 500) {
      for (const id of seenIds.current) {
        if (seenIds.current.size <= 400) break;
        seenIds.current.delete(id);
      }
    }
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

/* ─── Firm brand (white-label) ────────────────────────────────────────
   A firm's brand (name, color, logo, attribution) themes both bundles.
   Application = inline CSS custom properties on <html> (inline beats every
   stylesheet rule, including the dark-theme overrides) + window.__pxBrand +
   a 'px:brand' event the topbars subscribe to via useFirmBrand().

   Sources, in paint order:
   1. localStorage cache (instant repaint on next boot, per host),
   2. subdomain slug → px_brand_for_slug RPC (anon, pre-auth, {slug}.prismaw.com),
   3. the signed-in user's own firm row (auth.jsx, authoritative → re-cached). */
const PX_DEFAULT_BRAND_COLOR = '#1c2e4a';
const _brandCacheKey = () => `px_brand:${window.location.hostname}`;

// #rrggbb → slightly darkened hover shade
const _shadeHex = (hex, f = 0.85) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => ch(c).toString(16).padStart(2, '0')).join('');
};
const _hexRgba = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Trust boundary: the localStorage cache is client-writable and the slug RPC is
// anon-callable — whitelist + validate every field before painting or re-caching.
// (Pre-auth pages run the same shape of sanitizer in src/brand-boot.js.)
function _sanitizeBrand(b) {
  if (!b || typeof b !== 'object') return null;
  const out = {};
  if (typeof b.id === 'string') out.id = b.id;
  if (typeof b.name === 'string') out.name = b.name.slice(0, 120);
  if (typeof b.slug === 'string') out.slug = b.slug.slice(0, 63);
  if (/^#[0-9a-f]{6}$/i.test(b.brand_color || '')) out.brand_color = b.brand_color.toLowerCase();
  if (typeof b.logo_url === 'string' && /^data:image\//.test(b.logo_url) && b.logo_url.length <= 300000) out.logo_url = b.logo_url;
  out.show_powered_by = b.show_powered_by !== false;
  return out;
}

function applyFirmBrand(rawBrand, { cache = true } = {}) {
  const brand = _sanitizeBrand(rawBrand);
  if (!brand) return;
  const root = document.documentElement.style;
  const color = brand.brand_color || null;
  if (color && color.toLowerCase() !== PX_DEFAULT_BRAND_COLOR) {
    root.setProperty('--brand', color);
    root.setProperty('--brand-hover', _shadeHex(color));
    root.setProperty('--accent', color);
    root.setProperty('--accent-soft', _hexRgba(color, 0.14));
    root.setProperty('--accent-line', _hexRgba(color, 0.40));
  } else {
    for (const v of ['--brand', '--brand-hover', '--accent', '--accent-soft', '--accent-line']) root.removeProperty(v);
  }
  window.__pxBrand = brand;
  if (cache) {
    try { localStorage.setItem(_brandCacheKey(), JSON.stringify(brand)); } catch {}
  }
  window.dispatchEvent(new CustomEvent('px:brand'));
}

// Topbar hook — re-renders when the brand resolves or changes.
function useFirmBrand() {
  const [brand, setBrand] = React.useState(window.__pxBrand || null);
  React.useEffect(() => {
    const on = () => setBrand(window.__pxBrand || null);
    window.addEventListener('px:brand', on);
    return () => window.removeEventListener('px:brand', on);
  }, []);
  return brand;
}

// Boot-time paint: cached brand first (no flash), then resolve the subdomain
// slug against the DB (covers a client landing on {slug}.prismaw.com pre-auth).
(() => {
  try {
    const cached = localStorage.getItem(_brandCacheKey());
    if (cached) applyFirmBrand(JSON.parse(cached), { cache: false });
  } catch {}
  const host = window.location.hostname;
  const m = /^([a-z0-9-]+)\.prismaw\.com$/i.exec(host);
  const slug = m && !['www', 'app'].includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
  if (slug && window.db?.getBrandForSlug) {
    window.db.getBrandForSlug(slug).then(b => { if (b) applyFirmBrand(b); });
  }
})();

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

// Report styling lives in the same-origin /src/print.css. The popup opened below
// inherits the app's CSP, which (since C5) no longer carries style-src 'unsafe-inline',
// so the report can no longer use an inline <style> block or style="" attributes —
// it links the external sheet ('self' allows it) and uses classes only.
function _openPrint(title, bodyHtml, { autoPrint = true } = {}) {
  const win = window.open('', '_blank');
  if (!win) { console.warn('[print] popup blocked — allow popups for this site'); return; }
  const href = `${location.origin}/src/print.css`;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><link rel="stylesheet" href="${href}"></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  // autoPrint:false = reading material (e.g. estate sample documents) — open the
  // styled page without forcing the print dialog; the reader prints if they want.
  if (!autoPrint) { try { win.focus(); } catch (e) { /* popup closed */ } return; }
  // Print once the stylesheet has loaded so the report is styled; fall back on a
  // timer in case load/error never fires. CSP forbids inline onload= handlers in
  // the popup, so the listener is attached here from the opener context.
  let printed = false;
  const doPrint = () => { if (printed) return; printed = true; try { win.focus(); win.print(); } catch (e) { /* popup closed */ } };
  const link = win.document.querySelector('link[rel="stylesheet"]');
  if (link) { link.addEventListener('load', doPrint); link.addEventListener('error', doPrint); }
  setTimeout(doPrint, 800);
}

/* ─── Estate sample documents ─────────────────────────────────────────
   Discussion aids for the estate-readiness checklist. When a household hasn't
   completed an instrument, "View sample" opens an illustrative document so the
   advisor and client can walk through what it does and what decisions it asks
   for. Deliberately NOT a fillable template: advisors aren't attorneys, so the
   framing is "here's what this looks like and what to think about" with a
   plain banner sending execution to a licensed estate attorney. */
const ESTATE_SAMPLES = {
  will: {
    title: 'Last Will and Testament',
    what: 'Directs who receives property that passes through probate, names an executor to settle the estate, and (critically for parents) nominates guardians for minor children.',
    sections: [
      ['Article I — Declaration', 'I, [Full Legal Name], a resident of [County, State], being of sound mind, declare this to be my Last Will and Testament, revoking all prior wills and codicils.'],
      ['Article II — Executor', 'I nominate [Name] as Executor of my estate, to serve without bond. If they are unable or unwilling to serve, I nominate [Alternate Name].'],
      ['Article III — Guardianship', 'If at my death any of my children are minors, I nominate [Name] as guardian of their person and property, with [Alternate Name] as successor.'],
      ['Article IV — Disposition of property', 'I give my tangible personal property to [Name]. I give the residue of my estate to [Name / Trust], per stirpes.'],
      ['Article V — Execution', 'Signed at [City, State] on [Date], in the presence of two witnesses, who sign below at my request. [State-specific witnessing and notarization rules apply.]'],
    ],
    discuss: [
      'Who should serve as executor — and have they agreed?',
      'Who would raise minor children if both parents are gone?',
      'Does property pass outright, or into a trust for ages/stages?',
      'Assets with beneficiary designations (retirement accounts, life insurance) pass OUTSIDE the will — they must be reviewed separately.',
    ],
  },
  trust: {
    title: 'Revocable Living Trust Agreement',
    what: 'A container you control during life that lets assets pass to beneficiaries without probate, provides for incapacity, and keeps the plan private. You typically serve as your own trustee while able.',
    sections: [
      ['Article I — Trust creation', 'I, [Full Legal Name] (the "Grantor"), establish the [Family Name] Revocable Living Trust, dated [Date]. I may amend or revoke this trust at any time while living and competent.'],
      ['Article II — Trustees', 'I will serve as initial Trustee. On my death or incapacity, [Successor Trustee Name] shall serve as Successor Trustee without bond.'],
      ['Article III — During my lifetime', 'The Trustee shall hold, manage, and distribute trust property for my benefit as I direct.'],
      ['Article IV — On my death', 'The Trustee shall distribute the trust estate to [Beneficiaries], per the schedule attached — outright, or held in continuing trust until each beneficiary reaches the stated ages.'],
      ['Article V — Funding', 'A trust only avoids probate for assets actually TITLED in it. A schedule of trust property and a "pour-over" will accompany this agreement.'],
    ],
    discuss: [
      'Who is the successor trustee — and do they know where things are?',
      'Which accounts and the home should be retitled into the trust ("funding") — the most commonly skipped step?',
      'Should beneficiaries receive assets outright or in stages (e.g. ⅓ at 25/30/35)?',
      'Does the household\'s net worth or state make probate avoidance worth the setup cost?',
    ],
  },
  poa: {
    title: 'Durable Power of Attorney',
    what: 'Authorizes someone you trust (your "agent") to handle financial and legal matters if you cannot — paying bills, managing accounts, filing taxes. "Durable" means it keeps working through incapacity, which is the whole point.',
    sections: [
      ['1. Principal and agent', 'I, [Full Legal Name], appoint [Agent Name] as my agent (attorney-in-fact), with [Alternate Name] as successor if they cannot serve.'],
      ['2. Powers granted', 'My agent may act for me in: banking and financial transactions; real property; tax matters; retirement accounts; insurance; government benefits; and digital assets. [Initial each power per state form.]'],
      ['3. Durability', 'This power of attorney shall not be affected by my subsequent disability or incapacity.'],
      ['4. Effective date', '[Immediately upon signing] / [Only upon a physician\'s certification of incapacity ("springing")].'],
      ['5. Execution', 'Signed on [Date] before a notary public. [Many banks also have their own POA forms — ask yours.]'],
    ],
    discuss: [
      'Who has the financial judgment AND availability to act — often a different best answer than the will\'s executor?',
      'Effective immediately vs. "springing" at incapacity — springing sounds safer but can be slow exactly when speed matters.',
      'Has the named agent\'s contact info been shared with the financial institutions?',
    ],
  },
  healthcareDirective: {
    title: 'Advance Healthcare Directive',
    what: 'Combines a healthcare power of attorney (who decides for you) with a living will (what you want) — so medical decisions during incapacity follow your wishes, not a guess made under stress.',
    sections: [
      ['Part 1 — Healthcare agent', 'I, [Full Legal Name], appoint [Agent Name] to make healthcare decisions for me when I cannot, with [Alternate Name] as successor.'],
      ['Part 2 — Treatment preferences', 'If I have an end-stage condition with no reasonable expectation of recovery: [I do / do not] want life-sustaining treatment; [I do / do not] want artificial nutrition and hydration; I want medication to keep me comfortable in all cases.'],
      ['Part 3 — Organ donation', '[I do / do not] wish to donate organs and tissue.'],
      ['Part 4 — HIPAA release', 'My agent may receive my protected health information as my personal representative.'],
      ['Part 5 — Execution', 'Signed on [Date] with witnessing/notarization per state law. Copies should go to the agent, alternates, and primary physician.'],
    ],
    discuss: [
      'Who stays calm in a hospital hallway — the agent needs to advocate, not just decide?',
      'Have you actually TALKED with the agent about what "quality of life" means to you?',
      'Does your physician and hospital system have a copy on file?',
    ],
  },
  beneficiaries: {
    title: 'Beneficiary Designation Review',
    what: 'Retirement accounts, life insurance, HSAs, and TOD/POD accounts pass by their beneficiary forms — OUTSIDE the will or trust. An outdated form overrides everything else, which is why this review is on the checklist.',
    sections: [
      ['Worksheet — one row per account', 'For each: institution · account type · primary beneficiary (% share) · contingent beneficiary (% share) · date last confirmed.'],
      ['401(k) / 403(b)', 'Primary: [Name, 100%]. Contingent: [Name(s)]. Note: federal law generally requires spousal consent to name a non-spouse primary.'],
      ['IRA / Roth IRA', 'Primary: [Name]. Contingent: [Name(s)]. Consider per-stirpes language so a predeceased child\'s share passes to their children.'],
      ['Life insurance', 'Primary: [Name]. Contingent: [Trust / Name]. Minor children generally should NOT be named directly — proceeds may end up in a court-supervised account.'],
      ['HSA · TOD/POD accounts', 'Primary: [Name]. A spouse inherits an HSA as an HSA; anyone else inherits it as taxable income — worth a conversation.'],
    ],
    discuss: [
      'Any ex-spouses, deceased relatives, or "estate" still named on old forms?',
      'Are contingents named everywhere, or does one missing form send money through probate?',
      'Do designations agree with the will/trust, or quietly contradict them?',
    ],
  },
};

function openEstateSample(key) {
  const s = ESTATE_SAMPLES[key];
  if (!s) return;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  _openPrint(`Sample — ${s.title}`, `
    <div class="sample-banner">SAMPLE DOCUMENT — FOR DISCUSSION ONLY. This is an illustration to support a planning
    conversation. It is not a legal document, not legal advice, and not state-specific. Estate documents should be
    prepared and executed with a licensed estate-planning attorney.</div>
    <div class="rpt-head">
      <div><h1>${escapeHtml(s.title)}</h1><div class="sub">Sample for discussion &middot; Opened ${date}</div></div>
      <div class="rpt-meta">Prism Advisor Workspace<br/>Illustrative only</div>
    </div>
    <div class="note-block">${escapeHtml(s.what)}</div>
    ${s.sections.map(([h, b]) => `
      <div class="section-lbl">${escapeHtml(h)}</div>
      <div class="mtg-notes">${escapeHtml(b)}</div>`).join('')}
    <div class="section-lbl">What to discuss with your advisor</div>
    ${s.discuss.map(d => `<div class="task"><span class="check">○</span><span>${escapeHtml(d)}</span></div>`).join('')}
    <div class="sample-banner">SAMPLE — not a legal document. Execution belongs with a licensed estate-planning attorney.</div>
    <div class="footer">Illustrative sample for planning discussion. Prism Advisor Workspace.</div>
  `, { autoPrint: false });
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
    <div class="rpt-head">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">${escapeHtml(client.tag)} &middot; Generated ${date}</div></div>
      <div class="rpt-meta">Prism Advisor Workspace<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">AUM</div><div class="stat-val">${fmt$(client.aum, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Current Horizon</div><div class="stat-val sv13">Phase ${escapeHtml(phase.num)} &middot; ${escapeHtml(phase.title)}</div></div>
      <div class="stat"><div class="stat-lbl">Uninvested cash</div><div class="stat-val ${client.uninvestedCash > 80000 ? 'bad' : ''}">${fmt$(client.uninvestedCash, { short: true })}</div></div>
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
      <div class="stat"><div class="stat-lbl">Liquidity reserve</div><div class="stat-val sv15">${fmt$(n.reserve, { short: true })} <span class="sv-sub">/ ${fmt$(n.reserveTarget, { short: true })}</span></div></div>
      <div class="stat"><div class="stat-lbl">Retirement assets</div><div class="stat-val">${fmt$(n.retirementAssets, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Taxable assets</div><div class="stat-val">${fmt$(n.taxableBalance, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Monthly surplus</div><div class="stat-val ${(n.surplus || 0) < 0 ? 'bad' : 'ok'}">${fmt$(n.surplus)}</div></div>
    </div>` : '';

  _openPrint(`Milestone Report — Phase ${escapeHtml(phase.num)}`, `
    <div class="rpt-head">
      <div>
        <div class="ms-tag">Milestone Achieved &middot; Phase ${escapeHtml(phase.num)}</div>
        <h1>${escapeHtml(phase.title)}</h1>
        <div class="sub">Reviewed ${date} &middot; ${escapeHtml(advisorName)}${advisorFirm ? ', ' + escapeHtml(advisorFirm) : ''}</div>
      </div>
      <div class="rpt-meta">Prism Advisor Workspace<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Tasks completed</div><div class="stat-val">${completed.length} / ${phase.tasks.length}</div></div>
      <div class="stat"><div class="stat-lbl">Phase</div><div class="stat-val">${escapeHtml(phase.num)}</div></div>
      <div class="stat"><div class="stat-lbl">Status</div><div class="stat-val sv14 ok">&#10003; Complete</div></div>
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
          <span class="mut fs11 nw">${new Date(e.occurred_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span class="f140">${escapeHtml(AUDIT_ACTION_LABELS[e.action] || e.action)}</span>
          <span class="mut">${escapeHtml(e.actor_email || '')}</span>
          <span>${escapeHtml(e.summary || '')}</span>
        </div>`).join('')
    : '<div class="task mut2">No recorded actions for this client.</div>';
  const meetingsHtml = (meetings || []).length
    ? `<div class="section-lbl">Meeting record</div>${(meetings || []).map(m => `
        <div class="mtg"><div class="mtg-date">${new Date(m.met_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${m.duration_min ? ` &middot; ${Number(m.duration_min)} min` : ''}</div>${m.notes ? `<div class="mtg-notes">${escapeHtml(m.notes)}</div>` : ''}</div>`).join('')}`
    : '';

  _openPrint(`Compliance Record — ${escapeHtml(client.name)}`, `
    <div class="rpt-head">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">Compliance & audit record &middot; Generated ${date}</div></div>
      <div class="rpt-meta">Prism Advisor Workspace<br/>Confidential &middot; SEC 17a-3 / 17a-4</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Household tag</div><div class="stat-val sv13">${escapeHtml(client.tag || '—')}</div></div>
      <div class="stat"><div class="stat-lbl">Audited actions</div><div class="stat-val">${(auditEntries || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Profile versions</div><div class="stat-val">${Number(versionCount) || 0}</div></div>
    </div>
    <div class="section-lbl">Audit trail (append-only)</div>
    ${auditRows}
    ${meetingsHtml}
    <div class="footer">Records are retained and never erased per SEC Rule 17a-4. This export reflects the append-only audit trail as of generation time. Prism Advisor Workspace.</div>
  `);
}

// Exam-ready books-&-records packet (SEC/state exam). One click from firm admin:
// firm inventory (advisors, clients, fee schedules), billing record, every
// acknowledgement with its signature state, and the append-only audit trail over
// the chosen window — plus the WORM-retention statement. A pure renderer; the
// firm-admin view gathers the pieces.
//   opts: { firmName, generatedBy, rangeLabel, advisors, clients, feeSchedules,
//           invoices, acknowledgements, auditEntries, auditTruncated }
function printExamPacket(opts) {
  const o = opts || {};
  const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const d = (iso, t) => iso ? new Date(iso).toLocaleString('en-US', t ? { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const clientName = (c) => escapeHtml(c?.short_name || c?.household_name || 'Client');

  const advisorsHtml = (o.advisors || []).map(a => `
    <div class="task"><span class="f140">${escapeHtml(a.full_name || '')}</span>
      <span class="mut">${escapeHtml(a.email || '')}</span>
      <span class="mut fs11">${escapeHtml(a.role || 'advisor')}${a.credentials ? ' · ' + escapeHtml(a.credentials) : ''}</span></div>`).join('')
    || '<div class="task mut2">No advisors on record.</div>';

  const schedById = Object.fromEntries((o.feeSchedules || []).map(s => [s.id, s]));
  const schedulesHtml = (o.feeSchedules || []).map(s => `
    <div class="task"><span class="f140">${escapeHtml(s.name || '')}</span>
      <span class="mut">${escapeHtml(s.frequency || '')} · ${escapeHtml(s.basis || '')}</span>
      <span>${(s.tiers || []).map(t => `${Number(t.annual_bps) || 0} bps${t.up_to ? ` ≤ ${fmt$(t.up_to, { short: true })}` : ' above'}`).join(' / ')}</span></div>`).join('')
    || '<div class="task mut2">No fee schedules defined.</div>';

  const clientsHtml = (o.clients || []).map(c => `
    <div class="task"><span class="f140">${clientName(c)}</span>
      <span class="mut">${fmt$(Number(c.aum) || 0, { short: true })} AUM</span>
      <span>${c.fee_schedule_id && schedById[c.fee_schedule_id] ? escapeHtml(schedById[c.fee_schedule_id].name) : '<i>no fee schedule assigned</i>'}</span></div>`).join('')
    || '<div class="task mut2">No active clients.</div>';

  const invoicesHtml = (o.invoices || []).length
    ? (o.invoices || []).map(i => `
        <div class="task"><span class="f140">${clientName(i.clients)}</span>
          <span class="mut fs11 nw">${d(i.period_start)} – ${d(i.period_end)}</span>
          <span class="mut">${fmt$(i.fee_amount)}</span>
          <span>${escapeHtml(i.status || '')}</span></div>`).join('')
    : '<div class="task mut2">No invoices generated.</div>';

  const acksHtml = (o.acknowledgements || []).length
    ? (o.acknowledgements || []).map(a => `
        <div class="task"><span class="f140">${clientName(a.clients)}</span>
          <span>${escapeHtml(a.title || '')}</span>
          <span class="mut fs11 nw">req ${d(a.requested_at)}</span>
          <span class="mut">${a.status === 'signed' || a.acknowledged_at
            ? `signed ${d(a.acknowledged_at)}${a.signer_name ? ' · ' + escapeHtml(a.signer_name) : ''}${a.provider === 'docusign' ? ' · DocuSign' : ''}`
            : escapeHtml(a.envelope_status || a.status || 'pending')}</span></div>`).join('')
    : '<div class="task mut2">No acknowledgements requested.</div>';

  const auditHtml = (o.auditEntries || []).length
    ? (o.auditEntries || []).map(e => `
        <div class="task"><span class="mut fs11 nw">${d(e.occurred_at, true)}</span>
          <span class="f140">${escapeHtml(AUDIT_ACTION_LABELS[e.action] || e.action)}</span>
          <span class="mut">${escapeHtml(e.actor_email || '')}</span>
          <span>${escapeHtml(e.summary || '')}</span></div>`).join('')
    : '<div class="task mut2">No audit entries in this window.</div>';

  _openPrint(`Exam Packet — ${escapeHtml(o.firmName || 'Firm')}`, `
    <div class="rpt-head">
      <div><h1>${escapeHtml(o.firmName || 'Firm')}</h1>
        <div class="sub">Books &amp; records packet · ${escapeHtml(o.rangeLabel || '')} · Generated ${date}${o.generatedBy ? ` by ${escapeHtml(o.generatedBy)}` : ''}</div></div>
      <div class="rpt-meta">Prism Advisor Workspace<br/>Confidential · SEC 17a-3 / 17a-4</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Advisors</div><div class="stat-val">${(o.advisors || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Active clients</div><div class="stat-val">${(o.clients || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Acknowledgements</div><div class="stat-val">${(o.acknowledgements || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Audited actions</div><div class="stat-val">${(o.auditEntries || []).length}${o.auditTruncated ? '+' : ''}</div></div>
    </div>
    <div class="section-lbl">1 · Advisor roster</div>${advisorsHtml}
    <div class="section-lbl">2 · Fee schedules</div>${schedulesHtml}
    <div class="section-lbl">3 · Client inventory &amp; fee assignment</div>${clientsHtml}
    <div class="section-lbl">4 · Advisory-fee invoices</div>${invoicesHtml}
    <div class="section-lbl">5 · Disclosures &amp; acknowledgements (e-sign record)</div>${acksHtml}
    <div class="section-lbl">6 · Audit trail (append-only)${o.auditTruncated ? ' — most recent entries; full history retained' : ''}</div>${auditHtml}
    <div class="section-lbl">7 · Retention statement</div>
    <div class="rpt-p">The audit trail is an append-only ledger (no update or delete policy exists on the table).
      A scheduled export writes each day's entries to a private write-once storage bucket per SEC Rule 17a-4
      retention practice. Client profile changes are additionally versioned. Records are archived, never erased.</div>
    <div class="footer">This packet reflects the firm's books and records as of generation time and is intended for
      regulatory examination use. Prism Advisor Workspace.</div>
  `);
}

// Client-facing performance report — branded, printable PDF (Theme D, 18b).
// Takes pre-computed data so it has no dependency on where the math lives.
//   opts: { client, series:[{date,value}], periods:[{label,pct}], flows:[{flow_date,amount,kind}], advisorName, advisorFirm }
function printPerformanceReport(opts) {
  const { client, series = [], periods = [], flows = [], advisorName, advisorFirm } = opts || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const cur = series.length ? series[series.length - 1].value : 0;

  let chartHtml = '<div class="chart-empty">Not enough history to chart yet.</div>';
  if (series.length >= 2) {
    const W = 640, H = 170;
    const vals = series.map(p => p.value);
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1, n = series.length;
    const x = i => (i / (n - 1)) * W;
    const y = v => H - ((v - min) / range) * (H - 20) - 10;
    const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const up = vals[n - 1] >= vals[0], color = up ? '#3d5a4a' : '#8c3d3d';
    chartHtml = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="rpt-svg">
      <path d="${line} L${W},${H} L0,${H} Z" fill="${color}" opacity="0.08"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  const periodCells = (periods || []).map(s => {
    const has = s.pct != null && isFinite(s.pct), pos = (s.pct || 0) >= 0;
    return `<div class="stat"><div class="stat-lbl">${escapeHtml(s.label)}</div><div class="stat-val ${!has ? 'mut2' : pos ? 'ok' : 'bad'}">${has ? `${pos ? '+' : ''}${s.pct.toFixed(1)}%` : '—'}</div></div>`;
  }).join('');

  const capital = (flows || []).filter(f => f.kind !== 'fee');
  const fees    = (flows || []).filter(f => f.kind === 'fee').reduce((s, f) => s + Math.abs(Number(f.amount) || 0), 0);
  const contrib = capital.filter(f => Number(f.amount) > 0).reduce((s, f) => s + Number(f.amount), 0);
  const withdr  = capital.filter(f => Number(f.amount) < 0).reduce((s, f) => s + Math.abs(Number(f.amount)), 0);
  const netOfFees = fees > 0;

  _openPrint(`Performance Report — ${escapeHtml(client.name)}`, `
    <div class="rpt-head">
      <div><h1>${escapeHtml(client.name)}</h1><div class="sub">Performance report &middot; ${date}</div></div>
      <div class="rpt-meta">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}${advisorName ? `<br/>Prepared by ${escapeHtml(advisorName)}` : ''}</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Portfolio value</div><div class="stat-val">${fmt$(cur, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Net contributions</div><div class="stat-val sv15">${fmt$(contrib - withdr, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">As of</div><div class="stat-val sv13">${date}</div></div>
    </div>
    <div class="section-lbl">Portfolio value over time</div>
    ${chartHtml}
    <div class="section-lbl mt22">Time-weighted return${netOfFees ? ' &middot; net of advisory fees' : ''}</div>
    <div class="grid grid5">${periodCells}</div>
    <div class="section-lbl mt22">Cash flow summary</div>
    <div class="rpt-p">Contributions: <b>${fmt$(contrib, { short: true })}</b> &nbsp;&middot;&nbsp; Withdrawals: <b>${fmt$(withdr, { short: true })}</b>${netOfFees ? ` &nbsp;&middot;&nbsp; Advisory fees: <b>${fmt$(fees, { short: true })}</b>` : ''}</div>
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
    const tone = pct === 100 ? 'ok' : pct > 0 ? 'warn' : 'mut2';
    return `<div class="task"><span class="f1">Phase ${escapeHtml(p.num)} · ${escapeHtml(p.title)}</span>
      <span class="${tone} b6">${p.completed}/${p.total} · ${pct}%</span></div>`;
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
      <div class="rpt-p">${pct}% funded &middot; <b>${escapeHtml(r.verdict)}</b>${r.lasts ? ' — plan funded through age 95' : (r.depletionAge ? ` — projected to age ${r.depletionAge}` : '')}${band}</div>`;
  }

  // Goals
  const goalsHtml = (o.goals || []).length
    ? `<div class="section-lbl">Goals</div>${o.goals.map(g => `
        <div class="task"><span class="f1">${escapeHtml(g.label)}</span><span class="mut">${g.pct}% · ${escapeHtml(g.status)}</span></div>`).join('')}`
    : '';

  // Protection & estate — phrased so a $0 / not-yet-captured figure never reads
  // as "well covered". Three life-coverage states: not captured, gap, on guideline.
  let protHtml = '';
  if (o.protection) {
    const p = o.protection;
    let lifeLine;
    if (!p.captured) {
      // No life policies recorded and no income guideline to compare against.
      lifeLine = `<span class="mut">Life coverage — not yet captured.</span> Gather in-force policy details (or confirm none) so the plan reflects how the household is protected.`;
    } else if (p.gap > 0) {
      lifeLine = `Life coverage ${fmt$(p.lifeCoverage, { short: true })}${p.recommended > 0 ? ` of ${fmt$(p.recommended, { short: true })} guideline` : ''} &middot; <b>gap ${fmt$(p.gap, { short: true })}</b> — worth reviewing whether to add coverage.`;
    } else {
      lifeLine = `Life coverage ${fmt$(p.lifeCoverage, { short: true })}${p.recommended > 0 ? ` &middot; meets the ~10&times; income guideline` : ''}.`;
    }
    const other = [];
    if (p.disabilityCount) other.push(`${p.disabilityCount} disability`);
    if (p.ltcCount) other.push(`${p.ltcCount} long-term care`);
    const otherLine = other.length ? `<div class="rpt-p mut2">Also in place: ${other.join(' &middot; ')} cover.</div>` : '';
    const estItems = Array.isArray(p.estateItems) ? p.estateItems : [];
    const estList = estItems.length
      ? `<div class="grid grid5 mt10">${estItems.map(it => {
          // ✓ shared · ◦ held but not shared (hollow) · … in progress · — to do
          const done = it.status === 'complete', priv = it.status === 'have_unshared', prog = it.status === 'in_progress';
          const mark = done ? '&#10003;' : priv ? '&#9675;' : prog ? '&hellip;' : '&mdash;';
          const cls = done ? 'ok' : priv ? 'ok' : prog ? '' : 'mut2';
          const sub = priv ? '<div class="stat-lbl mut2" style="font-size:9px">private</div>' : '';
          return `<div class="stat"><div class="stat-lbl">${escapeHtml(it.label)}</div><div class="stat-val ${cls}" style="font-size:15px">${mark}</div>${sub}</div>`;
        }).join('')}</div>`
      : '';
    protHtml = `<div class="section-lbl">Protection &amp; estate</div>
      <div class="rpt-p">${lifeLine}</div>
      ${otherLine}
      <div class="section-lbl mt18">Estate readiness &middot; ${p.estateComplete} of ${p.estateTotal} in place</div>
      ${estList}`;
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
    chartHtml = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="rpt-svg">
      <path d="${line} L${W},${H} L0,${H} Z" fill="${color}" opacity="0.08"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  const netOfFees = (flows || []).some(f => f.kind === 'fee');
  const periodCells = periods.map(s => {
    const has = s.pct != null && isFinite(s.pct), pos = (s.pct || 0) >= 0;
    return `<div class="stat"><div class="stat-lbl">${escapeHtml(s.label)}</div><div class="stat-val ${!has ? 'mut2' : pos ? 'ok' : 'bad'}">${has ? `${pos ? '+' : ''}${s.pct.toFixed(1)}%` : '—'}</div></div>`;
  }).join('');
  const perfHtml = series.length >= 2
    ? `<div class="section-lbl">Performance — portfolio value</div>${chartHtml}
       <div class="section-lbl mt18">Time-weighted return${netOfFees ? ' &middot; net of advisory fees' : ''}</div>
       <div class="grid grid5">${periodCells}</div>`
    : '';

  // Plan flags — concentrated equity comp + the projected first RMD (advisor
  // talking points the front sections don't carry; rendered only when present).
  const _planFlagsHtml = (pf) => {
    if (!pf || (!pf.equityConcentration && !pf.rmd && !(pf.tax1040 || []).length)) return '';
    const lines = [];
    // 1040 observations (Holistiplan-lite) — the same flags the client's
    // tax-return tool shows, carried into the review packet (top 3, non-info).
    for (const ob of (pf.tax1040 || []).slice(0, 3)) {
      lines.push(`<div class="rpt-p">1040 &middot; <b>${escapeHtml(ob.title)}</b> — ${escapeHtml(ob.detail)}</div>`);
    }
    if (pf.equityConcentration) {
      const ec = pf.equityConcentration;
      lines.push(`<div class="rpt-p">Concentrated position${pf.equityTicker ? ` (${escapeHtml(pf.equityTicker)})` : ''}: <b>${ec.concentrationPct.toFixed(0)}% of invested assets</b>${ec.concentrated ? ` — above the ${ec.thresholdPct}% guideline` : ''} &middot; embedded gain ${fmt$(ec.gain, { short: true })} &middot; est. tax to trim to ${ec.thresholdPct}% ≈ ${fmt$(ec.taxToTrim, { short: true })}.</div>`);
    }
    if (pf.rmd && pf.rmd.firstRmd) {
      const fr = pf.rmd.firstRmd;
      lines.push(`<div class="rpt-p">Projected first RMD at age ${fr.age}: <b>≈ ${fmt$(fr.amount, { short: true })}/yr</b> on a tax-deferred balance growing to ${fmt$(fr.balance, { short: true })} — frames the Roth-conversion window in the years before.</div>`);
    }
    return `<div class="section-lbl">Plan flags</div>${lines.join('')}`;
  };
  const planFlagsHtml = _planFlagsHtml(o.planFlags);

  // Risk allocation
  const allocHtml = (o.risk && o.risk.allocation)
    ? `<div class="section-lbl">Strategic allocation (${escapeHtml(o.risk.band)})</div>
       <div class="rpt-p">Equity ${o.risk.allocation.equity}% &middot; Fixed income ${o.risk.allocation.fixedIncome}% &middot; Cash ${o.risk.allocation.cash}%</div>`
    : '';

  _openPrint(`Quarterly Review — ${escapeHtml(client.name)}`, `
    <div class="rpt-head">
      <div><h1>Quarterly Business Review</h1><div class="sub">${escapeHtml(client.name)} &middot; ${date}</div></div>
      <div class="rpt-meta">${escapeHtml(o.advisorFirm || 'Prism Advisor Workspace')}${o.advisorName ? `<br/>Prepared by ${escapeHtml(o.advisorName)}` : ''}<br/>Confidential</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Net worth</div><div class="stat-val">${fmt$(o.netWorth, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Managed assets</div><div class="stat-val">${fmt$(o.aum, { short: true })}</div></div>
      <div class="stat"><div class="stat-lbl">Current horizon</div><div class="stat-val sv13">Phase ${escapeHtml(o.phase?.num || '—')} · ${escapeHtml(o.phase?.title || '')}</div></div>
    </div>
    <div class="section-lbl">Plan progress</div>
    ${phaseRows}
    ${readinessHtml}
    ${allocHtml}
    ${planFlagsHtml}
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
  const { client, risk, planningAge, retireAt, planFlags, advisorName, advisorFirm } = opts || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const a = risk?.allocation || { equity: 60, fixedIncome: 35, cash: 5 };
  const horizon = (retireAt && planningAge) ? Math.max(0, retireAt - planningAge) : null;
  const allocRows = [
    ['Equity (global, diversified)', a.equity],
    ['Fixed income / bonds', a.fixedIncome],
    ['Cash & equivalents', a.cash],
  ].map(([label, pct]) => `
    <div class="task"><span class="f1">${escapeHtml(label)}</span><span class="b6">${pct}%</span></div>`).join('');

  _openPrint(`Investment Policy Statement — ${escapeHtml(client.name)}`, `
    <div class="rpt-head">
      <div><h1>Investment Policy Statement</h1><div class="sub">${escapeHtml(client.name)} &middot; Draft ${date}</div></div>
      <div class="rpt-meta">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}${advisorName ? `<br/>Prepared by ${escapeHtml(advisorName)}` : ''}<br/>DRAFT — for review</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Risk profile</div><div class="stat-val sv15">${escapeHtml(risk?.band || '—')}</div></div>
      <div class="stat"><div class="stat-lbl">Risk score</div><div class="stat-val">${risk?.score != null ? risk.score + ' / 100' : '—'}</div></div>
      <div class="stat"><div class="stat-lbl">Time horizon</div><div class="stat-val sv15">${horizon != null ? `${horizon} yrs to retirement` : 'Long-term'}</div></div>
    </div>
    <div class="section-lbl">1 · Purpose</div>
    <div class="rpt-p">This Investment Policy Statement sets the objectives, risk tolerance, and target asset allocation for the assets managed on behalf of ${escapeHtml(client.name)}. It is a working framework reviewed with the advisor and updated as circumstances change.</div>
    <div class="section-lbl">2 · Investment objective &amp; risk tolerance</div>
    <div class="rpt-p">Based on a completed risk questionnaire, the household's tolerance is assessed as <b>${escapeHtml(risk?.band || 'Balanced')}</b>. The portfolio is constructed to pursue long-term growth consistent with this tolerance${horizon != null ? ` over an approximately ${horizon}-year horizon to retirement` : ''}, accepting the interim volatility this allocation implies.</div>
    <div class="section-lbl">3 · Target strategic asset allocation</div>
    <div class="task task-head"><span class="f1">Asset class</span><span>Target</span></div>
    ${allocRows}
    <div class="section-lbl">4 · Rebalancing</div>
    <div class="rpt-p">Allocations are reviewed at least annually and rebalanced when any asset class drifts more than ±5% from its target, or upon a material change in the household's circumstances.</div>
    ${(planFlags && (planFlags.equityConcentration || (planFlags.rmd && planFlags.rmd.firstRmd))) ? `
      <div class="section-lbl">5 · Concentrated positions &amp; distributions</div>
      ${planFlags.equityConcentration ? `<div class="rpt-p">The household holds a concentrated single-stock position${planFlags.equityTicker ? ` (${escapeHtml(planFlags.equityTicker)})` : ''} at ${planFlags.equityConcentration.concentrationPct.toFixed(0)}% of invested assets (guideline ≤ ${planFlags.equityConcentration.thresholdPct}%). Diversification is managed deliberately against the embedded gain of ${fmt$(planFlags.equityConcentration.gain, { short: true })} — estimated tax to trim to guideline ≈ ${fmt$(planFlags.equityConcentration.taxToTrim, { short: true })}.</div>` : ''}
      ${(planFlags.rmd && planFlags.rmd.firstRmd) ? `<div class="rpt-p">Required minimum distributions are projected to begin at age ${planFlags.rmd.firstRmd.age} at approximately ${fmt$(planFlags.rmd.firstRmd.amount, { short: true })}/yr; the drawdown and Roth-conversion strategy is coordinated against this horizon.</div>` : ''}
    ` : ''}
    <div class="section-lbl">${(planFlags && (planFlags.equityConcentration || (planFlags.rmd && planFlags.rmd.firstRmd))) ? 6 : 5} · Review &amp; acknowledgement</div>
    <div class="rpt-p">This statement is reviewed at each periodic meeting. By signing, the client acknowledges they have reviewed and agree to this policy as a basis for ongoing management.</div>
    <div class="sig-row">
      <div class="sig">Client signature &amp; date</div>
      <div class="sig">Advisor signature &amp; date</div>
    </div>
    <div class="footer">Draft Investment Policy Statement generated by Prism Advisor Workspace${advisorFirm ? ' &middot; ' + escapeHtml(advisorFirm) : ''}. This draft is informational, is not investment advice, and is finalized only upon signature by both parties.</div>
  `);
}

// Prospect proposal packet — the close-the-deal print for proposal mode. One
// click from the prospect banner: where the household stands today, the
// seven-horizon roadmap they'd be working, what working together looks like,
// and the fee schedule. A pure renderer like printQBRReport — the portal view
// gathers the pieces from useProfile + the firm's fee schedules.
//   opts: { client, phase, phases:[{num,title,total}], netWorth, invested,
//           reserve, surplus, readiness, successBand, risk,
//           feeSchedule:{name,tiers}|null, feeIllustrative, advisorName, advisorFirm }
function printProposalPacket(opts) {
  const o = opts || {};
  const client = o.client || {};
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Roadmap preview — the seven horizons, with the prospect's starting point marked.
  const phaseRows = (o.phases || []).map(p => {
    const current = o.phase && p.num === o.phase.num;
    return `<div class="task"><span class="f1${current ? ' b6' : ''}">Phase ${escapeHtml(p.num)} · ${escapeHtml(p.title)}</span>
      <span class="${current ? 'ok b6' : 'mut2'}">${current ? 'your starting point' : `${p.total} milestones`}</span></div>`;
  }).join('');

  // Readiness snapshot — only when there are numbers behind it.
  let readinessHtml = '';
  if (o.readiness && (o.invested > 0 || o.netWorth > 0)) {
    const r = o.readiness;
    const pct = Math.round((r.fundedRatio || 0) * 100);
    const band = o.successBand
      ? ` &middot; Monte Carlo success ${Math.round(o.successBand.successPct)}%`
      : '';
    readinessHtml = `<div class="section-lbl">Retirement readiness — where you stand today</div>
      <div class="rpt-p">${pct}% funded &middot; <b>${escapeHtml(r.verdict)}</b>${r.lasts ? ' — plan funded through age 95' : (r.depletionAge ? ` — projected to age ${r.depletionAge}` : '')}${band}. This is the baseline we would work from together — every milestone on the roadmap moves this number.</div>`;
  }

  const allocHtml = (o.risk && o.risk.allocation && o.risk.score != null)
    ? `<div class="section-lbl">A starting allocation matched to you (${escapeHtml(o.risk.band)})</div>
       <div class="rpt-p">Equity ${o.risk.allocation.equity}% &middot; Fixed income ${o.risk.allocation.fixedIncome}% &middot; Cash ${o.risk.allocation.cash}% — refined together in a full Investment Policy Statement.</div>`
    : '';

  // Fee schedule — the firm's real tiers when one exists; an illustrative
  // default otherwise, labelled as such.
  let feeHtml = '';
  const tiers = Array.isArray(o.feeSchedule?.tiers) ? o.feeSchedule.tiers : [];
  if (tiers.length) {
    let prev = 0;
    const rows = tiers.map(t => {
      const cap = (t.up_to == null || t.up_to === '') ? null : Number(t.up_to);
      const label = cap == null
        ? (prev > 0 ? `Above ${fmt$(prev, { short: true })}` : 'All assets')
        : (prev > 0 ? `${fmt$(prev, { short: true })} – ${fmt$(cap, { short: true })}` : `First ${fmt$(cap, { short: true })}`);
      prev = cap == null ? prev : cap;
      return `<div class="task"><span class="f1">${label}</span><span class="b6">${((Number(t.annual_bps) || 0) / 100).toFixed(2)}% / yr</span></div>`;
    }).join('');
    const est = (o.invested > 0 && window.PrismCalc?.annualFeeForAum)
      ? window.PrismCalc.annualFeeForAum(tiers, o.invested) : 0;
    feeHtml = `<div class="section-lbl">Fee schedule${o.feeIllustrative ? ' (illustrative)' : o.feeSchedule?.name ? ` — ${escapeHtml(o.feeSchedule.name)}` : ''}</div>
      <div class="task task-head"><span class="f1">Assets under management</span><span>Annual fee</span></div>
      ${rows}
      ${est > 0 ? `<div class="rpt-p mut2">On roughly ${fmt$(o.invested, { short: true })} of invested assets, that works out to about ${fmt$(est)} per year — fully transparent, billed quarterly, and itemized on every invoice.</div>` : ''}
      ${o.feeIllustrative ? `<div class="rpt-p mut2">Final pricing is confirmed in your advisory agreement.</div>` : ''}`;
  }

  _openPrint(`Proposal — ${escapeHtml(client.name)}`, `
    <div class="rpt-head">
      <div><h1>Working Together — A Proposal</h1><div class="sub">Prepared for ${escapeHtml(client.name)} &middot; ${date}</div></div>
      <div class="rpt-meta">${escapeHtml(o.advisorFirm || 'Prism Advisor Workspace')}${o.advisorName ? `<br/>Prepared by ${escapeHtml(o.advisorName)}` : ''}<br/>Confidential</div>
    </div>
    <div class="rpt-p">This proposal previews the plan we would build together: where your household stands today, the lifecycle roadmap we would work through, and exactly what the engagement costs. Nothing here is binding — it is what working together looks like, on paper.</div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Net worth today</div><div class="stat-val">${o.netWorth ? fmt$(o.netWorth, { short: true }) : '—'}</div></div>
      <div class="stat"><div class="stat-lbl">Invested assets</div><div class="stat-val">${o.invested ? fmt$(o.invested, { short: true }) : '—'}</div></div>
      <div class="stat"><div class="stat-lbl">Liquidity reserve</div><div class="stat-val">${o.reserve ? fmt$(o.reserve, { short: true }) : '—'}</div></div>
      <div class="stat"><div class="stat-lbl">Monthly surplus</div><div class="stat-val ${(o.surplus || 0) < 0 ? 'bad' : 'ok'}">${o.surplus != null && o.surplus !== 0 ? fmt$(o.surplus) : '—'}</div></div>
    </div>
    ${readinessHtml}
    <div class="section-lbl">Your roadmap — seven horizons, one coordinated plan</div>
    ${phaseRows}
    ${allocHtml}
    <div class="section-lbl">What working together looks like</div>
    <div class="rpt-p"><b>Onboarding (first 30 days)</b> — we capture the full household picture, agree an Investment Policy Statement, and stand up your client portal: your live roadmap, secure messaging, and document vault.</div>
    <div class="rpt-p"><b>Ongoing</b> — structured reviews each quarter with a written packet, milestone-by-milestone progress on the roadmap, and direct access to your advisor between meetings. Every recommendation is documented and every fee is itemized.</div>
    <div class="rpt-p"><b>Fiduciary, always</b> — advice is delivered net of a transparent advisory fee, with no commissions and no product sales.</div>
    ${feeHtml}
    <div class="footer">This proposal is illustrative, is not investment advice, and does not establish an advisory relationship — that begins with a signed advisory agreement. Figures reflect the information provided to date. ${escapeHtml(o.advisorFirm || 'Prism Advisor Workspace')} &middot; ${date}.</div>
  `);
}

// Branded advisory-fee invoice (Theme D, 18d)
function printInvoiceReport(invoice, clientName, advisorFirm) {
  const fmtD = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const num = ('INV-' + String(invoice.id).replace(/-/g, '').slice(0, 8)).toUpperCase();
  _openPrint(`Invoice ${num}`, `
    <div class="rpt-head mb24">
      <div><h1>Invoice</h1><div class="sub">${num} &middot; Issued ${fmtD(invoice.created_at || new Date())}</div></div>
      <div class="rpt-meta2">${escapeHtml(advisorFirm || 'Prism Advisor Workspace')}<br/>Advisory fee statement</div>
    </div>
    <div class="grid">
      <div class="stat"><div class="stat-lbl">Bill to</div><div class="stat-val sv14">${escapeHtml(clientName || 'Client')}</div></div>
      <div class="stat"><div class="stat-lbl">Billing period</div><div class="stat-val sv13">${fmtD(invoice.period_start)} – ${fmtD(invoice.period_end)}</div></div>
      <div class="stat"><div class="stat-lbl">Status</div><div class="stat-val sv14 sv-cap">${escapeHtml(invoice.status || 'draft')}</div></div>
    </div>
    <div class="section-lbl">Detail</div>
    <div class="task task-head">
      <span class="f1">Description</span><span>Amount</span>
    </div>
    <div class="task">
      <span class="f1">Advisory fee on billing assets of ${fmt$(invoice.basis_amount, { short: true })}</span>
      <span class="b6">${fmt$(invoice.fee_amount)}</span>
    </div>
    <div class="task task-total">
      <span class="f1 b7 fs14">Total due</span>
      <span class="b7 fs16">${fmt$(invoice.fee_amount)}</span>
    </div>
    <div class="footer">Advisory fees are calculated per your firm's fee schedule. Questions? Contact your advisor. Prism Advisor Workspace${advisorFirm ? ' &middot; ' + escapeHtml(advisorFirm) : ''}.</div>
  `);
}

Object.assign(window, {
  ProfileProvider, useProfile, emptyProfile, mergeProfile, openEstateSample,
  TaskProvider, useTasks,
  ViewProvider, useView,
  NotificationProvider, useNotifications,
  useTheme,
  applyFirmBrand, useFirmBrand,
  printClientReport,
  printMilestoneReport,
  printComplianceReport,
  printExamPacket,
  printPerformanceReport,
  printInvoiceReport,
  printQBRReport,
  printIPSReport,
  printProposalPacket,
  escapeHtml, sanitizeHtml,
  fmt$, fmtPct, fmtN,
});

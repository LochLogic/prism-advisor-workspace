// Prism — Client Portal (View B). The collaborative roadmap shown to clients.
// Phases, tasks, Discuss-with-Advisor flagging, advanced tools, milestone modal.

const PhaseCard = ({ phase, onOpenMilestone }) => {
  const { taskStates, toggleTask, openPhases, togglePhase, flagForAdvisor, isFlagged, activePhase } = useTasks();
  const { showToast } = useView();
  const ctx = useProfile();
  const [flagModal, setFlagModal] = React.useState(null); // { phaseId, taskId, label }
  const [flagText,  setFlagText]  = React.useState('');

  const isOpen = !!openPhases[phase.id];
  const completed = phase.tasks.filter(t => taskStates[phase.id]?.[t.id]).length;
  const progress = (completed / phase.tasks.length) * 100;
  const isComplete = completed === phase.tasks.length;
  const isActive = phase.id === activePhase;
  const isLocked = phase.id > activePhase + 1;

  const PhaseIcon = Icons[phase.icon] || Icons.Briefcase;
  const ToolComp = calculators[phase.calc];
  const ToolComp2 = phase.calc2 ? calculators[phase.calc2] : null;

  // Compute the metric value from the profile
  const metricValue = (() => {
    const v = ctx[phase.metricKey];
    if (v === undefined) return null;
    return fmt$(v, { short: true });
  })();

  // When clicking checkbox of last incomplete task → fire milestone
  const handleToggle = (taskId) => {
    const wasUnchecked = !taskStates[phase.id]?.[taskId];
    const willCompletePhase = wasUnchecked && completed + 1 === phase.tasks.length;
    toggleTask(phase.id, taskId);
    if (willCompletePhase) {
      setTimeout(() => onOpenMilestone(phase), 360);
    }
  };

  return (
    <div className={`px-phase ${isOpen ? 'is-open' : ''} ${isComplete ? 'is-done' : ''} ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}
         data-phase-id={phase.id}>
      <div className="px-phase-spine" />
      <div className="px-phase-node">
        {isComplete ? <Icons.Check size={10} strokeWidth={2.5} /> : phase.num}
      </div>

      <div className="px-phase-card">
        <button className="px-phase-head" onClick={() => togglePhase(phase.id)} aria-expanded={isOpen}>
          <div className="px-phase-title-block">
            <div className="px-phase-eyebrow">
              <span>Phase {phase.num}</span>
              <b>· {phase.tag}</b>
            </div>
            <h3 className="px-phase-title">{phase.title}</h3>
            <p className="px-phase-desc">{phase.description}</p>
          </div>
          <div className="px-phase-aside">
            {metricValue && (
              <div className="px-phase-metric">
                <div className="px-phase-metric-label">{phase.metricLabel}</div>
                <div className="px-phase-metric-value">{metricValue}</div>
              </div>
            )}
            <div className="px-phase-progress">
              <div className="px-phase-prog-bar">
                <div className="px-phase-prog-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="px-phase-prog-pct">{Math.round(progress)}%</span>
            </div>
            <span className="px-phase-chevron"><Icons.ChevronDown size={16} /></span>
          </div>
        </button>

        {isOpen && (
          <div className="px-phase-body">
            <div className="px-phase-rationale">
              <span className="px-phase-rationale-icon"><Icons.Sparkles size={14} /></span>
              <div className="px-phase-rationale-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.rationale) }} />
            </div>

            <div className="px-eyebrow" style={{ marginBottom: 8 }}>Milestones</div>
            <div className="px-tasks">
              {phase.tasks.map(task => {
                const done = !!taskStates[phase.id]?.[task.id];
                const flagged = isFlagged(phase.id, task.id);
                return (
                  <div key={task.id} className={`px-task ${done ? 'is-done' : ''}`}>
                    <button className="px-task-check" onClick={() => handleToggle(task.id)} aria-label="Toggle">
                      {done && <Icons.Check size={11} strokeWidth={3} />}
                    </button>
                    <span className="px-task-label">{task.label}</span>
                    {task.tool === 'advanced' && (
                      <button className="px-task-act is-discuss" title="Open the tool for this phase"
                        onClick={(e) => {
                          e.stopPropagation();
                          const el = document.getElementById(`tool-${phase.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el?.classList.add('px-tool-flash');
                          setTimeout(() => el?.classList.remove('px-tool-flash'), 1200);
                        }}>
                        <Icons.Sparkles size={10} /> Open tool
                      </button>
                    )}
                    {task.tool === 'discuss' && (
                      <button
                        className={`px-task-act ${flagged ? 'is-flagged' : 'is-discuss'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (flagged) {
                            flagForAdvisor(phase.id, task.id);
                            showToast('Question unflagged');
                          } else {
                            setFlagText('');
                            setFlagModal({ phaseId: phase.id, taskId: task.id, label: task.label });
                          }
                        }}
                        title={flagged ? 'Remove flag' : 'Discuss with your advisor'}
                      >
                        <Icons.Message size={11} />
                        {flagged ? 'Flagged' : 'Discuss with advisor'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {(ToolComp || ToolComp2) && (
              <div id={`tool-${phase.id}`}>
                {ToolComp && <ToolComp />}
                {ToolComp2 && <ToolComp2 />}
              </div>
            )}

            {isComplete && (
              <div className="px-phase-complete-cta">
                <span>
                  <Icons.CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Phase complete · reviewed with your advisor
                </span>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => onOpenMilestone(phase)}>
                  View summary report
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flag-for-advisor text capture modal */}
      {flagModal && (
        <div className="px-modal-backdrop" onClick={() => setFlagModal(null)}>
          <div className="px-modal" style={{ maxWidth: 420 }}
               onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="px-modal-close" onClick={() => setFlagModal(null)} aria-label="Close">×</button>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600,
                            color: 'var(--ink)', marginBottom: 4 }}>
                Discuss with your advisor
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                About: <em>{flagModal.label}</em>
              </div>
            </div>
            <textarea
              autoFocus
              placeholder="What would you like to discuss? (optional)"
              value={flagText}
              onChange={e => setFlagText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  flagForAdvisor(flagModal.phaseId, flagModal.taskId, flagText.trim());
                  showToast('Flagged for your advisor — visible in their inbox');
                  setFlagModal(null);
                }
              }}
              style={{
                width: '100%', minHeight: 84, padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
                background: 'var(--bg)', resize: 'vertical', marginBottom: 14,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="px-btn px-btn-ghost" onClick={() => setFlagModal(null)}>
                Cancel
              </button>
              <button className="px-btn px-btn-primary" onClick={() => {
                flagForAdvisor(flagModal.phaseId, flagModal.taskId, flagText.trim());
                showToast('Flagged for your advisor — visible in their inbox');
                setFlagModal(null);
              }}>
                <Icons.Message size={11} /> Send to advisor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Risk questionnaire (C4) ─────────────────────────────────────────
   Client-facing risk profiling. Each option is weighted 0..4; the summed
   score maps (in calc-core.riskProfile) to a band + strategic allocation that
   feeds the roadmap and the advisor's draft IPS. Plain-language, no jargon. */
const RISK_QUESTIONS = [
  { q: 'When you picture investing, which feels most like you?',
    options: ['Protecting what I have matters most', 'Mostly safety, a little growth',
      'A balance of growth and safety', 'Mostly growth — some ups and downs are fine',
      'Maximum growth — I can ride out big swings'] },
  { q: 'If your portfolio dropped 20% over a few months, you would…',
    options: ['Sell to stop further losses', 'Move some into safer holdings',
      'Wait and hold steady', "Do nothing — it's part of investing",
      'Invest more while prices are lower'] },
  { q: 'How would you describe your investing experience?',
    options: ['New to it', 'Some — mostly funds or a 401(k)',
      'Comfortable with a diversified portfolio', 'Experienced across asset classes',
      'Very experienced, including individual securities'] },
  { q: 'Which best describes what you want this money to do?',
    options: ["I'll need it fairly soon", 'Produce income and stay stable',
      'Grow steadily over the long term', 'Build wealth over decades',
      'Grow as aggressively as possible'] },
  { q: 'How stable is your income and overall situation?',
    options: ['Variable or uncertain', 'Somewhat stable', 'Stable',
      'Very stable', 'Very stable, with strong reserves'] },
  { q: 'Which portfolio would you be most comfortable holding for 10 years?',
    options: ['Best year +4% / worst −2%', '+8% / −8%', '+12% / −15%',
      '+18% / −25%', '+25% / −35%'] },
];

const RISK_BAND_TONE = { Conservative: 'var(--forest)', Moderate: 'var(--forest)',
  Balanced: 'var(--gold)', Growth: 'var(--gold)', Aggressive: 'var(--brick)' };

const RiskProfileCard = ({ advisorName }) => {
  const ctx = useProfile();
  const answers = ctx.riskAnswers || [];
  const answeredCount = ctx.riskComplete || 0;
  const done = answeredCount >= RISK_QUESTIONS.length;
  const [editing, setEditing] = React.useState(!done);
  const result = ctx.riskProfile; // { score, band, allocation } | null

  const setAnswer = (i, score) => {
    const next = answers.slice();
    next[i] = score;
    ctx.update('risk.answers', next);
    if (next.filter(x => x != null && x !== '').length === RISK_QUESTIONS.length) {
      ctx.update('risk.completedAt', new Date().toISOString().slice(0, 10));
    }
  };

  return (
    <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div className="px-eyebrow">Risk profile</div>
        {done && result && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-mute)' }}>
            {result.score} / 100
            <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: RISK_BAND_TONE[result.band] }}>{result.band}</span>
            {!editing && (
              <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setEditing(true)}>
                <Icons.Edit size={10} /> Review
              </button>
            )}
          </span>
        )}
      </div>

      {editing ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 14 }}>
            A few quick questions shape your recommended investment mix — and the draft Investment Policy Statement {advisorName} prepares with you.
          </div>
          {RISK_QUESTIONS.map((item, qi) => (
            <div key={qi} style={{ padding: '10px 0', borderTop: qi === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>{qi + 1}. {item.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.options.map((opt, oi) => {
                  const sel = answers[qi] === oi;
                  return (
                    <button key={oi} onClick={() => setAnswer(qi, oi)}
                      style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)',
                        fontSize: 12.5, padding: '7px 11px', borderRadius: 6,
                        border: `1px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                        background: sel ? 'var(--gold-soft)' : 'var(--bg)',
                        color: sel ? 'var(--ink)' : 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                        border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border-2)'}`,
                        background: sel ? 'var(--gold)' : 'transparent' }} />
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {done && (
            <button className="px-btn px-btn-primary px-btn-sm" style={{ marginTop: 14 }} onClick={() => setEditing(false)}>
              <Icons.Check size={12} /> View my recommended mix
            </button>
          )}
        </>
      ) : result && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 12 }}>
            Based on your answers, a <b style={{ color: RISK_BAND_TONE[result.band] }}>{result.band.toLowerCase()}</b> strategy fits you — a starting point {advisorName} will tailor with you.
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${result.allocation.equity}%`, background: 'var(--forest)' }} title={`Equity ${result.allocation.equity}%`} />
            <div style={{ width: `${result.allocation.fixedIncome}%`, background: 'var(--gold)' }} title={`Fixed income ${result.allocation.fixedIncome}%`} />
            <div style={{ width: `${result.allocation.cash}%`, background: 'var(--ink-faint)' }} title={`Cash ${result.allocation.cash}%`} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-mute)' }}>
            <span><span style={{ color: 'var(--forest)', fontWeight: 700 }}>●</span> Equity {result.allocation.equity}%</span>
            <span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>●</span> Fixed income {result.allocation.fixedIncome}%</span>
            <span><span style={{ color: 'var(--ink-faint)', fontWeight: 700 }}>●</span> Cash {result.allocation.cash}%</span>
          </div>
        </>
      )}
    </div>
  );
};

const ClientPortal = ({ onOpenNumbers }) => {
  const ctx = useProfile();
  const { overallPct, completedCount, totalTasks, activePhase, taskStates, setOpenPhases } = useTasks();
  const { activeClientId, activeClient, showToast, pendingPhaseId, setPendingPhaseId } = useView();
  const { authUser } = useAuth();

  // Deep-link: when a notification sends us here with a target phase, auto-open it
  React.useEffect(() => {
    if (pendingPhaseId == null) return;
    setOpenPhases(prev => ({ ...prev, [pendingPhaseId]: true }));
    setPendingPhaseId(null);
    // Scroll to the phase after a short render delay
    setTimeout(() => {
      const el = document.querySelector(`[data-phase-id="${pendingPhaseId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [pendingPhaseId, setPendingPhaseId, setOpenPhases]);
  const [milestoneModal, setMilestoneModal] = React.useState(null);

  // Performance data for the client-facing report
  const [perfBal, setPerfBal] = React.useState(null);
  const [perfFlows, setPerfFlows] = React.useState([]);
  const [invoices, setInvoices] = React.useState([]);
  const [acks, setAcks] = React.useState([]);
  const [signName, setSignName] = React.useState('');
  const [signingId, setSigningId] = React.useState(null);
  React.useEffect(() => {
    if (!window.db?.isUUID(activeClientId)) { setPerfBal(null); setPerfFlows([]); setInvoices([]); setAcks([]); return; }
    window.db.getBalanceHistory(activeClientId).then(r => setPerfBal(r || []));
    window.db.getCashFlows(activeClientId).then(r => setPerfFlows(r || []));
    window.db.getInvoices({ clientId: activeClientId }).then(r => setInvoices((r || []).filter(i => i.status !== 'void' && i.status !== 'draft')));
    window.db.getAcknowledgements(activeClientId).then(r => setAcks(r || []));
  }, [activeClientId]);

  const signAck = async (ack) => {
    if (!signName.trim()) { showToast('Type your full name to acknowledge'); return; }
    setSigningId(ack.id);
    const row = await window.db.signAcknowledgement(ack.id, signName.trim());
    setSigningId(null);
    if (row) { setAcks(prev => prev.map(a => a.id === ack.id ? row : a)); setSignName(''); showToast('Acknowledged — thank you'); }
    else showToast('Could not record acknowledgement — try again');
  };

  // Meeting request (scheduling)
  const [schedOpen, setSchedOpen] = React.useState(false);
  const [schedForm, setSchedForm] = React.useState({ met_at: '', notes: '' });
  const canRequest = window.db?.isUUID(activeClientId) && !!authUser?.advisor_id;
  const openScheduler = () => {
    if (!canRequest) { showToast('Scheduling is available once you sign in to your portal.'); return; }
    setSchedForm({ met_at: '', notes: '' });
    setSchedOpen(true);
  };
  const sendMeetingRequest = async () => {
    const met_at = schedForm.met_at ? new Date(schedForm.met_at).toISOString() : null;
    if (!met_at) { showToast('Pick a preferred date & time'); return; }
    const row = await window.db.requestMeeting(activeClientId, authUser.advisor_id, { met_at, notes: schedForm.notes });
    if (row) { showToast('Request sent — your advisor will confirm'); setSchedOpen(false); }
    else showToast('Could not send request — try again');
  };

  const activePhaseObj = phasesData.find(p => p.id === activePhase) || phasesData[0];
  // Use the real client object from ViewContext; fall back to mock only in demo mode
  const viewingClient = activeClient || clientsData.find(c => c.id === activeClientId) || clientsData[0];

  // Build advisor display info from auth (real) or mock fallback (demo)
  const advisorDisplay = {
    initials: authUser?.full_name
      ? authUser.full_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
      : advisor.initials,
    fullName: authUser?.full_name || advisor.fullName,
    firm:     authUser?.firms?.name || advisor.firm,
    name:     authUser?.full_name?.split(' ')[0] || advisor.name,
  };

  const completedPhases = phasesData.filter(p => p.tasks.every(t => taskStates[p.id]?.[t.id])).length;

  // Blank-slate detection — a freshly created household with no numbers yet.
  // Used to show a friendly "add numbers" nudge instead of a wall of $0s.
  const pf = ctx.profile || {};
  const isBlankSlate = !ctx.totalInvested && !ctx.netWorth
    && !(pf.income?.monthlyTakehome) && !(pf.savings?.emergency)
    && !viewingClient.aum;

  // Live portfolio trend for the Managed-assets card, from real balance history
  // (the client's snapshots when live; the demo generator otherwise).
  const valueSeries = React.useMemo(() => {
    const rows = window.db?.isUUID(activeClientId)
      ? (perfBal || [])
      : (window.demoBalanceHistory ? window.demoBalanceHistory(viewingClient.aum || 0) : []);
    return buildValueSeries(rows);
  }, [activeClientId, perfBal, viewingClient.aum]);
  const aumTrend = React.useMemo(() => {
    if (valueSeries.length < 2) return null;
    const a = valueSeries[0].value, b = valueSeries[valueSeries.length - 1].value;
    if (!a) return null;
    return { up: b >= a, pct: ((b - a) / a) * 100, values: valueSeries.map(p => p.value) };
  }, [valueSeries]);

  // Period returns for the inline performance view (live flows, or demo flows).
  // Memoized so the demo generator's fresh array doesn't bust perfPeriodsData each render.
  const perfFlowsForView = React.useMemo(
    () => (window.db?.isUUID(activeClientId)
      ? perfFlows
      : (window.demoCashFlows ? window.demoCashFlows() : [])),
    [activeClientId, perfFlows]);
  const perfPeriodsData = React.useMemo(
    () => (valueSeries.length >= 2 ? perfPeriods(valueSeries, perfFlowsForView) : []),
    [valueSeries, perfFlowsForView]);
  // Returns shown to clients are NET of advisory fees whenever fee debits are on
  // record; otherwise we say so plainly rather than imply a net figure.
  const perfNetOfFees = perfPeriodsData.some(p => p.fees > 0);

  const downloadPerformance = () => {
    const series  = buildValueSeries(perfBal || []);
    const periods = perfPeriods(series, perfFlows);
    window.printPerformanceReport?.({
      client:  { name: viewingClient.name || viewingClient.shortName, tag: viewingClient.tag },
      series, periods, flows: perfFlows,
      advisorName: advisorDisplay.fullName, advisorFirm: advisorDisplay.firm,
    });
  };

  return (
    <>
      <main className="px-client-app">
        {/* Hero */}
        <section className="px-clienthero">
          <div className="px-eyebrow px-clienthero-eyebrow">
            <span className="px-activity-dot is-recent" style={{ background: 'var(--gold)', boxShadow: '0 0 0 3px var(--gold-soft)' }}></span>
            Now · Phase {activePhaseObj.num} · {activePhaseObj.title}
          </div>
          <h1>
            Your wealth, refracted into <em>seven horizons</em>.
          </h1>
          <p>
            A coordinated lifecycle plan, built and reviewed with {advisorDisplay.fullName}.
            Each Horizon phase advances when its milestones are met — together.
          </p>
        </section>

        {/* Advisor chip */}
        <div className="px-advisor-chip">
          <div className="px-advisor-avatar">{advisorDisplay.initials}</div>
          <div className="px-advisor-meta">
            <div className="px-advisor-name">{advisorDisplay.fullName}</div>
            <div className="px-advisor-role">{advisorDisplay.firm}</div>
          </div>
          <button className="px-advisor-chip-btn" onClick={openScheduler}>
            <Icons.Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Request meeting
          </button>
        </div>
        <div style={{ clear: 'both' }}></div>

        {/* Blank-slate nudge — new household with no numbers entered yet */}
        {isBlankSlate && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderLeft: '3px solid var(--gold)', borderRadius: 'var(--radius-lg)',
            padding: '16px 18px', margin: '12px 0 4px',
          }}>
            <span style={{ color: 'var(--gold)', display: 'flex', flexShrink: 0 }}><Icons.Sparkles size={18} /></span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 2 }}>
                Let's bring this plan to life.
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                Add the household's numbers and the roadmap, calculators, and reports fill in automatically.
              </div>
            </div>
            <button className="px-btn px-btn-primary px-btn-sm" onClick={onOpenNumbers}>
              <Icons.Edit size={12} /> Add numbers
            </button>
          </div>
        )}

        {/* Portfolio summary strip */}
        <div className="px-portstrip">
          <div className="px-portstat">
            <div className="px-portstat-label">Managed assets</div>
            <div className="px-portstat-value">{fmt$(viewingClient.aum, { short: true })}</div>
            {aumTrend ? (
              <div className="px-portstat-foot" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                <Sparkline data={aumTrend.values} width={58} height={18}
                  color={aumTrend.up ? 'var(--forest)' : 'var(--brick)'} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600,
                  color: aumTrend.up ? 'var(--forest)' : 'var(--brick)' }}>
                  {aumTrend.up ? <Icons.TrendUp size={11} /> : <Icons.TrendDown size={11} />}
                  {Math.abs(aumTrend.pct).toFixed(1)}%
                </span>
                <span style={{ color: 'var(--ink-faint)' }}>12-mo</span>
              </div>
            ) : (
              <div className="px-portstat-foot">YTD · pending portfolio sync</div>
            )}
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Net worth</div>
            <div className="px-portstat-value">{fmt$(ctx.netWorth, { short: true })}</div>
            <div className="px-portstat-foot">{(ctx.isOwner || ctx.hasProperties) ? 'incl. reserve & real estate equity, net of debt' : 'incl. reserve, net of debt'}</div>
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Horizons cleared</div>
            <div className="px-portstat-value">{completedPhases} <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>/ {phasesData.length}</span></div>
            <div className="px-portstat-foot">{completedCount}/{totalTasks} milestones · {overallPct}%</div>
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Last review</div>
            <div className="px-portstat-value" style={{ fontSize: 17, marginTop: 8 }}>
              {viewingClient.lastReview ? `${viewingClient.lastReview} ago` : '—'}
            </div>
            <div className="px-portstat-foot">
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', marginTop: 4 }} onClick={onOpenNumbers}>
                <Icons.Edit size={10} /> Update numbers
              </button>
            </div>
          </div>
        </div>

        {/* Asset-truth composition (W6) — one honest total: managed + held-away.
            The common case (held-away accounts exist) is a clean composition, not a
            warning. Only the genuine error case (managed > reported total) nudges. */}
        {(() => {
          const comp = ctx.assetComposition?.(viewingClient.aum);
          if (!comp || comp.total <= 0) return null;
          if (comp.stale) {
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: '3px solid var(--gold)', borderRadius: 'var(--radius-lg)',
                padding: '12px 16px', margin: '4px 0 12px', fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--gold)', display: 'flex', flexShrink: 0 }}><Icons.AlertCircle size={16} /></span>
                <span style={{ flex: 1, minWidth: 200 }}>
                  Your managed assets ({fmt$(comp.managed, { short: true })}) are higher than the invested balances on file. Updating your numbers keeps the full picture accurate.
                </span>
                <button className="px-btn px-btn-sm px-btn-ghost" style={{ flexShrink: 0 }} onClick={onOpenNumbers}>
                  <Icons.Edit size={11} /> Update numbers
                </button>
              </div>
            );
          }
          if (!comp.hasHeldAway) return null;   // fully managed — nothing to compose
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '12px 16px', margin: '4px 0 12px',
            }} aria-label="Invested assets composition">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Invested assets</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 13, color: 'var(--ink-mute)' }}>
                <span style={{ color: 'var(--forest)', fontWeight: 600 }}>{fmt$(comp.managed, { short: true })}</span> managed
              </span>
              <span style={{ color: 'var(--border-2)' }}>+</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 13, color: 'var(--ink-mute)' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt$(comp.heldAway, { short: true })}</span> held away
              </span>
              <span style={{ color: 'var(--border-2)' }}>=</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
                <span style={{ fontWeight: 700 }}>{fmt$(comp.total, { short: true })}</span> total
              </span>
            </div>
          );
        })()}

        {/* Retirement readiness — the "are we on track?" answer.
            Journey-aware tone: someone with decades ahead is "Building", not "At risk" —
            time + steady saving is the real lever, and the copy says so. The advisor's
            own view (client modal) keeps the unsoftened verdict. */}
        {!isBlankSlate && ctx.retirementReadiness && (() => {
          const rr = ctx.retirementReadiness;
          const retireAt = ctx.profile?.goals?.retireAt || 65;
          const yearsToRetire = Math.max(0, retireAt - (ctx.planningAge || 0));
          const earlyJourney = (ctx.planningAge > 0 && ctx.planningAge < 40) || yearsToRetire > 25;
          const down = rr.verdict === 'Off track' || rr.verdict === 'At risk';
          let label = rr.verdict, tone = 'var(--brick)', note;
          if (rr.verdict === 'On track') { tone = 'var(--forest)'; note = `On pace to fund the plan through age 95 — nicely done.`; }
          else if (rr.verdict === 'Nearly there') { tone = 'var(--gold)'; note = `Close — a small, steady increase closes the gap from here.`; }
          else if (down && earlyJourney) { label = 'Building'; tone = 'var(--gold)';
            note = `You're early in the journey, and that's the advantage — time does the heavy lifting. Steady saving now compounds enormously, and small increases go a long way.`; }
          else { note = `Let's close the gap together — ${advisorDisplay.name} can model a higher contribution or a later target date.`; }
          const pct = Math.round(rr.fundedRatio * 100);
          const rightLabel = (down && earlyJourney) ? 'Time on your side'
            : rr.lasts ? 'Plan funded through age 95' : `Projected to age ${rr.depletionAge}`;
          return (
            <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div className="px-eyebrow">Retirement readiness</div>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: tone }}>{label}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: tone, transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--ink-mute)' }}>
                <span>{pct}% funded</span>
                <span>{rightLabel}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5 }}>{note}</div>

              {/* Probability-of-success band — the existing Monte Carlo, surfaced
                  as a confidence range on the retirement horizon (C4). */}
              {ctx.successBand && (() => {
                const sb = ctx.successBand;
                const sbMax = Math.max(sb.p90, sb.medianFinal, 1);
                const segLeft = Math.max(0, Math.min(100, (sb.p10 / sbMax) * 100));
                const medPos  = Math.max(2, Math.min(98, (sb.medianFinal / sbMax) * 100));
                const sbTone = sb.successPct >= 85 ? 'var(--forest)'
                  : sb.successPct >= 70 ? 'var(--gold)'
                  : (earlyJourney ? 'var(--gold)' : 'var(--brick)');
                return (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <span className="px-eyebrow">Probability of success</span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: sbTone }}>{Math.round(sb.successPct)}%</span>
                    </div>
                    <div style={{ position: 'relative', height: 8, background: 'var(--bg-elev)', borderRadius: 4 }}
                         aria-label={`Outcomes range from ${fmt$(sb.p10, { short: true })} to ${fmt$(sb.p90, { short: true })}, median ${fmt$(sb.medianFinal, { short: true })}`}>
                      <div style={{ position: 'absolute', left: `${segLeft}%`, right: 0, top: 0, bottom: 0,
                        background: sbTone, opacity: 0.35, borderRadius: 4 }} />
                      <div style={{ position: 'absolute', left: `${medPos}%`, top: -2, bottom: -2, width: 2,
                        background: sbTone, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ink-mute)' }}>
                      <span>Bear case {fmt$(sb.p10, { short: true })}</span>
                      <span style={{ color: sbTone, fontWeight: 600 }}>Median {fmt$(sb.medianFinal, { short: true })}</span>
                      <span>Bull case {fmt$(sb.p90, { short: true })}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
                {ctx.successBand ? 'Funded ratio nets guaranteed income against inflated spending; the probability band reflects 600 simulated market paths. Both are illustrative and best refined with ' + advisorDisplay.name + '.'
                  : 'Projection nets your guaranteed income against inflated spending — illustrative, and best refined with ' + advisorDisplay.name + '.'}
              </div>
            </div>
          );
        })()}

        {/* Risk profile — client questionnaire → recommended mix + draft IPS (C4) */}
        {!isBlankSlate && <RiskProfileCard advisorName={advisorDisplay.name} />}

        {/* Funding goals — per-goal progress + on-pace nudge */}
        {!isBlankSlate && (ctx.goalsFunding || []).length > 0 && (
          <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="px-eyebrow" style={{ marginBottom: 12 }}>Goals</div>
            {ctx.goalsFunding.map(({ goal, status, gapMonthly }) => {
              // Client side stays constructive — no alarming red; the bar shows saved-so-far
              // progress, the badge carries the projection, paired with an actionable nudge.
              const tone = (status === 'funded' || status === 'on pace') ? 'var(--forest)' : 'var(--gold)';
              const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentFunding / goal.targetAmount) * 100)) : 0;
              const yr = goal.targetDate ? new Date(goal.targetDate).getFullYear() : null;
              const label = { funded: 'Funded', 'on pace': 'On pace', behind: 'Behind', 'past due': 'Needs attention' }[status] || status;
              return (
                <div key={goal.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                      {goal.label || 'Goal'}{yr ? <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 12 }}> · by {yr}</span> : null}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tone, border: `1px solid ${tone}`, borderRadius: 20, padding: '1px 9px', whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: tone, transition: 'width .4s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11.5, color: 'var(--ink-mute)' }}>
                    <span>{fmt$(goal.currentFunding, { short: true })} of {fmt$(goal.targetAmount, { short: true })} · {pct}%</span>
                    {status === 'behind' && isFinite(gapMonthly) && gapMonthly > 0 && (
                      <span style={{ color: 'var(--gold)' }}>+{fmt$(gapMonthly)}/mo to stay on pace</span>
                    )}
                    {status === 'past due' && <span style={{ color: 'var(--gold)' }}>Worth a fresh look with your advisor</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Protection & estate — capture + gentle coaching; never alarming on the client side */}
        {!isBlankSlate && (() => {
          const cg = ctx.lifeCoverageGap || { covered: true, gap: 0, recommended: 0, ratio: 1 };
          const estate = ctx.estate || {};
          const estateRows = [
            { key: 'will', label: 'Will' }, { key: 'trust', label: 'Revocable trust' },
            { key: 'poa', label: 'Power of attorney' }, { key: 'healthcareDirective', label: 'Healthcare directive' },
            { key: 'beneficiaries', label: 'Beneficiary review' },
          ];
          const lifeTone = cg.covered ? 'var(--forest)' : 'var(--gold)';
          const lifeLabel = cg.covered ? 'Well protected' : 'Room to strengthen';
          const hasAny = (ctx.insurance || []).length > 0 || (ctx.estateComplete || 0) > 0;
          if (!hasAny && cg.recommended <= 0) return null;
          return (
            <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div className="px-eyebrow" style={{ marginBottom: 12 }}>Protection &amp; estate</div>

              {/* Life coverage vs. a simple income-multiple guideline */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>Life coverage</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: lifeTone, border: `1px solid ${lifeTone}`, borderRadius: 20, padding: '1px 9px', whiteSpace: 'nowrap' }}>{lifeLabel}</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((cg.ratio || 0) * 100)}%`, background: lifeTone, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 5 }}>
                {fmt$(ctx.lifeCoverage || 0, { short: true })} in place
                {cg.recommended > 0 ? ` · guideline ≈ ${fmt$(cg.recommended, { short: true })}` : ''}
                {!cg.covered && cg.gap > 0 && (
                  <span style={{ color: 'var(--gold)' }}> · worth reviewing with {advisorDisplay.name} whether to add coverage</span>
                )}
              </div>

              {/* Estate readiness */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, margin: '16px 0 6px' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>Estate readiness</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{ctx.estateComplete || 0} of {estateRows.length} in place</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg-elev)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ctx.estateProgress || 0}%`, background: 'var(--forest)', transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {estateRows.map(({ key, label }) => {
                  const st = estate[key]?.status || 'none';
                  const done = st === 'complete';
                  const prog = st === 'in_progress';
                  const tone = done ? 'var(--forest)' : prog ? 'var(--gold)' : 'var(--ink-faint)';
                  return (
                    <span key={key} style={{ fontSize: 11, color: tone, border: `1px solid ${tone}`, borderRadius: 20, padding: '2px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {done && <Icons.Check size={10} />}{label}{prog ? ' · in progress' : done ? '' : ' · to do'}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Conversation — the two-way thread with the advisor (the collaboration wedge) */}
        <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div className="px-eyebrow" style={{ marginBottom: 12 }}>Conversation with {advisorDisplay.name}</div>
          <MessageThread
            clientId={activeClientId}
            role="client"
            authorId={window.db?.isUUID(activeClientId) ? activeClientId : null}
            firmId={authUser?.firm_id || authUser?.firms?.id || null}
            counterpartName={advisorDisplay.name}
            emptyHint={`Have a question between meetings? Message ${advisorDisplay.name} here — no question is too small.`}
            demoSeed={window.demoMessages ? window.demoMessages() : []}
          />
        </div>

        {/* Documents — review & download what the advisor has shared */}
        <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div className="px-eyebrow" style={{ marginBottom: 12 }}>Documents</div>
          <DocumentVault
            clientId={activeClientId}
            role="client"
            demoSeed={window.demoDocuments ? window.demoDocuments() : []}
            emptyHint={`When ${advisorDisplay.name} shares a statement, IPS, or disclosure, it will appear here to review and download.`}
          />
        </div>

        {/* Acknowledgements — review & e-sign documents the advisor requested */}
        {acks.length > 0 && (
          <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="px-eyebrow" style={{ marginBottom: 12 }}>Acknowledgements</div>
            {acks.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{a.title}</div>
                  {a.status === 'acknowledged' ? (
                    <span style={{ fontSize: 11, color: 'var(--forest)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Icons.CheckCircle size={13} /> Signed {a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gold)', whiteSpace: 'nowrap' }}>Action needed</span>
                  )}
                </div>
                {a.body && <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 6, lineHeight: 1.55 }}>{a.body}</div>}
                {a.status === 'acknowledged' ? (
                  a.signer_name && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>Signed by {a.signer_name}</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <input className="px-input" placeholder="Type your full name to sign" value={signName}
                      onChange={e => setSignName(e.target.value)} style={{ flex: '1 1 200px' }}
                      aria-label="Your full name" />
                    <button className="px-btn px-btn-sm px-btn-primary" onClick={() => signAck(a)} disabled={signingId === a.id}>
                      <Icons.Check size={12} /> {signingId === a.id ? 'Recording…' : 'I acknowledge'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Interactive performance view — inline chart + time-weighted returns */}
        {valueSeries.length >= 2 && (
          <div className="px-card" style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="px-eyebrow">Performance</div>
              {window.db?.isUUID(activeClientId) && (
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={downloadPerformance}>
                  <Icons.Download size={11} /> Download report
                </button>
              )}
            </div>
            <PerfChart series={valueSeries} height={110} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              {perfPeriodsData.map(p => (
                <div key={p.label} style={{ flex: '1 1 70px', minWidth: 64, textAlign: 'center', padding: '8px 6px', background: 'var(--bg-elev)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-mute)', fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 15.5, fontWeight: 500, marginTop: 3,
                    color: p.pct == null ? 'var(--ink-mute)' : p.pct >= 0 ? 'var(--forest)' : 'var(--brick)' }}>
                    {p.pct == null ? '—' : `${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 10, fontStyle: 'italic' }}>
              {perfNetOfFees ? 'Net of advisory fees' : 'Before advisory fees'} · time-weighted (Modified Dietz) · {window.db?.isUUID(activeClientId) ? 'from your linked accounts' : 'illustrative demo data'}
            </div>
          </div>
        )}

        {/* Advisory invoices (live clients with issued invoices) */}
        {invoices.length > 0 && (
          <div className="px-card" style={{ padding: 16, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div className="px-eyebrow" style={{ marginBottom: 10 }}>Advisory invoices</div>
            {invoices.map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {new Date(inv.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–{new Date(inv.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span style={{ marginLeft: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: inv.status === 'paid' ? 'var(--forest)' : 'var(--gold)' }}>{inv.status}</span>
                  </div>
                </div>
                <span className="px-num-serif" style={{ fontSize: 15 }}>{fmt$(inv.fee_amount)}</span>
                <button className="px-btn px-btn-sm px-btn-ghost" title="Download invoice"
                  onClick={() => window.printInvoiceReport?.(inv, viewingClient.shortName || viewingClient.name, advisorDisplay.firm)}>
                  <Icons.Download size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Phases */}
        <div className="px-horizons">
          {phasesData.map(phase => (
            <PhaseCard key={phase.id} phase={phase} onOpenMilestone={setMilestoneModal} />
          ))}

          <div className="px-phase-end">
            <div className="px-phase-end-mark">
              {overallPct === 100 ? <Icons.CheckCircle size={20} strokeWidth={2.2} /> : <Icons.Anchor size={18} />}
            </div>
            <div>
              <div className="px-phase-end-title">
                {overallPct === 100 ? 'Lifecycle plan complete.' : 'Generational stewardship'}
              </div>
              <div className="px-phase-end-sub">
                {overallPct === 100
                  ? 'Maintenance mode — annual review cadence with your advisor.'
                  : 'The horizon beyond the seven phases. Reviewed annually with your advisor.'}
              </div>
            </div>
          </div>
        </div>
      </main>

      <MilestoneAchievedModal
        isOpen={!!milestoneModal}
        onClose={() => setMilestoneModal(null)}
        phase={milestoneModal}
        onSchedule={() => { setMilestoneModal(null); openScheduler(); }}
      />

      {/* Request-a-meeting modal */}
      <Modal isOpen={schedOpen} onClose={() => setSchedOpen(false)} className="px-sched-modal">
        <div style={{ padding: '24px 26px 26px', minWidth: 360, maxWidth: 420 }}>
          <div className="px-eyebrow" style={{ marginBottom: 6 }}>Request a meeting</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>
            Pick a time with {advisorDisplay.name}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 16 }}>
            Suggest a preferred date and time — your advisor will confirm.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Preferred date & time</span>
            <input className="px-input" type="datetime-local" value={schedForm.met_at}
              onChange={e => setSchedForm(f => ({ ...f, met_at: e.target.value }))} autoFocus />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>What would you like to discuss? (optional)</span>
            <textarea className="px-input" rows={3} style={{ resize: 'vertical' }}
              value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="px-btn px-btn-ghost" onClick={() => setSchedOpen(false)}>Cancel</button>
            <button className="px-btn px-btn-primary" onClick={sendMeetingRequest}>
              <Icons.Calendar size={12} /> Send request
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

window.ClientPortal = ClientPortal;

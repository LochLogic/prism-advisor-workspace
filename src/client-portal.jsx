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
              <div className="px-phase-rationale-body" dangerouslySetInnerHTML={{ __html: phase.rationale }} />
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
                      <span className="px-task-act" title="Advanced advisor tool">
                        <Icons.Sparkles size={10} /> Tool
                      </span>
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

            {ToolComp && <ToolComp />}
            {ToolComp2 && <ToolComp2 />}

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
  React.useEffect(() => {
    if (!window.db?.isUUID(activeClientId)) { setPerfBal(null); setPerfFlows([]); return; }
    window.db.getBalanceHistory(activeClientId).then(r => setPerfBal(r || []));
    window.db.getCashFlows(activeClientId).then(r => setPerfFlows(r || []));
  }, [activeClientId]);

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
          <button className="px-advisor-chip-btn"
            onClick={() => showToast('Scheduling integration coming soon — ask your advisor for a link.')}>
            <Icons.Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Schedule
          </button>
        </div>
        <div style={{ clear: 'both' }}></div>

        {/* Portfolio summary strip */}
        <div className="px-portstrip">
          <div className="px-portstat">
            <div className="px-portstat-label">Managed assets</div>
            <div className="px-portstat-value">{fmt$(viewingClient.aum, { short: true })}</div>
            <div className="px-portstat-foot">YTD · pending portfolio sync</div>
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Net worth</div>
            <div className="px-portstat-value">{fmt$(ctx.netWorth, { short: true })}</div>
            <div className="px-portstat-foot">incl. reserve, net of debt</div>
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Horizons cleared</div>
            <div className="px-portstat-value">{completedPhases} <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>/ {phasesData.length}</span></div>
            <div className="px-portstat-foot">{completedCount}/{totalTasks} milestones · {overallPct}%</div>
          </div>
          <div className="px-portstat">
            <div className="px-portstat-label">Last review</div>
            <div className="px-portstat-value" style={{ fontSize: 17, marginTop: 8 }}>—</div>
            <div className="px-portstat-foot">
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', marginTop: 4 }} onClick={onOpenNumbers}>
                <Icons.Edit size={10} /> Update numbers
              </button>
            </div>
          </div>
        </div>

        {/* Performance report (live clients only) */}
        {window.db?.isUUID(activeClientId) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="px-btn px-btn-sm px-btn-ghost" onClick={downloadPerformance}>
              <Icons.Download size={11} /> Download performance report
            </button>
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
      />
    </>
  );
};

window.ClientPortal = ClientPortal;

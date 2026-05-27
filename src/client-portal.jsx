// Prism — Client Portal (View B). The collaborative roadmap shown to clients.
// Phases, tasks, Discuss-with-Advisor flagging, advanced tools, milestone modal.

const PhaseCard = ({ phase, onOpenMilestone }) => {
  const { taskStates, toggleTask, openPhases, togglePhase, flagForAdvisor, isFlagged, activePhase } = useTasks();
  const { showToast } = useView();
  const ctx = useProfile();

  const isOpen = !!openPhases[phase.id];
  const completed = phase.tasks.filter(t => taskStates[phase.id]?.[t.id]).length;
  const progress = (completed / phase.tasks.length) * 100;
  const isComplete = completed === phase.tasks.length;
  const isActive = phase.id === activePhase;
  const isLocked = phase.id > activePhase + 1;

  const PhaseIcon = Icons[phase.icon] || Icons.Briefcase;
  const ToolComp = calculators[phase.calc];

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
    <div className={`px-phase ${isOpen ? 'is-open' : ''} ${isComplete ? 'is-done' : ''} ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}>
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
                          flagForAdvisor(phase.id, task.id);
                          showToast(flagged ? 'Question unflagged' : `Flagged for ${advisor.name} — visible in their inbox`);
                        }}
                        title={flagged ? 'Flagged' : 'Discuss with your advisor'}
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

            {isComplete && (
              <div className="px-phase-complete-cta">
                <span>
                  <Icons.CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Phase complete · reviewed with {advisor.name}
                </span>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => onOpenMilestone(phase)}>
                  View summary report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ClientPortal = ({ onOpenNumbers }) => {
  const ctx = useProfile();
  const { overallPct, completedCount, totalTasks, activePhase, taskStates } = useTasks();
  const [milestoneModal, setMilestoneModal] = React.useState(null);
  const activePhaseObj = phasesData.find(p => p.id === activePhase) || phasesData[0];

  const completedPhases = phasesData.filter(p => p.tasks.every(t => taskStates[p.id]?.[t.id])).length;

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
            A coordinated lifecycle plan, built and reviewed with {advisor.fullName}.
            Each Horizon phase advances when its milestones are met — together.
          </p>
        </section>

        {/* Advisor chip */}
        <div className="px-advisor-chip">
          <div className="px-advisor-avatar">{advisor.initials}</div>
          <div className="px-advisor-meta">
            <div className="px-advisor-name">{advisor.fullName}</div>
            <div className="px-advisor-role">{advisor.firm}</div>
          </div>
          <button className="px-advisor-chip-btn">
            <Icons.Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Schedule
          </button>
        </div>
        <div style={{ clear: 'both' }}></div>

        {/* Portfolio summary strip */}
        <div className="px-portstrip">
          <div className="px-portstat">
            <div className="px-portstat-label">Managed assets</div>
            <div className="px-portstat-value">{fmt$(ctx.totalInvested, { short: true })}</div>
            <div className="px-portstat-foot">+ 11.4% YTD</div>
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
            <div className="px-portstat-value" style={{ fontSize: 17, marginTop: 8 }}>Oct 14</div>
            <div className="px-portstat-foot">
              <button className="px-btn px-btn-sm px-btn-ghost" style={{ padding: '3px 8px', marginTop: 4 }} onClick={onOpenNumbers}>
                <Icons.Edit size={10} /> Update numbers
              </button>
            </div>
          </div>
        </div>

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

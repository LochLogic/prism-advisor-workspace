// Prism — shared components: Modal shell, Avatar, Sparkline, MilestoneAchievedModal, Toast

/* ─── Modal shell ────────────────────────────────────────────────── */
const Modal = ({ isOpen, onClose, children, className = '' }) => {
  if (!isOpen) return null;
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="px-modal-backdrop" onClick={onClose}>
      <div className={`px-modal ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="px-modal-close" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
};

/* ─── Avatar ─────────────────────────────────────────────────────── */
const ClientAvatar = ({ client, size = 30 }) => {
  const hue = client.accentHue || 215;
  const bg = `hsl(${hue} 22% 38%)`;
  return (
    <div className="px-client-avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>
      {client.initials}
    </div>
  );
};

/* ─── Sparkline (tiny, deterministic per seed) ───────────────────── */
const Sparkline = ({ seed = 1, width = 56, height = 18, trend = 'up', color = 'var(--gold)' }) => {
  // pseudo-random with seed
  const rng = (i) => Math.abs(Math.sin(i * 12.9898 + seed * 78.233)) % 1;
  const N = 14;
  const pts = [];
  let v = 0.5;
  for (let i = 0; i < N; i++) {
    const drift = trend === 'up' ? 0.025 : trend === 'down' ? -0.025 : 0;
    v = Math.max(0.05, Math.min(0.95, v + drift + (rng(i) - 0.5) * 0.18));
    pts.push(v);
  }
  const d = pts.map((p, i) => {
    const x = (i / (N - 1)) * width;
    const y = height - p * height;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="px-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ─── Toast ──────────────────────────────────────────────────────── */
const Toast = () => {
  const { toast } = useView();
  if (!toast) return null;
  return (
    <div className="px-toast" role="status">
      <span className="px-toast-icon"><Icons.Flag size={14} /></span>
      <span>{toast}</span>
    </div>
  );
};

/* ─── Milestone Achieved Modal (replaces CelebrationModal) ───────── */
const MilestoneAchievedModal = ({ isOpen, onClose, phase }) => {
  const { taskStates } = useTasks() || {};
  if (!isOpen || !phase) return null;
  const completed = phase.tasks.filter(t => taskStates?.[phase.id]?.[t.id]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="px-milestone-modal">
      <div className="px-milestone-head">
        <div className="px-milestone-mark"><Icons.CheckCircle size={22} /></div>
        <div className="px-eyebrow px-milestone-eyebrow">Milestone Achieved · Phase {phase.num}</div>
        <h2 className="px-milestone-title">{phase.title} complete.</h2>
        <p className="px-milestone-sub">A summary of this Horizon phase has been compiled. Review with {advisor.name} at your next session, or share the printable report below.</p>
      </div>

      <div className="px-milestone-body">
        <div className="px-milestone-section">
          <h4>Completed in this phase</h4>
          <div className="px-milestone-checklist">
            {completed.map(t => (
              <div className="px-milestone-checkitem" key={t.id}>
                <span className="px-milestone-checkitem-mark"><Icons.Check size={14} strokeWidth={2.4} /></span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-milestone-section">
          <h4>Phase impact</h4>
          <div className="px-milestone-stats">
            <div>
              <div className="px-milestone-stat-label">Tasks completed</div>
              <div className="px-milestone-stat-value">{completed.length} / {phase.tasks.length}</div>
            </div>
            <div>
              <div className="px-milestone-stat-label">Phase</div>
              <div className="px-milestone-stat-value">{phase.num}</div>
            </div>
            <div>
              <div className="px-milestone-stat-label">Reviewed</div>
              <div className="px-milestone-stat-value px-mono" style={{ fontSize: 15, paddingTop: 5 }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        <div className="px-milestone-section">
          <h4>Advisor's note</h4>
          <p style={{
            fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic',
            color: 'var(--ink-2)', lineHeight: 1.55,
            borderLeft: '2px solid var(--gold)', paddingLeft: 14, margin: 0,
          }}>
            "{phase.title === 'Liability Optimization'
              ? 'Excellent execution on the avalanche schedule. With high-cost debt cleared, the next phase moves capital into tax-advantaged space — where we get the compounding advantage of three-axis tax benefit.'
              : 'Solid foundation laid. The work in this phase compounds into every decision that follows — particularly around tax location and withdrawal sequencing. We will review the next Horizon together at your scheduled session.'}"
            <br /><span style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, display: 'block' }}>— {advisor.fullName}, {advisor.firm}</span>
          </p>
        </div>
      </div>

      <div className="px-milestone-foot">
        <span className="px-milestone-foot-note">A printable PDF copy is retained in your client vault.</span>
        <button className="px-btn px-btn-ghost" onClick={onClose}>
          <Icons.Download size={13} /> Download PDF
        </button>
        <button className="px-btn px-btn-primary" onClick={onClose}>
          <Icons.Calendar size={13} /> Schedule next review
        </button>
      </div>
    </Modal>
  );
};

Object.assign(window, { Modal, ClientAvatar, Sparkline, Toast, MilestoneAchievedModal });

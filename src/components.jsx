// Prism — shared components: Modal shell, Avatar, Sparkline, MilestoneAchievedModal, Toast

/* ─── Modal shell ────────────────────────────────────────────────── */
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const Modal = ({ isOpen, onClose, children, className = '' }) => {
  const modalRef        = React.useRef(null);
  const previousFocus   = React.useRef(null);

  // Save trigger focus, auto-focus first focusable element, restore on close
  React.useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement;
    const raf = requestAnimationFrame(() => {
      if (!modalRef.current) return;
      const first = modalRef.current.querySelector(FOCUSABLE);
      (first || modalRef.current).focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      previousFocus.current?.focus();
    };
  }, [isOpen]);

  // Escape to close + Tab focus trap
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="px-modal-backdrop" onClick={onClose}>
      <div ref={modalRef} tabIndex={-1} className={`px-modal ${className}`}
           onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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

/* ─── Sparkline ──────────────────────────────────────────────────────
   Pass `data` (array of real values) to plot an actual series; otherwise
   falls back to a deterministic seed-based shape (legacy/decorative use). */
const Sparkline = ({ seed = 1, width = 56, height = 18, trend = 'up', color = 'var(--gold)', data = null }) => {
  let pts;
  if (Array.isArray(data) && data.length >= 2) {
    // Normalize the real series to 0..1 for the viewbox.
    const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
    pts = data.map(v => (v - min) / range);
  } else {
    // pseudo-random with seed (decorative fallback)
    const rng = (i) => Math.abs(Math.sin(i * 12.9898 + seed * 78.233)) % 1;
    const N = 14;
    pts = [];
    let v = 0.5;
    for (let i = 0; i < N; i++) {
      const drift = trend === 'up' ? 0.025 : trend === 'down' ? -0.025 : 0;
      v = Math.max(0.05, Math.min(0.95, v + drift + (rng(i) - 0.5) * 0.18));
      pts.push(v);
    }
  }
  const N = pts.length;
  const d = pts.map((p, i) => {
    const x = (i / (N - 1)) * width;
    const y = height - p * (height - 2) - 1;
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
const MilestoneAchievedModal = ({ isOpen, onClose, phase, onSchedule }) => {
  const { taskStates } = useTasks() || {};
  const { authUser } = window.useAuth?.() || {};
  const prof = useProfile() || {};
  if (!isOpen || !phase) return null;
  const completed   = phase.tasks.filter(t => taskStates?.[phase.id]?.[t.id]);
  const advisorName = authUser?.full_name || advisor.fullName;
  const advisorFirm = authUser?.firms?.name || advisor.firm;
  const numbers = {
    netWorth: prof.netWorth, invested: prof.totalInvested,
    reserve: prof.profile?.savings?.emergency || 0, reserveTarget: prof.reserveTarget,
    surplus: prof.surplus, savingsRate: prof.savingsRate,
    retirementAssets: prof.retirementAssets, taxableBalance: prof.taxableBalance,
  };
  const handlePrint = () => window.printMilestoneReport?.(phase, taskStates, advisorName, advisorFirm, numbers);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="px-milestone-modal">
      <div className="px-milestone-head">
        <div className="px-milestone-mark"><Icons.CheckCircle size={22} /></div>
        <div className="px-eyebrow px-milestone-eyebrow">Milestone Achieved · Phase {phase.num}</div>
        <h2 className="px-milestone-title">{phase.title} complete.</h2>
        <p className="px-milestone-sub">A summary of this Horizon phase has been compiled. Review with your advisor at your next session, or share the printable report below.</p>
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
            <br /><span style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, display: 'block' }}>— {advisorName}, {advisorFirm}</span>
          </p>
        </div>
      </div>

      <div className="px-milestone-foot">
        <span className="px-milestone-foot-note">A printable PDF copy is retained in your client vault.</span>
        <button className="px-btn px-btn-ghost" onClick={handlePrint}>
          <Icons.Download size={13} /> Download PDF
        </button>
        <button className="px-btn px-btn-primary" onClick={onSchedule || onClose}>
          <Icons.Calendar size={13} /> Schedule next review
        </button>
      </div>
    </Modal>
  );
};

/* ─── Message thread — two-way advisor ↔ client conversation (W3) ──── */
// Shared by the client portal and the advisor client modal. `role` is the
// viewer ('advisor' | 'client'); their own messages align right. Live clients
// load + subscribe in realtime; demo/mock clients use local state from demoSeed.
const MessageThread = ({ clientId, role, authorId, firmId, demoSeed = [], context = null,
                         counterpartName = 'your advisor', emptyHint, height = 300 }) => {
  const isLive = window.db?.isUUID(clientId);
  const [messages, setMessages] = React.useState(isLive ? undefined : demoSeed);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    if (!isLive) { setMessages(demoSeed); return; }
    let active = true;
    setMessages(undefined);
    window.db.getMessages(clientId).then(rows => { if (active) setMessages(rows || []); });
    const unsub = window.db.subscribeMessages(clientId, (m) =>
      setMessages(prev => (prev || []).some(x => x.id === m.id) ? prev : [...(prev || []), m]));
    return () => { active = false; unsub && unsub(); };
  }, [clientId]);

  React.useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    if (!isLive) {
      setMessages(prev => [...(prev || []), { id: 'demo-' + Date.now(), author_role: role, body, context, created_at: new Date().toISOString() }]);
      return;
    }
    setSending(true);
    const row = await window.db.sendMessage(clientId, { body, authorRole: role, authorId, context, firmId });
    setSending(false);
    if (row) setMessages(prev => (prev || []).some(x => x.id === row.id) ? prev : [...(prev || []), row]);
  };

  const fmtTime = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-thread">
      <div className="px-thread-log" style={{ maxHeight: height }}>
        {messages === undefined && <div className="px-thread-empty">Loading…</div>}
        {messages !== undefined && messages.length === 0 && (
          <div className="px-thread-empty">{emptyHint || `Start the conversation with ${counterpartName}.`}</div>
        )}
        {(messages || []).map(m => (
          <div key={m.id} className={`px-msg ${m.author_role === role ? 'is-mine' : ''}`}>
            <div className="px-msg-bubble">
              {m.context && <div className="px-msg-context">{m.context}</div>}
              <div className="px-msg-body">{m.body}</div>
              <div className="px-msg-time">{fmtTime(m.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-thread-compose">
        <textarea className="px-input" rows={2} value={draft} placeholder="Write a message… (Enter to send)"
          aria-label="Write a message"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ resize: 'none' }} />
        <button className="px-btn px-btn-primary px-btn-sm" onClick={send} disabled={sending || !draft.trim()}>
          <Icons.Message size={12} /> Send
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { Modal, ClientAvatar, Sparkline, Toast, MilestoneAchievedModal, MessageThread });

// Prism - shared components: Modal shell, Avatar, Sparkline, MilestoneAchievedModal, Toast

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

/* ─── Performance value chart (shared: advisor modal + client portal) ─────
   An area sparkline with an interactive readout: hover (or move along) the
   chart to surface a crosshair, a marker on the line, and a tooltip with the
   exact date + portfolio value at that point. Falls back gracefully on touch
   (tap-drag fires the same move handler) and announces its range to AT. */
const PerfChart = ({ series, height = 96 }) => {
  const [hover, setHover] = React.useState(null);
  if (!series || series.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-faint)', fontSize: 12, fontStyle: 'italic',
        border: '1px dashed var(--border)', borderRadius: 8 }}>
        Not enough history yet - the curve fills in as balances update.
      </div>
    );
  }
  const W = 380, H = height;
  const vals = series.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1, n = series.length;
  // Fractional (0–1) coordinates: the SVG stretches with preserveAspectRatio
  // "none", so x-fraction = i/(n-1) and y-fraction = y(v)/H map straight onto
  // the container - letting the HTML overlay (dot + tooltip) sit in %.
  const xFrac = i => (n > 1 ? i / (n - 1) : 0);
  const yFrac = v => (H - ((v - min) / range) * (H - 10) - 5) / H;
  const x = i => xFrac(i) * W;
  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${(yFrac(p.value) * H).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const up = vals[n - 1] >= vals[0];
  const color = up ? 'var(--forest)' : 'var(--brick)';
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); } catch (e) { return d || ''; } };

  const onMove = (e) => {
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHover(Math.round(f * (n - 1)));
  };
  const hp = hover != null ? series[hover] : null;
  const tipLeft = hp ? Math.min(92, Math.max(8, xFrac(hover) * 100)) : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: H, cursor: 'crosshair' }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setHover(null)}
      role="img" aria-label={`Portfolio value trend, ${fmt$(vals[0], { short: true })} to ${fmt$(vals[n - 1], { short: true })} over ${n} points`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
        <path d={area} fill={color} opacity="0.09" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {hp && <line x1={x(hover)} y1="0" x2={x(hover)} y2={H} stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hp && (
        <>
          <div style={{ position: 'absolute', left: `${xFrac(hover) * 100}%`, top: `${yFrac(hp.value) * 100}%`,
            width: 9, height: 9, borderRadius: '50%', background: color, border: '2px solid var(--surface)',
            transform: 'translate(-50%, -50%)', pointerEvents: 'none', boxShadow: '0 0 0 1px var(--border)' }} />
          <div style={{ position: 'absolute', left: `${tipLeft}%`, top: -4, transform: 'translate(-50%, -100%)',
            background: 'var(--ink)', color: '#fff', fontSize: 10.5, lineHeight: 1.35, padding: '4px 8px',
            borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 3, boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: 600 }}>{fmt$(hp.value)}</div>
            <div style={{ opacity: .75 }}>{fmtDate(hp.date)}</div>
          </div>
        </>
      )}
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
              ? 'Excellent execution on the avalanche schedule. With high-cost debt cleared, the next phase moves capital into tax-advantaged space - where we get the compounding advantage of three-axis tax benefit.'
              : 'Solid foundation laid. The work in this phase compounds into every decision that follows - particularly around tax location and withdrawal sequencing. We will review the next Horizon together at your scheduled session.'}"
            <br /><span style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, display: 'block' }}>- {advisorName}, {advisorFirm}</span>
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

/* ─── Message thread - two-way advisor ↔ client conversation (W3) ──── */
// Shared by the client portal and the advisor client modal. `role` is the
// viewer ('advisor' | 'client'); their own messages align right. Live clients
// load + subscribe in realtime; demo/mock clients use local state from demoSeed.
const MessageThread = ({ clientId, role, authorId, firmId, demoSeed = [], context = null,
                         counterpartName = 'your advisor', emptyHint, height = 300,
                         aiContext = null }) => {
  const isLive = window.db?.isUUID(clientId);
  const [messages, setMessages] = React.useState(isLive ? undefined : demoSeed);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState(false);
  const endRef = React.useRef(null);

  // AI draft (advisor side only) - sends the client context + recent thread to
  // the server-side Gemini edge function and drops the result into the compose
  // box for the advisor to edit before sending. Demo mode shows a canned draft.
  const aiDraft = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    let text = null;
    if (isLive) {
      text = await window.db.aiAssist?.('draft_reply', {
        ...aiContext,
        thread: (messages || []).slice(-12).map(m => ({ from: m.author_role, body: m.body })),
      });
    } else {
      text = `Thanks for the note - that's exactly the kind of question this plan is built to answer. Looking at where the household stands, you're in a solid position to take this step without disturbing the longer-term targets we set. Let's walk through the numbers together at our next review; I'll bring a side-by-side so you can see the trade-off clearly.`;
    }
    setAiBusy(false);
    if (text) setDraft(text);
    else setSendError('AI draft unavailable - try again, or write your reply directly.');
  };

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

  // "Something changed?" hooks elsewhere on the page (e.g. the portal accounts
  // card) prefill the compose box and bring the thread into view.
  React.useEffect(() => {
    const onPrefill = (e) => {
      if (e.detail?.draft) setDraft(e.detail.draft);
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      endRef.current?.closest('.px-thread')?.querySelector('textarea')?.focus();
    };
    window.addEventListener('px:prefill-message', onPrefill);
    return () => window.removeEventListener('px:prefill-message', onPrefill);
  }, []);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSendError('');
    if (!isLive) {
      setDraft('');
      setMessages(prev => [...(prev || []), { id: 'demo-' + Date.now(), author_role: role, body, context, created_at: new Date().toISOString() }]);
      return;
    }
    setSending(true);
    const row = await window.db.sendMessage(clientId, { body, authorRole: role, authorId, context, firmId });
    setSending(false);
    if (row) {
      setDraft('');
      setMessages(prev => (prev || []).some(x => x.id === row.id) ? prev : [...(prev || []), row]);
    } else {
      setSendError('Message could not be sent - please try again.');
    }
  };

  const fmtTime = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Machine-readable contexts (document requests) render as friendly labels.
  const ctxLabel = (c) => {
    if (typeof c !== 'string') return c;
    if (c.startsWith('doc-request-done:')) return 'Document request · fulfilled';
    if (c.startsWith('doc-request:')) return `Document request · ${_docCatLabel(c.slice('doc-request:'.length))}`;
    return c;
  };

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
              {m.context && <div className="px-msg-context">{ctxLabel(m.context)}</div>}
              <div className="px-msg-body">{m.body}</div>
              <div className="px-msg-time">{fmtTime(m.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-thread-compose">
        {sendError && <div style={{ fontSize: 11.5, color: 'var(--brick)', marginBottom: 6, padding: '4px 8px', background: 'rgba(140,61,61,.07)', borderRadius: 5 }}>{sendError}</div>}
        <textarea className="px-input" rows={2} value={draft} placeholder="Write a message… (Enter to send)"
          aria-label="Write a message"
          onChange={e => { setDraft(e.target.value); if (sendError) setSendError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ resize: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="px-btn px-btn-primary px-btn-sm" onClick={send} disabled={sending || !draft.trim()}>
            <Icons.Message size={12} /> {sending ? 'Sending…' : 'Send'}
          </button>
          {role === 'advisor' && aiContext && (
            <button className="px-btn px-btn-ghost px-btn-sm" onClick={aiDraft} disabled={aiBusy}
              title="Draft a reply with the AI assistant - you review and edit before sending">
              <Icons.Sparkles size={12} /> {aiBusy ? 'Drafting…' : 'AI draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Document vault - advisor uploads, client reviews + downloads (W4) ──── */
const DOC_CATEGORIES = [
  { value: 'ips', label: 'IPS' }, { value: 'statement', label: 'Statement' },
  { value: 'tax', label: 'Tax' }, { value: 'estate', label: 'Estate' },
  { value: 'disclosure', label: 'Disclosure' }, { value: 'other', label: 'Other' },
];
const _docCatLabel = (v) => (DOC_CATEGORIES.find(c => c.value === v) || { label: 'Other' }).label;
const _fmtBytes = (b) => {
  if (!b) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};
const _fmtDocDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// `role` is the viewer ('advisor' | 'client'). Both can upload + download; only
// advisors can delete (clients can't remove advisor-shared files). Live clients
// hit Storage; demo/mock clients use demoSeed.
const DocumentVault = ({ clientId, role, firmId, advisorId, demoSeed = [], emptyHint }) => {
  const isLive = window.db?.isUUID(clientId);
  const canManage = role === 'advisor';
  const canUpload = role === 'advisor' || role === 'client';
  const [docs, setDocs] = React.useState(isLive ? undefined : demoSeed);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [form, setForm] = React.useState(null);
  const fileRef = React.useRef(null);

  // Document requests - the advisor's "please upload X" asks (rides on the
  // messages table; see db.jsx). Demo mode keeps them in local state so the
  // flow is demonstrable without a session.
  const [requests, setRequests] = React.useState([]);
  const [reqForm, setReqForm] = React.useState(null);
  const [reqBusy, setReqBusy] = React.useState(false);
  const openRequests = requests.filter(r => !r.resolved);

  React.useEffect(() => {
    if (!isLive) { setDocs(demoSeed); setRequests([]); return; }
    setDocs(undefined);
    window.db.getDocuments(clientId).then(rows => setDocs(rows || []));
    window.db.getDocumentRequests?.(clientId).then(rows => setRequests(rows || []));
  }, [clientId]);

  const sendRequest = async () => {
    const title = reqForm?.title?.trim();
    if (!title || reqBusy) return;
    if (!isLive) {
      setRequests(prev => [{ id: 'demo-' + Date.now(), title, category: reqForm.category,
        requestedAt: new Date().toISOString(), resolved: false }, ...prev]);
      setReqForm(null);
      return;
    }
    setReqBusy(true); setErr('');
    const row = await window.db.requestDocument(clientId, { title, category: reqForm.category, advisorId, firmId });
    setReqBusy(false);
    if (row) {
      setRequests(prev => [{ id: row.id, title, category: reqForm.category,
        requestedAt: row.created_at, resolved: false }, ...prev]);
      setReqForm(null);
    } else setErr('Could not send the request - please try again.');
  };

  const resolveRequest = async (r, { byRole, note } = {}) => {
    if (isLive) {
      const ok = await window.db.resolveDocumentRequest(clientId, r.id, {
        byRole: byRole || role,
        authorId: role === 'client' ? clientId : advisorId,
        firmId, note,
      });
      if (!ok) { setErr('Could not update the request - please try again.'); return false; }
    }
    setRequests(prev => prev.map(x => x.id === r.id ? { ...x, resolved: true } : x));
    return true;
  };

  const pickFile = (e, request = null) => {
    const f = e.target.files?.[0]; if (!f) return;
    setErr('');
    setForm(request
      ? { file: f, title: request.title, category: request.category, requestId: request.id }
      : { file: f, title: f.name.replace(/\.[^.]+$/, ''), category: 'other' });
  };
  const upload = async () => {
    if (!form?.file || busy) return;
    if (!isLive) { setErr('Uploads are available on live clients.'); return; }
    setBusy(true); setErr('');
    const row = await window.db.uploadDocument(clientId, firmId, advisorId, form.file,
      { title: form.title?.trim() || form.file.name, category: form.category,
        uploadedByRole: role === 'client' ? 'client' : 'advisor' });
    setBusy(false);
    if (row) {
      // Upload fulfilling an advisor request → close the request in the thread.
      const req = form.requestId ? requests.find(r => r.id === form.requestId) : null;
      if (req) await resolveRequest(req, { note: `Uploaded: ${row.title}` });
      setDocs(prev => [row, ...(prev || [])]); setForm(null); if (fileRef.current) fileRef.current.value = '';
      // Milestone documentation gates (round 23) watch the vault by category -
      // announce the arrival so gated checkboxes unlock without a reload.
      window.dispatchEvent(new CustomEvent('px:document-uploaded', { detail: { documentId: row.id, category: row.category, clientId } }));
    }
    else setErr('Upload failed - please try again.');
  };
  const download = async (d) => {
    setErr('');
    if (!isLive) { setErr('Documents open in the live portal.'); setTimeout(() => setErr(''), 2500); return; }
    const url = await window.db.getDocumentUrl(d.storage_path);
    if (url) window.open(url, '_blank', 'noopener'); else setErr('Could not open the document.');
  };
  const remove = async (d) => {
    if (!isLive) return;
    const ok = await window.db.deleteDocument(d.id, d.storage_path, clientId);
    if (ok) {
      setDocs(prev => (prev || []).filter(x => x.id !== d.id));
      // Estate checklist items may link this document (estate.*.documentId).
      // Announce the deletion so ProfileProvider clears any stale link instead
      // of leaving a dangling pointer behind a graceful-but-confusing toast.
      window.dispatchEvent(new CustomEvent('px:document-deleted', { detail: { documentId: d.id, clientId } }));
    }
  };

  return (
    <div className="px-docs">
      {/* Open document requests - what the advisor has asked the client to upload */}
      {openRequests.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {openRequests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', marginBottom: 6, background: 'var(--gold-soft)',
              border: '1px solid var(--gold)', borderRadius: 6 }}>
              <span style={{ color: 'var(--gold)', display: 'flex', flexShrink: 0 }}><Icons.FileText size={15} /></span>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                  {role === 'client' ? `Your advisor asked for: ${r.title}` : r.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                  {_docCatLabel(r.category)}{r.requestedAt ? ` · requested ${_fmtDocDate(r.requestedAt)}` : ''}
                  {role === 'advisor' ? ' · awaiting client upload' : ''}
                </div>
              </div>
              {role === 'client' && (
                <label className="px-btn px-btn-sm px-btn-primary" style={{ cursor: 'pointer' }}>
                  <Icons.Upload size={12} /> Upload
                  <input type="file" onChange={(e) => pickFile(e, r)} style={{ display: 'none' }} />
                </label>
              )}
              {role === 'advisor' && (
                <button className="px-btn px-btn-sm px-btn-ghost"
                  title="Close this request - received outside the portal or no longer needed"
                  onClick={() => resolveRequest(r, { note: `Received: ${r.title}` })}>
                  Mark received
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canUpload && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {!form && (
            <label className="px-btn px-btn-sm px-btn-ghost" style={{ cursor: 'pointer' }}>
              <Icons.Upload size={12} /> {role === 'client' ? 'Upload a document' : 'Upload document'}
              <input ref={fileRef} type="file" onChange={pickFile} style={{ display: 'none' }} />
            </label>
          )}
          {!form && role === 'advisor' && !reqForm && (
            <button className="px-btn px-btn-sm px-btn-ghost"
              title="Ask the client to upload a named document - the request appears in their portal"
              onClick={() => setReqForm({ title: '', category: 'statement' })}>
              <Icons.FileText size={12} /> Request document
            </button>
          )}
          {!form && reqForm && (
            <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, flexBasis: '100%' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}>
                Request a document - the ask shows in the client&apos;s portal and is resolved by their upload.
              </div>
              <input className="px-input" placeholder="What should they upload? e.g. 2025 Form 1040" value={reqForm.title} autoFocus
                onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') sendRequest(); }} style={{ marginBottom: 8 }} />
              <select className="px-select" value={reqForm.category}
                onChange={e => setReqForm(f => ({ ...f, category: e.target.value }))} style={{ marginBottom: 8, width: '100%' }}>
                {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="px-btn px-btn-sm px-btn-primary" onClick={sendRequest} disabled={reqBusy || !reqForm.title.trim()}>
                  {reqBusy ? 'Sending…' : 'Send request'}
                </button>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => setReqForm(null)}>Cancel</button>
              </div>
            </div>
          )}
          {form && (
            <div style={{ padding: 12, background: 'var(--bg-elev)', borderRadius: 6, flexBasis: '100%' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.FileText size={13} /> {form.file.name} <span style={{ color: 'var(--ink-faint)' }}>· {_fmtBytes(form.file.size)}</span>
                {form.requestId && <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600 }}>· fulfills a request</span>}
              </div>
              <input className="px-input" placeholder="Title" value={form.title} autoFocus
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ marginBottom: 8 }} />
              <select className="px-select" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ marginBottom: 8, width: '100%' }}>
                {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="px-btn px-btn-sm px-btn-primary" onClick={upload} disabled={busy}>
                  {busy ? 'Uploading…' : 'Upload'}
                </button>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => { setForm(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: 'var(--brick)', marginBottom: 8, padding: '4px 8px', background: 'rgba(140,61,61,.07)', borderRadius: 5 }}>{err}</div>}
      {docs === undefined && <div className="px-thread-empty">Loading…</div>}
      {docs !== undefined && docs.length === 0 && (
        <div className="px-thread-empty">{emptyHint || 'No documents yet.'}</div>
      )}
      {(docs || []).map(d => (
        <div key={d.id} className="px-doc-row">
          <span className="px-doc-icon"><Icons.FileText size={16} /></span>
          <div className="px-doc-meta">
            <div className="px-doc-title">{d.title}</div>
            <div className="px-doc-sub">
              <span className="px-doc-cat">{_docCatLabel(d.category)}</span>
              {d.file_name ? ` · ${d.file_name}` : ''}{d.size_bytes ? ` · ${_fmtBytes(d.size_bytes)}` : ''}
              {d.uploaded_at ? ` · ${_fmtDocDate(d.uploaded_at)}` : ''}
            </div>
          </div>
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => download(d)} title="Download" aria-label={`Download ${d.title}`}>
            <Icons.Download size={12} />
          </button>
          {canManage && (
            <button className="px-icon-btn" onClick={() => remove(d)} title="Delete" aria-label="Delete document"
              style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}>
              <Icons.Trash size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Numeric input without the leading-zero trap. A raw controlled
// <input type="number"> backed by a number state renders "0" the moment the
// field is cleared, and the next keystroke lands AFTER it ("05") - which the
// browser then keeps showing, because React compares number inputs loosely.
// So: render '' for 0/empty with a "0" placeholder, hold the raw string in a
// local draft while the field is being edited (so intermediate states like
// "0." survive), commit the parsed number on every change, and collapse a
// digit typed after a lone "0" into the digit itself. Blur drops the draft
// and re-syncs to the stored value. Shared by the Numbers drawer and every
// phase tool.
const NumInput = ({ value, onCommit, step, placeholder = '0', ...rest }) => {
  const [draft, setDraft] = React.useState(null);
  const settled = (value === 0 || value == null || value === '') ? '' : String(value);
  return (
    <input type="number" value={draft != null ? draft : settled} step={step} placeholder={placeholder}
      onChange={(e) => {
        const prev = draft != null ? draft : settled;
        let raw = e.target.value;
        if ((prev === '0' || prev === '-0') && /^-?0\d/.test(raw)) raw = raw.replace(/^(-?)0+/, '$1');
        setDraft(raw);
        onCommit(raw === '' ? 0 : (parseFloat(raw) || 0));
      }}
      onBlur={() => setDraft(null)}
      {...rest} />
  );
};

Object.assign(window, { Modal, ClientAvatar, Sparkline, Toast, MilestoneAchievedModal, MessageThread, DocumentVault, NumInput });

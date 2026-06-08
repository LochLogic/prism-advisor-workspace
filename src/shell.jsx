// Prism — shared app shell. Chrome used by BOTH the advisor app (app.jsx, /app)
// and the slim client portal (portal-app.jsx, /portal): loading screen, the
// notification bell, the account chip + 2FA modal, and the error boundary.
// Kept here (loaded after components.jsx) so neither bundle duplicates it.

/* ─── Loading screen ──────────────────────────────────────────────── */
const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', gap: 14,
  }}>
    <div style={{
      width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icons.Prism size={19} style={{ color: 'white' }} />
    </div>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-mute)', letterSpacing: '.01em' }}>
      Verifying session…
    </div>
  </div>
);

/* ─── Notification bell + dropdown ───────────────────────────────── */
const NotificationBell = () => {
  const { notifications, unread, markAllRead, dismiss, realtimeStatus } = useNotifications();
  const { setActiveClientId, setView, setPendingPhaseId } = useView();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    const handleKey   = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open) markAllRead();
    setOpen(v => !v);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className="px-icon-btn" onClick={toggle}
        aria-label="Notifications" aria-haspopup="true" aria-expanded={open}
        title="Notifications" style={{ position: 'relative' }}>
        <Icons.Bell size={14} />
        {unread > 0 && (
          <span className="px-notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="px-notif-panel" role="region" aria-label="Notifications"
             onClick={e => e.stopPropagation()}>
          <div className="px-notif-panel-head">
            <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12 }}>Notifications</span>
            <span className={`px-rt-dot is-${realtimeStatus}`}
              title={`Realtime: ${realtimeStatus}`} />
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, fontStyle: 'italic' }}>
              No notifications yet
              {realtimeStatus === 'live' && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--forest)' }}>● Realtime connected</div>
              )}
            </div>
          ) : (
            notifications.map(n => {
              const I = Icons[n.icon] || Icons.Bell;
              const isClickable = !!n.clientId;
              const handleDeepLink = () => {
                if (!n.clientId) return;
                setActiveClientId(n.clientId);
                if (n.phaseId != null) setPendingPhaseId(n.phaseId);
                setView('client');
                setOpen(false);
              };
              return (
                <div key={n.id} className="px-notif-item"
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  onClick={isClickable ? handleDeepLink : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDeepLink(); } }
                    : undefined}
                  aria-label={isClickable ? `Go to client · ${n.headline}` : undefined}
                >
                  <span className="px-notif-item-icon"><I size={11} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {n.headline}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 3 }}>{n.timeAgo}</div>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                    onClick={() => dismiss(n.id)}>
                    <Icons.X size={10} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Two-factor (TOTP) security settings ────────────────────────── */
const SecurityModal = ({ isOpen, onClose }) => {
  // phase: 'loading' | 'none' | 'enrolling' | 'enrolled' | 'error'
  const [phase,  setPhase]  = React.useState('loading');
  const [enroll, setEnroll] = React.useState(null); // { factorId, qr, secret }
  const [code,   setCode]   = React.useState('');
  const [busy,   setBusy]   = React.useState(false);
  const [error,  setError]  = React.useState('');

  const sb = window.__sb;

  const refresh = React.useCallback(async () => {
    if (!sb) { setPhase('error'); return; }
    setError('');
    try {
      const { data } = await sb.auth.mfa.listFactors();
      const verified = (data?.totp || []).find(f => f.status === 'verified');
      setPhase(verified ? 'enrolled' : 'none');
    } catch (e) { setError(e.message); setPhase('error'); }
  }, [sb]);

  React.useEffect(() => {
    if (!isOpen) return;
    setEnroll(null); setCode(''); setError(''); setPhase('loading');
    refresh();
  }, [isOpen, refresh]);

  // Begin enrollment — clears any stale unverified factor first, then enrolls.
  const beginEnroll = async () => {
    setBusy(true); setError('');
    try {
      const { data: factors } = await sb.auth.mfa.listFactors();
      for (const f of (factors?.totp || [])) {
        if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' });
      if (error) throw error;
      setEnroll({ factorId: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret });
      setPhase('enrolling');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code: code.trim() });
      if (error) throw error;
      window.db?.audit('mfa.enroll', { entityType: 'auth', summary: 'Enabled two-factor authentication' });
      setCode(''); setEnroll(null);
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeFactor = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await sb.auth.mfa.listFactors();
      for (const f of (data?.totp || [])) await sb.auth.mfa.unenroll({ factorId: f.id });
      window.db?.audit('mfa.unenroll', { entityType: 'auth', summary: 'Disabled two-factor authentication' });
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="px-security-modal">
      <div style={{ padding: '26px 28px 28px', minWidth: 380, maxWidth: 440 }}>
        <div className="px-eyebrow" style={{ marginBottom: 6 }}>Account security</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>
          Two-factor authentication
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5, marginBottom: 18 }}>
          Add a time-based one-time code (TOTP) from an authenticator app as a second factor at sign-in.
        </p>

        {phase === 'loading' && <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Checking status…</div>}

        {phase === 'error' && (
          <div style={{ fontSize: 13, color: 'var(--brick)' }}>{error || 'Two-factor is unavailable right now.'}</div>
        )}

        {phase === 'none' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elev)', borderRadius: 6, marginBottom: 16, fontSize: 12.5, color: 'var(--ink-mute)' }}>
              <Icons.Lock size={14} /> Not enabled — your account uses a single factor.
            </div>
            <button className="px-btn px-btn-primary" onClick={beginEnroll} disabled={busy}>
              {busy ? 'Starting…' : 'Enable two-factor'}
            </button>
          </>
        )}

        {phase === 'enrolling' && enroll && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginBottom: 10 }}>
              1 · Scan this QR code in your authenticator app:
            </div>
            {enroll.qr && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <img src={enroll.qr} alt="Two-factor QR code" width={168} height={168}
                     style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', padding: 6 }} />
              </div>
            )}
            {enroll.secret && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 14, wordBreak: 'break-all' }}>
                Or enter manually: <code style={{ color: 'var(--ink-mute)' }}>{enroll.secret}</code>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginBottom: 6 }}>2 · Enter the 6-digit code:</div>
            <input className="px-input" inputMode="numeric" maxLength={6} placeholder="123456"
                   value={code} onChange={e => setCode(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') confirmEnroll(); }}
                   style={{ marginBottom: 12, letterSpacing: '.2em', textAlign: 'center', fontSize: 16 }} autoFocus />
            {error && <div style={{ fontSize: 12, color: 'var(--brick)', marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="px-btn px-btn-ghost" onClick={() => { setEnroll(null); setPhase('none'); setError(''); }}>Cancel</button>
              <button className="px-btn px-btn-primary" onClick={confirmEnroll} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
            </div>
          </>
        )}

        {phase === 'enrolled' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--forest-soft)', borderRadius: 6, marginBottom: 16, fontSize: 12.5, color: 'var(--forest)' }}>
              <Icons.CheckCircle size={14} /> Two-factor is <b>enabled</b> on your account.
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--brick)', marginBottom: 10 }}>{error}</div>}
            <button className="px-btn px-btn-ghost" style={{ color: 'var(--brick)' }} onClick={removeFactor} disabled={busy}>
              {busy ? 'Removing…' : 'Remove two-factor'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

/* ─── Account chip + sign-out dropdown ───────────────────────────── */
const AccountChip = ({ view, activeClient }) => {
  const { role, signOut, isDemo, authUser } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [securityOpen, setSecurityOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    const handleKey   = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const advisorInitials = authUser?.full_name
    ? authUser.full_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : advisor.initials;
  const advisorFirm = authUser?.firms?.name || advisor.firm;

  const displayName     = view === 'client' ? (activeClient?.shortName || 'Client')   : (authUser?.full_name || advisor.name);
  const displayFirm     = view === 'client' ? 'Client view'                           : advisorFirm;
  const displayInitials = view === 'client' ? (activeClient?.initials  || 'C')        : advisorInitials;

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="px-account-chip"
        title={isDemo ? 'Demo mode' : (authUser?.email || advisor.email)}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
        role="button" tabIndex={0}
        aria-haspopup="true" aria-expanded={open}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="px-account-avatar">{displayInitials}</div>
        <div className="px-account-meta">
          <div className="px-account-name">{displayName}</div>
          <div className="px-account-firm">{displayFirm}</div>
        </div>
      </div>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 4px 20px rgba(28,46,74,.13)',
            overflow: 'hidden', minWidth: 186, zIndex: 200,
          }}
        >
          {isDemo ? (
            <div style={{
              padding: '9px 14px', fontSize: 11, color: 'var(--ink-faint)',
              borderBottom: '1px solid var(--border)', fontStyle: 'italic',
            }}>
              Demo mode — no live session
            </div>
          ) : authUser && (
            <div style={{
              padding: '10px 14px', fontSize: 12, color: 'var(--ink-mute)',
              borderBottom: '1px solid var(--border)', lineHeight: 1.45,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 1 }}>
                {authUser.full_name || '—'}
              </div>
              <div style={{ fontSize: 11 }}>{authUser.email || ''}</div>
              {advisorFirm && <div style={{ fontSize: 11, marginTop: 1, color: 'var(--ink-faint)' }}>{advisorFirm}</div>}
            </div>
          )}

          {!isDemo && (
            <button
              onClick={() => { setOpen(false); setSecurityOpen(true); }}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                fontSize: 13, color: 'var(--ink)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)',
              }}
            >
              <Icons.Lock size={12} /> Security &amp; 2FA
            </button>
          )}

          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '10px 14px', textAlign: 'left',
              background: 'none', border: 'none', fontSize: 13, color: 'var(--ink)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--sans)',
            }}
          >
            <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
            {isDemo ? 'Back to sign-in' : 'Sign out'}
          </button>
        </div>
      )}

      <SecurityModal isOpen={securityOpen} onClose={() => setSecurityOpen(false)} />
    </div>
  );
};

/* ─── Error boundary ──────────────────────────────────────────────────
   Catches any render error so a bug shows a friendly fallback (with a copy-
   details affordance for the user to send you) instead of a blank screen, and
   reports it to the lightweight error reporter. */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, copied: false }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    try { window.__pxReportError?.(error, { type: 'react', component: (info && info.componentStack || '').slice(0, 1000) }); } catch (e) {}
  }
  copyDetails = () => {
    const e = this.state.error;
    const text = `Prism error\n${e && (e.stack || e.message) || String(e)}\nURL: ${location.href}\n${navigator.userAgent}`;
    try { navigator.clipboard?.writeText(text); this.setState({ copied: true }); } catch (x) {}
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)', gap: 14, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icons.Prism size={19} style={{ color: 'white' }} />
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)' }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', maxWidth: 380, lineHeight: 1.55 }}>
          The app hit an unexpected error. Reloading usually fixes it — your data is safe.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="px-btn px-btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <button className="px-btn px-btn-ghost" onClick={this.copyDetails}>
            {this.state.copied ? 'Copied ✓' : 'Copy error details'}
          </button>
        </div>
      </div>
    );
  }
}

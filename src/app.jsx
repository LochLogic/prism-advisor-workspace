// Prism — App shell. Auth gate, topbar, view switch, account chip, notification bell.

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
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open) markAllRead();
    setOpen(v => !v);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className="px-icon-btn" onClick={toggle} title="Notifications"
        style={{ position: 'relative' }}>
        <Icons.Bell size={14} />
        {unread > 0 && (
          <span className="px-notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="px-notif-panel" onClick={e => e.stopPropagation()}>
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
              return (
                <div key={n.id} className="px-notif-item">
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

/* ─── Account chip + sign-out dropdown ───────────────────────────── */
const AccountChip = ({ view, activeClient }) => {
  const { role, signOut, isDemo, authUser } = useAuth();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
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
    </div>
  );
};

/* ─── Topbar ──────────────────────────────────────────────────────── */
const Topbar = ({ onOpenNumbers }) => {
  const { view, setView, activeClient } = useView();
  const { role } = useAuth();

  return (
    <header className="px-topbar">
      <div className="px-brand">
        <div className="px-brand-mark"><Icons.Prism size={15} /></div>
        <div>
          <div className="px-brand-name">Prism</div>
          <div className="px-brand-sub">Advisor Workspace</div>
        </div>
      </div>

      {/* View switcher — advisors only */}
      {role === 'advisor' && (
        <div className="px-viewswitch" role="tablist" aria-label="View">
          <button
            className={view === 'advisor' ? 'is-on' : ''}
            onClick={() => setView('advisor')}
            role="tab" aria-selected={view === 'advisor'}>
            <Icons.TableCol size={13} /> Advisor
          </button>
          <button
            className={view === 'client' ? 'is-on' : ''}
            onClick={() => setView('client')}
            role="tab" aria-selected={view === 'client'}>
            <Icons.Layers size={13} /> Client
          </button>
        </div>
      )}

      <div className="px-topright">
        {view === 'client' && (
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={onOpenNumbers}>
            <Icons.Calculator size={12} /> Your numbers
          </button>
        )}
        <NotificationBell />
        <AccountChip view={view} activeClient={activeClient} />
      </div>
    </header>
  );
};

/* ─── App inner (all providers are already mounted above) ─────────── */
function AppInner() {
  const { view, setView } = useView();
  const { loading, session, role, isDemo, signOut } = useAuth();
  const [isNumbersOpen, setIsNumbersOpen] = React.useState(false);

  // Client-role users always land in client view
  React.useEffect(() => {
    if (role === 'client') setView('client');
  }, [role]);

  if (loading) return <LoadingScreen />;
  if (!session && !isDemo) return <LoadingScreen />;

  if (role === 'unregistered') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', gap: 18, padding: 32,
      }}>
        <div style={{
          width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.Prism size={19} style={{ color: 'white' }} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
            Account not yet linked
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.6, marginBottom: 20 }}>
            Your login was verified, but no advisor or client record was found for this email. Ask your administrator to add you to the system, then sign in again.
          </div>
          <button className="px-btn px-btn-ghost" onClick={signOut}>
            <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-app">
      <Topbar onOpenNumbers={() => setIsNumbersOpen(true)} />
      {view === 'advisor'
        ? <AdvisorDashboard />
        : <ClientPortal onOpenNumbers={() => setIsNumbersOpen(true)} />}
      <NumbersDrawer isOpen={isNumbersOpen} onClose={() => setIsNumbersOpen(false)} />
      <Toast />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ViewProvider>
        <NotificationProvider>
          <ProfileProvider>
            <TaskProvider>
              <AppInner />
            </TaskProvider>
          </ProfileProvider>
        </NotificationProvider>
      </ViewProvider>
    </AuthProvider>
  );
}

window.App = App;

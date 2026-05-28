// Prism — App shell. Auth gate, topbar, view switch, account chip with sign-out.

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

/* ─── Account chip + sign-out dropdown ───────────────────────────── */
const AccountChip = ({ view, activeClient }) => {
  const { role, signOut, isDemo, authUser } = useAuth();
  const [open, setOpen] = React.useState(false);

  // Close on any outside click
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const displayName     = view === 'client' ? (activeClient?.shortName || 'Client') : (authUser?.name || advisor.name);
  const displayFirm     = view === 'client' ? 'Client view' : advisor.firm;
  const displayInitials = view === 'client' ? (activeClient?.initials || 'C') : advisor.initials;

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
          {/* Session info */}
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
                {authUser.full_name || authUser.name || '—'}
              </div>
              <div style={{ fontSize: 11 }}>{authUser.email || ''}</div>
            </div>
          )}

          {/* Sign out */}
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
  const { view, setView, activeClientId } = useView();
  const { role } = useAuth();
  const activeClient = clientsData.find(c => c.id === activeClientId);

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
        <button className="px-icon-btn" title="Notifications">
          <Icons.Bell size={14} />
        </button>
        <AccountChip view={view} activeClient={activeClient} />
      </div>
    </header>
  );
};

/* ─── App inner (all providers are already mounted above) ─────────── */
function AppInner() {
  const { view, setView } = useView();
  const { loading, session, role, isDemo } = useAuth();
  const [isNumbersOpen, setIsNumbersOpen] = React.useState(false);

  // Client-role users always land in client view
  React.useEffect(() => {
    if (role === 'client') setView('client');
  }, [role]);

  // Auth gate
  if (loading) return <LoadingScreen />;
  if (!session && !isDemo) {
    // onAuthStateChange in auth.jsx handles the redirect; render nothing while it fires
    return <LoadingScreen />;
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
        <ProfileProvider>
          <TaskProvider>
            <AppInner />
          </TaskProvider>
        </ProfileProvider>
      </ViewProvider>
    </AuthProvider>
  );
}

window.App = App;

// Prism — Client Portal entry (/portal). This is a SECOND bundle (dist/portal.js)
// built from the client-facing source subset only: it deliberately excludes the
// advisor dashboard, firm-admin, advisor modals, and bulk-import code. The result
// is a smaller client payload AND a smaller attack surface in a client's browser —
// a client never downloads advisor/admin logic.
//
// Shared providers/components come from the same source files the advisor app uses
// (store, auth, components, shell, numbers-panel, client-portal); only the shell
// here is portal-specific.

// Marks this runtime as the portal so shared code (e.g. app.jsx's client→/portal
// redirect) never bounces us in a loop. Set at load time, before React renders.
window.__pxIsPortal = true;

/* ─── Slim client topbar (no view switcher, no admin) ────────────── */
const PortalTopbar = ({ onOpenNumbers, dark, toggleTheme }) => {
  const { activeClient } = useView();

  return (
    <header className="px-topbar">
      <div className="px-brand" aria-label="Prism">
        <div className="px-brand-mark"><Icons.Prism size={15} /></div>
        <div>
          <div className="px-brand-name">Prism</div>
          <div className="px-brand-sub">Client Portal</div>
        </div>
      </div>

      <div className="px-topright">
        <button className="px-btn px-btn-sm px-btn-ghost" onClick={onOpenNumbers}
          aria-label="Update your numbers">
          <Icons.Calculator size={12} /> <span className="px-vs-label">Your numbers</span>
        </button>
        <button className="px-icon-btn" onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
        </button>
        <NotificationBell />
        <AccountChip view="client" activeClient={activeClient} />
      </div>
    </header>
  );
};

/* ─── Portal inner — auth gate + bind the signed-in client's household ─ */
function PortalInner() {
  const { loading, session, role, authUser } = useAuth();
  const { numbersOpen, openNumbers, closeNumbers, setActiveClientId, setActiveClient, setView } = useView();
  const { dark, toggleTheme } = useTheme();

  // Bind the view to the signed-in client's own household. (The advisor app sets
  // the active client by picking from the roster; here it's simply "me".)
  React.useEffect(() => {
    if (role === 'client' && authUser?.id) {
      setActiveClientId(authUser.id);
      setActiveClient(window.db?.mapClient
        ? window.db.mapClient({
            id: authUser.id, household_name: authUser.household_name,
            short_name: authUser.short_name, current_phase: authUser.current_phase,
          })
        : null);
      setView('client');
    }
  }, [role, authUser?.id]);

  if (loading) return <LoadingScreen />;
  if (!session) { window.location.replace('/login.html'); return <LoadingScreen />; }
  // The portal is client-only. Advisors/admins (and demo, which grants advisor)
  // and not-yet-provisioned users belong on the advisor app, which handles
  // role routing, workspace provisioning, and invite claiming.
  if (role !== 'client') { window.location.replace('/app'); return <LoadingScreen />; }

  return (
    <div className="px-app">
      <PortalTopbar onOpenNumbers={openNumbers} dark={dark} toggleTheme={toggleTheme} />
      <ClientPortal onOpenNumbers={openNumbers} />
      <NumbersDrawer isOpen={numbersOpen} onClose={closeNumbers} />
      <Toast />
    </div>
  );
}

function PortalApp() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ViewProvider>
          <NotificationProvider>
            <ProfileProvider>
              <TaskProvider>
                <PortalInner />
              </TaskProvider>
            </ProfileProvider>
          </NotificationProvider>
        </ViewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

window.PortalApp = PortalApp;

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(PortalApp));

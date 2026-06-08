// Prism — App shell. Auth gate, topbar, view switch, account chip, notification bell.

// Captured once at load (before React rewrites the hash): did the user arrive on
// an explicit deep link? If so, role-based view-homing must not override it.
const __pxHadDeepLink = typeof window !== 'undefined'
  && /^#\/(advisor|admin|client)/.test(window.location.hash || '');

/* LoadingScreen, NotificationBell, SecurityModal, AccountChip now live in
   src/shell.jsx (shared by the advisor app and the client portal). */

/* ─── Topbar ──────────────────────────────────────────────────────── */
const Topbar = ({ onOpenNumbers, dark, toggleTheme }) => {
  const { view, setView, activeClient, setActiveClient } = useView();
  const { role, isDemo } = useAuth();

  // Logo = "home": demo → public landing page; logged in → role's default view
  const goHome = () => {
    if (isDemo) { window.location.href = '/'; return; }
    setActiveClient?.(null);
    setView(role === 'admin' ? 'admin' : role === 'client' ? 'client' : 'advisor');
  };

  return (
    <header className="px-topbar">
      <div className="px-brand" onClick={goHome} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); } }}
        title={isDemo ? 'Back to homepage' : 'Go to dashboard'}
        style={{ cursor: 'pointer' }} aria-label="Home">
        <div className="px-brand-mark"><Icons.Prism size={15} /></div>
        <div>
          <div className="px-brand-name">Prism</div>
          <div className="px-brand-sub">{view === 'client' ? 'Client Portal' : view === 'admin' ? 'Firm Admin' : 'Advisor Workspace'}</div>
        </div>
      </div>

      {/* View switcher — advisors and firm admins */}
      {(role === 'advisor' || role === 'admin') && (
        <div className="px-viewswitch" role="tablist" aria-label="View">
          <button
            className={view === 'advisor' ? 'is-on' : ''}
            onClick={() => setView('advisor')}
            role="tab" aria-selected={view === 'advisor'} aria-label="Advisor view">
            <Icons.TableCol size={13} /> <span className="px-vs-label">Advisor</span>
          </button>
          <button
            className={view === 'client' ? 'is-on' : ''}
            onClick={() => setView('client')}
            role="tab" aria-selected={view === 'client'} aria-label="Client view">
            <Icons.Layers size={13} /> <span className="px-vs-label">Client</span>
          </button>
          {role === 'admin' && (
            <button
              className={view === 'admin' ? 'is-on' : ''}
              onClick={() => setView('admin')}
              role="tab" aria-selected={view === 'admin'} aria-label="Firm admin view">
              <Icons.Building size={13} /> <span className="px-vs-label">Admin</span>
            </button>
          )}
        </div>
      )}

      <div className="px-topright">
        {view === 'client' && (
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={onOpenNumbers}
            aria-label="Update your numbers">
            <Icons.Calculator size={12} /> <span className="px-vs-label">Your numbers</span>
          </button>
        )}
        <button className="px-icon-btn" onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
        </button>
        <NotificationBell />
        <AccountChip view={view} activeClient={activeClient} />
      </div>
    </header>
  );
};

/* ─── Self-serve workspace provisioning (Option B signup completion) ─ */
function ProvisionWorkspace() {
  const { session, signOut } = useAuth();
  const meta = session?.user?.user_metadata || {};
  const [firmName, setFirmName] = React.useState(meta.firm_name || '');
  const [fullName, setFullName] = React.useState(meta.full_name || '');
  const [busy, setBusy]   = React.useState(false);
  const [error, setError] = React.useState('');

  const provision = async () => {
    if (!firmName.trim() || !fullName.trim()) { setError('Enter your name and firm name.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await window.__sb.rpc('px_provision_firm',
        { p_firm_name: firmName.trim(), p_full_name: fullName.trim() });
      if (error) throw error;
      window.location.reload(); // re-run role detection — lands as firm admin
    } catch (e) { setError(e.message || 'Could not create workspace.'); setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 18, padding: 32 }}>
      <div style={{ width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icons.Prism size={19} style={{ color: 'white' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
            Set up your workspace
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.55 }}>
            One more step — name your firm to create your advisor workspace. You'll be its first administrator.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 22 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Your name</span>
            <input className="px-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Advisor" autoFocus />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Firm name</span>
            <input className="px-input" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Northbridge Wealth"
              onKeyDown={e => { if (e.key === 'Enter') provision(); }} />
          </label>
          {error && <div style={{ fontSize: 12, color: 'var(--brick)' }}>{error}</div>}
          <button className="px-btn px-btn-primary" onClick={provision} disabled={busy}>
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="px-btn px-btn-ghost" onClick={signOut}>
            <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Client portal claim (C3 invite flow) ───────────────────────────
   The advisor shares /login.html?claim=<code>. After the client signs in
   (login.html stashes the code in localStorage + threads it onto /app),
   a freshly-authenticated user with no DB record lands here. We redeem the
   code (px_claim_client), which binds clients.auth_user_id to this auth user,
   then reload so role detection finds the now-linked household. */
function pendingClaimCode() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('claim');
    if (fromUrl) return fromUrl;
    return localStorage.getItem('px_claim') || null;
  } catch (e) { return null; }
}
function clearClaimCode() {
  try { localStorage.removeItem('px_claim'); } catch (e) {}
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has('claim')) { u.searchParams.delete('claim'); window.history.replaceState({}, '', u.pathname + u.search); }
  } catch (e) {}
}

function ClaimInvite({ code }) {
  const { signOut } = useAuth();
  const [error, setError] = React.useState('');
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return; // claim is single-use — never fire twice (StrictMode/re-render)
    ran.current = true;
    (async () => {
      const { clientId, error } = await window.db.claimClient(code);
      if (clientId) {
        clearClaimCode();
        window.location.href = '/portal'; // slim client bundle; role detection confirms the link
      } else {
        setError(error || 'This invite could not be redeemed.');
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icons.Prism size={19} style={{ color: 'white' }} />
      </div>
      {!error ? (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink-mute)' }}>
          Connecting you to your advisor’s portal…
        </div>
      ) : (
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
            We couldn’t connect this invite
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', lineHeight: 1.55, marginBottom: 16 }}>
            {error} Ask your advisor for a fresh invite link, then try again.
          </div>
          <button className="px-btn px-btn-ghost" onClick={() => { clearClaimCode(); signOut(); }}>
            <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Back to sign-in
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── App inner (all providers are already mounted above) ─────────── */
function AppInner() {
  const { view, setView, numbersOpen, openNumbers, closeNumbers } = useView();
  const { loading, session, role, isDemo, signOut } = useAuth();
  const { dark, toggleTheme } = useTheme();

  // Route users to their natural home view on first load.
  // Demo opens on the wedge — the client lifecycle roadmap — not the admin grid,
  // so visitors and prospective design partners see the differentiator first.
  // An explicit deep-link hash (#/client/<id>…) wins — don't clobber a shared link.
  React.useEffect(() => {
    if (__pxHadDeepLink) return;
    if (role === 'client')      setView('client');
    else if (role === 'admin')  setView('admin');
    else if (isDemo)            setView('client');
  }, [role, isDemo]);

  if (loading) return <LoadingScreen />;
  if (!session && !isDemo) return <LoadingScreen />;

  if (role === 'unregistered') {
    // A pending invite code means this is a client connecting — redeem it before
    // falling back to the advisor self-serve workspace setup.
    const claim = pendingClaimCode();
    return claim ? <ClaimInvite code={claim} /> : <ProvisionWorkspace />;
  }

  // Real (non-demo) clients live on the slim, lower-attack-surface /portal bundle;
  // /app is the advisor/admin surface. Demo stays here (its client view is part of
  // the advisor demo). The advisor's own "Client view" is role advisor/admin, so
  // it is unaffected by this redirect.
  if (role === 'client' && !isDemo && !window.__pxIsPortal) {
    window.location.replace('/portal');
    return <LoadingScreen />;
  }

  return (
    <div className="px-app">
      <Topbar onOpenNumbers={openNumbers} dark={dark} toggleTheme={toggleTheme} />
      {view === 'admin'   ? <FirmAdminDashboard />
       : view === 'advisor' ? <AdvisorDashboard />
       : <ClientPortal onOpenNumbers={openNumbers} />}
      <NumbersDrawer isOpen={numbersOpen} onClose={closeNumbers} />
      <Toast />
    </div>
  );
}

/* ErrorBoundary now lives in src/shell.jsx (shared). */

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

window.App = App;

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

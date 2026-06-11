// Prism — App shell. Auth gate, topbar, view switch, account chip, notification bell.

// Captured once at load (before React rewrites the hash): did the user arrive on
// an explicit deep link? If so, role-based view-homing must not override it.
const __pxHadDeepLink = typeof window !== 'undefined'
  && /^#\/(advisor|admin|client|platform)/.test(window.location.hash || '');

/* LoadingScreen, NotificationBell, SecurityModal, AccountChip now live in
   src/shell.jsx (shared by the advisor app and the client portal). */

/* ─── Topbar ──────────────────────────────────────────────────────── */
const Topbar = ({ onOpenNumbers, dark, toggleTheme, platformOwner }) => {
  const { view, setView, activeClient, setActiveClient } = useView();
  const { role, isDemo } = useAuth();
  const brand = useFirmBrand();

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
        {brand?.logo_url
          ? <img className="px-brand-logo" src={brand.logo_url} alt={brand.name || 'Firm logo'} />
          : <div className="px-brand-mark"><Icons.PrismMark size={16} /></div>}
        <div>
          <div className="px-brand-name">{brand?.name || 'Prism'}</div>
          <div className="px-brand-sub">{view === 'client' ? 'Client Portal' : view === 'admin' ? 'Firm Admin' : view === 'platform' ? 'Platform Owner' : 'Advisor Workspace'}</div>
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
          {platformOwner && (
            <button
              className={view === 'platform' ? 'is-on' : ''}
              onClick={() => setView('platform')}
              role="tab" aria-selected={view === 'platform'} aria-label="Platform owner view">
              <Icons.Prism size={13} /> <span className="px-vs-label">Platform</span>
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
  const [honorific, setHonorific] = React.useState('');
  const [busy, setBusy]   = React.useState(false);
  const [error, setError] = React.useState('');

  const provision = async () => {
    if (!firmName.trim() || !fullName.trim()) { setError('Enter your name and firm name.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await window.__sb.rpc('px_provision_firm',
        { p_firm_name: firmName.trim(), p_full_name: fullName.trim() });
      if (error) throw error;
      // Persist the optional client-facing title onto the just-created advisor
      // row (advisors_update_self RLS permits this). Non-fatal if it fails — the
      // advisor can set it later from the account menu.
      if (honorific) {
        try { await window.__sb.from('advisors').update({ honorific }).eq('auth_user_id', session.user.id); } catch (e) {}
      }
      window.location.reload(); // re-run role detection — lands as firm admin
    } catch (e) { setError(e.message || 'Could not create workspace.'); setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 18, padding: 32 }}>
      <div style={{ width: 42, height: 42, background: 'var(--ink)', borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icons.PrismMark size={24} />
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
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '.07em' }}>How clients address you <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--ink-faint)' }}>· optional</span></span>
            <select className="px-select" value={honorific} onChange={e => setHonorific(e.target.value)}>
              <option value="">First name (e.g. {fullName.trim().split(/\s+/)[0] || 'Jane'})</option>
              {(window.HONORIFIC_OPTIONS || []).map(h => (
                <option key={h} value={h}>{advisorFormalName({ honorific: h, fullName, fallback: h }) || h}</option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Shown in your clients' portal — e.g. "{advisorFormalName({ honorific: honorific || 'Ms.', fullName: fullName || 'Jane Advisor' })} will tailor this with you."</span>
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
        <Icons.PrismMark size={24} />
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

/* ─── ⌘K command palette (C5) ─────────────────────────────────────────
   Global advisor-UX accelerator: ⌘K / Ctrl-K opens a fuzzy launcher to jump
   to any client in the book and run the common view/account actions without
   reaching for the mouse — the highest-leverage add once a book runs to 150+
   households. Mounted in AppInner (advisor/admin surface only; the slim client
   portal never bundles this file). */
function CommandPalette() {
  const { view, setView, setActiveClientId, setActiveClient, openNumbers } = useView();
  const { role, isDemo, signOut } = useAuth();
  const { dark, toggleTheme } = useTheme();

  const [open, setOpen]   = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [sel, setSel]     = React.useState(0);
  const [clients, setClients] = React.useState(null); // null until first load
  const inputRef = React.useRef(null);
  const listRef  = React.useRef(null);

  // ⌘K / Ctrl-K toggles the palette from anywhere in the app.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset transient state each time it opens, and lazy-load the book once.
  React.useEffect(() => {
    if (!open) return;
    setQuery(''); setSel(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    if (clients === null) {
      if (isDemo || !window.db?.getClients) {
        setClients((window.clientsData || []));
      } else {
        const { authUser } = window.useAuth?.() || {};
        const advisorId = authUser?.id;
        if (!advisorId) { setClients([]); }
        else {
          // Page through the whole book so any household is reachable, not just
          // the dashboard's first roster page.
          (async () => {
            const all = [];
            for (let page = 0; page < 40; page++) {
              const res = await window.db.getClients(advisorId, { page, pageSize: 100 });
              const rows = res?.rows || [];
              all.push(...rows.map(window.db.mapClient));
              if (rows.length < 100) break;
            }
            setClients(all);
          })();
        }
      }
    }
    return () => cancelAnimationFrame(raf);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = React.useCallback(() => setOpen(false), []);

  const jumpToClient = React.useCallback((c) => {
    setActiveClientId(c.id);
    setActiveClient(c);
    setView('client');
    close();
  }, [setActiveClientId, setActiveClient, setView, close]);

  // Actions are role-aware; each is a flat launcher row with its own runner.
  const actions = React.useMemo(() => {
    const a = [];
    if ((role === 'advisor' || role === 'admin') && view !== 'advisor')
      a.push({ key: 'view-advisor', icon: 'TableCol', label: 'Go to Advisor dashboard', run: () => { setView('advisor'); close(); } });
    if (view !== 'client')
      a.push({ key: 'view-client', icon: 'Layers', label: 'Go to Client view', run: () => { setView('client'); close(); } });
    if (role === 'admin' && view !== 'admin')
      a.push({ key: 'view-admin', icon: 'Building', label: 'Go to Firm admin', run: () => { setView('admin'); close(); } });
    a.push({ key: 'numbers', icon: 'Calculator', label: 'Update household numbers', run: () => { openNumbers(); close(); } });
    a.push({ key: 'theme', icon: dark ? 'Sun' : 'Moon', label: dark ? 'Switch to light mode' : 'Switch to dark mode', run: () => { toggleTheme(); close(); } });
    a.push({ key: 'signout', icon: 'ArrowRight', label: isDemo ? 'Back to sign-in' : 'Sign out', run: () => { close(); signOut(); } });
    return a;
  }, [role, view, dark, isDemo, setView, openNumbers, toggleTheme, signOut, close]);

  // Filter both pools by a case-insensitive substring, then flatten so a single
  // selection index can walk the whole list with ↑/↓.
  const q = query.trim().toLowerCase();
  const matchedClients = React.useMemo(() => {
    const list = clients || [];
    const f = q ? list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.shortName || '').toLowerCase().includes(q) ||
      (c.tag || '').toLowerCase().includes(q)) : list;
    return f.slice(0, q ? 12 : 6); // cap the list; empty query shows a recent slice
  }, [clients, q]);
  const matchedActions = React.useMemo(
    () => q ? actions.filter(a => a.label.toLowerCase().includes(q)) : actions,
    [actions, q]);

  const flat = React.useMemo(() => [
    ...matchedActions.map(a => ({ ...a, kind: 'action' })),
    ...matchedClients.map(c => ({ kind: 'client', key: `c:${c.id}`, client: c })),
  ], [matchedActions, matchedClients]);

  React.useEffect(() => { setSel(s => Math.min(s, Math.max(0, flat.length - 1))); }, [flat.length]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape')      { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter')  {
      e.preventDefault();
      const item = flat[sel];
      if (!item) return;
      if (item.kind === 'action') item.run();
      else jumpToClient(item.client);
    }
  };

  // Keep the selected row scrolled into view as the user arrows through.
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('.px-cmdk-item.is-sel');
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel, open]);

  if (!open) return null;

  let idx = -1;
  return (
    <div className="px-cmdk-backdrop" onClick={close}>
      <div className="px-cmdk" role="dialog" aria-modal="true" aria-label="Command palette"
           onClick={e => e.stopPropagation()}>
        <div className="px-cmdk-search">
          <Icons.Search size={15} />
          <input ref={inputRef} className="px-cmdk-input" value={query} onKeyDown={onKeyDown}
                 onChange={e => { setQuery(e.target.value); setSel(0); }}
                 placeholder="Jump to a client or run a command…"
                 aria-label="Search clients and commands" autoComplete="off" spellCheck={false} />
        </div>

        <div className="px-cmdk-list" ref={listRef}>
          {flat.length === 0 && (
            <div className="px-cmdk-empty">
              {clients === null ? 'Loading your book…' : 'No matches'}
            </div>
          )}

          {matchedActions.length > 0 && <div className="px-cmdk-section">Actions</div>}
          {matchedActions.map(a => {
            idx++; const i = idx; const I = Icons[a.icon] || Icons.ArrowRight;
            return (
              <div key={a.key} className={`px-cmdk-item ${i === sel ? 'is-sel' : ''}`}
                   onMouseEnter={() => setSel(i)} onClick={a.run} role="button">
                <span className="px-cmdk-item-icon"><I size={14} /></span>
                <span className="px-cmdk-item-label">{a.label}</span>
              </div>
            );
          })}

          {matchedClients.length > 0 && (
            <div className="px-cmdk-section">{q ? 'Clients' : 'Recent clients'}</div>
          )}
          {matchedClients.map(c => {
            idx++; const i = idx;
            return (
              <div key={`c:${c.id}`} className={`px-cmdk-item ${i === sel ? 'is-sel' : ''}`}
                   onMouseEnter={() => setSel(i)} onClick={() => jumpToClient(c)} role="button">
                <span className="px-cmdk-item-avatar">{c.initials || (c.name || '?').slice(0, 1)}</span>
                <span className="px-cmdk-item-label">{c.name}</span>
                {c.tag && c.tag !== '—' && <span className="px-cmdk-item-sub">{c.tag}</span>}
              </div>
            );
          })}
        </div>

        <div className="px-cmdk-hint">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/* ─── App inner (all providers are already mounted above) ─────────── */
function AppInner() {
  const { view, setView, activeClientId, numbersOpen, openNumbers, closeNumbers } = useView();
  const { loading, session, role, isDemo, signOut, authUser } = useAuth();
  const { dark, toggleTheme } = useTheme();

  // Platform-owner probe (founder tier). One cheap `whoami` per session; the
  // edge function checks the px_platform_owners allowlist server-side. Only
  // advisor/admin sessions even ask — clients and demo never do.
  const [platformOwner, setPlatformOwner] = React.useState(false);
  React.useEffect(() => {
    if (isDemo || !(role === 'advisor' || role === 'admin')) return;
    window.db.platformAdmin?.('whoami').then(r => setPlatformOwner(r?.owner === true));
  }, [role, isDemo]);

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

  // Opening a new page should start at the top. The window/body is the scroller and
  // the topbar is sticky, so without this a freshly-rendered view inherits the prior
  // page's scroll position and appears mid-scroll. Always reset on a view switch;
  // reset on a client switch only while on the portal (so opening a client's Numbers
  // drawer from the advisor view doesn't jump the roster). A deep-link to a specific
  // phase re-scrolls itself ~150ms after mount (ClientPortal), which wins over this.
  React.useEffect(() => { window.scrollTo(0, 0); }, [view]);
  React.useEffect(() => { if (view === 'client') window.scrollTo(0, 0); }, [activeClientId]);

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

  // Suspended firm (platform tier, migration 035): the advisor workspace locks
  // until the platform owner reactivates. Data is retained, nothing is deleted.
  if (!isDemo && (role === 'advisor' || role === 'admin') && authUser?.firms?.status === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 14, padding: 32, textAlign: 'center' }}>
        <Icons.Lock size={22} style={{ color: 'var(--ink-faint)' }} />
        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)' }}>
          This workspace is paused
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-mute)', lineHeight: 1.55, maxWidth: 400 }}>
          Your firm's Prism workspace has been suspended by the platform. Your data is intact —
          contact Prism support to restore access.
        </div>
        <button className="px-btn px-btn-ghost" onClick={signOut}>
          <Icons.ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="px-app">
      <Topbar onOpenNumbers={openNumbers} dark={dark} toggleTheme={toggleTheme} platformOwner={platformOwner} />
      <CommandPalette />
      {view === 'platform' ? <PlatformOwnerDashboard />
       : view === 'admin'   ? <FirmAdminDashboard />
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
          <ProspectProvider>
            <NotificationProvider>
              <ProfileProvider>
                <TaskProvider>
                  <AppInner />
                </TaskProvider>
              </ProfileProvider>
            </NotificationProvider>
          </ProspectProvider>
        </ViewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

window.App = App;

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

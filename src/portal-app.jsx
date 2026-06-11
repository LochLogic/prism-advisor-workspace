// Prism - Client Portal entry (/portal). This is a SECOND bundle (dist/portal.js)
// built from the client-facing source subset only: it deliberately excludes the
// advisor dashboard, firm-admin, advisor modals, and bulk-import code. The result
// is a smaller client payload AND a smaller attack surface in a client's browser -
// a client never downloads advisor/admin logic.
//
// Shared providers/components come from the same source files the advisor app uses
// (store, auth, components, shell, numbers-panel, client-portal); only the shell
// here is portal-specific.

// Marks this runtime as the portal so shared code (e.g. app.jsx's client→/portal
// redirect) never bounces us in a loop. Set at load time, before React renders.
window.__pxIsPortal = true;

/* ─── Web push (round 13) ─────────────────────────────────────────
   The portal is an installable PWA (manifest + /portal-sw.js); pushes arrive
   on new advisor messages / document requests / acknowledgements (send-push
   edge fn). The VAPID PUBLIC key is non-secret by design - it only identifies
   the application server to the browser's push service. */
const PUSH_VAPID_PUBLIC_KEY = 'BAfYlDcSv2qsk8-FnhSQm-UET828k21ruVzq7aNRZf_PuDSRGj64EfowCtuAheqesFlyt2U5kdhNITlCSpu2FnQ';

const _pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function _vapidKeyBytes(s) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function _subscribePush(reg) {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: _vapidKeyBytes(PUSH_VAPID_PUBLIC_KEY),
  });
  const saved = await window.db?.savePushSubscription?.(sub);
  return saved ? sub : null;
}

/* Bell-plus button in the topbar: visible until notifications are enabled.
   Registration is silent; subscribing waits for the user's click (the
   permission prompt requires a gesture). If permission is already granted
   (returning visit / reinstall), we re-sync the subscription quietly. */
function PushSetupButton() {
  const [state, setState] = React.useState('hidden'); // hidden|idle|denied
  React.useEffect(() => {
    if (!_pushSupported() || !window.__sb) return;
    let dead = false;
    navigator.serviceWorker.register('/portal-sw.js', { scope: '/portal/' }).then(async (reg) => {
      if (dead) return;
      if (Notification.permission === 'granted') {
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        if (sub) window.db?.savePushSubscription?.(sub);   // keep the row fresh
        else await _subscribePush(reg).catch(() => {});
        return; // stays hidden - already on
      }
      setState(Notification.permission === 'denied' ? 'denied' : 'idle');
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  if (state !== 'idle') return null; // hidden when on/unsupported; denied is the browser's to undo
  const enable = async () => {
    try {
      if (await Notification.requestPermission() !== 'granted') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      await _subscribePush(reg);
      window.db?.track?.('push_subscribed');
      setState('hidden');
    } catch (e) { console.warn('[push] enable:', e.message); setState('hidden'); }
  };
  return (
    <button className="px-icon-btn" onClick={enable}
      aria-label="Turn on notifications for new messages and requests"
      title="Turn on notifications">
      <Icons.Bell size={14} />
    </button>
  );
}

/* ─── Slim client topbar (no view switcher, no admin) ────────────── */
const PortalTopbar = ({ onOpenNumbers, dark, toggleTheme }) => {
  const { activeClient } = useView();
  const brand = useFirmBrand();
  // "Powered by Prism" attribution: shown when the firm white-labels the portal
  // and hasn't turned attribution off (firms.show_powered_by, default true).
  const branded = !!(brand && brand.name);
  const poweredBy = branded && brand.show_powered_by !== false;

  return (
    <header className="px-topbar">
      <div className="px-brand" aria-label={branded ? brand.name : 'Prism'}>
        {brand?.logo_url
          ? <img className="px-brand-logo" src={brand.logo_url} alt={brand.name || 'Firm logo'} />
          : <div className="px-brand-mark"><Icons.PrismMark size={16} /></div>}
        <div>
          <div className="px-brand-name">{branded ? brand.name : 'Prism'}</div>
          <div className="px-brand-sub">Client Portal{poweredBy ? ' · powered by Prism' : ''}</div>
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
        <PushSetupButton />
        <NotificationBell />
        <AccountChip view="client" activeClient={activeClient} />
      </div>
    </header>
  );
};

/* ─── Portal inner - auth gate + bind the signed-in client's household ─ */
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

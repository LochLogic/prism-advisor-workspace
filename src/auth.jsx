// Prism — auth context. Supabase session, role detection (advisor / client), sign-out.
// DEMO_MODE is true when __sb is null (CDN failed) OR when px_demo flag is set
// (user clicked "Continue in demo mode" on login.html). In demo mode auth is bypassed
// entirely and the advisor role is granted so the full app is accessible.

const DEMO_MODE = !window.__sb || sessionStorage.getItem('px_demo') === '1';

const AuthContext = React.createContext(null);

function AuthProvider({ children }) {
  const [session,  setSession]  = React.useState(null);
  const [role,     setRole]     = React.useState(DEMO_MODE ? 'advisor' : null);
  const [authUser, setAuthUser] = React.useState(null);
  const [loading,  setLoading]  = React.useState(!DEMO_MODE);

  // Query advisors → clients tables to determine role
  async function detectRole(sess) {
    try {
      const { data: adv } = await window.__sb
        .from('advisors')
        .select('id, full_name, firm_id, email, role, firms(name)')
        .eq('auth_user_id', sess.user.id)
        .maybeSingle();

      if (adv) { setRole('advisor'); setAuthUser(adv); setLoading(false); return; }

      const { data: cli } = await window.__sb
        .from('clients')
        .select('id, household_name, short_name, advisor_id, current_phase')
        .eq('auth_user_id', sess.user.id)
        .maybeSingle();

      if (cli) { setRole('client'); setAuthUser(cli); setLoading(false); return; }

      // Authenticated but no DB record — require registration before granting access
      setRole('unregistered');
      setLoading(false);
    } catch {
      setRole('unregistered');
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (DEMO_MODE) return; // skip all auth checks

    // onAuthStateChange fires immediately with INITIAL_SESSION
    const { data: { subscription } } = window.__sb.auth.onAuthStateChange((event, sess) => {
      setSession(sess);

      if (sess) {
        detectRole(sess);
        return;
      }

      if (event === 'INITIAL_SESSION') {
        // No session — but check for a PKCE callback code before redirecting
        const inCallback = new URLSearchParams(window.location.search).has('code');
        if (!inCallback) {
          setLoading(false);
          window.location.href = 'login.html';
        }
        // If there IS a code, the SDK will exchange it and fire SIGNED_IN next
      }

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setRole(null);
        setAuthUser(null);
        setLoading(false);
        window.location.href = 'login.html';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem('px_demo');
    if (window.__sb) await window.__sb.auth.signOut();
    window.location.href = 'login.html';
  };

  return (
    <AuthContext.Provider value={{ session, role, authUser, loading, signOut, isDemo: DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => React.useContext(AuthContext);

window.AuthProvider = AuthProvider;
window.useAuth = useAuth;

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

  // Replace in-scope phasesData (defined as `let` in data.jsx) with DB content.
  // Called before setLoading(false) so the app renders with up-to-date phases.
  async function mergePhasesWithDB() {
    try {
      const { data } = await window.__sb
        .from('phase_library_resolved')
        .select('*');
      if (data && data.length) {
        // phasesData is a `let` in the same bundle scope (data.jsx)
        phasesData = data; // eslint-disable-line no-undef
      }
    } catch (e) {
      console.warn('[auth] mergePhasesWithDB:', e.message);
      // Fall through — phasesData stays as the JS default
    }
  }

  // Query advisors → clients tables to determine role
  async function detectRole(sess, event) {
    // MFA enforcement: a session with an enrolled TOTP factor must reach aal2.
    // If it's only aal1, send the user back to login.html to complete the challenge.
    try {
      const { data: aal } = await window.__sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        window.location.href = 'login.html';
        return;
      }
    } catch (e) { /* MFA unavailable — continue */ }

    const auditSignin = () => {
      if (event === 'SIGNED_IN' && window.__pxAuthActor?.id) {
        window.db?.audit('auth.signin', { entityType: 'auth', entityId: sess.user.id,
          summary: `Signed in (${window.__pxAuthActor.role})` });
      }
    };
    try {
      const { data: adv } = await window.__sb
        .from('advisors')
        .select('id, full_name, firm_id, email, role, firms(name)')
        .eq('auth_user_id', sess.user.id)
        .maybeSingle();

      if (adv) {
        await mergePhasesWithDB();
        // DB role column: 'advisor' | 'admin' | 'analyst'
        const appRole = adv.role === 'admin' ? 'admin' : 'advisor';
        // Capture actor identity for the audit trail (auth uid, not advisors.id)
        window.__pxAuthActor = { id: sess.user.id, role: appRole, email: adv.email, firm_id: adv.firm_id };
        auditSignin();
        setRole(appRole); setAuthUser(adv); setLoading(false); return;
      }

      const { data: cli } = await window.__sb
        .from('clients')
        .select('id, household_name, short_name, advisor_id, current_phase, firm_id')
        .eq('auth_user_id', sess.user.id)
        .maybeSingle();

      if (cli) {
        await mergePhasesWithDB();
        window.__pxAuthActor = { id: sess.user.id, role: 'client', email: sess.user.email, firm_id: cli.firm_id };
        auditSignin();
        setRole('client'); setAuthUser(cli); setLoading(false); return;
      }

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
        detectRole(sess, event);
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
    if (window.__pxAuthActor?.id) {
      await window.db?.audit('auth.signout', { entityType: 'auth',
        entityId: window.__pxAuthActor.id, summary: 'Signed out' });
    }
    window.__pxAuthActor = null;
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

// Supabase client — must load AFTER the supabase UMD script but BEFORE any code that uses it.
// Lives on window.__sb. If the CDN fails, __sb is null and the app falls back to a local-only demo.
(function () {
  const SUPABASE_URL = 'https://pgaujaxlfykqpuffudzq.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_C2lepSE01CA03z1Z9BKfwQ_YVaBe2kw';

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[FinFire] Supabase client failed to load — running in local-only mode.');
    window.__sb = null;
    return;
  }

  window.__sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
})();

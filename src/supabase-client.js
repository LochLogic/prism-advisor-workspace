// Supabase client - must load AFTER the supabase UMD script but BEFORE any code that uses it.
// Lives on window.__sb. If the CDN fails, __sb is null and the app falls back to a local-only demo.
(function () {
  const SUPABASE_URL = 'https://phabxcijbbphfxvjedfj.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_Aj_SLwVNmZZwlZ02RDi0zA_Bz79h5Il';

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[Prism] Supabase client failed to load - running in local-only mode.');
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

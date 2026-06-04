// Prism — lightweight client error reporter.
// Captures uncaught errors, unhandled promise rejections, and React error-boundary
// errors, and best-effort POSTs them to the `log-error` Edge Function. It NEVER
// throws and NEVER blocks the app; if the function isn't deployed (or CORS blocks
// it in dev) the send fails silently. The last 20 errors are also kept in
// window.__pxErrors so they're inspectable on the spot.
(function () {
  var ENDPOINT = 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/log-error';
  var ANON = 'sb_publishable_Aj_SLwVNmZZwlZ02RDi0zA_Bz79h5Il';

  window.__pxErrors = window.__pxErrors || [];

  window.__pxReportError = function (err, context) {
    try {
      var rec = {
        message: (err && (err.message || String(err))) || 'unknown error',
        stack: err && err.stack ? String(err.stack).slice(0, 5000) : null,
        url: location.href,
        user_agent: navigator.userAgent,
        context: context || null,
        at: new Date().toISOString(),
      };
      window.__pxErrors.unshift(rec);
      if (window.__pxErrors.length > 20) window.__pxErrors.length = 20;
      // Best-effort remote log (keepalive so it survives a reload). Swallow all errors.
      fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'apikey': ANON },
        body: JSON.stringify(rec),
      }).catch(function () {});
    } catch (e) { /* reporting must never break the app */ }
  };

  window.addEventListener('error', function (e) {
    window.__pxReportError(e.error || { message: e.message }, { type: 'window.error', source: e.filename, line: e.lineno });
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__pxReportError(e.reason || { message: 'unhandledrejection' }, { type: 'unhandledrejection' });
  });
})();

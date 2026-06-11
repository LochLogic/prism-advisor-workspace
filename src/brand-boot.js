// Prism - pre-auth white-label brand boot (login / signup / landing).
// The in-app brand engine lives in store.jsx (bundle-only); these static pages
// load this tiny standalone instead. Paint order mirrors the app: localStorage
// cache first (instant, no flash), then the anon px_brand_for_slug RPC when the
// host is a firm subdomain ({slug}.prismaw.com) - resolved result re-caches.
// Loaded with `defer` (after vendor/supabase.js + src/supabase-client.js).
(function () {
  var DEFAULT_COLOR = '#1c2e4a';
  var CACHE_KEY = 'px_brand:' + window.location.hostname;

  // Trust boundary: the cache is client-writable localStorage, and the RPC is
  // anon-callable - accept only the whitelisted, validated fields.
  function sanitizeBrand(b) {
    if (!b || typeof b !== 'object') return null;
    var out = {};
    if (typeof b.name === 'string') out.name = b.name.slice(0, 120);
    if (typeof b.slug === 'string') out.slug = b.slug.slice(0, 63);
    if (/^#[0-9a-f]{6}$/i.test(b.brand_color || '')) out.brand_color = b.brand_color.toLowerCase();
    if (typeof b.logo_url === 'string' && /^data:image\//.test(b.logo_url) && b.logo_url.length <= 300000) out.logo_url = b.logo_url;
    out.show_powered_by = b.show_powered_by !== false;
    return out;
  }
  window.__pxSanitizeBrand = sanitizeBrand;

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var ch = function (x) { return Math.max(0, Math.min(255, Math.round(x * f))).toString(16).padStart(2, '0'); };
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (c) { return ch(c); }).join('');
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function paint(brand) {
    var b = sanitizeBrand(brand);
    if (!b) return;
    var root = document.documentElement.style;
    if (b.brand_color && b.brand_color !== DEFAULT_COLOR) {
      root.setProperty('--brand', b.brand_color);
      root.setProperty('--brand-hover', shade(b.brand_color, 0.85));
      root.setProperty('--accent', b.brand_color);
      root.setProperty('--accent-soft', rgba(b.brand_color, 0.14));
      root.setProperty('--accent-line', rgba(b.brand_color, 0.40));
    }
    var onReady = function () {
      var nameEl = document.querySelector('[data-brand-name]');
      if (nameEl && b.name) nameEl.textContent = b.name;
      var subEl = document.querySelector('[data-brand-sub]');
      if (subEl && b.name) subEl.textContent = b.show_powered_by ? 'Powered by Prism' : 'Client & Advisor Portal';
      var markEl = document.querySelector('[data-brand-mark]');
      if (markEl && b.logo_url) {
        var img = document.createElement('img');
        img.src = b.logo_url;
        img.alt = b.name || 'Firm logo';
        img.style.width = '44px'; img.style.height = '44px';
        img.style.borderRadius = '11px'; img.style.objectFit = 'contain';
        markEl.replaceChildren(img);
        markEl.style.background = 'transparent';
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  }

  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) paint(JSON.parse(cached));
  } catch (e) {}

  var m = /^([a-z0-9-]+)\.prismaw\.com$/i.exec(window.location.hostname);
  var slug = m && ['www', 'app'].indexOf(m[1].toLowerCase()) === -1 ? m[1].toLowerCase() : null;
  if (slug && window.__sb) {
    window.__sb.rpc('px_brand_for_slug', { p_slug: slug }).then(function (res) {
      var b = res && res.data && (Array.isArray(res.data) ? res.data[0] : res.data);
      var clean = sanitizeBrand(b);
      if (!clean) return;
      paint(clean);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(clean)); } catch (e) {}
    }).catch(function () {});
  }
})();

// Prism - portal service worker (push + notification click only).
// NOT in build-files.mjs: copied verbatim by build.mjs to _site/portal-sw.js
// (root path so its scope can cover /portal/). Deliberately NO fetch/cache
// handler - every asset URL is content-hash-busted by the build, and a cache
// layer here could serve stale bundles past a deploy.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* opaque payload */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Your advisor', {
    body:  data.body || 'You have new activity in your portal.',
    tag:   data.tag || 'prism-portal',
    icon:  '/icons/portal-192.png',
    badge: '/icons/portal-192.png',
    data:  { url: data.url || '/portal' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/portal';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.includes('/portal') && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});

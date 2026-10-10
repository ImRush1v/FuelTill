/* FuelTill public demo app-shell cache.
 * Scope is automatically resolved to /FuelTill/ on GitHub Pages.
 * Do not cache Firebase, auth responses, financial API data or receipt files.
 */
const VERSION = 'fueltill-shell-v1.2';
const ROOT = new URL(self.registration.scope);
const scoped = path => new URL(path, ROOT).toString();
const APP_SHELL = ['','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'].map(scoped);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('fueltill-shell-') && key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (url.pathname.includes('/__/') || url.pathname.includes('/api/') || url.pathname.includes('/auth/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const responseCopy = response.clone();
        void caches.open(VERSION).then(cache => cache.put(scoped(''), responseCopy));
      }
      return response;
    }).catch(() => caches.match(scoped(''))));
    return;
  }
  if (url.pathname.startsWith(scoped('assets/').replace(ROOT.origin,'')) ||
      url.pathname.startsWith(scoped('icons/').replace(ROOT.origin,'')) ||
      url.pathname === new URL(scoped('manifest.webmanifest')).pathname) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(VERSION).then(cache => cache.put(request, copy));
      }
      return response;
    })));
  }
});

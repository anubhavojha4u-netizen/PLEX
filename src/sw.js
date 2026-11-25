// Service worker: keeps the app shell on the device so PLEX opens offline. Rig data never passes through here (it comes from PLEX Cloud).
const VERSION = 'plex-shell-1.4.0';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'report.html', 'report.css', 'report.js', 'upload.html', 'upload.js', 'news.html', 'news.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSION).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
// network first for the shell (fresh code when online), cache when offline; other origins are not touched
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

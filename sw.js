// KasirBosku service worker: keeps the app and its libraries on the device so it opens without internet.
// build.mjs fills VERSION and FILES. Every file name carries its version, so a saved copy is never out of date.
const VERSION = 'kb-5f53c4b3bf';
const FILES = ["./","app.e9a01518b5.js","app.23e879b1f8.css","manifest.webmanifest","privasi.html","syarat.html","legal.css","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","vendor/react-18.3.1.js","vendor/react-dom-18.3.1.js","vendor/prop-types-15.8.1.js","vendor/recharts-2.12.7.js","vendor/exceljs-4.4.0.js","vendor/jspdf-4.2.1.js","vendor/jspdf-autotable-5.0.9.js","vendor/jszip-3.10.1.js","vendor/inter-variable-5.0.20.woff2"];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The API (sync, login, photos) always goes to the network; the app handles being offline itself
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // The page: newest version when online, the saved copy when offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(VERSION)).put('./', res.clone());
        return res;
      } catch {
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: saved copy first, then the network (and keep what comes back)
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  })());
});

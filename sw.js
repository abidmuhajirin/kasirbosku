// KasirBosku service worker: keeps the app and its libraries on the device so it opens without internet.
// Naikkan VERSION setiap kali daftar LIBS berubah (index.html tidak perlu: selalu diambil baru saat online).
const VERSION = 'kb-v6';
const APP = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
// Fetched in CORS mode so they also satisfy <script crossorigin> tags
const LIBS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/prop-types@15.8.1/prop-types.min.js',
  'https://unpkg.com/recharts@2.12.7/umd/Recharts.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js'
];
// Loaded by plain <script>/<link> tags (no-cors)
const OPAQUE = [
  'https://cdn.tailwindcss.com/3.4.5',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP);
    await Promise.all([
      ...LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && cache.put(u, r))),
      ...OPAQUE.map(u => fetch(u, { mode: 'no-cors' }).then(r => cache.put(u, r)))
    ]);
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
  if (url.hostname.startsWith('api.') || url.pathname.startsWith('/api/')) return;

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

  // Libraries, fonts, icons: saved copy first, then the network (and keep what comes back)
  const sameOrigin = url.origin === self.location.origin;
  const known = sameOrigin || ['unpkg.com', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if (!known) return;
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') (await caches.open(VERSION)).put(req, res.clone());
    return res;
  })());
});

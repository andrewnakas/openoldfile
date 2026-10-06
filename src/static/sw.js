// Offline support. Everything a viewer needs is cached as it is used: wasm
// and other /vendor/ files cache-first, scripts, styles and pages
// network-first with the cached copy as the offline fallback. Nothing a visitor opens is ever cached:
// only this site's own GET requests are.

const CACHE = 'oof-v1';
const ASSETS = /^\/(js|css|vendor)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key !== 'handoff') await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname === '/__handoff') return;
  // Large vendor files (wasm, sound bank) are immutable by name: cache-first.
  if (url.pathname.startsWith('/vendor/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  // Scripts and styles: network-first, so app and engines always come from
  // the same deploy; the cached copy is only an offline fallback.
  if (ASSETS.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (req.mode === 'navigate') event.respondWith(networkFirst(req, '/'));
});

async function networkFirst(req, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (fallback && (await cache.match(fallback))) || Response.error();
  }
}

const CACHE = 'nilefound-static-v4';
const OFFLINE = '/offline.html';
const MAX_CACHE_ENTRIES = 60;
const PRECACHE = [
  OFFLINE,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  const evictable = keys.filter((req) => !PRECACHE.includes(new URL(req.url).pathname));
  await Promise.all(evictable.slice(0, excess).map((req) => cache.delete(req)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/') || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (/\.(?:js|css|woff2)$/.test(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(async (cache) => {
              await cache.put(request, copy);
              await trimCache(cache, MAX_CACHE_ENTRIES);
            });
          }
          return response;
        })
      )
    );
  }
});

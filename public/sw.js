const CACHE = 'nilefound-static-v6';
const OFFLINE = '/offline.html';
const NAVIGATION_TIMEOUT_MS = 4000;
const MAX_CACHE_ENTRIES = 60;
const PRECACHE = [
  OFFLINE,
  '/index.html',
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

async function networkFirstNavigation(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);

  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put('/index.html', response.clone());
      return response;
    }
    throw new Error('Non-OK navigation response');
  } catch {
    const cachedShell = await caches.match('/index.html');
    if (cachedShell) return cachedShell;
    const offlineFallback = await caches.match(OFFLINE);
    return offlineFallback || new Response('Offline', { status: 503, statusText: 'Offline' });
  } finally {
    clearTimeout(timeoutId);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});

const FIREBASE_BYPASS_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'firebaseappcheck.googleapis.com',
  'content-firebaseappcheck.googleapis.com',
  'firebaseinstallations.googleapis.com',
]);

function isFirebaseOrEmulatorHost(hostname) {
  if (FIREBASE_BYPASS_HOSTS.has(hostname)) return true;
  return (
    hostname.endsWith('.firebasestorage.app') ||
    hostname.endsWith('.firebaseapp.com') ||
    hostname.endsWith('.googleapis.com')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (isFirebaseOrEmulatorHost(url.hostname)) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/') || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(networkFirstNavigation(request));
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

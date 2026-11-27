/* Fitness Tracker Secure App-Shell Service Worker (v2.0.0)
 * Security invariant: NEVER cache /api/* responses, cross-origin requests,
 * non-GET requests, or any response containing credentials/Set-Cookie headers.
 */

const CACHE_NAME = 'ft-shell-v2.0.0';
const PRECACHE_URLS = /* __PRECACHE_MANIFEST__ */ [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

function isCacheableStaticRequest(request) {
  if (request.method !== 'GET') return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return false;
  return true;
}

function isCacheableResponse(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (response.headers.has('Set-Cookie')) return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cacheControl)) return false;
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('ft-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableStaticRequest(request)) {
    return;
  }

  // SPA navigation requests: network-first with cached /index.html fallback for offline launch
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static app-shell assets (JS, CSS, icons, manifest): cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (isCacheableResponse(response)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

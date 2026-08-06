const CACHE_NAME = 'ekhtsasi-v2';

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

self.addEventListener('fetch', event => {
  // Never cache POST requests or non-http requests (e.g. chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Network-first strategy for everything to ensure updates in development
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache successful responses (not 404s, etc)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
});


const CACHE_NAME = 'antara-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/Antara_App_Icon_512.png',
  '/Antara_Logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => console.log("Cache pre-fill error during sw install:", err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Only intercept HTTP/HTTPS GET requests (excludes browser extensions and non-GET requests)
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Network First Strategy
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If network request succeeds, update the cache copy dynamically
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(e.request);
      })
  );
});

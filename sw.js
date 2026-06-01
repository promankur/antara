const CACHE_NAME = 'antara-cache-v1';
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
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

const CACHE_NAME = 'ituze';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing and pre-caching core assets...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating and clearing old caches...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        console.warn(`[Service Worker] Network failed for: ${event.request.url}. Fetching from cache...`);
        
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.mode === 'navigate') {
          console.log('[Service Worker] Route not cached. Serving default offline page.');
          const offlinePage = await cache.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
        }

        return new Response('Network error occurred and no cached content matches.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Listen for messages from the front-end script
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STATUS_CHANGE') {
    console.log(`[Service Worker] Main application reported status change: User is now ${event.data.status.toUpperCase()}`);
  }
});

const CACHE_NAME = 'ituze';
const OFFLINE_URL = '/offline.html';
const OFFLINE_IMAGE = '/images/ituze.svg';

const STATIC_ASSETS = [
  '/',
  '/home',
  OFFLINE_URL,
  OFFLINE_IMAGE,
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing and updating core assets in unified cache...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating and taking immediate control...');
  event.waitUntil(self.clients.claim());
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
          if (url.origin === self.location.origin) {
            cache.put(event.request, networkResponse.clone());
          }
        }

        return networkResponse;
      } catch (error) {
        console.warn(`[Service Worker] Network failed for: ${event.request.url}. Fetching from cache...`);
        
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.destination === 'image') {
          const fallbackImage = await cache.match(OFFLINE_IMAGE);
          if (fallbackImage) return fallbackImage;
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STATUS_CHANGE') {
    console.log(`[Service Worker] Main application reported status change: User is now ${event.data.status.toUpperCase()}`);
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Notification', body: 'New updates available!' };
  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(event.notification.data.url);
    })
  );
});

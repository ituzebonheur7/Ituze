importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

const OFFLINE_HTML = '/offline.html';
const FALLBACK_IMAGE = '/images/ituze.png'; 

workbox.precaching.precacheAndRoute([
  { url: OFFLINE_HTML, revision: '1.0.1' },
  { url: FALLBACK_IMAGE, revision: '1.0.0' }
]);

workbox.routing.registerRoute(
  ({ request }) => 
    request.destination === 'style' || 
    request.destination === 'script' || 
    request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets-cache',
  })
);

workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

workbox.routing.registerRoute(
  ({ request }) => request.destination === 'document',
  async ({ request }) => {
    const url = new URL(request.url);

    try {
      const networkResponse = await fetch(request);
      
      const cache = await caches.open('html-cache');
      cache.put(request, networkResponse.clone());
      
      return networkResponse;
    } catch (error) {
      
      if (url.searchParams.get('offline_accepted') === 'true') {
         const cache = await caches.open('html-cache');
         const cachedResponse = await cache.match(request, { ignoreSearch: true });
         
         if (cachedResponse) {
           return cachedResponse;
         }
      }
      
      return caches.match(OFFLINE_HTML);
    }
  }
);

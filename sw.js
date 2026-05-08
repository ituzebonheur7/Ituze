importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

workbox.core.skipWaiting();
workbox.core.clientsClaim();

const OFFLINE_HTML = '/offline.html';
const FALLBACK_IMAGE = '/images/ituze.png';

workbox.precaching.precacheAndRoute([
  { url: '/', revision: null },
  { url: '/codeviewer.html', revision: null },
  { url: '/favicon.ico', revision: null },
  { url: '/feedback.html', revision: null },
  { url: '/games.html', revision: null },
  { url: '/hunter.html', revision: null },
  { url: '/index.html', revision: null },
  { url: '/manifest.json', revision: null },
  { url: '/offline.html', revision: '1.0.1' },
  { url: '/qrcode.html', revision: null },
  { url: '/search.html', revision: null },
  { url: '/what.html', revision: null },
  { url: '/wrong.html', revision: null },
  { url: '/images/404.png', revision: null },
  { url: '/images/code.png', revision: null },
  { url: '/images/game.png', revision: null },
  { url: '/images/ituze-qr.png', revision: null },
  { url: '/images/ituze.png', revision: '1.0.0' },
  { url: '/js/router.js', revision: null },
  { url: '/js/screen.js', revision: null },
]);

// Use StaleWhileRevalidate for CSS, JS, and worker requests
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets-cache',
  })
);

// Use CacheFirst for image requests
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Use NetworkFirst for navigation requests
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      const networkResponse = await fetch(event.request);
      return networkResponse;
    } catch (error) {
      const cache = await caches.open('html-cache');
      const cachedResponse = await cache.match(OFFLINE_HTML);
      return cachedResponse;
    }
  }
);

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const CACHE_NAME = 'matrix-offline-v1';
const OFFLINE_URL = '/offline.html';

// Pre-cache the offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
});

// Cache CSS and JS (Stale-While-Revalidate)
workbox.routing.registerRoute(
  ({request}) => request.destination === 'style' || request.destination === 'script',
  new workbox.strategies.StaleWhileRevalidate()
);

// Cache HTML (Network-First)
workbox.routing.registerRoute(
  ({request}) => request.destination === 'document',
  new workbox.strategies.NetworkFirst()
);

// Fallback logic: If network fails and page isn't in cache, show offline.html
workbox.routing.setCatchHandler(async ({event}) => {
  if (event.request.destination === 'document') {
    return caches.match(OFFLINE_URL);
  }
  return Response.error();
});

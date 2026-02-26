importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

const OFFLINE_URL = '/offline.html';

workbox.precaching.precacheAndRoute([
  { url: OFFLINE_URL, revision: null }
]);

workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script',
  new workbox.strategies.StaleWhileRevalidate()
);

workbox.routing.registerRoute(
  ({ request }) => request.destination === 'document',
  async ({ event }) => {

    if (!self.navigator.onLine) {
      return caches.match(OFFLINE_URL);
    }

    // Otherwise try network
    try {
      return await fetch(event.request);
    } catch (error) {
      return caches.match(OFFLINE_URL);
    }
  }
);

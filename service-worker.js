importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

workbox.routing.registerRoute(
    ({request}) => request.destination === 'style' || request.destination === 'script',
    new workbox.strategies.StaleWhileRevalidate()
);

workbox.routing.registerRoute(
    ({request}) => request.destination === 'document',
    new workbox.strategies.NetworkFirst()
);

const {warmStrategyCache} = workbox.recipes;
const {CacheFirst} = workbox.strategies;
const {CacheableResponsePlugin} = workbox.cacheable_response;

const pages = ['.'];
const strategy = new CacheFirst();

warmStrategyCache({
  urls: pages,
  strategy,
});

workbox.routing.registerRoute(({url}) => pages.includes(url.pathname), strategy);
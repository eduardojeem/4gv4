/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist'
import { isPublicStaticAsset, obsoletePrivateCache } from './cache-policy'

declare const self: ServiceWorkerGlobalScope

// No automatic HTML precache or navigation cache: tenant/session data stays private.
const worker = new Serwist({
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ url, request }) => isPublicStaticAsset(url, self.location.origin, request.method),
      handler: new CacheFirst({
        cacheName: 'mitiendapy-static-v1',
        plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    { matcher: () => true, handler: new NetworkOnly() },
  ],
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter(obsoletePrivateCache).map((name) => caches.delete(name)))))
})
worker.addEventListeners()

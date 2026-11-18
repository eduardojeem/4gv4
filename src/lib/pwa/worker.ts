/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, Serwist } from 'serwist'
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
    // Nada más pasa por el service worker: las páginas, la API y los scripts de
    // otros sitios van directo a la red. Antes una regla «todo, solo red» los
    // interceptaba: el worker pedía él mismo el script de Cloudflare (y la CSP
    // lo bloqueaba por connect-src) y una navegación cortada terminaba en
    // «no-response» en vez de la página de error normal del navegador.
  ],
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter(obsoletePrivateCache).map((name) => caches.delete(name)))))
})
worker.addEventListeners()

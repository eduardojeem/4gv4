/**
 * Service worker de la plataforma.
 *
 * Reglas, por orden de importancia:
 *
 * 1. NUNCA se cachea `/api/`. Este sistema maneja stock, precios, ventas y
 *    saldos: servir una respuesta vieja desde cache seria mostrar plata o
 *    inventario que no existe. El service worker anterior hacia cache-first
 *    para todo, incluidas las APIs.
 * 2. NUNCA se cachea HTML. Las paginas del panel son por usuario y por
 *    organizacion; guardarlas en cache filtraria datos entre cuentas o entre
 *    tiendas en un dispositivo compartido.
 * 3. Solo se cachean assets inmutables (`/_next/static/`, iconos). Llevan hash
 *    en el nombre, asi que no pueden quedar desactualizados.
 *
 * Resultado: la app abre offline con una pagina de aviso y los estaticos ya
 * descargados, sin arriesgar datos obsoletos ni fugas entre cuentas.
 */

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      // Solo la pagina offline: precargar rutas de la app fallaba entero si una
      // sola URL no existia (addAll rechaza en bloque) y dejaba el SW sin instalar.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name !== STATIC_CACHE).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Solo GET: un POST/PATCH jamas debe pasar por cache.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Otro origen: que lo maneje el navegador.
  if (url.origin !== self.location.origin) return

  // Datos siempre frescos.
  if (url.pathname.startsWith('/api/')) return

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        // Todo el camino va dentro de un try: si el Cache Storage falla (cuota
        // llena, modo privado, permisos), el asset debe seguir bajando de la red
        // en vez de que la peticion quede rechazada y la pagina sin estilos.
        try {
          const cached = await caches.match(request)
          if (cached) return cached
        } catch {
          return fetch(request)
        }

        const response = await fetch(request)

        try {
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE)
            await cache.put(request, response.clone())
          }
        } catch {
          // Guardar en cache es opcional: si no se puede, se sirve igual.
        }

        return response
      })(),
    )
    return
  }

  // Navegacion: siempre a la red. Si no hay conexion, se muestra el aviso
  // offline en vez de una pagina en blanco del navegador.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cached = await caches.match(OFFLINE_URL)
          return cached ?? Response.error()
        }
      })(),
    )
  }
})

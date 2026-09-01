"use client"

import { useEffect } from 'react'

import { isServiceWorkerDisabled, unregisterServiceWorkers } from '@/lib/pwa/service-worker'

/**
 * Registra el service worker.
 *
 * Antes este componente existia pero no lo montaba nadie, asi que la app no
 * tenia service worker: no funcionaba nada offline y los navegadores tampoco
 * ofrecian instalarla de forma confiable (Chrome pide un SW con handler de
 * fetch para disparar `beforeinstallprompt`).
 *
 * Se desregistra en dos casos: en desarrollo, donde un SW activo serviria
 * assets cacheados por encima de los que recompila el dev server; y cuando se
 * activa el interruptor de apagado, que existe porque un service worker con un
 * bug no se arregla solo con desplegar.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const shouldDisable = process.env.NODE_ENV !== 'production' || isServiceWorkerDisabled()

    if (shouldDisable) {
      void unregisterServiceWorkers()
      return
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker:', error)
      })
    }

    // Se espera al load para no competir por ancho de banda con el primer render.
    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}

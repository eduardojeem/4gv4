"use client"

import { useEffect } from 'react'

/**
 * Registra el service worker.
 *
 * Antes este componente existia pero no lo montaba nadie, asi que la app no
 * tenia service worker: no funcionaba nada offline y los navegadores tampoco
 * ofrecian instalarla de forma confiable (Chrome pide un SW con handler de
 * fetch para disparar `beforeinstallprompt`).
 *
 * En desarrollo no se registra: un SW activo sirve assets cacheados por encima
 * de los que recompila el dev server y termina mostrando codigo viejo.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Si quedo uno registrado de una sesion anterior, se da de baja para no
      // arrastrar cache vieja mientras se desarrolla.
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister())
      })
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

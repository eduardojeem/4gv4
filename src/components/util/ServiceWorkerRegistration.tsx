"use client"

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js')
          console.info('Service Worker registrado:', reg)
        } catch (e) {
          console.warn('Registro de Service Worker fallido:', e)
        }
      }
      register()
    }
  }, [])

  return null
}
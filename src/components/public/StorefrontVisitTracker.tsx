'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/public/tenant-client'
import { classifyStorefrontPath, visitorDayKey } from '@/lib/public/storefront-visits'

/**
 * Cuenta las visitas a la tienda: una página vista por cada cambio de ruta y
 * una persona por día.
 *
 * No manda nada de la persona. Respeta «No rastrear» del navegador.
 */
export function StorefrontVisitTracker({ organizationId }: { organizationId: string }) {
  const pathname = usePathname()
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return
    lastSent.current = pathname

    if (typeof navigator === 'undefined' || navigator.doNotTrack === '1') return

    const page = classifyStorefrontPath(pathname, getTenantSlugFromPathname(pathname))
    if (!page) return

    let newVisitor = false
    try {
      const key = visitorDayKey(organizationId)
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, '1')
        newVisitor = true
      }
    } catch {
      // Sin almacenamiento (modo privado estricto): se cuenta la página, no la persona.
    }

    const body = JSON.stringify({ organizationId, page, newVisitor })
    try {
      if (!navigator.sendBeacon?.('/api/public/storefront-visit', body)) {
        void fetch('/api/public/storefront-visit', { method: 'POST', body, keepalive: true }).catch(() => {})
      }
    } catch {
      // Contar una visita nunca puede romper la tienda.
    }
  }, [pathname, organizationId])

  return null
}

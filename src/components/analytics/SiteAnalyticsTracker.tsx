'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { setSiteAnalyticsTenant, trackSiteEvent, trackSitePageView } from '@/lib/site-analytics/client'

const WHATSAPP_HREF_RE = /^(https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:)/i

/**
 * `tenantSlug` solo hace falta en tiendas servidas por su propio dominio, donde
 * la ruta no incluye el slug de la tienda.
 */
export function SiteAnalyticsTracker({ tenantSlug = null }: { tenantSlug?: string | null } = {}) {
  const pathname = usePathname()

  useEffect(() => {
    setSiteAnalyticsTenant(tenantSlug)
    return () => setSiteAnalyticsTenant(null)
  }, [tenantSlug])

  useEffect(() => {
    if (!pathname) return
    setSiteAnalyticsTenant(tenantSlug)
    trackSitePageView(pathname)
  }, [pathname, tenantSlug])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute('href') ?? ''
      if (WHATSAPP_HREF_RE.test(href)) {
        trackSiteEvent('whatsapp_click')
      } else if (href.toLowerCase().startsWith('tel:')) {
        trackSiteEvent('phone_click')
      }
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [])

  return null
}

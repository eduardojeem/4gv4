'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackSiteEvent, trackSitePageView } from '@/lib/site-analytics/client'

const WHATSAPP_HREF_RE = /^(https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:)/i

export function SiteAnalyticsTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname) trackSitePageView(pathname)
  }, [pathname])

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

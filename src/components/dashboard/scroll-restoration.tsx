'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface ScrollRestorationProps {
  containerId?: string
}

export function ScrollRestoration({ containerId = 'dashboard-main' }: ScrollRestorationProps) {
  const pathname = usePathname()

  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return

    // Restore scroll position on mount
    try {
      const savedPosition = sessionStorage.getItem(`scroll-${pathname}`)
      if (savedPosition) {
        setTimeout(() => {
          container.scrollTop = parseInt(savedPosition, 10)
        }, 0)
      } else {
        container.scrollTop = 0
      }
    } catch {
      container.scrollTop = 0
    }

    // Save scroll position on scroll
    const handleScroll = () => {
      try {
        sessionStorage.setItem(`scroll-${pathname}`, container.scrollTop.toString())
      } catch { /* sessionStorage may be unavailable in private mode */ }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [pathname, containerId])

  return null
}

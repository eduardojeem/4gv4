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
    const savedPosition = sessionStorage.getItem(`scroll-${pathname}`)
    if (savedPosition) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        container.scrollTop = parseInt(savedPosition, 10)
      }, 0)
    } else {
      // Scroll to top for new pages
      container.scrollTop = 0
    }

    // Save scroll position on scroll
    const handleScroll = () => {
      sessionStorage.setItem(`scroll-${pathname}`, container.scrollTop.toString())
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [pathname, containerId])

  return null
}

'use client'

import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScrollToTopProps {
  containerId?: string
  threshold?: number
  className?: string
}

export function ScrollToTop({ 
  containerId = 'dashboard-main', 
  threshold = 300,
  className 
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return

    const handleScroll = () => {
      setIsVisible(container.scrollTop > threshold)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerId, threshold])

  const scrollToTop = () => {
    const container = document.getElementById(containerId)
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className={cn(
        "fixed bottom-24 right-6 z-40 rounded-full shadow-lg transition-all duration-300 lg:bottom-6",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        className
      )}
      aria-label="Volver arriba"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  )
}

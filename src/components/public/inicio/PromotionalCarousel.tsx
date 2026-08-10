'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path-shared'
import type { PromotionalCarouselSettings } from '@/types/website-settings'

const subscribeReducedMotion = (callback: () => void) => {
  if (typeof window === 'undefined') return () => undefined
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

const getReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ALIGNMENT = {
  left: 'sm:items-start sm:text-left',
  center: 'sm:items-center sm:text-center',
  right: 'sm:items-end sm:text-right',
} as const

export function PromotionalCarousel({
  settings,
  isPageLead = false,
}: {
  settings?: PromotionalCarouselSettings
  isPageLead?: boolean
}) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const slides = settings?.slides.filter((slide) => slide.active) ?? []
  const safeIndex = slides.length > 0 ? activeIndex % slides.length : 0
  const activeSlide = slides[safeIndex]
  const canRotate = slides.length > 1

  useEffect(() => {
    if (!settings?.autoplay || !canRotate || interactionPaused || userPaused || prefersReducedMotion) return
    const interval = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % slides.length),
      settings.intervalSeconds * 1000
    )
    return () => window.clearInterval(interval)
  }, [canRotate, interactionPaused, prefersReducedMotion, settings?.autoplay, settings?.intervalSeconds, slides.length, userPaused])

  if (!settings?.enabled || !activeSlide) return null

  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length)
  const isExternal = /^https?:\/\//i.test(activeSlide.ctaHref || '')
  const ctaHref = isExternal
    ? activeSlide.ctaHref || '#'
    : prefixPublicTenantPath(tenantPrefix, activeSlide.ctaHref || '/')
  const Heading = isPageLead ? 'h1' : 'h2'

  return (
    <section className={cn('border-b bg-background', isPageLead ? 'pb-8 pt-4 sm:py-8' : 'py-6 sm:py-8')} aria-label="Promociones destacadas">
      <div className="container">
        <div
          className="group relative mx-auto max-w-7xl overflow-hidden rounded-lg border bg-card shadow-sm sm:min-h-[420px]"
          role="region"
          aria-roledescription="carrusel"
          aria-label={`Promoción ${safeIndex + 1} de ${slides.length}`}
          aria-live={interactionPaused || userPaused ? 'polite' : 'off'}
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null
            setInteractionPaused(true)
          }}
          onTouchEnd={(event) => {
            const endX = event.changedTouches[0]?.clientX
            if (touchStartX.current !== null && typeof endX === 'number') {
              const distance = endX - touchStartX.current
              if (Math.abs(distance) >= 50) goTo(safeIndex + (distance < 0 ? 1 : -1))
            }
            touchStartX.current = null
            setInteractionPaused(false)
          }}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false)
          }}
        >
          <div className="relative aspect-[12/5] w-full overflow-hidden bg-muted sm:absolute sm:inset-0 sm:aspect-auto">
            <Image
              key={activeSlide.imageUrl}
              src={activeSlide.imageUrl}
              alt={activeSlide.imageAlt}
              fill
              priority={isPageLead && safeIndex === 0}
              sizes="(max-width: 640px) 100vw, 1200px"
              className="object-cover"
            />
            <div className={cn('absolute inset-0 hidden sm:block', activeSlide.textTone === 'light' ? 'bg-black/40' : 'bg-white/20')} />

            {canRotate && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(safeIndex - 1)}
                  className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-3"
                  aria-label="Promoción anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(safeIndex + 1)}
                  className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-3"
                  aria-label="Siguiente promoción"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          <div className={cn(
            'relative z-10 flex min-h-[220px] flex-col items-start justify-center px-5 py-7 text-left sm:min-h-[420px] sm:px-14 sm:py-16 lg:px-16',
            ALIGNMENT[activeSlide.contentAlign],
            activeSlide.textTone === 'light' ? 'text-foreground sm:text-white' : 'text-foreground sm:text-zinc-950'
          )}>
            <Heading className="max-w-2xl text-2xl font-black leading-tight sm:text-4xl lg:text-5xl">{activeSlide.title}</Heading>
            <p className={cn(
              'mt-3 max-w-xl text-sm font-medium leading-relaxed sm:mt-4 sm:text-lg',
              activeSlide.textTone === 'light' ? 'text-muted-foreground sm:text-white/90' : 'text-muted-foreground sm:text-zinc-800'
            )}>
              {activeSlide.message}
            </p>
            {activeSlide.ctaText && activeSlide.ctaHref && (
              <Button asChild size="lg" className={cn(
                'mt-5 w-fit rounded-md bg-foreground font-bold text-background shadow-sm hover:bg-foreground/90 sm:mt-6 sm:shadow-lg',
                activeSlide.textTone === 'light'
                  ? 'sm:bg-white sm:text-zinc-950 sm:hover:bg-white/90'
                  : 'sm:bg-zinc-950 sm:text-white sm:hover:bg-zinc-800'
              )}>
                {isExternal ? (
                  <a href={ctaHref} target="_blank" rel="noopener noreferrer">{activeSlide.ctaText}</a>
                ) : (
                  <Link href={ctaHref}>{activeSlide.ctaText}</Link>
                )}
              </Button>
            )}
          </div>

          {canRotate && (
              <div className="relative z-20 mx-auto mb-4 flex w-fit items-center gap-1 rounded-full border bg-background/95 p-1 shadow-sm sm:absolute sm:bottom-4 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2 sm:border-0">
                <button
                  type="button"
                  onClick={() => setUserPaused((paused) => !paused)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
                  title={userPaused ? 'Reanudar' : 'Pausar'}
                >
                  {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ir a promoción ${index + 1}`}
                    aria-current={index === safeIndex ? 'true' : undefined}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', index === safeIndex ? 'bg-primary' : 'bg-muted-foreground/35')} />
                  </button>
                ))}
              </div>
          )}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, ArrowRight } from 'lucide-react'
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
  const touchStartY = useRef<number | null>(null)

  const slides = settings?.slides.filter((slide) => slide.active) ?? []
  const safeIndex = slides.length > 0 ? activeIndex % slides.length : 0
  const activeSlide = slides[safeIndex]
  const canRotate = slides.length > 1
  const intervalSeconds = settings?.intervalSeconds || 5

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + slides.length) % slides.length)
  }, [slides.length])

  const nextSlide = useCallback(() => {
    if (slides.length > 0) {
      setActiveIndex((current) => (current + 1) % slides.length)
    }
  }, [slides.length])

  const prevSlide = useCallback(() => {
    if (slides.length > 0) {
      setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
    }
  }, [slides.length])

  // Autoplay loop
  useEffect(() => {
    if (!settings?.autoplay || !canRotate || interactionPaused || userPaused || prefersReducedMotion) return
    const interval = window.setInterval(nextSlide, intervalSeconds * 1000)
    return () => window.clearInterval(interval)
  }, [canRotate, interactionPaused, prefersReducedMotion, settings?.autoplay, intervalSeconds, nextSlide, userPaused])

  // Manejo de teclado accesible
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!canRotate) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prevSlide()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextSlide()
    }
  }

  if (!settings?.enabled || !activeSlide) return null

  const isExternal = /^https?:\/\//i.test(activeSlide.ctaHref || '')
  const ctaHref = isExternal
    ? activeSlide.ctaHref || '#'
    : prefixPublicTenantPath(tenantPrefix, activeSlide.ctaHref || '/')
  const layoutMode = settings?.layoutMode || 'contained'
  const isFullBleed = layoutMode === 'full'
  const isCompact = layoutMode === 'compact'
  const Heading = isPageLead ? 'h1' : 'h2'

  return (
    <section
      className={cn(
        'relative bg-background overflow-hidden',
        isFullBleed
          ? 'py-0 sm:py-0'
          : isCompact
          ? 'py-3 sm:py-5'
          : isPageLead
          ? 'pb-8 pt-2 sm:py-8'
          : 'py-6 sm:py-8'
      )}
      aria-label="Promociones destacadas"
    >
      <div className={cn(
        isFullBleed
          ? 'w-full px-0 max-w-none'
          : isCompact
          ? 'container mx-auto px-3 sm:px-6'
          : 'container mx-auto px-4 sm:px-6 lg:px-8'
      )}>
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className={cn(
            'group relative overflow-hidden bg-card transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isFullBleed
              ? 'w-full max-w-none rounded-none border-x-0 border-y border-border/80 shadow-none sm:min-h-[460px] md:min-h-[500px]'
              : isCompact
              ? 'mx-auto max-w-5xl rounded-2xl border border-border/80 shadow-md sm:min-h-[340px] md:min-h-[380px]'
              : 'mx-auto max-w-7xl rounded-3xl border border-border/80 shadow-lg sm:min-h-[440px] md:min-h-[480px]'
          )}
          role="region"
          aria-roledescription="carrusel"
          aria-label={`Promoción ${safeIndex + 1} de ${slides.length}`}
          aria-live={interactionPaused || userPaused ? 'polite' : 'off'}
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null
            touchStartY.current = event.touches[0]?.clientY ?? null
            setInteractionPaused(true)
          }}
          onTouchEnd={(event) => {
            const endX = event.changedTouches[0]?.clientX
            const endY = event.changedTouches[0]?.clientY
            if (touchStartX.current !== null && typeof endX === 'number') {
              const diffX = endX - touchStartX.current
              const diffY = touchStartY.current !== null && typeof endY === 'number' ? Math.abs(endY - touchStartY.current) : 0
              if (Math.abs(diffX) >= 40 && Math.abs(diffX) > diffY) {
                if (diffX < 0) nextSlide()
                else prevSlide()
              }
            }
            touchStartX.current = null
            touchStartY.current = null
            setInteractionPaused(false)
          }}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false)
          }}
        >
          {/* ── Capas de Imágenes con Crossfade ── */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950 sm:absolute sm:inset-0 sm:aspect-auto">
            {slides.map((slide, idx) => {
              const isCurrent = idx === safeIndex
              return (
                <div
                  key={slide.id || idx}
                  className={cn(
                    'absolute inset-0 transition-all duration-700 ease-in-out',
                    isCurrent ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 pointer-events-none z-0'
                  )}
                >
                  <Image
                    src={slide.imageUrl}
                    alt={slide.imageAlt || slide.title}
                    fill
                    priority={isPageLead && idx === 0}
                    sizes="(max-width: 640px) 100vw, 1280px"
                    className="object-cover object-center"
                  />

                  {/* Gradiente direccional con desenfoque elegante para legibilidad */}
                  <div
                    className={cn(
                      'absolute inset-0',
                      slide.textTone === 'light'
                        ? 'bg-gradient-to-t from-black/90 via-black/50 to-black/20 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/50 sm:to-black/20'
                        : 'bg-gradient-to-t from-white/95 via-white/80 to-transparent sm:bg-gradient-to-r sm:from-white/95 sm:via-white/70 sm:to-transparent'
                    )}
                  />
                </div>
              )
            })}

            {/* Flechas de Navegación Flotantes con Glassmorphism */}
            {canRotate && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    prevSlide()
                  }}
                  className="absolute left-3 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-200 hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:left-5"
                  aria-label="Promoción anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    nextSlide()
                  }}
                  className="absolute right-3 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-200 hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:right-5"
                  aria-label="Siguiente promoción"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* ── Textos y Botón de Acción ── */}
          <div
            className={cn(
              'relative z-20 flex min-h-[240px] flex-col justify-center px-6 py-8 sm:min-h-[440px] md:min-h-[480px] sm:px-14 sm:py-16 lg:px-18 transition-all duration-500',
              ALIGNMENT[activeSlide.contentAlign],
              activeSlide.textTone === 'light' ? 'text-white' : 'text-zinc-900'
            )}
          >
            {/* Badge de Promoción */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3.5 py-1 text-xs font-bold text-primary-foreground shadow-sm backdrop-blur-xs">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span>Destacado 4G</span>
            </div>

            <Heading className="max-w-2xl text-2xl font-black tracking-tight sm:text-4xl md:text-5xl leading-[1.15]">
              {activeSlide.title}
            </Heading>

            <p
              className={cn(
                'mt-3 max-w-xl text-sm font-medium leading-relaxed sm:mt-4 sm:text-base md:text-lg',
                activeSlide.textTone === 'light' ? 'text-slate-200/90' : 'text-zinc-700'
              )}
            >
              {activeSlide.message}
            </p>

            {activeSlide.ctaText && activeSlide.ctaHref && (
              <div className="mt-6 flex items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    'h-12 rounded-2xl px-6 font-bold shadow-md transition-all duration-200 hover:scale-105 group/btn gap-2',
                    activeSlide.textTone === 'light'
                      ? 'bg-white text-zinc-950 hover:bg-slate-100 shadow-white/20'
                      : 'bg-zinc-950 text-white hover:bg-zinc-800 shadow-zinc-950/25'
                  )}
                >
                  {isExternal ? (
                    <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                      <span>{activeSlide.ctaText}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </a>
                  ) : (
                    <Link href={ctaHref}>
                      <span>{activeSlide.ctaText}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* ── Indicadores de Progreso Estilo Story / Barra Interactiva ── */}
          {canRotate && (
            <div className="relative z-30 mx-auto mb-4 flex w-fit items-center gap-2 rounded-2xl bg-black/50 px-3 py-1.5 backdrop-blur-md border border-white/10 sm:absolute sm:bottom-6 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2">
              <button
                type="button"
                onClick={() => setUserPaused((paused) => !paused)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none"
                aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
                title={userPaused ? 'Reanudar' : 'Pausar'}
              >
                {userPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>

              <div className="flex items-center gap-1.5">
                {slides.map((slide, index) => {
                  const isCurrent = index === safeIndex
                  const isAnimating = isCurrent && !userPaused && !interactionPaused && settings?.autoplay

                  return (
                    <button
                      key={slide.id || index}
                      type="button"
                      onClick={() => goTo(index)}
                      className="group/dot relative flex h-6 items-center px-0.5 focus-visible:outline-none"
                      aria-label={`Ir a diapositiva ${index + 1}`}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <div className="relative h-1.5 w-7 sm:w-10 overflow-hidden rounded-full bg-white/30 transition-all duration-300 group-hover/dot:bg-white/50">
                        {isCurrent && (
                          <div
                            className={cn(
                              'absolute inset-0 rounded-full bg-white shadow-xs',
                              isAnimating && 'origin-left'
                            )}
                            style={{
                              animationDuration: isAnimating ? `${intervalSeconds}s` : '0s',
                              animationName: isAnimating ? 'progressBar' : 'none',
                              animationTimingFunction: 'linear',
                              animationFillMode: 'forwards'
                            }}
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes progressBar {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </section>
  )
}

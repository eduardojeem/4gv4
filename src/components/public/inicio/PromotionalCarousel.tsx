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

function getOverlayGradient(tone: 'light' | 'dark', align: 'left' | 'center' | 'right' = 'left') {
  if (tone === 'light') {
    switch (align) {
      case 'right':
        return 'bg-gradient-to-t from-black/95 via-black/85 to-black/45 sm:bg-gradient-to-l sm:from-black/95 sm:via-black/80 sm:to-black/25'
      case 'center':
        return 'bg-gradient-to-t from-black/95 via-black/85 to-black/50 sm:bg-black/60 sm:bg-radial sm:from-black/90 sm:via-black/75 sm:to-black/45'
      case 'left':
      default:
        return 'bg-gradient-to-t from-black/95 via-black/85 to-black/45 sm:bg-gradient-to-r sm:from-black/95 sm:via-black/80 sm:to-black/25'
    }
  } else {
    switch (align) {
      case 'right':
        return 'bg-gradient-to-t from-white/98 via-white/92 to-white/50 sm:bg-gradient-to-l sm:from-white/98 sm:via-white/88 sm:to-transparent'
      case 'center':
        return 'bg-gradient-to-t from-white/98 via-white/92 to-white/60 sm:bg-white/75 sm:bg-radial sm:from-white/98 sm:via-white/88 sm:to-white/45'
      case 'left':
      default:
        return 'bg-gradient-to-t from-white/98 via-white/92 to-white/50 sm:bg-gradient-to-r sm:from-white/98 sm:via-white/88 sm:to-transparent'
    }
  }
}

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
  const intervalSeconds = Math.min(15, Math.max(5, settings?.intervalSeconds || 6))

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
            'group relative overflow-hidden bg-slate-950 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isFullBleed
              ? 'w-full max-w-none rounded-none border-x-0 border-y border-border/80 shadow-none min-h-[380px] sm:min-h-[460px] md:min-h-[500px]'
              : isCompact
              ? 'mx-auto max-w-5xl rounded-2xl border border-border/80 shadow-md min-h-[320px] sm:min-h-[340px] md:min-h-[380px]'
              : 'mx-auto max-w-7xl rounded-3xl border border-border/80 shadow-lg min-h-[380px] sm:min-h-[440px] md:min-h-[480px]'
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
          <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950">
            {slides.map((slide, idx) => {
              const isCurrent = idx === safeIndex
              const tone = slide.textTone || 'light'
              const align = slide.contentAlign || 'left'

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

                  {/* Gradiente direccional con alto contraste para máxima legibilidad */}
                  <div
                    className={cn(
                      'absolute inset-0 transition-opacity duration-700',
                      getOverlayGradient(tone, align)
                    )}
                  />
                </div>
              )
            })}

            {/* Flechas de Navegación Flotantes con Glassmorphism (en desktop) */}
            {canRotate && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    prevSlide()
                  }}
                  className="hidden sm:flex absolute left-3 top-1/2 z-30 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-200 hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:left-5 cursor-pointer"
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
                  className="hidden sm:flex absolute right-3 top-1/2 z-30 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-200 hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:right-5 cursor-pointer"
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
              'relative z-20 flex min-h-[340px] sm:min-h-[440px] md:min-h-[480px] flex-col justify-center px-5 py-8 pb-14 sm:px-14 sm:py-16 sm:pb-16 lg:px-18 transition-all duration-500',
              ALIGNMENT[activeSlide.contentAlign],
              activeSlide.textTone === 'light' ? 'text-white' : 'text-zinc-950'
            )}
          >
            <Heading
              className={cn(
                'max-w-2xl text-xl sm:text-4xl md:text-5xl font-black tracking-tight leading-snug sm:leading-[1.15]',
                activeSlide.textTone === 'light'
                  ? 'text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] [text-shadow:_0_2px_14px_rgb(0_0_0_/_90%)]'
                  : 'text-zinc-950 drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]'
              )}
            >
              {activeSlide.title}
            </Heading>

            <p
              className={cn(
                'mt-2.5 max-w-xl text-xs sm:text-base md:text-lg font-semibold leading-relaxed sm:mt-4 line-clamp-3 sm:line-clamp-none',
                activeSlide.textTone === 'light'
                  ? 'text-slate-100 drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_8px_rgb(0_0_0_/_90%)]'
                  : 'text-zinc-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]'
              )}
            >
              {activeSlide.message}
            </p>

            {activeSlide.ctaText && activeSlide.ctaHref && (
              <div className="mt-4 sm:mt-6 flex items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    'h-10 sm:h-12 rounded-xl sm:rounded-2xl px-5 sm:px-6 text-xs sm:text-sm font-bold shadow-md transition-all duration-200 hover:scale-105 group/btn gap-2',
                    activeSlide.textTone === 'light'
                      ? 'bg-white text-zinc-950 hover:bg-slate-100 shadow-black/30'
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
            <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/60 px-2.5 py-1 sm:px-3 sm:py-1.5 backdrop-blur-md border border-white/15">
              <button
                type="button"
                onClick={() => setUserPaused((paused) => !paused)}
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none cursor-pointer"
                aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
                title={userPaused ? 'Reanudar' : 'Pausar'}
              >
                {userPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>

              <div className="flex items-center gap-1 sm:gap-1.5">
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

'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path-shared'
import { cn } from '@/lib/utils'
import type { PromotionalCarouselSettings } from '@/types/website-settings'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia?.(reducedMotionQuery)
  media?.addEventListener('change', listener)
  return () => media?.removeEventListener('change', listener)
}
const getReducedMotion = () => window.matchMedia?.(reducedMotionQuery).matches ?? false
const getServerReducedMotion = () => true

interface EspecialCosmeticosCarouselProps {
  settings?: PromotionalCarouselSettings
  brandColor?: string
  customBrandColor?: string
}

// The storefront owns --primary; all carousel formats derive the same palette.
const CAROUSEL_THEME = {
  btn: 'bg-gradient-to-r from-[var(--cosmetics-500)] to-[var(--cosmetics-600)] hover:from-[var(--cosmetics-600)] hover:to-[var(--cosmetics-700)]',
  badge: 'bg-[var(--cosmetics-soft)] text-[var(--cosmetics-ink)] border-[var(--cosmetics-200)]',
  border: 'border-[var(--cosmetics-200)]/80 dark:border-[var(--cosmetics-900)]/40',
  activeDot: 'bg-[var(--cosmetics-400)]',
  glow: 'from-[var(--cosmetics-tint)] via-[var(--cosmetics-page)] to-transparent',
}

export function EspecialCosmeticosCarousel({ settings, brandColor, customBrandColor }: EspecialCosmeticosCarouselProps) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  const slides = settings?.slides?.filter((slide) => slide.active) ?? []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const slideCount = slides.length
  const intervalSeconds = Math.min(15, Math.max(5, settings?.intervalSeconds || 6))
  const safeIndex = slideCount > 0 ? currentIndex % slideCount : 0

  const nextSlide = useCallback(() => {
    if (slideCount <= 1) return
    setCurrentIndex((prev) => (prev + 1) % slideCount)
  }, [slideCount])

  const prevSlide = useCallback(() => {
    if (slideCount <= 1) return
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount)
  }, [slideCount])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  // Autoplay
  useEffect(() => {
    if (!settings?.enabled || slideCount <= 1 || userPaused || hoverPaused || focusPaused || prefersReducedMotion || settings.autoplay !== true) return
    timerRef.current = setTimeout(nextSlide, intervalSeconds * 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, userPaused, hoverPaused, focusPaused, prefersReducedMotion, nextSlide, slideCount, intervalSeconds, settings?.autoplay, settings?.enabled])

  if (!settings?.enabled || slideCount === 0) {
    return null
  }

  const layoutMode = settings?.layoutMode || 'contained'
  const isFullBleed = layoutMode === 'full'
  const isCompact = layoutMode === 'compact'

  const currentSlide = slides[safeIndex]
  const isExternal = /^https?:\/\//i.test(currentSlide.ctaHref || '')
  const ctaHref = isExternal
    ? currentSlide.ctaHref || '#'
    : prefixPublicTenantPath(prefix, currentSlide.ctaHref || '/productos')

  const hideText = Boolean(currentSlide.hideText)
  const contentAlign = currentSlide.contentAlign || 'left'
  const titleSize = currentSlide.titleSize || 'normal'
  const fontFamily = currentSlide.fontFamily || 'serif'
  const overlayIntensity = currentSlide.overlayIntensity || 'medium'

  const alignContainerClass =
    contentAlign === 'center'
      ? 'justify-center items-end sm:items-center text-center'
      : contentAlign === 'right'
      ? 'justify-end items-end sm:items-center text-left sm:text-right'
      : 'justify-start items-end sm:items-center text-left'

  const titleSizeClass =
    titleSize === 'compact'
      ? 'text-xl sm:text-2xl lg:text-3xl'
      : titleSize === 'large'
      ? 'text-3xl sm:text-4xl lg:text-5xl'
      : 'text-2xl sm:text-3xl lg:text-4xl'

  const fontFamilyClass =
    fontFamily === 'sans'
      ? 'font-sans'
      : fontFamily === 'mono'
      ? 'font-mono'
      : fontFamily === 'display'
      ? 'font-sans font-black tracking-tight'
      : 'font-serif'

  const overlayIntensityClass =
    overlayIntensity === 'none'
      ? 'opacity-0'
      : overlayIntensity === 'subtle'
      ? 'opacity-35'
      : overlayIntensity === 'strong'
      ? 'opacity-90'
      : 'opacity-70'

  // Manejo de gestos táctiles
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !e.changedTouches[0]) return
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd
    if (diff > 50) nextSlide()
    if (diff < -50) prevSlide()
    setTouchStart(null)
  }

  // Resolución de colores de marca elegidos por la organización en /admin/website
  const brandTheme = CAROUSEL_THEME
  const isCustomBrand = Boolean(brandColor === 'custom' && customBrandColor && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(customBrandColor))

  return (
    <section
      data-color-scheme={brandColor === 'custom' ? 'blue' : brandColor}
      data-custom-brand={isCustomBrand ? '' : undefined}
      aria-label="Campañas y Novedades de Cosmética"
      className={cn(
        'cosmetics-brand-surface relative w-full overflow-hidden',
        isCustomBrand ? '' : `bg-gradient-to-b ${brandTheme.glow}`,
        isFullBleed ? 'py-0' : isCompact ? 'py-3 sm:py-5' : 'py-4 sm:py-8'
      )}
      style={
        isCustomBrand
          ? {
              '--brand-primary': customBrandColor,
              background: 'linear-gradient(to bottom, var(--cosmetics-tint), var(--cosmetics-page), transparent)',
            } as React.CSSProperties
          : undefined
      }
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      tabIndex={0}
      aria-roledescription="carrusel"
      onFocus={() => setFocusPaused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusPaused(false) }}
      onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); if (event.key === 'ArrowRight') nextSlide(); else prevSlide() } }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={cn(
          isFullBleed
            ? 'w-full px-0 max-w-none'
            : isCompact
            ? 'container mx-auto px-3 sm:px-6 max-w-5xl'
            : 'container mx-auto px-4 sm:px-6 lg:px-8'
        )}
      >
        {/* Marco boutique con bordes redondeados y sombra suave */}
        <div
          className={cn(
            'relative w-full overflow-hidden transition-all duration-300',
            isFullBleed
              ? cn('aspect-[4/3] sm:aspect-[21/9] lg:aspect-[24/9] min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] rounded-none border-y shadow-none', isCustomBrand ? '' : brandTheme.border)
              : isCompact
              ? cn('aspect-[4/3] sm:aspect-[16/7] lg:aspect-[21/8] min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] rounded-2xl border shadow-md', isCustomBrand ? '' : brandTheme.border)
              : cn('aspect-[4/3] sm:aspect-[16/8] lg:aspect-[21/9] min-h-[380px] sm:min-h-[460px] lg:min-h-[500px] rounded-3xl sm:rounded-[2.5rem] border shadow-xl', isCustomBrand ? '' : brandTheme.border)
          )}
          style={isCustomBrand ? { borderColor: 'var(--cosmetics-200)' } : undefined}
        >
          {/* Slides de imagen en cross-fade */}
          {slides.map((slide, idx) => {
            const isActive = idx === safeIndex
            return (
              <div
                key={slide.id || idx}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
                aria-hidden={!isActive}
              >
                <AppImage
                  src={slide.imageUrl}
                  alt={slide.imageAlt || slide.title}
                  fill
                  priority={idx === 0}
                  className="object-cover object-center scale-100 transition-transform duration-1000 ease-out"
                />
                {/* Degradé de oscurecimiento suave para legibilidad */}
                <div
                  className={cn(
                    'absolute inset-0 transition-opacity duration-300 bg-gradient-to-t from-stone-950/70 via-stone-950/30 to-transparent sm:bg-gradient-to-r sm:from-stone-950/75 sm:via-stone-950/35 sm:to-transparent',
                    overlayIntensityClass
                  )}
                />
              </div>
            )
          })}

          {/* Enlace de toda la diapositiva cuando se ocultan textos gráficos */}
          {hideText && currentSlide.ctaHref && (
            <Link
              href={ctaHref}
              className="absolute inset-0 z-20 block cursor-pointer"
              aria-label={currentSlide.title || 'Ver promoción'}
            />
          )}

          {/* Tarjeta editorial flotante con contenido */}
          {!hideText && (
            <div className={cn('absolute inset-0 z-20 flex p-5 sm:p-10 lg:p-14', alignContainerClass)}>
              <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-[var(--cosmetics-soft)]/90 p-5 sm:p-8 backdrop-blur-md border border-white/60 dark:border-[var(--cosmetics-150)]/60 shadow-2xl space-y-3 sm:space-y-4">
                {/* Badge del slide */}
                {currentSlide.badge && (
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase border',
                      isCustomBrand ? '' : brandTheme.badge
                    )}
                    style={
                      isCustomBrand
                        ? {
                            color: 'var(--cosmetics-ink)',
                            borderColor: 'var(--cosmetics-200)',
                            backgroundColor: 'var(--cosmetics-soft)',
                          }
                        : undefined
                    }
                  >
                    <Sparkles
                      className="h-3 w-3"
                      style={isCustomBrand ? { color: 'var(--cosmetics-ink)' } : undefined}
                    />
                    <span>{currentSlide.badge}</span>
                  </div>
                )}

                {/* Título editorial */}
                <h2
                  className={cn(
                    'font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.15]',
                    titleSizeClass,
                    fontFamilyClass
                  )}
                  style={currentSlide.titleColor ? { color: currentSlide.titleColor } : undefined}
                >
                  {currentSlide.title}
                </h2>

                {/* Mensaje descriptivo */}
                {currentSlide.message && (
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-2 sm:line-clamp-3">
                    {currentSlide.message}
                  </p>
                )}

                {/* Botón de acción */}
                {currentSlide.ctaText && (
                  <div
                    className={cn(
                      'pt-2 flex items-center gap-4',
                      contentAlign === 'center'
                        ? 'justify-center'
                        : contentAlign === 'right'
                        ? 'justify-end'
                        : 'justify-start'
                    )}
                  >
                    <Link
                      href={ctaHref}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-6 py-2.5 sm:px-7 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-md transition-all',
                        isCustomBrand ? 'hover:brightness-110 shadow-lg' : brandTheme.btn
                      )}
                      style={
                        isCustomBrand
                          ? { backgroundColor: 'var(--cosmetics-600)', borderColor: 'var(--cosmetics-600)' }
                          : undefined
                      }
                    >
                      <span>{currentSlide.ctaText}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flechas de navegación boutique (escritorio y tablet) */}
          {slideCount > 1 && (
            <>
              <button
                type="button"
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-[var(--cosmetics-soft)]/80 text-stone-800 dark:text-stone-100 shadow-lg backdrop-blur-xs border border-white/70 dark:border-[var(--cosmetics-150)] hover:bg-white dark:hover:bg-zinc-800 hover:scale-105 transition-all"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-[var(--cosmetics-soft)]/80 text-stone-800 dark:text-stone-100 shadow-lg backdrop-blur-xs border border-white/70 dark:border-[var(--cosmetics-150)] hover:bg-white dark:hover:bg-zinc-800 hover:scale-105 transition-all"
                aria-label="Slide siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Paginación y control de pausa al pie del carrusel */}
          {slideCount > 1 && (
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-3 rounded-full bg-stone-950/60 dark:bg-black/70 px-3.5 py-1.5 backdrop-blur-md border border-white/20">
              {/* Botón Pausa / Reproducir */}
              <button
                type="button"
                onClick={() => setUserPaused((prev) => !prev)}
                aria-pressed={userPaused}
                className="flex min-h-11 min-w-11 items-center justify-center text-white/80 transition-colors hover:text-white"
                aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
              >
                {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>

              {/* Indicadores de cápsula */}
              <div className="flex items-center gap-1.5">
                {slides.map((_, idx) => {
                  const isActive = idx === safeIndex
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goToSlide(idx)}
                      className={cn(
                        'h-1.5 transition-all duration-300 rounded-full',
                        isActive
                          ? isCustomBrand
                            ? 'w-6'
                            : `w-6 ${brandTheme.activeDot}`
                          : 'w-1.5 bg-white/40 hover:bg-white/70'
                      )}
                      style={isActive && isCustomBrand ? { backgroundColor: 'var(--cosmetics-600)' } : undefined}
                      aria-label={`Ir al slide ${idx + 1}`}
                    />
                  )
                })}
              </div>

              {/* Contador numérico */}
              <span className="text-[10px] font-mono text-white/70">
                {safeIndex + 1}/{slideCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

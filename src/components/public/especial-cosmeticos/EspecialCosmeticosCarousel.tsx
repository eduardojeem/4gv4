'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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

interface EspecialCosmeticosCarouselProps {
  settings?: PromotionalCarouselSettings
  brandColor?: string
  customBrandColor?: string
}

const BRAND_CAROUSEL_THEMES: Record<string, {
  btn: string
  badge: string
  border: string
  activeDot: string
  glow: string
}> = {
  rose: {
    btn: 'bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-950/20',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    border: 'border-rose-200/80 dark:border-rose-900/40',
    activeDot: 'bg-rose-400',
    glow: 'from-[#FFF5F6]/60 via-[#FFF9F9] to-transparent',
  },
  purple: {
    btn: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 hover:from-purple-700 hover:to-fuchsia-700 shadow-purple-950/20',
    badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    border: 'border-purple-200/80 dark:border-purple-900/40',
    activeDot: 'bg-purple-500',
    glow: 'from-[#FAF5FF]/60 via-[#FDF9FF] to-transparent',
  },
  amber: {
    btn: 'bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-950/20',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    border: 'border-amber-200/80 dark:border-amber-900/40',
    activeDot: 'bg-amber-500',
    glow: 'from-[#FFFBEB]/60 via-[#FEFDF9] to-transparent',
  },
  emerald: {
    btn: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-950/20',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    border: 'border-emerald-200/80 dark:border-emerald-900/40',
    activeDot: 'bg-emerald-500',
    glow: 'from-[#ECFDF5]/60 via-[#F7FEFB] to-transparent',
  },
  teal: {
    btn: 'bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-700 hover:to-cyan-700 shadow-teal-950/20',
    badge: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    border: 'border-teal-200/80 dark:border-teal-900/40',
    activeDot: 'bg-teal-500',
    glow: 'from-[#F0FDFA]/60 via-[#F8FFFE] to-transparent',
  },
  red: {
    btn: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-700 shadow-red-950/20',
    badge: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    border: 'border-red-200/80 dark:border-red-900/40',
    activeDot: 'bg-red-500',
    glow: 'from-[#FEF2F2]/60 via-[#FFF9F9] to-transparent',
  },
  blue: {
    btn: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 shadow-blue-950/20',
    badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    border: 'border-blue-200/80 dark:border-blue-900/40',
    activeDot: 'bg-blue-500',
    glow: 'from-[#EFF6FF]/60 via-[#F8FAFC] to-transparent',
  },
  indigo: {
    btn: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-950/20',
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    border: 'border-indigo-200/80 dark:border-indigo-900/40',
    activeDot: 'bg-indigo-500',
    glow: 'from-[#EEF2FF]/60 via-[#F8FAFF] to-transparent',
  },
  orange: {
    btn: 'bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-950/20',
    badge: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    border: 'border-orange-200/80 dark:border-orange-900/40',
    activeDot: 'bg-orange-500',
    glow: 'from-[#FFF7ED]/60 via-[#FFFBF5] to-transparent',
  },
  cyan: {
    btn: 'bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-950/20',
    badge: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    border: 'border-cyan-200/80 dark:border-cyan-900/40',
    activeDot: 'bg-cyan-500',
    glow: 'from-[#ECFEFF]/60 via-[#F7FEFF] to-transparent',
  },
  sky: {
    btn: 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 hover:from-sky-600 hover:to-blue-600 shadow-sky-950/20',
    badge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    border: 'border-sky-200/80 dark:border-sky-900/40',
    activeDot: 'bg-sky-500',
    glow: 'from-[#F0F9FF]/60 via-[#F8FCFF] to-transparent',
  },
  green: {
    btn: 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700 hover:from-green-700 hover:to-emerald-700 shadow-green-950/20',
    badge: 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    border: 'border-green-200/80 dark:border-green-900/40',
    activeDot: 'bg-green-500',
    glow: 'from-[#F0FDF4]/60 via-[#F8FEFA] to-transparent',
  },
}

export function EspecialCosmeticosCarousel({ settings, brandColor, customBrandColor }: EspecialCosmeticosCarouselProps) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  const slides = settings?.slides?.filter((slide) => slide.active) ?? []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const slideCount = slides.length
  const intervalSeconds = Math.max(4, settings?.intervalSeconds || 6)

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
    if (slideCount <= 1 || isPaused || settings?.autoplay === false) return
    timerRef.current = setTimeout(nextSlide, intervalSeconds * 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, isPaused, nextSlide, slideCount, intervalSeconds, settings?.autoplay])

  if (!settings?.enabled || slideCount === 0) {
    return null
  }

  const layoutMode = settings?.layoutMode || 'contained'
  const isFullBleed = layoutMode === 'full'
  const isCompact = layoutMode === 'compact'

  const currentSlide = slides[currentIndex]
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
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd
    if (diff > 50) nextSlide()
    if (diff < -50) prevSlide()
    setTouchStart(null)
  }

  // Resolución de colores de marca elegidos por la organización en /admin/website
  const effectiveBrand = brandColor && brandColor !== 'custom' ? brandColor : 'rose'
  const brandTheme = BRAND_CAROUSEL_THEMES[effectiveBrand] ?? BRAND_CAROUSEL_THEMES.rose
  const isCustomBrand = Boolean(customBrandColor && /^#[0-9A-Fa-f]{3,8}$/.test(customBrandColor))

  return (
    <section
      aria-label="Campañas y Novedades de Cosmética"
      className={cn(
        'relative w-full overflow-hidden',
        isCustomBrand ? '' : `bg-gradient-to-b ${brandTheme.glow}`,
        isFullBleed ? 'py-0' : isCompact ? 'py-3 sm:py-5' : 'py-4 sm:py-8'
      )}
      style={
        isCustomBrand
          ? {
              background: `linear-gradient(to bottom, ${customBrandColor}14 0%, ${customBrandColor}05 60%, transparent 100%)`,
            }
          : undefined
      }
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
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
          style={isCustomBrand ? { borderColor: `${customBrandColor}40` } : undefined}
        >
          {/* Slides de imagen en cross-fade */}
          {slides.map((slide, idx) => {
            const isActive = idx === currentIndex
            return (
              <div
                key={slide.id || idx}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
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
              <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-zinc-900/90 p-5 sm:p-8 backdrop-blur-md border border-white/60 dark:border-zinc-700/60 shadow-2xl space-y-3 sm:space-y-4">
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
                            color: customBrandColor,
                            borderColor: `${customBrandColor}45`,
                            backgroundColor: `${customBrandColor}15`,
                          }
                        : undefined
                    }
                  >
                    <Sparkles
                      className="h-3 w-3"
                      style={isCustomBrand ? { color: customBrandColor } : undefined}
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
                          ? { backgroundColor: customBrandColor, borderColor: customBrandColor }
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
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-zinc-900/80 text-stone-800 dark:text-stone-100 shadow-lg backdrop-blur-xs border border-white/70 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 hover:scale-105 transition-all"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-zinc-900/80 text-stone-800 dark:text-stone-100 shadow-lg backdrop-blur-xs border border-white/70 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 hover:scale-105 transition-all"
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
                onClick={() => setIsPaused((prev) => !prev)}
                className="text-white/80 hover:text-white transition-colors"
                aria-label={isPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>

              {/* Indicadores de cápsula */}
              <div className="flex items-center gap-1.5">
                {slides.map((_, idx) => {
                  const isActive = idx === currentIndex
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
                      style={isActive && isCustomBrand ? { backgroundColor: customBrandColor } : undefined}
                      aria-label={`Ir al slide ${idx + 1}`}
                    />
                  )
                })}
              </div>

              {/* Contador numérico */}
              <span className="text-[10px] font-mono text-white/70">
                {currentIndex + 1}/{slideCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

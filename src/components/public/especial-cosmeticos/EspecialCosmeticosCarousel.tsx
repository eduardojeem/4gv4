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
import type { PromotionalCarouselSettings } from '@/types/website-settings'

interface EspecialCosmeticosCarouselProps {
  settings?: PromotionalCarouselSettings
}

export function EspecialCosmeticosCarousel({ settings }: EspecialCosmeticosCarouselProps) {
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

  const currentSlide = slides[currentIndex]
  const isExternal = /^https?:\/\//i.test(currentSlide.ctaHref || '')
  const ctaHref = isExternal
    ? currentSlide.ctaHref || '#'
    : prefixPublicTenantPath(prefix, currentSlide.ctaHref || '/productos')

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

  return (
    <section
      aria-label="Campañas y Novedades de Cosmética"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#FFF5F6]/60 via-[#FFF9F9] to-transparent py-4 sm:py-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Marco boutique con bordes redondeados y sombra suave */}
        <div className="relative aspect-[4/3] sm:aspect-[16/8] lg:aspect-[21/9] min-h-[380px] sm:min-h-[460px] lg:min-h-[500px] w-full overflow-hidden rounded-3xl sm:rounded-[2.5rem] border border-rose-200/80 dark:border-rose-900/40 shadow-xl shadow-rose-950/5">
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
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/30 to-transparent sm:bg-gradient-to-r sm:from-stone-950/75 sm:via-stone-950/35 sm:to-transparent" />
              </div>
            )
          })}

          {/* Tarjeta editorial flotante con contenido */}
          <div className="absolute inset-0 z-20 flex items-end sm:items-center p-5 sm:p-10 lg:p-14">
            <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-zinc-900/90 p-5 sm:p-8 backdrop-blur-md border border-white/60 dark:border-zinc-700/60 shadow-2xl space-y-3 sm:space-y-4">
              {/* Badge del slide */}
              {currentSlide.badge && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-3 py-1 text-[11px] font-bold tracking-wide uppercase text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <Sparkles className="h-3 w-3 text-rose-500" />
                  <span>{currentSlide.badge}</span>
                </div>
              )}

              {/* Título editorial */}
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.15]">
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
                <div className="pt-2 flex items-center gap-4">
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 px-6 py-2.5 sm:px-7 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-rose-950/20 hover:from-rose-600 hover:to-pink-700 hover:shadow-lg transition-all"
                  >
                    <span>{currentSlide.ctaText}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

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
                      className={`h-1.5 transition-all duration-300 rounded-full ${
                        isActive ? 'w-6 bg-rose-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                      }`}
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

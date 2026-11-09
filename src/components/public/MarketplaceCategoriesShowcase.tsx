'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Search,
  X,
  Play,
  Pause,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ShowcaseSlide = {
  id: string
  eyebrow: string
  title: string
  description: string
  image: string
  searchTerm: string
  ambientGradient: string
  accentPill: string
}

export const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: 'belleza',
    eyebrow: 'BRILLA CON CONFIANZA',
    title: 'Belleza & Estética',
    description: 'Esenciales de piel, cabello y belleza hechos para ti.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format',
    searchTerm: 'belleza',
    ambientGradient: 'from-emerald-700/85 via-teal-800/60 to-emerald-950/20',
    accentPill: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  {
    id: 'servicios',
    eyebrow: 'PROFESIONALES DE CONFIANZA',
    title: 'Servicios',
    description: 'Descubre expertos locales listos para ayudarte.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format',
    searchTerm: 'servicios',
    ambientGradient: 'from-sky-700/85 via-blue-800/60 to-slate-950/20',
    accentPill: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  {
    id: 'electronica',
    eyebrow: 'MÁS CONECTADO CADA DÍA',
    title: 'Electrónica',
    description: 'Dispositivos y tecnología para una vida conectada.',
    image: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=80&auto=format',
    searchTerm: 'electronica',
    ambientGradient: 'from-purple-700/85 via-violet-800/60 to-indigo-950/20',
    accentPill: 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
  },
  {
    id: 'electrodomesticos',
    eyebrow: 'CONFORT & TECNOLOGÍA EN CASA',
    title: 'Electrodomésticos',
    description: 'Heladeras, lavarropas, climatización y cocina para tu día a día.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80&auto=format',
    searchTerm: 'electrodomesticos',
    ambientGradient: 'from-blue-700/85 via-indigo-800/60 to-slate-950/20',
    accentPill: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  {
    id: 'muebles',
    eyebrow: 'CONFORT & DISEÑO',
    title: 'Muebles & Hogar',
    description: 'Muebles de diseño y confort para transformar tus ambientes.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format',
    searchTerm: 'muebles',
    ambientGradient: 'from-amber-800/85 via-stone-800/60 to-neutral-950/20',
    accentPill: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  {
    id: 'computacion',
    eyebrow: 'PRODUCTIVIDAD & EQUIPAMIENTO',
    title: 'Computación',
    description: 'Pantallas, teclados, mouse, impresoras y conectividad.',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format',
    searchTerm: 'computacion',
    ambientGradient: 'from-indigo-700/85 via-cyan-800/60 to-slate-950/20',
    accentPill: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  {
    id: 'audio',
    eyebrow: 'SONIDO DE ALTA FIDELIDAD',
    title: 'Audio & Video',
    description: 'Auriculares, parlantes y sonido envolvente.',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80&auto=format',
    searchTerm: 'audio',
    ambientGradient: 'from-cyan-700/85 via-blue-800/60 to-slate-950/20',
    accentPill: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
  },
  {
    id: 'moda',
    eyebrow: 'TU PROPIO ESTILO',
    title: 'Moda & Relojería',
    description: 'Remeras básicas, indumentaria corporativa y relojes.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format',
    searchTerm: 'reloj',
    ambientGradient: 'from-rose-700/85 via-pink-800/60 to-stone-950/20',
    accentPill: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
]

interface Props {
  className?: string
  exploreAllHref?: string
  exploreAllLabel?: string
  title?: string
  subtitle?: string
}

export function MarketplaceCategoriesShowcase({
  className,
  exploreAllHref = '/marketplace/categorias',
  exploreAllLabel = 'Ver todas',
  title = 'Categorías destacadas',
  subtitle = 'Explorá los rubros comerciales del marketplace y encontrá productos en tu ciudad.',
}: Props) {
  const carouselTrackRef = useRef<HTMLDivElement>(null)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)

  // Filtrado de slides por búsqueda
  const filteredSlides = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SHOWCASE_SLIDES
    return SHOWCASE_SLIDES.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.eyebrow.toLowerCase().includes(q) ||
        s.searchTerm.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Desplazamiento del carrusel
  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselTrackRef.current
    if (!el) return
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  // Actualizar índice activo al desplazarse
  const handleScroll = useCallback(() => {
    const el = carouselTrackRef.current
    if (!el) return
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
    const nextIndex = Math.round(el.scrollLeft / cardWidth)
    setActiveSlideIndex(Math.max(0, Math.min(nextIndex, filteredSlides.length - 1)))
  }, [filteredSlides.length])

  useEffect(() => {
    const el = carouselTrackRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [handleScroll])

  // Autoplay cada 5s
  useEffect(() => {
    if (!autoplayEnabled || isPaused || filteredSlides.length <= 1) return

    const timer = setInterval(() => {
      const el = carouselTrackRef.current
      if (!el) return
      const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 30

      if (isAtEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' })
      }
    }, 5000)

    return () => clearInterval(timer)
  }, [autoplayEnabled, isPaused, filteredSlides.length])

  const activeSlide = filteredSlides[activeSlideIndex] ?? filteredSlides[0] ?? SHOWCASE_SLIDES[0]

  return (
    <section
      suppressHydrationWarning
      aria-label="Carrusel de categorías destacadas"
      className={cn(
        'relative py-8 sm:py-14 border-b border-border/80 overflow-hidden transition-all duration-700 bg-gradient-to-b',
        activeSlide.ambientGradient,
        className
      )}
    >
      {/* Resplandores ambientales dinámicos */}
      <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-black/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white shadow-2xs backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
              <span>SHOWCASE · EXPLORÁ POR CATEGORÍAS</span>
              <span className="h-1 w-1 rounded-full bg-white/60" />
              <span className="text-[11px] font-semibold text-white/85">
                {filteredSlides.length} rubros
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-sm">
              {title}
            </h2>

            <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-medium">
              {subtitle}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-white/25 bg-white/15 backdrop-blur-md text-white text-xs font-bold hover:bg-white/25 hover:text-white shadow-xs transition-all"
            >
              <Link href={exploreAllHref}>
                <span>{exploreAllLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>

            {/* Play/Pause autoplay */}
            {filteredSlides.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAutoplayEnabled((prev) => !prev)}
                className="h-9 w-9 rounded-full border-white/25 bg-white/15 backdrop-blur-md text-white hover:bg-white/25 hover:text-white shadow-xs transition-all active:scale-95"
                aria-label={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
                title={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
              >
                {autoplayEnabled ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Búsqueda Flotante tipo Cápsula Blanca */}
        <div className="relative mb-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categorías o rubros comerciales..."
              className="h-12 w-full rounded-full border-0 bg-white/95 dark:bg-card/95 text-slate-900 dark:text-foreground pl-11 pr-10 text-sm shadow-md backdrop-blur-md placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-white"
            />
            {searchQuery && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Carrusel de Tarjetas Gigantes Destacadas */}
        {filteredSlides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 sm:p-12 text-center text-white my-4">
            <Layers className="h-12 w-12 text-white/50 mb-3" />
            <h3 className="text-lg font-bold">No encontramos categorías para &quot;{searchQuery}&quot;</h3>
            <p className="mt-1 text-xs sm:text-sm text-white/80 max-w-md">
              Probá con otro término como Tecnología, Belleza, Muebles o Alimentos.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="mt-4 rounded-full border-white/30 bg-white/20 text-white hover:bg-white hover:text-slate-900 transition-all font-semibold"
            >
              Restablecer búsqueda
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Controles de flecha desktop flotantes */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scrollCarousel('left')}
              disabled={activeSlideIndex === 0}
              aria-label="Slide anterior"
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scrollCarousel('right')}
              disabled={activeSlideIndex === filteredSlides.length - 1}
              aria-label="Siguiente slide"
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Pista de tarjetas */}
            <div
              ref={carouselTrackRef}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
              className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {filteredSlides.map((slide, idx) => {
                const isActive = idx === activeSlideIndex

                return (
                  <div
                    key={slide.id}
                    className={cn(
                      'relative shrink-0 overflow-hidden rounded-[28px] sm:rounded-[32px] shadow-2xl transition-all duration-300',
                      'w-[82vw] max-w-[340px] sm:w-[360px] md:w-[390px]',
                      'h-[380px] sm:h-[420px]',
                      isActive ? 'scale-100 ring-2 ring-white/40' : 'scale-[0.97] opacity-90'
                    )}
                    style={{ scrollSnapAlign: 'center' }}
                  >
                    {/* Imagen de Fondo de Alta Calidad */}
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      fill
                      sizes="(max-width: 768px) 85vw, 420px"
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      priority={idx < 2}
                    />

                    {/* Gradientes Oscuros Superior e Inferior para Legibilidad Cristalina */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85" />

                    {/* Contenido Superior: Eyebrow + Título + Descripción */}
                    <div className="absolute left-0 right-0 top-0 p-5 sm:p-6 text-white">
                      <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white/90 drop-shadow-sm">
                        {slide.eyebrow}
                      </span>
                      <h3 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
                        {slide.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-[270px] drop-shadow-sm">
                        {slide.description}
                      </p>
                    </div>

                    {/* Botón Cápsula "Explorar ahora" con Flecha Circular */}
                    <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5">
                      <Link
                        href={`/marketplace/productos?q=${encodeURIComponent(slide.searchTerm)}`}
                        className="group/btn flex items-center justify-between rounded-full bg-white/95 dark:bg-card/95 py-2.5 px-4 sm:py-3 sm:px-5 text-slate-900 dark:text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-white"
                      >
                        <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                          Explorar ahora
                        </span>
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-transform group-hover/btn:translate-x-1 shadow-sm">
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                        </div>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Indicador de Bolitas de Slides */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {filteredSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    const el = carouselTrackRef.current
                    if (!el) return
                    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
                    el.scrollTo({ left: i * cardWidth, behavior: 'smooth' })
                    setActiveSlideIndex(i)
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === activeSlideIndex
                      ? 'w-6 bg-white shadow-xs'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

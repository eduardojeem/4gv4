'use client'

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppImage } from '@/components/ui/app-image'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { ShowcaseRubroId, ShowcaseRubroStats } from '@/lib/public/category-showcase'

export type ShowcaseSlide = {
  id: ShowcaseRubroId
  eyebrow: string
  title: string
  description: string
  image: string
  searchTerm: string
  /** Resplandor suave del rubro activo sobre el fondo oscuro neutro. */
  glow: string
}

export const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: 'belleza',
    eyebrow: 'BRILLA CON CONFIANZA',
    title: 'Belleza & Estética',
    description: 'Perfumes, cuidado de piel, cabello y belleza.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format',
    searchTerm: 'belleza',
    glow: 'bg-rose-500/20',
  },
  {
    id: 'servicios',
    eyebrow: 'PROFESIONALES DE CONFIANZA',
    title: 'Servicios',
    description: 'Descubrí expertos locales listos para ayudarte.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format',
    searchTerm: 'servicios',
    glow: 'bg-sky-500/20',
  },
  {
    id: 'electronica',
    eyebrow: 'MÁS CONECTADO CADA DÍA',
    title: 'Electrónica',
    description: 'Celulares, pantallas, cámaras y tecnología para todos los días.',
    image: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=80&auto=format',
    searchTerm: 'electronica',
    glow: 'bg-violet-500/20',
  },
  {
    id: 'electrodomesticos',
    eyebrow: 'CONFORT & TECNOLOGÍA EN CASA',
    title: 'Electrodomésticos',
    description: 'Heladeras, lavarropas, climatización y cocina para tu día a día.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80&auto=format',
    searchTerm: 'electrodomesticos',
    glow: 'bg-blue-500/20',
  },
  {
    id: 'muebles',
    eyebrow: 'CONFORT & DISEÑO',
    title: 'Muebles & Hogar',
    description: 'Todo para tu casa, el jardín y la pileta.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format',
    searchTerm: 'muebles',
    glow: 'bg-amber-500/20',
  },
  {
    id: 'computacion',
    eyebrow: 'PRODUCTIVIDAD & EQUIPAMIENTO',
    title: 'Computación',
    description: 'Tintas, teclados, mouse, almacenamiento y redes.',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format',
    searchTerm: 'computacion',
    glow: 'bg-cyan-500/20',
  },
  {
    id: 'audio',
    eyebrow: 'SONIDO DE ALTA FIDELIDAD',
    title: 'Audio & Video',
    description: 'Auriculares, parlantes y sonido envolvente.',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80&auto=format',
    searchTerm: 'audio',
    glow: 'bg-teal-500/20',
  },
  {
    id: 'moda',
    eyebrow: 'TU PROPIO ESTILO',
    title: 'Moda & Relojería',
    description: 'Remeras básicas, indumentaria corporativa y relojes.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format',
    searchTerm: 'reloj',
    glow: 'bg-pink-500/20',
  },
]

interface Props {
  className?: string
  exploreAllHref?: string
  exploreAllLabel?: string
  title?: string
  subtitle?: string
  /**
   * Productos reales por rubro (categorías de las tiendas agrupadas). Con
   * datos, solo salen los rubros que tienen productos, ordenados por cantidad,
   * y el botón lleva a esas categorías. Sin datos, se muestran todos los
   * rubros con una búsqueda por texto.
   */
  stats?: Partial<Record<ShowcaseRubroId, ShowcaseRubroStats>> | null
}

type Card = ShowcaseSlide & { stats: ShowcaseRubroStats | null; href: string }

export function MarketplaceCategoriesShowcase({
  className,
  exploreAllHref = '/marketplace/categorias',
  exploreAllLabel = 'Ver todas',
  title = 'Categorías destacadas',
  subtitle = 'Explorá los rubros comerciales del marketplace y encontrá productos en tu ciudad.',
  stats = null,
}: Props) {
  const carouselTrackRef = useRef<HTMLDivElement>(null)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)

  const cards = useMemo<Card[]>(() => {
    if (!stats) {
      return SHOWCASE_SLIDES.map((slide) => ({
        ...slide,
        stats: null,
        href: `/marketplace/productos?q=${encodeURIComponent(slide.searchTerm)}`,
      }))
    }
    return SHOWCASE_SLIDES
      .flatMap((slide) => {
        const rubro = stats[slide.id]
        if (!rubro) return []
        return [{ ...slide, stats: rubro, href: `/marketplace/productos?categoria=${rubro.categoryIds.join(',')}` }]
      })
      .sort((a, b) => (b.stats?.count ?? 0) - (a.stats?.count ?? 0))
  }, [stats])

  const totalProducts = cards.reduce((sum, card) => sum + (card.stats?.count ?? 0), 0)

  const cardStep = () => {
    const el = carouselTrackRef.current
    return el?.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
  }

  const scrollCarousel = (direction: 'left' | 'right') => {
    carouselTrackRef.current?.scrollBy({ left: direction === 'left' ? -cardStep() : cardStep(), behavior: 'smooth' })
  }

  const handleScroll = useCallback(() => {
    const el = carouselTrackRef.current
    if (!el) return
    const step = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380
    setActiveSlideIndex(Math.max(0, Math.min(Math.round(el.scrollLeft / step), cards.length - 1)))
  }, [cards.length])

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

  // Avance automático cada 5 s, con pausa al pasar el mouse o tocar.
  useEffect(() => {
    if (!autoplayEnabled || isPaused || cards.length <= 1) return
    const timer = setInterval(() => {
      const el = carouselTrackRef.current
      if (!el) return
      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 30
      if (isAtEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
      else el.scrollBy({ left: cardStep(), behavior: 'smooth' })
    }, 5000)
    return () => clearInterval(timer)
  }, [autoplayEnabled, isPaused, cards.length])

  if (cards.length === 0) return null

  const activeSlide = cards[activeSlideIndex] ?? cards[0]

  return (
    <section
      suppressHydrationWarning
      aria-label="Carrusel de categorías destacadas"
      className={cn(
        // Modo claro: fondo claro neutro; modo oscuro: pizarra. Antes cada rubro
        // teñía toda la franja de un color fuerte.
        'relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-slate-100 via-slate-50 to-white py-8 sm:py-14',
        'dark:from-slate-900 dark:via-slate-950 dark:to-slate-900',
        className,
      )}
    >
      {/* Un resplandor suave con el color del rubro activo */}
      <div className={cn('pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl transition-colors duration-700', activeSlide.glow)} />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl dark:bg-white/5" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white dark:shadow-none">
              <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
              <span>EXPLORÁ POR CATEGORÍAS</span>
              <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-white/60" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-white/80">
                {cards.length} rubros{totalProducts > 0 ? ` · ${totalProducts} productos` : ''}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl dark:text-white">{title}</h2>
            <p className="text-xs font-medium leading-relaxed text-slate-600 sm:text-sm dark:text-white/75">{subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-md dark:hover:bg-white/20 dark:hover:text-white"
            >
              <Link href={exploreAllHref}>
                <span>{exploreAllLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {cards.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAutoplayEnabled((prev) => !prev)}
                className="h-9 w-9 rounded-full border-slate-300 bg-white text-slate-800 hover:bg-slate-100 active:scale-95 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-md dark:hover:bg-white/20 dark:hover:text-white"
                aria-label={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
                title={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
              >
                {autoplayEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => scrollCarousel('left')}
            disabled={activeSlideIndex === 0}
            aria-label="Slide anterior"
            className="absolute -left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-900 shadow-xl backdrop-blur-md transition-all hover:bg-white active:scale-95 disabled:opacity-0 sm:flex dark:border-transparent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => scrollCarousel('right')}
            disabled={activeSlideIndex === cards.length - 1}
            aria-label="Siguiente slide"
            className="absolute -right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-900 shadow-xl backdrop-blur-md transition-all hover:bg-white active:scale-95 disabled:opacity-0 sm:flex dark:border-transparent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={carouselTrackRef}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-4 pt-1 scrollbar-hide sm:gap-6"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {cards.map((card, idx) => {
              const isActive = idx === activeSlideIndex
              const count = card.stats?.count ?? 0
              const products = card.stats?.products ?? []
              return (
                <div
                  key={card.id}
                  className={cn(
                    'relative shrink-0 overflow-hidden rounded-[28px] shadow-2xl transition-all duration-300 sm:rounded-[32px]',
                    'w-[82vw] max-w-[340px] sm:w-[360px] md:w-[390px]',
                    products.length > 0 ? 'h-[420px] sm:h-[440px]' : 'h-[380px] sm:h-[420px]',
                    isActive ? 'scale-100 ring-2 ring-slate-900/15 dark:ring-white/40' : 'scale-[0.97] opacity-90',
                  )}
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    sizes="(max-width: 768px) 85vw, 420px"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    priority={idx < 2}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85" />

                  <div className="absolute left-0 right-0 top-0 p-5 text-white sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/90 sm:text-xs">{card.eyebrow}</span>
                      {count > 0 && (
                        <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/25 backdrop-blur-md">
                          {count} productos
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{card.title}</h3>
                    <p className="mt-1.5 max-w-[270px] text-xs font-medium leading-relaxed text-white/90 sm:text-sm">{card.description}</p>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 space-y-3 sm:bottom-5 sm:left-5 sm:right-5">
                    {products.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {products.map((product) => {
                          const image = resolveProductImageUrl(product.image)
                          return (
                            <Link
                              key={product.id}
                              href={product.href}
                              title={product.name}
                              className="relative aspect-square overflow-hidden rounded-xl bg-white/95 shadow-md transition-transform hover:scale-[1.03]"
                            >
                              {image && <AppImage src={image} alt={product.name} fill sizes="100px" className="object-contain p-1.5" />}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    <Link
                      href={card.href}
                      className="group/btn flex items-center justify-between rounded-full bg-white/95 px-4 py-2.5 text-slate-900 shadow-lg backdrop-blur-md transition-all hover:bg-white sm:px-5 sm:py-3 dark:bg-card/95 dark:text-foreground"
                    >
                      <span className="text-xs font-extrabold tracking-tight sm:text-sm">
                        {count > 0 ? `Ver ${count} productos` : 'Explorar ahora'}
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition-transform group-hover/btn:translate-x-1 sm:h-8 sm:w-8 dark:bg-white dark:text-slate-900">
                        <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] sm:h-4 sm:w-4" />
                      </span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Puntitos solo en pantallas grandes: en el celular el tamaño mínimo de
              toque los volvía círculos grandes, y ahí se desliza con el dedo. */}
          <div className="mt-3 hidden items-center justify-center gap-1.5 sm:flex">
            {cards.map((card, i) => (
              <button
                key={card.id}
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  carouselTrackRef.current?.scrollTo({ left: i * cardStep(), behavior: 'smooth' })
                  setActiveSlideIndex(i)
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === activeSlideIndex
                    ? 'w-6 bg-slate-800 dark:bg-white'
                    : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/40 dark:hover:bg-white/70',
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

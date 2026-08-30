'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ChevronLeft, ChevronRight, Pause, Play, Flame, ArrowRight, Star, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OffersSectionSettings } from '@/types/website-settings'
import { cn } from '@/lib/utils'

export interface OfferSlide {
  id: string
  title: string
  description: string
  priceLabel: string
  originalPriceLabel?: string
  tag: string
  ctaHref: string
  image: string | null
  brand: string | null
  inStock: boolean
}

export type OffersAccent = {
  section: string
  eyebrow: string
  price: string
  button: string
  activeDot: string
}

export const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], OffersAccent> = {
  brand: {
    section: 'border-primary/20 bg-gradient-to-b from-primary/[0.04] via-background to-background',
    eyebrow: 'text-primary',
    price: 'text-primary',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20',
    activeDot: 'bg-primary',
  },
  rose: {
    section: 'border-rose-500/20 bg-gradient-to-b from-rose-500/[0.04] via-background to-background dark:border-rose-900/30',
    eyebrow: 'text-rose-600 dark:text-rose-400',
    price: 'text-rose-600 dark:text-rose-400',
    button: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/25',
    activeDot: 'bg-rose-600',
  },
  amber: {
    section: 'border-amber-500/20 bg-gradient-to-b from-amber-500/[0.04] via-background to-background dark:border-amber-900/30',
    eyebrow: 'text-amber-600 dark:text-amber-400',
    price: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 text-white hover:bg-amber-500 shadow-md shadow-amber-600/25',
    activeDot: 'bg-amber-600',
  },
  orange: {
    section: 'border-orange-500/20 bg-gradient-to-b from-orange-500/[0.04] via-background to-background dark:border-orange-900/30',
    eyebrow: 'text-orange-600 dark:text-orange-400',
    price: 'text-orange-600 dark:text-orange-400',
    button: 'bg-orange-600 text-white hover:bg-orange-500 shadow-md shadow-orange-600/25',
    activeDot: 'bg-orange-600',
  },
  emerald: {
    section: 'border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] via-background to-background dark:border-emerald-900/30',
    eyebrow: 'text-emerald-600 dark:text-emerald-400',
    price: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/25',
    activeDot: 'bg-emerald-600',
  },
  blue: {
    section: 'border-blue-500/20 bg-gradient-to-b from-blue-500/[0.04] via-background to-background dark:border-blue-900/30',
    eyebrow: 'text-blue-600 dark:text-blue-400',
    price: 'text-blue-600 dark:text-blue-400',
    button: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/25',
    activeDot: 'bg-blue-600',
  },
  sky: {
    section: 'border-sky-500/20 bg-gradient-to-b from-sky-500/[0.04] via-background to-background dark:border-sky-900/30',
    eyebrow: 'text-sky-600 dark:text-sky-400',
    price: 'text-sky-600 dark:text-sky-400',
    button: 'bg-sky-600 text-white hover:bg-sky-500 shadow-md shadow-sky-600/25',
    activeDot: 'bg-sky-600',
  },
  violet: {
    section: 'border-violet-500/20 bg-gradient-to-b from-violet-500/[0.04] via-background to-background dark:border-violet-900/30',
    eyebrow: 'text-violet-600 dark:text-violet-400',
    price: 'text-violet-600 dark:text-violet-400',
    button: 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/25',
    activeDot: 'bg-violet-600',
  },
  fuchsia: {
    section: 'border-fuchsia-500/20 bg-gradient-to-b from-fuchsia-500/[0.04] via-background to-background dark:border-fuchsia-900/30',
    eyebrow: 'text-fuchsia-600 dark:text-fuchsia-400',
    price: 'text-fuchsia-600 dark:text-fuchsia-400',
    button: 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-md shadow-fuchsia-600/25',
    activeDot: 'bg-fuchsia-600',
  },
  red: {
    section: 'border-red-500/20 bg-gradient-to-b from-red-500/[0.04] via-background to-background dark:border-red-900/30',
    eyebrow: 'text-red-600 dark:text-red-400',
    price: 'text-red-600 dark:text-red-400',
    button: 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/25',
    activeDot: 'bg-red-600',
  },
  teal: {
    section: 'border-teal-500/20 bg-gradient-to-b from-teal-500/[0.04] via-background to-background dark:border-teal-900/30',
    eyebrow: 'text-teal-600 dark:text-teal-400',
    price: 'text-teal-600 dark:text-teal-400',
    button: 'bg-teal-600 text-white hover:bg-teal-500 shadow-md shadow-teal-600/25',
    activeDot: 'bg-teal-600',
  },
}

interface OffersCarouselDeckProps {
  offers: OfferSlide[]
  accent: OffersAccent
  fallbackBrand: string
  tenantPrefix: string
  autoplay?: boolean
  intervalSeconds?: number
  ariaLabel?: string
}

export function OffersCarouselDeck({
  offers,
  accent,
  fallbackBrand,
  tenantPrefix,
  autoplay = true,
  intervalSeconds = 5,
  ariaLabel = 'Carrusel de ofertas destacadas',
}: OffersCarouselDeckProps) {
  const [activeOfferIndex, setActiveOfferIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [isSectionVisible, setIsSectionVisible] = useState(true)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const handleVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible')
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setIsSectionVisible(Boolean(entries[0]?.isIntersecting)),
      { threshold: 0.2 }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const findNearestOfferIndex = useCallback(() => {
    const track = trackRef.current
    if (!track) return 0
    const children = Array.from(track.children) as HTMLElement[]
    if (children.length === 0) return 0
    const containerLeft = track.getBoundingClientRect().left
    let nearest = 0
    let minDistance = Number.POSITIVE_INFINITY
    children.forEach((child, idx) => {
      const distance = Math.abs(child.getBoundingClientRect().left - containerLeft)
      if (distance < minDistance) {
        minDistance = distance
        nearest = idx
      }
    })
    return nearest
  }, [])

  const effectivelyPaused = isCarouselPaused || isUserPaused || !autoplay

  useEffect(() => {
    if (effectivelyPaused || offers.length <= 1 || !isSectionVisible || !isDocumentVisible) return
    const delay = Math.max(2, intervalSeconds) * 1000
    const interval = window.setInterval(() => {
      setActiveOfferIndex((prev) => {
        const next = (prev + 1) % offers.length
        const node = trackRef.current?.children?.item(next) as HTMLElement | null
        node?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          inline: 'start',
          block: 'nearest',
        })
        return next
      })
    }, delay)
    return () => window.clearInterval(interval)
  }, [offers.length, effectivelyPaused, isSectionVisible, isDocumentVisible, prefersReducedMotion, intervalSeconds])

  const goToOffer = useCallback((index: number) => {
    if (offers.length === 0) return
    const normalized = (index + offers.length) % offers.length
    setActiveOfferIndex(normalized)
    const node = trackRef.current?.children?.item(normalized) as HTMLElement | null
    node?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'start',
      block: 'nearest',
    })
  }, [offers.length, prefersReducedMotion])

  const resolveHref = (href: string | undefined) => {
    const target = href ?? '/productos'
    return target.startsWith('/productos') ? `${tenantPrefix}${target}` : target
  }

  if (offers.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="relative space-y-4"
      onMouseEnter={() => setIsCarouselPaused(true)}
      onMouseLeave={() => setIsCarouselPaused(false)}
      onTouchStart={() => setIsCarouselPaused(true)}
      onTouchEnd={() => setIsCarouselPaused(false)}
    >
      {/* ── Controles Superiores de Navegación ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Indicadores de Progreso */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Indicadores de oferta">
          {offers.map((offer, idx) => (
            <button
              key={offer.id}
              type="button"
              role="tab"
              aria-selected={idx === activeOfferIndex}
              onClick={() => goToOffer(idx)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                idx === activeOfferIndex
                  ? `w-7 ${accent.activeDot}`
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Ir a oferta ${idx + 1}`}
            />
          ))}

          {autoplay && (
            <button
              type="button"
              onClick={() => setIsUserPaused((p) => !p)}
              className="ml-2 flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground"
              aria-label={isUserPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
            >
              {isUserPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Flechas de Navegación */}
        {offers.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-border/80 bg-card hover:bg-muted shadow-2xs"
              onClick={() => goToOffer(activeOfferIndex - 1)}
              aria-label="Oferta anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-border/80 bg-card hover:bg-muted shadow-2xs"
              onClick={() => goToOffer(activeOfferIndex + 1)}
              aria-label="Siguiente oferta"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Pista Deslizable de Tarjetas Premium ── */}
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-none"
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        aria-live={effectivelyPaused ? 'polite' : 'off'}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            goToOffer(activeOfferIndex - 1)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            goToOffer(activeOfferIndex + 1)
          }
        }}
        onScroll={() => {
          const next = findNearestOfferIndex()
          setActiveOfferIndex(Math.max(0, Math.min(offers.length - 1, next)))
        }}
      >
        {offers.map((offer, idx) => (
          <article
            key={offer.id}
            aria-labelledby={`offer-title-${offer.id}`}
            className="group relative flex flex-col justify-between min-w-[85%] sm:min-w-[48%] lg:min-w-[32%] xl:min-w-[30%] snap-start overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/50"
          >
            <div>
              {/* Imagen del Producto con Badges */}
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted/40 p-3 mb-3">
                <Link href={resolveHref(offer.ctaHref)} className="relative block h-full w-full">
                  {offer.image ? (
                    <Image
                      src={offer.image}
                      alt={offer.title || 'Imagen de oferta destacada'}
                      fill
                      unoptimized
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 85vw, (max-width: 1024px) 48vw, 32vw"
                      priority={idx === 0}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </Link>

                {/* Badge de Descuento */}
                <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-sm',
                    accent.button
                  )}>
                    <Flame className="h-3.5 w-3.5 fill-current animate-pulse" />
                    <span>{offer.tag}</span>
                  </span>
                </div>

                {/* Badge Destacado */}
                <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    <Star className="h-3 w-3 fill-white" />
                    <span>Top Semana</span>
                  </span>
                </div>

                {!offer.inStock && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                    <span className="rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
                      Sin stock
                    </span>
                  </div>
                )}
              </div>

              {/* Marca & Título */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {offer.brand || fallbackBrand}
                </p>
                <Link href={resolveHref(offer.ctaHref)} className="group-hover:text-primary transition-colors">
                  <h3 id={`offer-title-${offer.id}`} className="line-clamp-2 text-sm font-bold leading-snug text-foreground" title={offer.title}>
                    {offer.title}
                  </h3>
                </Link>
              </div>
            </div>

            {/* Precios & Botón de Acción */}
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
              <div>
                {offer.originalPriceLabel && (
                  <p className="text-xs font-semibold text-muted-foreground line-through tabular-nums leading-none">
                    {offer.originalPriceLabel}
                  </p>
                )}
                <p className={cn('text-lg font-black tracking-tight tabular-nums mt-0.5', accent.price)}>
                  {offer.priceLabel}
                </p>
              </div>

              <Button
                asChild
                size="sm"
                className={cn('rounded-xl font-bold text-xs gap-1.5 px-3.5 shadow-xs', accent.button)}
              >
                <Link href={resolveHref(offer.ctaHref)}>
                  <span>Aprovechar</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

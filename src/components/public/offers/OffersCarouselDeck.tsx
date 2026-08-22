'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OffersSectionSettings } from '@/types/website-settings'
import { cn } from '@/lib/utils'

/**
 * Carrusel de ofertas: la pista, las tarjetas y los controles.
 *
 * Vive aparte para que el inicio público (OffersCarousel) y la página /ofertas
 * compartan exactamente el mismo diseño. El que fetchea los datos y pone el
 * marco de la sección es cada consumidor; acá sólo se renderiza la pista.
 */

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
    section: 'border-primary/30 bg-gradient-to-b from-primary/10 to-background',
    eyebrow: 'text-primary',
    price: 'text-primary',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90',
    activeDot: 'bg-primary',
  },
  rose: {
    section: 'border-rose-200 bg-gradient-to-b from-rose-50/90 to-background dark:border-rose-900/40 dark:from-rose-950/25',
    eyebrow: 'text-rose-700 dark:text-rose-300',
    price: 'text-rose-700 dark:text-rose-300',
    button: 'bg-rose-600 text-white hover:bg-rose-700',
    activeDot: 'bg-rose-600',
  },
  amber: {
    section: 'border-amber-200 bg-gradient-to-b from-amber-50/90 to-background dark:border-amber-900/40 dark:from-amber-950/25',
    eyebrow: 'text-amber-700 dark:text-amber-300',
    price: 'text-amber-700 dark:text-amber-300',
    button: 'bg-amber-600 text-white hover:bg-amber-700',
    activeDot: 'bg-amber-600',
  },
  orange: {
    section: 'border-orange-200 bg-gradient-to-b from-orange-50/90 to-background dark:border-orange-900/40 dark:from-orange-950/25',
    eyebrow: 'text-orange-700 dark:text-orange-300',
    price: 'text-orange-700 dark:text-orange-300',
    button: 'bg-orange-600 text-white hover:bg-orange-700',
    activeDot: 'bg-orange-600',
  },
  emerald: {
    section: 'border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-background dark:border-emerald-900/40 dark:from-emerald-950/25',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    price: 'text-emerald-700 dark:text-emerald-300',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    activeDot: 'bg-emerald-600',
  },
  blue: {
    section: 'border-blue-200 bg-gradient-to-b from-blue-50/90 to-background dark:border-blue-900/40 dark:from-blue-950/25',
    eyebrow: 'text-blue-700 dark:text-blue-300', price: 'text-blue-700 dark:text-blue-300', button: 'bg-blue-600 text-white hover:bg-blue-700', activeDot: 'bg-blue-600',
  },
  sky: {
    section: 'border-sky-200 bg-gradient-to-b from-sky-50/90 to-background dark:border-sky-900/40 dark:from-sky-950/25',
    eyebrow: 'text-sky-700 dark:text-sky-300', price: 'text-sky-700 dark:text-sky-300', button: 'bg-sky-600 text-white hover:bg-sky-700', activeDot: 'bg-sky-600',
  },
  violet: {
    section: 'border-violet-200 bg-gradient-to-b from-violet-50/90 to-background dark:border-violet-900/40 dark:from-violet-950/25',
    eyebrow: 'text-violet-700 dark:text-violet-300', price: 'text-violet-700 dark:text-violet-300', button: 'bg-violet-600 text-white hover:bg-violet-700', activeDot: 'bg-violet-600',
  },
  fuchsia: {
    section: 'border-fuchsia-200 bg-gradient-to-b from-fuchsia-50/90 to-background dark:border-fuchsia-900/40 dark:from-fuchsia-950/25',
    eyebrow: 'text-fuchsia-700 dark:text-fuchsia-300', price: 'text-fuchsia-700 dark:text-fuchsia-300', button: 'bg-fuchsia-600 text-white hover:bg-fuchsia-700', activeDot: 'bg-fuchsia-600',
  },
  red: {
    section: 'border-red-200 bg-gradient-to-b from-red-50/90 to-background dark:border-red-900/40 dark:from-red-950/25',
    eyebrow: 'text-red-700 dark:text-red-300', price: 'text-red-700 dark:text-red-300', button: 'bg-red-600 text-white hover:bg-red-700', activeDot: 'bg-red-600',
  },
  teal: {
    section: 'border-teal-200 bg-gradient-to-b from-teal-50/90 to-background dark:border-teal-900/40 dark:from-teal-950/25',
    eyebrow: 'text-teal-700 dark:text-teal-300', price: 'text-teal-700 dark:text-teal-300', button: 'bg-teal-600 text-white hover:bg-teal-700', activeDot: 'bg-teal-600',
  },
}

interface OffersCarouselDeckProps {
  offers: OfferSlide[]
  accent: OffersAccent
  /** Marca que se muestra cuando el producto no tiene una propia. */
  fallbackBrand: string
  /** Prefijo de tenant para los links (`/slug` o vacío). */
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

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsCarouselPaused(true)}
      onMouseLeave={() => setIsCarouselPaused(false)}
      onTouchStart={() => setIsCarouselPaused(true)}
      onTouchEnd={() => setIsCarouselPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            className="min-w-[88%] snap-start overflow-hidden rounded-2xl border bg-card sm:min-w-[62%] lg:min-w-[36%]"
          >
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
              {offer.image ? (
                <Image
                  src={offer.image}
                  alt={offer.title || 'Imagen de oferta'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 88vw, (max-width: 1200px) 62vw, 36vw"
                  priority={idx === 0}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-12 w-12 text-slate-500/60" />
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
                {offer.tag}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id={`offer-title-${offer.id}`} className="line-clamp-1 text-lg font-semibold">{offer.title}</h3>
                  <p className="text-xs text-muted-foreground">{offer.brand || fallbackBrand}</p>
                </div>
                <div className="text-right">
                  {offer.originalPriceLabel && (
                    <p className="text-xs text-muted-foreground line-through">{offer.originalPriceLabel}</p>
                  )}
                  <p className={cn('text-lg font-bold', accent.price)}>{offer.priceLabel}</p>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{offer.description}</p>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${offer.inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {offer.inStock ? 'Disponible' : 'Sin stock'}
                </span>
                <Button asChild size="sm" className={accent.button}>
                  <Link href={resolveHref(offer.ctaHref)}>Ver detalle</Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {offers.length > 1 && (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 bg-background/90 sm:flex"
            onClick={() => goToOffer(activeOfferIndex - 1)}
            aria-label="Oferta anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 bg-background/90 sm:flex"
            onClick={() => goToOffer(activeOfferIndex + 1)}
            aria-label="Siguiente oferta"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="mt-3 flex items-center justify-center gap-3">
            {autoplay && (
              <button
                type="button"
                onClick={() => setIsUserPaused((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
                aria-label={isUserPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
              >
                {isUserPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            )}
            <div className="flex gap-2" role="tablist" aria-label="Indicadores de oferta">
              {offers.map((offer, idx) => (
                <button
                  key={offer.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeOfferIndex}
                  onClick={() => goToOffer(idx)}
                  className={cn('h-2.5 rounded-full transition-all', idx === activeOfferIndex ? `w-8 ${accent.activeDot}` : 'w-2.5 bg-muted-foreground/30')}
                  aria-label={`Ir a oferta ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

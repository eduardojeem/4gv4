'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, Package, ChevronLeft, ChevronRight, Pause, Play, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import type { OffersSectionSettings } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import useSWR from 'swr'

export interface OfferCard {
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

interface OffersCarouselProps {
  companyName: string
  settings: OffersSectionSettings
}

const OFFER_ACCENTS: Record<OffersSectionSettings['accentColor'], {
  section: string
  eyebrow: string
  price: string
  button: string
  activeDot: string
}> = {
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
}

const offersFetcher = async (url: string): Promise<OfferCard[]> => {
  const response = await fetch(url)
  const body = await response.json().catch(() => null)
  const products = body?.data?.products

  if (!response.ok || !Array.isArray(products)) {
    throw new Error('Failed to fetch offers')
  }

  return [...products]
    .filter((product) => {
      const salePrice = Number(product?.sale_price || 0)
      const offerPrice = Number(product?.offer_price || 0)
      return Boolean(product?.has_offer) && offerPrice > 0 && salePrice > 0 && offerPrice < salePrice
    })
    .sort((a, b) => Number(Boolean(b?.featured)) - Number(Boolean(a?.featured)))
    .slice(0, 8)
    .map((product) => ({
      id: String(product.id),
      title: String(product.name || 'Producto destacado'),
      description: String(product.description || 'Disponible para entrega inmediata y retiro en tienda.'),
      priceLabel: typeof product.offer_price === 'number' ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(product.offer_price) : 'Consultar precio',
      originalPriceLabel: typeof product.sale_price === 'number' ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(product.sale_price) : undefined,
      tag: 'Oferta activa',
      ctaHref: product.id != null && product.id !== '' ? `/productos/${String(product.id)}` : '/productos',
      image: product.image || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null),
      brand: product.brand || null,
      inStock: typeof product.in_stock === 'boolean'
        ? product.in_stock
        : Number(product.stock_quantity ?? product.in_stock) > 0,
    }))
}

export function OffersCarousel({ companyName, settings }: OffersCarouselProps) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const { data: offerCards, error, isLoading } = useSWR(
    withOrgQuery('/api/public/products?per_page=50&sort=newest&has_offer=true', tenantSlug),
    offersFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const offersFetchFailed = Boolean(error)
  const displayedOffers = offerCards ?? []
  const accent = OFFER_ACCENTS[settings.accentColor] ?? OFFER_ACCENTS.rose

  const [activeOfferIndex, setActiveOfferIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [isSectionVisible, setIsSectionVisible] = useState(true)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)

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
    if (!sectionRef.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setIsSectionVisible(Boolean(entries[0]?.isIntersecting)),
      { threshold: 0.2 }
    )
    observer.observe(sectionRef.current)
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

  const effectivelyPaused = isCarouselPaused || isUserPaused

  useEffect(() => {
    if (effectivelyPaused || displayedOffers.length <= 1 || !isSectionVisible || !isDocumentVisible) return
    const interval = window.setInterval(() => {
      setActiveOfferIndex((prev) => {
        const next = (prev + 1) % displayedOffers.length
        const node = trackRef.current?.children?.item(next) as HTMLElement | null
        node?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          inline: 'start',
          block: 'nearest',
        })
        return next
      })
    }, 5000)
    return () => window.clearInterval(interval)
  }, [displayedOffers.length, effectivelyPaused, isSectionVisible, isDocumentVisible, prefersReducedMotion])

  const goToOffer = useCallback((index: number) => {
    if (displayedOffers.length === 0) return
    const normalized = (index + displayedOffers.length) % displayedOffers.length
    setActiveOfferIndex(normalized)
    const node = trackRef.current?.children?.item(normalized) as HTMLElement | null
    node?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'start',
      block: 'nearest',
    })
  }, [displayedOffers.length, prefersReducedMotion])

  return (
    <section ref={sectionRef} className={cn('border-y py-14 md:py-20', accent.section)}>
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={cn('flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]', accent.eyebrow)}>
              <Tag className="h-4 w-4" />
              {settings.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{settings.title}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {settings.subtitle}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`${tenantPrefix}/productos`}>
              Ver catalogo completo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-64 animate-pulse rounded-2xl border bg-muted/40" />
            ))}
          </div>
        ) : displayedOffers.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
            <p className="text-base font-semibold">No hay ofertas activas en este momento</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {offersFetchFailed
                ? 'No pudimos cargar las ofertas. Intenta nuevamente en unos minutos.'
                : 'Cuando actives productos con precio en oferta, apareceran aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <div
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
              aria-label="Carrusel de ofertas destacadas"
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
                setActiveOfferIndex(Math.max(0, Math.min(displayedOffers.length - 1, next)))
              }}
            >
              {displayedOffers.map((offer, idx) => (
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
                        <p className="text-xs text-muted-foreground">{offer.brand || companyName || '4G Movil'}</p>
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
                        <Link href={(offer.ctaHref ?? '/productos').startsWith('/productos') ? `${tenantPrefix}${offer.ctaHref ?? '/productos'}` : (offer.ctaHref ?? `${tenantPrefix}/productos`)}>Ver detalle</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {displayedOffers.length > 1 && (
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
                  <button
                    type="button"
                    onClick={() => setIsUserPaused((p) => !p)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={isUserPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
                  >
                    {isUserPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  </button>
                  <div className="flex gap-2" role="tablist" aria-label="Indicadores de oferta">
                    {displayedOffers.map((offer, idx) => (
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
        )}
      </div>
    </section>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, Package, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  fallbackOffers: OfferCard[]
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
      priceLabel: typeof product.offer_price === 'number' ? `${product.offer_price.toLocaleString('es-CL')}` : 'Consultar precio',
      originalPriceLabel: typeof product.sale_price === 'number' ? `${product.sale_price.toLocaleString('es-CL')}` : undefined,
      tag: 'Oferta activa',
      ctaHref: product.id ? `/productos/${product.id}` : '/productos',
      image: product.image || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null),
      brand: product.brand || null,
      inStock: Number(product.in_stock) > 0 || Boolean(product.in_stock),
    }))
}

export function OffersCarousel({ companyName, fallbackOffers }: OffersCarouselProps) {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix = pathSegments.length > 1 && pathSegments[1] === 'inicio' ? `/${pathSegments[0]}` : ''

  const { data: offerCards, error, isLoading } = useSWR(
    '/api/public/products?per_page=50&sort=newest&has_offer=true',
    offersFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const offersFetchFailed = Boolean(error)
  const displayedOffers = offersFetchFailed ? fallbackOffers : (offerCards ?? [])

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
    if (displayedOffers.length === 0) {
      setActiveOfferIndex(0)
      return
    }
    setActiveOfferIndex((prev) => Math.min(prev, displayedOffers.length - 1))
  }, [displayedOffers.length])

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
    <section ref={sectionRef} className="border-t bg-background py-14 md:py-20">
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">Tienda</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ofertas y productos destacados</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Precios actualizados, servicios populares y equipos recomendados por nuestros tecnicos.
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
        ) : !offersFetchFailed && displayedOffers.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
            <p className="text-base font-semibold">No hay ofertas activas en este momento</p>
            <p className="mt-2 text-sm text-muted-foreground">Cuando actives productos con precio en oferta, apareceran aqui automaticamente.</p>
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
                        alt={offer.title}
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
                        <p className="text-lg font-bold text-primary">{offer.priceLabel}</p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{offer.description}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${offer.inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {offer.inStock ? 'Disponible' : 'Sin stock'}
                      </span>
                      <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                        <Link href={offer.ctaHref.startsWith('/productos') ? `${tenantPrefix}${offer.ctaHref}` : offer.ctaHref}>Ver detalle</Link>
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
                        className={`h-2.5 rounded-full transition-all ${idx === activeOfferIndex ? 'w-8 bg-primary' : 'w-2.5 bg-muted-foreground/30'}`}
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

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, MapPin, Package, Star } from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { Button } from '@/components/ui/button'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { organizationAccentColor } from '@/lib/public/organization-brand'
import { normalizeCity } from '@/lib/public/city-normalizer'
import { RUBRO_LABELS } from '@/components/public/OrganizationDirectoryCard'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

interface Props {
  organizations: MarketplaceOrganization[]
  className?: string
  exploreAllHref?: string
  exploreAllLabel?: string
  title?: string
  subtitle?: string
}

/** Con menos reseñas, un «5.0» no dice nada y parece armado. */
const MIN_REVIEWS_TO_SHOW_RATING = 3
const CARD_GAP = 16

/**
 * Vidriera de tiendas con algunos de sus productos. Sobria a propósito: fondo
 * claro, tarjetas como las del directorio y sin avance automático, para que
 * acompañe a la página en vez de competir con ella.
 */
export function MarketplaceStoresProductsCarousel({
  organizations,
  className,
  exploreAllHref = '/marketplace/empresas',
  exploreAllLabel = 'Ver todas',
  title = 'Tiendas destacadas y sus productos',
  subtitle = 'Comercios del marketplace con sus productos más recientes.',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Las tiendas con productos cargados van en la vidriera; si ninguna tiene, todas.
  const stores = useMemo(() => {
    const withProducts = organizations.filter(
      (org) => (org.featured_products?.length ?? 0) > 0 || org.products_count > 0,
    )
    return withProducts.length > 0 ? withProducts : organizations
  }, [organizations])

  const cardStep = () => {
    const card = scrollRef.current?.querySelector<HTMLElement>('[data-store-card]')
    return card ? card.offsetWidth + CARD_GAP : 360
  }

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
    const card = el.querySelector<HTMLElement>('[data-store-card]')
    const step = card ? card.offsetWidth + CARD_GAP : 360
    setActiveIndex(Math.max(0, Math.min(Math.round(el.scrollLeft / step), stores.length - 1)))
  }, [stores.length])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -cardStep() : cardStep(), behavior: 'smooth' })
  }

  const scrollToIndex = (index: number) => {
    const card = scrollRef.current?.querySelectorAll<HTMLElement>('[data-store-card]')[index]
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  if (stores.length === 0) return null

  return (
    <section
      aria-labelledby="marketplace-stores-carousel-heading"
      className={cn('border-y border-border/70 bg-muted/30 py-8 sm:py-12', className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vidriera del marketplace</p>
            <h2 id="marketplace-stores-carousel-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <Link href={exploreAllHref}>
                <span>{exploreAllLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Tienda anterior"
              className="hidden h-9 w-9 rounded-lg sm:inline-flex"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Siguiente tienda"
              className="hidden h-9 w-9 rounded-lg sm:inline-flex"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 scrollbar-hide sm:mx-0 sm:px-0"
        >
          {stores.map((org) => (
            <StoreShowcaseCard key={org.id} org={org} />
          ))}
        </div>

        {stores.length > 1 && (
          // Solo en pantallas grandes: en el celular se desliza con el dedo, y el
          // tamaño mínimo de toque convertía cada puntito en un círculo grande.
          <div className="mt-4 hidden items-center justify-center gap-1.5 sm:flex">
            {stores.map((org, index) => (
              <button
                key={org.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Ir a ${org.name}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function StoreShowcaseCard({ org }: { org: MarketplaceOrganization }) {
  const rubroMeta = RUBRO_LABELS[org.rubro || 'comercio'] ?? RUBRO_LABELS.comercio
  const RubroIcon = rubroMeta.icon
  const storeUrl = `/${org.slug}/inicio`
  const products = (org.featured_products ?? []).slice(0, 3)
  const accentColor = organizationAccentColor(org)
  const city = normalizeCity(org.city)?.display ?? null
  const reviews = org.review_count ?? 0
  const description = org.slogan || org.description

  const whatsappDigits = (org.whatsapp || org.phone || '').replace(/\D/g, '')
  const whatsappHref = whatsappDigits.length >= 6
    ? getWhatsAppLink({
        phone: org.whatsapp || org.phone!,
        message: `¡Hola ${org.name}! Vi su tienda en el Marketplace y quería hacerles una consulta sobre sus productos.`,
      })
    : null

  return (
    <article
      data-store-card
      className="flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-shadow hover:shadow-md sm:w-[340px]"
    >
      {/* Franja con el color de la tienda: la identifica sin teñir toda la tarjeta */}
      <div className="h-1 w-full bg-primary/70" style={accentColor ? { backgroundColor: accentColor } : undefined} />

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <Link
            href={storeUrl}
            aria-label={org.name}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-background"
          >
            {org.logo_url ? (
              <AppImage src={org.logo_url} alt="" width={48} height={48} className="h-full w-full object-contain p-1" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-primary-foreground"
                style={accentColor ? { backgroundColor: accentColor } : undefined}
              >
                {org.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <Link href={storeUrl} title={org.name} className="truncate font-semibold text-foreground hover:text-primary">
                {org.name}
              </Link>
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Tienda verificada" />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <RubroIcon className="h-3 w-3" aria-hidden="true" />
                {rubroMeta.label}
              </span>
              {city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {city}
                </span>
              )}
              {reviews >= MIN_REVIEWS_TO_SHOW_RATING && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {Number(org.review_rating_avg ?? 0).toFixed(1)}
                  <span className="font-normal text-muted-foreground">({reviews})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {description && <p className="line-clamp-1 text-sm text-muted-foreground">{description}</p>}

        {products.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {products.map((prod) => {
              const image = resolveProductImageUrl(prod.image)
              const hiddenPrice = hidesPublicPrice(prod)
              const hasDiscount = !hiddenPrice && Boolean(prod.has_offer && prod.offer_price && prod.offer_price < prod.sale_price)
              const price = hasDiscount && prod.offer_price ? prod.offer_price : prod.sale_price
              return (
                <Link key={prod.id} href={`/${org.slug}/productos/${prod.id}`} className="group/prod min-w-0" title={prod.name}>
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-background">
                    {image ? (
                      <AppImage
                        src={image}
                        alt={prod.name}
                        fill
                        sizes="110px"
                        className="object-contain p-1.5 transition-transform duration-300 group-hover/prod:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                      </div>
                    )}
                    {hasDiscount && (
                      <span className="absolute left-1 top-1 rounded bg-rose-600 px-1 py-px text-[9px] font-semibold text-white">
                        Oferta
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground group-hover/prod:text-foreground">{prod.name}</p>
                  <p className="text-xs font-semibold text-foreground">
                    {hiddenPrice ? 'Consultar' : formatPrice(price, org.currency ?? 'PYG')}
                  </p>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Catálogo disponible en la tienda.
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 gap-1.5 rounded-lg">
            <Link href={storeUrl}>
              Visitar tienda
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {whatsappHref && (
            <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-lg">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label={`Escribir por WhatsApp a ${org.name}`}>
                <WhatsAppIcon className="h-4 w-4 fill-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

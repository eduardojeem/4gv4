'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import type { OffersSectionSettings } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import {
  OFFER_ACCENTS,
  OffersCarouselDeck,
  type OfferSlide,
} from '@/components/public/offers/OffersCarouselDeck'

export type { OfferSlide }

interface OffersCarouselProps {
  companyName: string
  settings: OffersSectionSettings
}

const priceFormatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0,
})

/**
 * Mapea la respuesta de /api/public/products a slides del carrusel.
 * No recorta la lista: el recorte por maxItems lo hace el consumidor, para que
 * cambiar ese ajuste no invalide la cache de SWR.
 */
export const mapProductsToOfferSlides = (products: unknown[]): OfferSlide[] => {
  return [...products]
    .filter((item) => {
      const product = item as Record<string, unknown>
      const salePrice = Number(product?.sale_price || 0)
      const offerPrice = Number(product?.offer_price || 0)
      return Boolean(product?.has_offer) && offerPrice > 0 && salePrice > 0 && offerPrice < salePrice
    })
    .sort((a, b) => {
      const left = a as Record<string, unknown>
      const right = b as Record<string, unknown>
      return Number(Boolean(right?.featured)) - Number(Boolean(left?.featured))
    })
    .map((item) => {
      const product = item as Record<string, unknown>
      return {
        id: String(product.id),
        title: String(product.name || 'Producto destacado'),
        description: String(product.description || 'Disponible para entrega inmediata y retiro en tienda.'),
        priceLabel: typeof product.offer_price === 'number' ? priceFormatter.format(product.offer_price) : 'Consultar precio',
        originalPriceLabel: typeof product.sale_price === 'number' ? priceFormatter.format(product.sale_price) : undefined,
        tag: 'Oferta activa',
        ctaHref: product.id != null && product.id !== '' ? `/productos/${String(product.id)}` : '/productos',
        image: (product.image as string | null) || (Array.isArray(product.images) && product.images.length > 0 ? String(product.images[0]) : null),
        brand: (product.brand as string | null) || null,
        inStock: typeof product.in_stock === 'boolean'
          ? product.in_stock
          : Number(product.stock_quantity ?? product.in_stock) > 0,
      }
    })
}

const offersFetcher = async (url: string): Promise<OfferSlide[]> => {
  const response = await fetch(url)
  const body = await response.json().catch(() => null)
  const products = body?.data?.products

  if (!response.ok || !Array.isArray(products)) {
    throw new Error('Failed to fetch offers')
  }

  return mapProductsToOfferSlides(products)
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

  const carousel = settings.carousel
  const offersFetchFailed = Boolean(error)
  const displayedOffers = (offerCards ?? []).slice(0, carousel?.maxItems ?? 8)
  const accent = OFFER_ACCENTS[settings.accentColor] ?? OFFER_ACCENTS.rose

  // Garantiza que servidor y cliente rendericen lo mismo en el primer paint.
  // Sin esto, el servidor ve isLoading=true (skeleton) pero el cliente puede ver
  // datos ya cacheados (carousel), causando el mismatch de hidratación.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <section className={cn('border-y py-14 md:py-20', accent.section)}>
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

        {/* Skeleton: siempre igual en servidor y cliente hasta el montaje */}
        {(!isMounted || isLoading) ? (
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
          <OffersCarouselDeck
            offers={displayedOffers}
            accent={accent}
            fallbackBrand={companyName || '4G Movil'}
            tenantPrefix={tenantPrefix}
            autoplay={carousel?.autoplay ?? true}
            intervalSeconds={carousel?.intervalSeconds ?? 5}
          />
        )}
      </div>
    </section>
  )
}

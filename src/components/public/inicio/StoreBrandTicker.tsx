'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'
import { getBrandLogoOrFallback } from '@/lib/website/brand-catalog'
import type { BrandsSectionSettings } from '@/types/website-settings'

interface BrandDisplayItem {
  id: string
  name: string
  imageUrl?: string
  href?: string
  svgLogo: React.ReactNode
}

export function buildBrandTickerItems<T>(items: T[]): T[] {
  return items.length === 0 ? [] : [...items, ...items]
}

export function StoreBrandTicker({
  settings,
  title,
}: {
  settings?: BrandsSectionSettings
  title?: string
}) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const { data: products } = useSWR(
    newestProductsKey(tenantSlug),
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  // Si la sección está explícitamente deshabilitada por el administrador, no se muestra
  const isEnabled = settings?.enabled !== false

  // Extraer marcas presentes en los productos de la tienda si existen
  const storeBrands = useMemo<BrandDisplayItem[]>(() => {
    if (!products || products.length === 0) return []
    const set = new Set<string>()
    for (const p of products) {
      if (p.brand?.trim()) {
        set.add(p.brand.trim())
      }
    }
    return Array.from(set).map((brand) => ({
      id: brand.toLowerCase().replace(/\s+/g, '-'),
      name: brand,
      svgLogo: getBrandLogoOrFallback(brand) || (
        <span className="font-extrabold uppercase tracking-tight text-xs sm:text-sm">
          {brand}
        </span>
      ),
      href: `${tenantPrefix}/productos?q=${encodeURIComponent(brand)}`,
    }))
  }, [products, tenantPrefix])

  // Marcas configuradas en el panel que tienen activo el switch "Público"
  const configuredBrands = useMemo<BrandDisplayItem[]>(() => {
    if (!settings?.items || settings.items.length === 0) return []
    return settings.items
      .filter((item) => item.active) // <-- Solamente las marcas que el usuario eligió como PÚBLICAS
      .map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        svgLogo: getBrandLogoOrFallback(item.id) || getBrandLogoOrFallback(item.name) || (
          <span className="font-extrabold uppercase tracking-tight text-xs sm:text-sm">
            {item.name}
          </span>
        ),
        href: item.href || `${tenantPrefix}/productos?q=${encodeURIComponent(item.name)}`,
      }))
  }, [settings, tenantPrefix])

  // Combinar marcas configuradas activas con marcas detectadas en productos
  const displayBrands = useMemo(() => {
    if (configuredBrands.length > 0) {
      return configuredBrands
    }
    return storeBrands
  }, [configuredBrands, storeBrands])

  // Una sola copia adicional alcanza para el marquee de escritorio. En móvil
  // la segunda tanda se oculta y la fila se desplaza manualmente.
  const tickerItems = useMemo(() => {
    return buildBrandTickerItems(displayBrands)
  }, [displayBrands])

  if (!isEnabled || tickerItems.length === 0) {
    return null
  }

  const headingText = title || settings?.title || 'Las mejores marcas para toda la familia'
  const subtitleText = settings?.subtitle || 'Encontrá indumentaria y calzado original con garantía y envío rápido'

  return (
    <section className="border-b border-border/80 bg-background py-8 sm:py-10 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {headingText}
          </h2>
          {subtitleText && (
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground/70">
              {subtitleText}
            </p>
          )}
        </div>

        {/* Contenedor del Carrusel con Desvanecimiento Lateral y Movimiento Automático */}
        <div className="relative w-full select-none overflow-x-auto pb-1 scrollbar-hide sm:overflow-hidden sm:pb-0">
          {/* Sombras de desvanecimiento lateral estilo Giulio Cesare */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-28 bg-gradient-to-r from-background via-background/80 to-transparent sm:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-28 bg-gradient-to-l from-background via-background/80 to-transparent sm:block" />

          {/* Fila horizontal con animación infinita continua (Marquee con pausa al pasar el cursor) */}
          <div className="flex w-max items-center gap-4 py-3 sm:gap-6 sm:animate-marquee-left sm:hover:[animation-play-state:paused] motion-reduce:animate-none">
            {tickerItems.map((brand, idx) => {
              const href = brand.href || `${tenantPrefix}/productos?q=${encodeURIComponent(brand.name)}`
              const hasCustomImage = Boolean(brand.imageUrl && !imageErrors[`${brand.id}-${idx}`])

              return (
                <Link
                  key={`${brand.id}-${idx}`}
                  href={href}
                  className={cn(
                    'shrink-0 snap-start transition-transform duration-300 focus-visible:outline-none',
                    idx >= displayBrands.length && 'hidden sm:block',
                  )}
                  aria-label={`Ver colección ${brand.name}`}
                  aria-hidden={idx >= displayBrands.length ? true : undefined}
                  tabIndex={idx >= displayBrands.length ? -1 : undefined}
                >
                  <div className="flex h-14 w-28 sm:h-16 sm:w-36 items-center justify-center rounded-xl border border-border/60 bg-card px-4 py-2 shadow-xs transition-all duration-300 opacity-80 grayscale hover:grayscale-0 hover:opacity-100 hover:scale-105 hover:border-primary/40 hover:shadow-md text-foreground">
                    <div className="flex items-center justify-center max-h-8 max-w-full">
                      {hasCustomImage ? (
                        // Las marcas permiten URLs administrables y dominios no conocidos en build.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brand.imageUrl!}
                          alt={brand.name}
                          className="max-h-7 max-w-[85px] sm:max-w-[100px] object-contain"
                          onError={() => setImageErrors((prev) => ({ ...prev, [`${brand.id}-${idx}`]: true }))}
                        />
                      ) : (
                        brand.svgLogo
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

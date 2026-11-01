'use client'

import React from 'react'
import Link from 'next/link'
import { wholesalePresentation } from '@/lib/website/wholesale-presentation'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Package, ArrowRight, Tag } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { AppImage } from '@/components/ui/app-image'
import { StoreOffersPromoShowcase } from '@/components/public/inicio/StoreOffersPromoShowcase'
import { ProductCard } from '@/components/public/ProductCard'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from '@/components/public/inicio/newest-products'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'

export function WholesaleHome({
  settings,
  branches,
  capabilities,
}: {
  settings: WebsiteSettings
  branches: BranchLocationData[]
  capabilities: StorefrontCapabilities
}) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? '/' + slug : ''
  const { categories } = usePublicCategories()
  const { data: products, error, isLoading } = useSWR(
    capabilities.hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )
  const { hero, benefits } = wholesalePresentation(settings, capabilities)
  const brands =
    settings.brands_section?.enabled && settings.brands_section.showOnHome !== false
      ? settings.brands_section.items.filter((x) => x.active && x.name.trim())
      : []

  const activeSlides =
    settings.promotional_carousel?.enabled && settings.promotional_carousel.slides
      ? settings.promotional_carousel.slides.filter((x) => x.active)
      : []
  const configuredSlides = activeSlides.length > 0

  // Secondary promo cards (only if real secondary slides exist, or if special offers are configured)
  const secondarySlides = activeSlides.length > 1 ? activeSlides.slice(1, 3) : []

  return (
    <div data-wholesale-home className="min-w-0 bg-background text-foreground">
      {/* ── 1. Commercial Hero (~320-400px compact) ── */}
      {configuredSlides ? (
        <div className="border-b bg-muted/20">
          <PromotionalCarousel settings={settings.promotional_carousel} />
        </div>
      ) : (
        hero?.enabled !== false && (
          <section className="relative overflow-hidden border-b bg-gradient-to-r from-muted/50 via-muted/20 to-background">
            <div className="mx-auto flex max-w-7xl flex-col justify-center px-4 py-8 sm:py-12 md:min-h-[340px]">
              <div className="max-w-2xl space-y-3">
                {hero?.badge && (
                  <span className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                    {hero.badge}
                  </span>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                  {hero?.title || settings.company_info?.name || 'Catálogo'}
                </h1>
                {hero?.subtitle && (
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {hero.subtitle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href={prefix + '/productos'}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{hero?.ctaPrimaryText || 'Explorar catálogo'}</span>
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                  {settings?.offers_section?.enabled && (
                    <Link
                      href={prefix + '/ofertas'}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/80 bg-background px-4 py-2 text-xs sm:text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Tag className="h-3.5 w-3.5 text-rose-500" aria-hidden />
                      <span>Ver promociones</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )
      )}

      {/* ── 2. Secondary Promo Cards (Only if configured) ── */}
      {secondarySlides.length > 0 && (
        <section aria-label="Promociones destacadas" className="border-b bg-muted/10 py-4">
          <div className="mx-auto max-w-7xl px-4">
            <div className={`grid gap-4 ${secondarySlides.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {secondarySlides.map((slide) => (
                <div
                  key={slide.id}
                  className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-2xs transition-all hover:border-primary/50"
                >
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">{slide.title}</h3>
                    {slide.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{slide.message}</p>
                    )}
                  </div>
                  {slide.ctaText && slide.ctaHref && (
                    <div className="pt-4">
                      <Link
                        href={slide.ctaHref}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <span>{slide.ctaText}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Main Content Container ── */}
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:space-y-12 sm:py-8">
        {/* ── 3. Quick Category Grid (6-8 items for fast entry) ── */}
        {capabilities.hasCatalog && categories.length > 0 && (
          <section aria-labelledby="wholesale-categories">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 id="wholesale-categories" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Explorá por categoría
                </h2>
                <p className="text-xs text-muted-foreground">Acceso rápido a las secciones del catálogo</p>
              </div>
              <Link
                href={prefix + '/productos'}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>Ver catálogo</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  href={prefix + '/productos?category_id=' + encodeURIComponent(category.id)}
                  className="group flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3 sm:p-3.5 transition-all duration-200 hover:border-primary/50 hover:bg-muted/40 hover:shadow-2xs focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Package className="h-4 w-4" aria-hidden />
                    </div>
                    <ArrowRight
                      className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </div>
                  <span className="mt-2.5 block text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary line-clamp-1 break-words">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 4. Product Catalog Grid (Max 20 products, high density) ── */}
        {capabilities.hasCatalog && (
          <section aria-labelledby="wholesale-products">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 id="wholesale-products" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Productos del catálogo
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Explorá los últimos productos publicados con disponibilidad inmediata.
                </p>
              </div>
              <Link
                href={prefix + '/productos'}
                className="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>Ver todos</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {error ? (
              <p role="status" className="rounded-lg border border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
                No pudimos cargar el catálogo.{' '}
                <Link href={prefix + '/productos'} className="font-semibold text-primary underline underline-offset-2">
                  Intentar desde el catálogo
                </Link>
              </p>
            ) : isLoading ? (
              <div role="status" className="py-12 text-center text-sm text-muted-foreground">
                <p>Cargando productos…</p>
              </div>
            ) : !products?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Todavía no hay productos publicados.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 items-stretch">
                {products.slice(0, 20).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 5. Offers Section Showcase (if enabled) ── */}
        {capabilities.hasCatalog && settings.offers_section?.enabled && (
          <StoreOffersPromoShowcase
            companyInfo={settings.company_info}
            tenantPrefix={prefix}
            tenantSlug={slug}
            phoneClean={(settings.company_info?.phone || '').replace(/\D/g, '')}
          />
        )}

        {/* ── 6. Brands Grid (if configured) ── */}
        {brands.length > 0 && (
          <section aria-labelledby="wholesale-brands">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 id="wholesale-brands" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {settings.brands_section?.title || 'Marcas'}
              </h2>
              <span className="text-xs text-muted-foreground">{brands.length} marcas</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={prefix + '/productos?marca=' + encodeURIComponent(brand.name)}
                  className="flex h-14 items-center justify-center rounded-lg border border-border/70 bg-card px-4 py-2 text-center text-xs sm:text-sm font-semibold text-foreground/80 transition-all hover:border-primary/50 hover:bg-muted/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {brand.imageUrl ? (
                    <AppImage
                      src={brand.imageUrl}
                      alt={brand.name}
                      width={120}
                      height={40}
                      className="max-h-9 max-w-full object-contain grayscale transition-all hover:grayscale-0"
                    />
                  ) : (
                    <span className="truncate">{brand.name}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 7. Branches (if configured) ── */}
        {branches.length > 1 && (
          <section aria-labelledby="wholesale-branches">
            <h2 id="wholesale-branches" className="mb-4 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Sucursales
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-1">
                  <h3 className="font-semibold text-sm text-foreground">{branch.name}</h3>
                  {branch.address && <p className="text-xs text-muted-foreground">{branch.address}</p>}
                  {branch.phone && (
                    <a
                      className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                      href={'tel:' + branch.phone.replace(/[^+0-9]/g, '')}
                    >
                      {branch.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── 8. Real Trust Bar / Benefits (Only if merchant explicitly configured them) ── */}
      {benefits?.enabled && benefits.items.some((item) => item.active !== false && item.title.trim()) && (
        <StoreTrustBar settings={benefits} />
      )}
    </div>
  )
}

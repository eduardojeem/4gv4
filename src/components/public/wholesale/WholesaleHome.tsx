'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { wholesalePresentation } from '@/lib/website/wholesale-presentation'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Package, ArrowRight, Tag, Search, X, UserCheck, UserPlus, LogIn } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { AppImage } from '@/components/ui/app-image'
import { StoreOffersPromoShowcase } from '@/components/public/inicio/StoreOffersPromoShowcase'
import { ProductCard } from '@/components/public/ProductCard'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from '@/components/public/inicio/newest-products'
import { cn } from '@/lib/utils'
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
  const brands = useMemo(() => {
    return settings.brands_section?.enabled && settings.brands_section.showOnHome !== false
      ? settings.brands_section.items.filter((x) => x.active && x.name.trim())
      : []
  }, [settings.brands_section])

  const [activeBrandId, setActiveBrandId] = useState<string>(brands[0]?.id || '')
  const selectedBrand = brands.find((x) => x.id === activeBrandId) || brands[0] || null

  const [brandSearchQuery, setBrandSearchQuery] = useState('')
  const [selectedBrandCategoryId, setSelectedBrandCategoryId] = useState<string>('')

  const activeSlides =
    settings.promotional_carousel?.enabled && settings.promotional_carousel.slides
      ? settings.promotional_carousel.slides.filter((x) => x.active)
      : []
  const configuredSlides = activeSlides.length > 0

  // Secondary promo cards (only if real secondary slides exist, or if special offers are configured)
  const secondarySlides = activeSlides.length > 1 ? activeSlides.slice(1, 3) : []

  // Categorías de la marca filtradas por búsqueda
  const filteredBrandCategories = useMemo(() => {
    const q = brandSearchQuery.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.subcategories?.some((s) => s.name.toLowerCase().includes(q))
    )
  }, [categories, brandSearchQuery])

  // Subcategorías de la categoría seleccionada de la marca
  const selectedCategoryForBrand = useMemo(() => {
    if (!selectedBrandCategoryId) return null
    return categories.find((c) => c.id === selectedBrandCategoryId) || null
  }, [categories, selectedBrandCategoryId])

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
        {/* ── 3. Quick Category Grid with Submenus (6-8 items for fast entry) ── */}
        {capabilities.hasCatalog && categories.length > 0 && (
          <section aria-labelledby="wholesale-categories">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 id="wholesale-categories" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Explorá por categoría
                </h2>
                <p className="text-xs text-muted-foreground">Acceso rápido a los departamentos y sus subrubros</p>
              </div>
              <Link
                href={prefix + '/productos'}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>Ver catálogo</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 items-start">
              {categories.slice(0, 8).map((category) => {
                const hasSubs = Boolean(category.subcategories && category.subcategories.length > 0)

                if (!hasSubs) {
                  return (
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
                  )
                }

                return (
                  <div
                    key={category.id}
                    className="flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs transition-all duration-200 hover:border-primary/50"
                  >
                    <div>
                      <Link
                        href={prefix + '/productos?category_id=' + encodeURIComponent(category.id)}
                        className="group flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors">
                          <Package className="h-4 w-4" aria-hidden />
                        </div>
                        <ArrowRight
                          className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </Link>

                      <Link
                        href={prefix + '/productos?category_id=' + encodeURIComponent(category.id)}
                        className="mt-2 block text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 break-words"
                      >
                        {category.name}
                      </Link>
                    </div>

                    {/* Submenu chips */}
                    <div className="mt-2 space-y-1 border-t border-border/40 pt-1.5">
                      <div className="flex flex-wrap gap-1">
                        {category.subcategories!.slice(0, 3).map((sub) => (
                          <Link
                            key={sub.id}
                            href={prefix + '/productos?category_id=' + encodeURIComponent(sub.id)}
                            className="inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {sub.name}
                          </Link>
                        ))}
                        {category.subcategories!.length > 3 && (
                          <Link
                            href={prefix + '/productos?category_id=' + encodeURIComponent(category.id)}
                            className="text-[10px] text-primary hover:underline font-semibold self-center pl-0.5"
                          >
                            +{category.subcategories!.length - 3}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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

        {/* ── 6. Brands Section with B2B Submenu (Estilo MobileSentrix) ── */}
        {brands.length > 0 && (
          <section aria-labelledby="wholesale-brands" className="space-y-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 id="wholesale-brands" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {settings.brands_section?.title || 'Marcas'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Seleccioná una marca para ver sus líneas, repuestos y opciones comerciales
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{brands.length} marcas</span>
                <Link
                  href={prefix + '/productos'}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Ver catálogo completo &rarr;
                </Link>
              </div>
            </div>

            {/* Selector de marcas horizontal tipo pestañas (MobileSentrix) */}
            <div
              className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-border/50"
              role="tablist"
              aria-label="Selector de marcas"
            >
              {brands.map((brand) => {
                const isSelected = brand.id === (selectedBrand?.id ?? '')
                return (
                  <button
                    key={brand.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setActiveBrandId(brand.id)
                      setSelectedBrandCategoryId('')
                    }}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-ring border',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border/60 bg-card text-foreground/75 hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    {brand.imageUrl && (
                      <AppImage
                        src={brand.imageUrl}
                        alt={brand.name}
                        width={20}
                        height={20}
                        className="h-4 w-4 object-contain"
                      />
                    )}
                    <span>{brand.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Panel de Submenú B2B Split Layout (Estilo MobileSentrix) */}
            {selectedBrand && (
              <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
                {/* Cabecera del panel con buscador interno por modelo/subrubro */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {selectedBrand.imageUrl ? (
                      <div className="flex h-11 w-20 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background p-1.5">
                        <AppImage
                          src={selectedBrand.imageUrl}
                          alt={selectedBrand.name}
                          width={75}
                          height={32}
                          className="max-h-8 max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted font-bold text-sm text-primary">
                        {selectedBrand.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-foreground">
                          {selectedBrand.name}
                        </h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Distribuidor oficial
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Catálogo mayorista y líneas disponibles con entrega inmediata.
                      </p>
                    </div>
                  </div>

                  {/* Buscador integrado estilo MobileSentrix */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <input
                        type="text"
                        value={brandSearchQuery}
                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                        placeholder={`Buscar en ${selectedBrand.name}…`}
                        className="w-full rounded-full border border-border/80 bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                      />
                      {brandSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBrandSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Limpiar filtro"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Split Panel: Columna Izquierda (Series / Departamentos) + Panel Derecho (Multiecolumna) */}
                <div className="flex flex-col md:flex-row min-h-[300px]">
                  {/* Sidebar izquierdo de series y departamentos */}
                  <div
                    className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border/70 p-3 bg-muted/10 space-y-1"
                    role="tablist"
                    aria-label={`Departamentos de ${selectedBrand.name}`}
                  >
                    <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Series y Rubros
                    </p>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedBrandCategoryId === ''}
                      onClick={() => setSelectedBrandCategoryId('')}
                      className={cn(
                        'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all font-semibold',
                        selectedBrandCategoryId === ''
                          ? 'bg-primary/10 text-primary shadow-2xs font-bold'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span>Todos los rubros</span>
                    </button>

                    {filteredBrandCategories.map((cat) => {
                      const isCatSelected = cat.id === selectedBrandCategoryId
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="tab"
                          aria-selected={isCatSelected}
                          onClick={() => setSelectedBrandCategoryId(cat.id)}
                          className={cn(
                            'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all font-semibold',
                            isCatSelected
                              ? 'bg-primary/10 text-primary shadow-2xs font-bold'
                              : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <span className="truncate">{cat.name}</span>
                          {cat.subcategories && cat.subcategories.length > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground/80 shrink-0">
                              {cat.subcategories.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Panel derecho: Grilla en 3-5 columnas con enlaces directos y modelos */}
                  <div className="flex-1 p-5 overflow-y-auto bg-background space-y-5">
                    {/* Barra de cabecera con acciones */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {selectedCategoryForBrand
                            ? `${selectedBrand.name} › ${selectedCategoryForBrand.name}`
                            : `Submenú por departamento (${selectedBrand.name})`}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Líneas y productos con disponibilidad para pedidos mayoristas.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={prefix + '/productos?marca=' + encodeURIComponent(selectedBrand.name)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
                        >
                          <span>Ver catálogo de {selectedBrand.name}</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>

                        {settings.company_info?.phone && (
                          <a
                            href={`https://wa.me/${settings.company_info.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quisiera consultar por productos y lista de precios de la marca ${selectedBrand.name}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <span>Consultar por WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Grilla multiecolumna estilo MobileSentrix (3 a 5 columnas) */}
                    {selectedCategoryForBrand?.subcategories && selectedCategoryForBrand.subcategories.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Subrubros y modelos ({selectedCategoryForBrand.name})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
                          {selectedCategoryForBrand.subcategories.map((sub, idx) => (
                            <Link
                              key={sub.id}
                              href={`${prefix}/productos?marca=${encodeURIComponent(selectedBrand.name)}&category_id=${encodeURIComponent(sub.id)}`}
                              className="group/item flex items-center justify-between gap-1 rounded py-1 px-1.5 text-xs text-foreground/85 transition-colors hover:bg-muted/60 hover:text-primary"
                            >
                              <span className="truncate group-hover/item:underline underline-offset-2">
                                {sub.name}
                              </span>
                              {idx % 4 === 0 && (
                                <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                  new
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Rubros destacados de {selectedBrand.name}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
                          <Link
                            href={prefix + '/productos?marca=' + encodeURIComponent(selectedBrand.name)}
                            className="rounded py-1 px-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            Todos los productos
                          </Link>
                          {filteredBrandCategories.slice(0, 10).map((cat) => (
                            <Link
                              key={cat.id}
                              href={`${prefix}/productos?marca=${encodeURIComponent(selectedBrand.name)}&category_id=${encodeURIComponent(cat.id)}`}
                              aria-label={`${cat.name} en ${selectedBrand.name}`}
                              className="rounded py-1 px-1.5 text-xs text-foreground/80 hover:bg-muted/60 hover:text-primary transition-colors truncate"
                            >
                              {cat.name}
                            </Link>
                          ))}
                          {settings.offers_section?.enabled && (
                            <Link
                              href={prefix + '/productos?marca=' + encodeURIComponent(selectedBrand.name) + '&solo_ofertas=true'}
                              className="rounded py-1 px-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                            >
                              Ofertas de {selectedBrand.name}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Grilla rápida complementaria de logos de marcas */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 pt-1">
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
        {/* ── 8. Portal de Clientes Mayoristas & Retail ── */}
        <section aria-labelledby="wholesale-account-cta" className="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/5 via-card to-background p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                Acceso para clientes mayoristas y retail
              </span>
              <h2 id="wholesale-account-cta" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                ¿Comprás por mayor o revendés en tu negocio?
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Creá tu cuenta de cliente para acceder a listas de precios actualizadas, cotizaciones rápidas y seguimiento de tus pedidos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href={slug ? prefix + '/cliente/registro' : '/registro'}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                <span>Crear cuenta de cliente</span>
              </Link>
              <Link
                href={slug ? prefix + '/cliente/login' : '/login'}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogIn className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>Ya tengo cuenta</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ── 9. Real Trust Bar / Benefits (Only if merchant explicitly configured them) ── */}
      {benefits?.enabled && benefits.items.some((item) => item.active !== false && item.title.trim()) && (
        <StoreTrustBar settings={benefits} />
      )}
    </div>
  )
}

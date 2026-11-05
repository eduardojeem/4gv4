'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { MapPin, Clock, Phone, Tag, ChevronRight, Package } from 'lucide-react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { AppImage } from '@/components/ui/app-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePathname } from 'next/navigation'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from '@/components/public/inicio/newest-products'
import { productDiscountPct } from '@/lib/public/market'
import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import { formatPrice, cn } from '@/lib/utils'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { PublicProduct } from '@/types/public'

export function CatalogBasicHome({
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
  const prefix = slug ? `/${slug}` : ''
  const company = settings?.company_info
  const hero = settings?.hero_content

  const { categories } = usePublicCategories()
  const { data: products, error, isLoading } = useSWR(
    capabilities.hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [activeProduct, setActiveProduct] = useState<PublicProduct | null>(null)
  const [activeModalImageIdx, setActiveModalImageIdx] = useState(0)

  // Filtrado de productos por categoría
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return []
    if (!selectedCategoryId) return products
    return products.filter((p) => p.category?.id === selectedCategoryId)
  }, [products, selectedCategoryId])

  // Datos de contacto de la tienda
  const storeWhatsapp = hasStoreWhatsapp(company)
  const rawWhatsapp = company?.whatsapp?.replace(/\D/g, '') || ''
  const rawPhone = company?.phone?.replace(/[^+0-9]/g, '') || ''

  const phrase =
    company?.slogan ||
    hero?.subtitle ||
    hero?.title ||
    'Mirá todos nuestros productos y consultá disponibilidad.'

  const hasHours = Boolean(
    company?.hours?.weekdays || company?.hours?.saturday || company?.hours?.sunday
  )

  // Mensaje para consultar disponibilidad por WhatsApp sin botones de compra
  const getProductWhatsappUrl = (product: PublicProduct) => {
    if (!storeWhatsapp || !rawWhatsapp) return null
    const text = `Hola, te consulto por la disponibilidad de: ${product.name} (${formatPrice(product.has_offer && product.offer_price ? product.offer_price : product.sale_price)})`
    return `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(text)}`
  }

  // Galería para el modal de detalle
  const modalImages = useMemo(() => {
    if (!activeProduct) return []
    const list = [activeProduct.image]
    if (Array.isArray(activeProduct.images)) {
      list.push(...activeProduct.images)
    }
    return list.filter((img): img is string => Boolean(img && img.trim()))
  }, [activeProduct])

  return (
    <div data-catalog-basic-home className="min-w-0 bg-background text-foreground">
      {/* ── 1. Portada corta y directa ── */}
      <section
        aria-labelledby="catalog-hero-title"
        className="border-b border-border/80 bg-muted/20 px-4 py-6 sm:py-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="space-y-2">
            <h1
              id="catalog-hero-title"
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              {company?.name || 'Catálogo Digital'}
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {phrase}
            </p>

            {/* Dirección y horario si existen */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-muted-foreground">
              {company?.address && (
                <div className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>{company.address}</span>
                </div>
              )}
              {hasHours && (
                <div className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>
                    {company?.hours?.weekdays && `Lun-Vie: ${company.hours.weekdays}`}
                    {company?.hours?.saturday && ` · Sáb: ${company.hours.saturday}`}
                  </span>
                </div>
              )}
              {rawPhone && (
                <div className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  <a
                    href={`tel:${rawPhone}`}
                    className="hover:text-foreground hover:underline transition-colors"
                  >
                    {company?.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Barra de categorías horizontal (chips) ── */}
      {categories.length > 0 && (
        <nav
          aria-label="Filtro de categorías"
          className="sticky top-[57px] z-20 border-b border-border/80 bg-background/95 backdrop-blur-xs px-4 py-2.5 shadow-2xs"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              aria-pressed={selectedCategoryId === null}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                selectedCategoryId === null
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              Todos los productos
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* ── 3. Grilla de productos ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {selectedCategoryId
              ? categories.find((c) => c.id === selectedCategoryId)?.name || 'Productos seleccionados'
              : 'Productos en exhibición'}
          </h2>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        {error ? (
          <div role="status" className="rounded-lg border border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
            <p>No pudimos cargar los productos del catálogo.</p>
            <Link
              href={`${prefix}/productos`}
              className="mt-2 inline-block font-semibold text-primary underline underline-offset-2"
            >
              Ver catálogo completo
            </Link>
          </div>
        ) : isLoading ? (
          <div role="status" className="py-12 text-center text-sm text-muted-foreground">
            <p>Cargando productos…</p>
          </div>
        ) : !filteredProducts.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
            <p className="font-medium text-foreground">Todavía no hay productos publicados.</p>
            <p className="mt-1 text-xs">
              {selectedCategoryId
                ? 'No encontramos productos en esta categoría. Mirá otras categorías o seleccioná "Todos".'
                : 'Los artículos aparecerán aquí cuando el comercio los cargue en su inventario.'}
            </p>
          </div>
        ) : (
          <div
            data-testid="catalog-grid"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 items-stretch"
          >
            {filteredProducts.map((product) => {
              const discount = productDiscountPct(product)
              const hasOffer = discount > 0 && product.offer_price != null && product.offer_price < product.sale_price
              const finalPrice = hasOffer ? product.offer_price! : product.sale_price

              const inStock =
                product.in_stock !== false &&
                (product.stock_quantity == null || product.stock_quantity > 0)

              return (
                <article
                  key={product.id}
                  data-testid="catalog-product-card"
                  onClick={() => {
                    setActiveProduct(product)
                    setActiveModalImageIdx(0)
                  }}
                  className={cn(
                    'group flex flex-col justify-between overflow-hidden rounded-lg border border-border/70 bg-card p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer',
                    'hover:border-primary/50 hover:shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1'
                  )}
                >
                  <div className="space-y-2">
                    {/* Foto del producto con lazy loading */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted/30">
                      {product.image ? (
                        <AppImage
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          loading="lazy"
                          className="object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground/30">
                          <Package className="h-10 w-10" aria-hidden="true" />
                        </div>
                      )}

                      {/* Badge de oferta */}
                      {hasOffer && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                          -{discount}%
                        </span>
                      )}
                    </div>

                    {/* Nombre */}
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </div>

                  {/* Precios e indicador de stock */}
                  <div className="mt-3 space-y-1.5 pt-1 border-t border-border/50">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-sm sm:text-base font-bold tabular-nums text-foreground">
                        {formatPrice(finalPrice)}
                      </span>
                      {hasOffer && (
                        <del className="text-xs font-normal tabular-nums text-muted-foreground">
                          {formatPrice(product.sale_price)}
                        </del>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      {inStock ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          Disponible
                        </span>
                      ) : (
                        <span className="font-medium text-rose-600 dark:text-rose-400">
                          Sin stock
                        </span>
                      )}

                      <span className="text-primary font-semibold group-hover:underline">
                        Ver detalle
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* ── 4. Sucursales (si hay más de una) ── */}
        {branches && branches.length > 1 && (
          <section aria-labelledby="catalog-branches" className="mt-12 border-t border-border/80 pt-8">
            <h2 id="catalog-branches" className="text-base sm:text-lg font-bold tracking-tight text-foreground mb-4">
              Nuestras Sucursales
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-1 text-xs">
                  <h3 className="font-semibold text-sm text-foreground">{branch.name}</h3>
                  {branch.address && <p className="text-muted-foreground">{branch.address}</p>}
                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone.replace(/[^+0-9]/g, '')}`}
                      className="mt-2 inline-block font-semibold text-primary hover:underline"
                    >
                      {branch.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── 5. Modal de detalle de producto (sin botones de compra ni carrito) ── */}
      <Dialog
        open={Boolean(activeProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveProduct(null)
            setActiveModalImageIdx(0)
          }
        }}
      >
        <DialogContent
          className="flex max-h-[92dvh] w-[calc(100%-1rem)] sm:max-w-lg flex-col gap-0 overflow-hidden rounded-xl border-border/80 p-0 shadow-2xl"
          showCloseButton
        >
          {activeProduct && (
            <>
              <DialogHeader className="p-4 pb-2 border-b border-border/60">
                <DialogTitle className="text-base font-bold text-foreground line-clamp-2">
                  {activeProduct.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Información, precio y disponibilidad en el catálogo.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                {/* Imagen principal */}
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  {modalImages.length > 0 && modalImages[activeModalImageIdx] ? (
                    <AppImage
                      src={modalImages[activeModalImageIdx]!}
                      alt={activeProduct.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 480px"
                      loading="lazy"
                      className="object-contain p-4"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/30">
                      <Package className="h-16 w-16" aria-hidden="true" />
                    </div>
                  )}

                  {productDiscountPct(activeProduct) > 0 && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      -{productDiscountPct(activeProduct)}% OFERTA
                    </span>
                  )}
                </div>

                {/* Miniaturas de imágenes si hay más de una */}
                {modalImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {modalImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveModalImageIdx(idx)}
                        className={cn(
                          'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/20 transition-all',
                          activeModalImageIdx === idx ? 'border-primary ring-2 ring-primary/20' : 'border-border/60 hover:border-primary/40'
                        )}
                        aria-label={`Ver foto ${idx + 1} de ${activeProduct.name}`}
                      >
                        <AppImage src={img} alt="" fill sizes="56px" className="object-contain p-1" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Precio e indicador de stock */}
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {formatPrice(
                        activeProduct.has_offer && activeProduct.offer_price
                          ? activeProduct.offer_price
                          : activeProduct.sale_price
                      )}
                    </span>
                    {activeProduct.has_offer && activeProduct.offer_price && (
                      <del className="text-sm font-normal tabular-nums text-muted-foreground">
                        {formatPrice(activeProduct.sale_price)}
                      </del>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Estado de stock:</span>
                    {activeProduct.in_stock !== false && (activeProduct.stock_quantity == null || activeProduct.stock_quantity > 0) ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Disponible
                      </span>
                    ) : (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        Sin stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Descripción del producto */}
                {activeProduct.description && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Descripción
                    </h4>
                    <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {activeProduct.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Pie de acciones: sin botón de compra, solo consulta de disponibilidad si hay WhatsApp */}
              <div className="border-t border-border/70 bg-background p-3.5 space-y-2">
                {getProductWhatsappUrl(activeProduct) && (
                  <a
                    href={getProductWhatsappUrl(activeProduct)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-background text-xs sm:text-sm font-semibold text-foreground',
                      'transition-colors hover:bg-muted hover:border-emerald-600/40 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
                    )}
                  >
                    <WhatsAppIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Consultar disponibilidad</span>
                  </a>
                )}

                <Link
                  href={`${prefix}/productos/${activeProduct.id}`}
                  onClick={() => setActiveProduct(null)}
                  className="flex h-9 w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Ver ficha completa</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

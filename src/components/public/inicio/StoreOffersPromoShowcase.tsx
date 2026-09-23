'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  Eye,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { formatPrice, cn } from '@/lib/utils'
import { getWhatsAppLink, buildProductWhatsAppMessage } from '@/lib/whatsapp'
import { siteUrl } from '@/lib/site-url'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { describeDeviceCompatibility } from '@/lib/products/device-compatibility'
import { PriceAccessDialog } from '@/components/public/PriceAccessDialog'
import { FavoriteButton } from '@/components/public/Favorites'
import { MarketplaceProductModal } from '@/components/public/MarketplaceProductModal'
import { withOrgQuery } from '@/lib/saas/tenant'
import { fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS } from './newest-products'
import type { PublicProduct } from '@/types/public'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

interface StoreOffersPromoShowcaseProps {
  companyInfo: {
    name?: string | null
    logo_url?: string | null
    logoUrl?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    brandColor?: string
    description?: string | null
    slogan?: string | null
  }
  tenantPrefix: string
  tenantSlug: string
  phoneClean?: string
  className?: string
  id?: string
}

export function StoreOffersPromoShowcase({
  companyInfo,
  tenantPrefix,
  tenantSlug,
  phoneClean,
  className,
  id = 'ofertas',
}: StoreOffersPromoShowcaseProps) {
  const storeName = companyInfo.name?.trim() || '4G Celulares'
  const logoUrl = companyInfo.logo_url || companyInfo.logoUrl || null

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null)

  // Consulta de productos que tengan oferta activa
  const offersQueryUrl = withOrgQuery(
    '/api/public/products?per_page=50&sort=newest&has_offer=true',
    tenantSlug
  )

  const { data: rawProducts, isLoading } = useSWR(
    offersQueryUrl,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  // Filtrar exclusivamente productos con ofertas válidas (precio de oferta menor que precio regular)
  const validOffers = useMemo(() => {
    if (!Array.isArray(rawProducts)) return []
    return rawProducts.filter(
      (p) => Boolean(p.has_offer) && typeof p.offer_price === 'number' && p.offer_price > 0 && p.offer_price < p.sale_price
    )
  }, [rawProducts])

  // Descuento máximo activo entre todas las ofertas
  const maxDiscountPct = useMemo(() => {
    if (validOffers.length === 0) return 0
    return Math.max(
      ...validOffers.map((p) => {
        if (!p.offer_price || p.sale_price <= 0) return 0
        return Math.round(((p.sale_price - p.offer_price) / p.sale_price) * 100)
      })
    )
  }, [validOffers])

  // Categorías representadas en las ofertas
  const categoriesInOffers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of validOffers) {
      if (p.category?.id && p.category?.name) {
        const existing = map.get(p.category.id)
        if (existing) {
          existing.count++
        } else {
          map.set(p.category.id, { id: p.category.id, name: p.category.name, count: 1 })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [validOffers])

  // Productos mostrados según filtro de categoría (hasta 8 para no saturar)
  const displayedOffers = useMemo(() => {
    let list = validOffers
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category?.id === selectedCategory)
    }
    return list.slice(0, 8)
  }, [validOffers, selectedCategory])

  // WhatsApp de la tienda para consulta general de ofertas
  const generalWhatsappHref = phoneClean && phoneClean.length >= 6
    ? getWhatsAppLink({
        phone: phoneClean,
        message: `¡Hola ${storeName}! 👋 Vi las ofertas especiales en su tienda online y quería consultar sobre las promociones activas.`,
      })
    : null

  // Si no está cargando y no hay ninguna oferta disponible, no mostramos un bloque vacío
  if (!isLoading && validOffers.length === 0) {
    return null
  }

  return (
    <section id={id} className={cn('relative py-12 sm:py-16 border-b border-border/70 overflow-hidden bg-muted/10', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* ── Encabezado de la Sección ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Promociones & Precios Especiales</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Ofertas Imperdibles de la Semana
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              Descuentos exclusivos por tiempo limitado en repuestos, accesorios y productos seleccionados con garantía oficial de {storeName}.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-border/80 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5"
            >
              <Link href={`${tenantPrefix}/productos?has_offer=true`}>
                <span>Ver todas las ofertas</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1 text-primary" />
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Selector / Chips de Categorías con Ofertas ── */}
        {categoriesInOffers.length > 1 && (
          <div className="mb-7 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0',
                selectedCategory === 'all'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200 shadow-xs ring-2 ring-rose-500/20'
                  : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span>Todas las ofertas</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  selectedCategory === 'all'
                    ? 'bg-rose-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {validOffers.length}
              </span>
            </button>

            {categoriesInOffers.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0',
                    isSelected
                      ? 'border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200 shadow-xs ring-2 ring-rose-500/20'
                      : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <span>{cat.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Fila Principal: Banner Vertical Estilo Showcase + Productos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* ══ TARJETA VERTICAL PUBLICITARIA (Inspirada en MarketplaceBusinessPromoShowcase) ══ */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col">
            <div className="relative h-full flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-b from-[#2a0818] via-[#3a0d22] to-[#1a040e] p-6 sm:p-7 text-white shadow-2xl shadow-rose-950/20">
              
              {/* Luces y resplandor decorativo de fondo */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-500/25 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,63,94,0.18),transparent_70%)]" />

              <div className="relative z-10 space-y-5">
                {/* Header del Negocio: Logo + Insignia Oficial */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg shadow-black/20 border border-white/20">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={storeName}
                          width={48}
                          height={48}
                          className="h-full w-full object-contain"
                          unoptimized={shouldBypassImageOptimization(logoUrl)}
                        />
                      ) : (
                        <Store className="h-7 w-7 text-rose-800" />
                      )}
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/20 border border-rose-300/30 px-2 py-0.5 text-[10px] font-extrabold text-rose-300 uppercase tracking-wide">
                        <BadgeCheck className="h-3 w-3 text-rose-300" />
                        Tienda Oficial
                      </span>
                      <p className="text-xs text-rose-100/80 mt-0.5 font-medium">
                        {companyInfo.city || 'Garantía oficial'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Titular Promocional (Centro de Atención) */}
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-rose-300/90">
                    OFERTAS EXCLUSIVAS
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none">
                    {storeName}
                  </h3>
                </div>

                {/* Bloque Gigante de Beneficio */}
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-4 backdrop-blur-md shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">
                    DESCUENTOS POR TIEMPO LIMITADO
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                      {maxDiscountPct > 0 ? `-${maxDiscountPct}%` : 'OFERTAS'}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold uppercase leading-tight text-rose-200">
                      {maxDiscountPct > 0 ? 'Descuento Máximo' : 'Rebajas Activas'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-rose-100/85 leading-snug">
                    {validOffers.length} {validOffers.length === 1 ? 'producto rebajado' : 'productos rebajados'} con precio especial y disponibilidad inmediata.
                  </p>
                </div>

                {/* Lista de Ventajas del Negocio */}
                <div className="space-y-2 pt-1 text-xs text-rose-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-400/20 text-rose-300">
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-white/95">Garantía oficial de {storeName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-400/20 text-rose-300">
                      <Tag className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-white/95">Precios directos sin intermediarios</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-400/20 text-rose-300">
                      <Clock className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-white/95">Stock listo para retiro o entrega express</span>
                  </div>
                </div>
              </div>

              {/* Acciones y Enlaces */}
              <div className="relative z-10 pt-6 space-y-3">
                <Button
                  asChild
                  className="w-full h-12 rounded-xl bg-white hover:bg-rose-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-black/20 active:scale-[0.98] transition-all border border-white/40"
                >
                  <Link href={`${tenantPrefix}/ofertas`} className="flex items-center justify-center gap-2">
                    <Tag className="h-4 w-4 text-rose-700" />
                    <span>Ver Todas las Ofertas</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                {generalWhatsappHref && (
                  <a
                    href={generalWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    suppressHydrationWarning
                    className="flex items-center justify-center gap-2 text-xs font-bold text-rose-300 hover:text-white transition-colors py-1"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-400" />
                    <span>Consultar ofertas por WhatsApp</span>
                  </a>
                )}

                <p className="text-[10px] text-rose-300/50 text-center tracking-wide">
                  Promociones válidas hasta agotar stock
                </p>
              </div>

            </div>
          </div>

          {/* ══ GRILLA DE PRODUCTOS EN OFERTA (Lado derecho) ══ */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between">
            {displayedOffers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
                {displayedOffers.map((product) => {
                  const precioOculto = hidesPublicPrice(product)
                  const deviceCompatibility = describeDeviceCompatibility(product.device_brand, product.device_models)
                  const imageSrc = resolveProductImageUrl(product.image)
                  const hasDiscount = Boolean(product.has_offer && product.offer_price && product.offer_price < product.sale_price)
                  const discountPct = hasDiscount && product.offer_price
                    ? Math.round(((product.sale_price - product.offer_price) / product.sale_price) * 100)
                    : 0
                  const displayPrice = hasDiscount && product.offer_price ? product.offer_price : product.sale_price
                  const savings = hasDiscount && product.offer_price ? product.sale_price - product.offer_price : 0

                  const productHref = `${tenantPrefix}/productos/${product.id}`
                  const canonicalProductUrl = siteUrl(productHref)

                  const whatsappDigits = (phoneClean || '').replace(/\D/g, '')
                  const itemWhatsappHref = whatsappDigits.length >= 6
                    ? getWhatsAppLink({
                        phone: whatsappDigits,
                        message: buildProductWhatsAppMessage({
                          storeName,
                          productName: product.name,
                          price: precioOculto ? 0 : displayPrice,
                          originalPrice: !precioOculto && hasDiscount ? product.sale_price : null,
                          sku: product.sku,
                          productUrl: canonicalProductUrl,
                          imageUrl: imageSrc,
                          intent: precioOculto ? 'price' : 'order',
                        }),
                      })
                    : null

                  // Objeto mapeado para el modal
                  const asModalProduct: MarketplaceProduct = {
                    ...product,
                    organization_id: tenantSlug,
                    organization_name: storeName,
                    organization_slug: tenantSlug,
                    organization_logo_url: logoUrl,
                    organization_city: companyInfo.city ?? null,
                    organization_address: companyInfo.address ?? null,
                    organization_contact: phoneClean ? { phone: phoneClean, whatsapp: phoneClean } : null,
                  }

                  return (
                    <div
                      key={product.id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-2xs transition-all duration-300 hover:-translate-y-1.5 hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/5"
                    >
                      {/* Badge de Oferta / Descuento */}
                      {!precioOculto && hasDiscount && discountPct > 0 && (
                        <div className="absolute left-3 top-3 z-20">
                          <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                            -{discountPct}% OFF
                          </span>
                        </div>
                      )}

                      {/* Botón Favorito */}
                      <div className="absolute right-3 top-3 z-20">
                        <FavoriteButton
                          item={{
                            productId: product.id,
                            slug: tenantSlug,
                            name: product.name,
                            store: storeName,
                            image: product.image,
                            price: displayPrice,
                          }}
                        />
                      </div>

                      {/* Imagen del Producto */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProduct(asModalProduct)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedProduct(asModalProduct)
                        }}
                        className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-muted/20"
                      >
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={product.name}
                            fill
                            className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            unoptimized={shouldBypassImageOptimization(imageSrc)}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Datos del Producto */}
                      <div className="mt-3 flex flex-1 flex-col justify-between space-y-2.5">
                        <div>
                          {deviceCompatibility ? (
                            <p className="mb-0.5 truncate text-[11px] font-semibold text-primary" title={deviceCompatibility}>
                              Para {deviceCompatibility}
                            </p>
                          ) : (
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              {product.brand || storeName}
                            </p>
                          )}
                          <h4
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedProduct(asModalProduct)}
                            className="line-clamp-2 text-xs sm:text-sm font-semibold text-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-colors mt-1 cursor-pointer"
                          >
                            {product.name}
                          </h4>
                        </div>

                        {/* Precios y Pastilla de Ahorro */}
                        <div className="space-y-2 border-t border-border/60 pt-2">
                          {precioOculto ? (
                            <div
                              className="min-w-0"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <p className="text-sm font-bold leading-tight text-foreground">
                                Precio a consultar
                              </p>
                              <div className="relative z-20 mt-0.5">
                                <PriceAccessDialog
                                  productName={product.name}
                                  whatsappHref={itemWhatsappHref}
                                  organizationSlug={tenantSlug}
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-baseline gap-2">
                                <p className="text-base sm:text-lg font-black text-foreground tabular-nums">
                                  {formatPrice(displayPrice)}
                                </p>
                                {hasDiscount && (
                                  <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                                    {formatPrice(product.sale_price)}
                                  </p>
                                )}
                              </div>

                              {hasDiscount && savings > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Ahorrás {formatPrice(savings)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Botones de Acción */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {precioOculto && itemWhatsappHref ? (
                              <a
                                href={itemWhatsappHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                suppressHydrationWarning
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#25D366]/10 px-2 text-[11px] font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366] hover:text-white dark:text-[#4ADE80]"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Preguntar</span>
                              </a>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedProduct(asModalProduct)}
                                className="h-8 text-xs font-bold gap-1 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Detalle</span>
                              </Button>
                            )}

                            <Button
                              asChild
                              size="sm"
                              className="h-8 text-xs font-bold gap-1 bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                            >
                              <Link href={productHref}>
                                <span>Comprar</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
                <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <h4 className="text-sm font-bold text-foreground">
                  No hay productos en esta categoría
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Elegí otra categoría o consultá todo el catálogo para ver más opciones disponibles.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  Ver todas las ofertas
                </Button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal de Detalle Rápido del Producto */}
      <MarketplaceProductModal
        product={selectedProduct}
        open={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  )
}

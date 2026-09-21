'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice, cn } from '@/lib/utils'
import { getOfferPricing } from '@/lib/public/marketplace-offers'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { FavoriteButton } from './Favorites'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import type { MarketplaceOrganization, MarketplaceProduct } from '@/lib/public/marketplace'
import type { PublicProduct } from '@/types/public'

interface Props {
  organizations: MarketplaceOrganization[]
  className?: string
}

export function MarketplaceBusinessPromoShowcase({ organizations, className }: Props) {
  // Solo consideramos organizaciones que tengan al menos 1 producto cargado
  const activeOrgs = useMemo(() => {
    return organizations.filter(
      (org) => (org.featured_products && org.featured_products.length > 0) || org.products_count > 0
    )
  }, [organizations])

  const [selectedOrgIndex, setSelectedOrgIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null)

  if (activeOrgs.length === 0) return null

  const currentOrg = activeOrgs[selectedOrgIndex] ?? activeOrgs[0]

  const handlePrev = () => {
    setSelectedOrgIndex((prev) => (prev === 0 ? activeOrgs.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setSelectedOrgIndex((prev) => (prev === activeOrgs.length - 1 ? 0 : prev + 1))
  }

  const whatsappHref = (currentOrg.whatsapp ?? '').replace(/\D/g, '').length >= 6
    ? getWhatsAppLink({
        phone: currentOrg.whatsapp!,
        message: `¡Hola ${currentOrg.name}! Vi su tienda en el Marketplace y quería hacer una consulta.`,
      })
    : null

  const displayProducts = (currentOrg.featured_products || []).slice(0, 4)

  return (
    <section className={cn('relative py-12 sm:py-16 border-b border-border/70 overflow-hidden', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* ── Encabezado de Sección ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-3">
              <Store className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Comercios & Talleres Registrados</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Comprá directo en Tiendas Oficiales
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              Negocios verificados en la plataforma. Productos con stock real, garantía y atención personalizada sin intermediarios.
            </p>
          </div>

          {/* Selector / Flechas de navegación entre negocios */}
          {activeOrgs.length > 1 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-medium text-muted-foreground mr-1 hidden sm:inline">
                {selectedOrgIndex + 1} de {activeOrgs.length} comercios
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePrev}
                className="h-9 w-9 rounded-xl border-border/80"
                aria-label="Comercio anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="h-9 w-9 rounded-xl border-border/80"
                aria-label="Siguiente comercio"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Pestañas / Chips de Comercios ── */}
        {activeOrgs.length > 1 && (
          <div className="mb-7 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {activeOrgs.map((org, index) => {
              const isSelected = index === selectedOrgIndex
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelectedOrgIndex(index)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 shadow-xs ring-2 ring-emerald-500/20'
                      : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 border border-slate-200 dark:border-slate-800">
                    {org.logo_url ? (
                      <Image
                        src={org.logo_url}
                        alt={org.name}
                        width={24}
                        height={24}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <span>{org.name}</span>
                  {org.products_count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      {org.products_count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Fila Principal: Banner Vertical Estilo ueno bank + Productos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* ══ TARJETA VERTICAL PUBLICITARIA DEL NEGOCIO (Similar a la referencia) ══ */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col">
            <div className="relative h-full flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#063520] via-[#09482b] to-[#041e12] p-6 sm:p-7 text-white shadow-2xl shadow-emerald-950/20">
              
              {/* Luces y resplandor decorativo de fondo */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_70%)]" />

              <div className="relative z-10 space-y-5">
                {/* Header del Negocio: Logo blanco + Insignia Oficial */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg shadow-black/20 border border-white/20">
                      {currentOrg.logo_url ? (
                        <Image
                          src={currentOrg.logo_url}
                          alt={currentOrg.name}
                          width={48}
                          height={48}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Store className="h-7 w-7 text-emerald-800" />
                      )}
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 uppercase tracking-wide">
                        <BadgeCheck className="h-3 w-3 text-emerald-300" />
                        Comercio Oficial
                      </span>
                      <p className="text-xs text-emerald-100/80 mt-0.5 font-medium">
                        {currentOrg.city || 'Tienda verificada'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Titular Promocional (Centro de Atención) */}
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300/90">
                    COMPRÁ DIRECTO DE
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none">
                    {currentOrg.name}
                  </h3>
                </div>

                {/* Bloque Gigante de Beneficio (Inspirado en el bloque '18 CUOTAS' de la imagen) */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4 backdrop-blur-md shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    VENTA DIRECTA Y GARANTIZADA
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                      {currentOrg.products_count > 0 ? currentOrg.products_count : '100%'}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold uppercase leading-tight text-emerald-200">
                      {currentOrg.products_count > 0 ? 'Productos en Stock' : 'Garantía Directa'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-emerald-100/85 leading-snug">
                    {currentOrg.slogan || currentOrg.description || 'Precios oficiales, productos originales y atención directa con el comercio.'}
                  </p>
                </div>

                {/* Lista de Ventajas del Negocio */}
                <div className="space-y-2 pt-1 text-xs text-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-white/95">Garantía oficial de {currentOrg.name}</span>
                  </div>
                  {currentOrg.city && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                        <MapPin className="h-3 w-3" />
                      </div>
                      <span className="font-semibold text-white/95">Atención en {currentOrg.city}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones y Enlaces */}
              <div className="relative z-10 pt-6 space-y-3">
                <Button
                  asChild
                  className="w-full h-12 rounded-xl bg-white hover:bg-emerald-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-black/20 active:scale-[0.98] transition-all border border-white/40"
                >
                  <Link href={`/${currentOrg.slug}/inicio`} className="flex items-center justify-center gap-2">
                    <Store className="h-4 w-4 text-emerald-800" />
                    <span>Visitar Tienda Oficial</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-300 hover:text-white transition-colors py-1"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-400" />
                    <span>Consultar por WhatsApp</span>
                  </a>
                )}

                <p className="text-[10px] text-emerald-300/50 text-center tracking-wide">
                  Comercio registrado en la plataforma
                </p>
              </div>

            </div>
          </div>

          {/* ══ GRILLA DE PRODUCTOS DEL COMERCIO (Lado derecho de la referencia) ══ */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between">
            {displayProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
                {displayProducts.map((product) => {
                  const pricing = getOfferPricing(product)
                  const imageSrc = resolveProductImageUrl(product.image)

                  const asMarketplace: MarketplaceProduct = {
                    ...product,
                    organization_id: currentOrg.id,
                    organization_name: currentOrg.name,
                    organization_slug: currentOrg.slug,
                    organization_logo_url: currentOrg.logo_url ?? null,
                    organization_city: currentOrg.city ?? null,
                    organization_address: currentOrg.address ?? null,
                    organization_maps_url: currentOrg.maps_url ?? null,
                    organization_contact: currentOrg.phone || currentOrg.whatsapp
                      ? {
                          phone: currentOrg.phone ?? null,
                          whatsapp: currentOrg.whatsapp ?? null,
                          instagram: currentOrg.instagram ?? null,
                          facebook: currentOrg.facebook ?? null,
                          tiktok: currentOrg.tiktok ?? null,
                        }
                      : null,
                  }

                  return (
                    <div
                      key={product.id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-2xs transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5"
                    >
                      {/* Badge de Oferta / Descuento */}
                      {pricing.hasOffer && (
                        <div className="absolute left-3 top-3 z-20">
                          <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                            {pricing.percent}% OFF
                          </span>
                        </div>
                      )}

                      {/* Botón Favorito */}
                      <div className="absolute right-3 top-3 z-20">
                        <FavoriteButton
                          item={{
                            productId: product.id,
                            slug: currentOrg.slug,
                            name: product.name,
                            store: currentOrg.name,
                            image: product.image,
                            price: pricing.price,
                          }}
                        />
                      </div>

                      {/* Imagen con zoom sutil */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProduct(asMarketplace)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedProduct(asMarketplace)
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
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {currentOrg.name}
                          </p>
                          <h4
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedProduct(asMarketplace)}
                            className="line-clamp-2 text-xs sm:text-sm font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mt-1 cursor-pointer"
                          >
                            {product.name}
                          </h4>
                        </div>

                        {/* Precios y Pastilla de Venta Directa (Estilo referencia) */}
                        <div className="space-y-2 border-t border-border/60 pt-2">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-base sm:text-lg font-black text-foreground tabular-nums">
                                {formatPrice(pricing.price)}
                              </p>
                              {pricing.hasOffer && (
                                <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                                  {formatPrice(pricing.regularPrice)}
                                </p>
                              )}
                            </div>

                            {/* Insignia de cuotas o beneficio directo (Similar a la pastilla de la foto) */}
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Venta directa · Garantía oficial</span>
                            </div>
                          </div>

                          {/* Botones de Acción */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedProduct(asMarketplace)}
                              className="h-8 text-xs font-bold gap-1 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Detalle</span>
                            </Button>

                            <Button
                              asChild
                              size="sm"
                              className="h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              <Link href={`/${currentOrg.slug}/productos/${product.id}`}>
                                <span>Tienda</span>
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
                  Catálogo en preparación
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  {currentOrg.name} está actualizando su inventario en la plataforma.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
                  <Link href={`/${currentOrg.slug}/inicio`}>
                    <span>Visitar tienda oficial</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Enlace para ver todo el catálogo del comercio */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground border border-border/60">
              <span className="font-medium">
                Mostrando destacados de <strong>{currentOrg.name}</strong>.
              </span>
              <Link
                href={`/${currentOrg.slug}/productos`}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                Ver los {currentOrg.products_count} productos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>

      </div>

      {/* Modal de Detalle de Producto de Marketplace */}
      <MarketplaceProductModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  )
}

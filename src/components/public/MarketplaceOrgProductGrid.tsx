'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Eye,
  Package,
  Store,
  MapPin,
  MessageCircle,
  Play,
  Pause,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import { FavoriteButton } from './Favorites'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { getSocialLinks } from '@/lib/public/social-links'
import { SOCIAL_ICONS } from '@/components/public/SocialIcons'
import { cn } from '@/lib/utils'
import { getWhatsAppLink } from '@/lib/whatsapp'

type Org = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  city?: string | null
  address?: string | null
  maps_url?: string | null
  phone?: string | null
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  whatsapp?: string | null
  products_count: number
  featured_products: PublicProduct[]
  review_rating_avg?: number | null
  review_count?: number | null
}

type Props = {
  organizations: Org[]
}

function OrgProductCard({
  product,
  org,
  onSelectProduct,
  tabIndex,
}: {
  product: PublicProduct
  org: Org
  onSelectProduct: (product: MarketplaceProduct) => void
  tabIndex?: number
}) {
  const imageSrc = resolveProductImageUrl(product.image)
  const asMarketplace: MarketplaceProduct = {
    ...product,
    organization_id: org.id,
    organization_name: org.name,
    organization_slug: org.slug,
    organization_logo_url: org.logo_url ?? null,
    organization_city: org.city ?? null,
    organization_address: org.address ?? null,
    organization_maps_url: org.maps_url ?? null,
    organization_contact: org.instagram || org.facebook || org.tiktok || org.whatsapp || org.phone
      ? {
          instagram: org.instagram ?? null,
          facebook: org.facebook ?? null,
          tiktok: org.tiktok ?? null,
          whatsapp: org.whatsapp ?? null,
          phone: org.phone ?? null,
        }
      : null,
  }

  const hasDiscount = Boolean(product.has_offer && product.offer_price && product.offer_price < product.sale_price)

  return (
    <div className="group relative flex w-52 sm:w-60 shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-3 text-left shadow-2xs transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 dark:bg-card/90">
      {/* Botón Favorito */}
      <div className="absolute right-2 top-2 z-20">
        <FavoriteButton
          item={{
            productId: product.id,
            slug: org.slug,
            name: product.name,
            store: org.name,
            image: product.image,
            price: hasDiscount && product.offer_price ? product.offer_price : product.sale_price,
          }}
        />
      </div>

      {/* Badge de Oferta */}
      {hasDiscount && (
        <div className="absolute left-2 top-2 z-20">
          <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
            OFERTA
          </span>
        </div>
      )}

      {/* Imagen del Producto */}
      <div
        suppressHydrationWarning
        onClick={() => onSelectProduct(asMarketplace)}
        role="button"
        tabIndex={tabIndex ?? 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelectProduct(asMarketplace)
        }}
        aria-label={`Ver detalle de ${product.name}`}
        className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-muted/30"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 208px, 240px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Título y Precios */}
      <div className="mt-2.5 flex flex-1 flex-col justify-between">
        <div>
          <h4
            suppressHydrationWarning
            onClick={() => onSelectProduct(asMarketplace)}
            role="button"
            tabIndex={tabIndex ?? 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectProduct(asMarketplace)
            }}
            className="line-clamp-2 cursor-pointer text-xs font-semibold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {product.name}
          </h4>
        </div>

        <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2">
          <div className="flex items-baseline gap-1.5">
            <p className="text-sm sm:text-base font-bold tabular-nums text-foreground">
              {formatPrice(hasDiscount && product.offer_price ? product.offer_price : product.sale_price)}
            </p>
            {hasDiscount && (
              <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                {formatPrice(product.sale_price)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              tabIndex={tabIndex}
              onClick={() => onSelectProduct(asMarketplace)}
              className="h-7.5 rounded-lg px-2 text-[11px] font-semibold gap-1 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Eye className="h-3 w-3" />
              <span>Detalle</span>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7.5 rounded-lg px-2 text-[11px] font-semibold gap-1 border-border/80 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Link href={`/${org.slug}/productos/${product.id}`} tabIndex={tabIndex}>
                <span>Tienda</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OrgCatalogCard({ org, tabIndex }: { org: Org; tabIndex?: number }) {
  return (
    <Link
      href={`/${org.slug}/productos`}
      tabIndex={tabIndex}
      className="group relative flex w-52 sm:w-60 self-stretch shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-primary/5 hover:shadow-lg"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs transition-transform duration-300 group-hover:scale-110">
        <Store className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs sm:text-sm font-bold text-foreground transition-colors group-hover:text-primary">
          Ver todo el catálogo
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {org.products_count} productos de {org.name}
        </p>
      </div>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
        Explorar tienda
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

function OrgProductSection({
  org,
  onSelectProduct,
}: {
  org: Org
  onSelectProduct: (product: MarketplaceProduct) => void
}) {
  const [isPaused, setIsPaused] = useState(false)

  // Enlaces a redes sociales de la organización
  const socialLinks = useMemo(() => {
    return getSocialLinks({
      instagram: org.instagram,
      facebook: org.facebook,
      tiktok: org.tiktok,
    })
  }, [org.instagram, org.facebook, org.tiktok])

  // El número tal cual lo cargó la tienda no sirve para wa.me: `0985...` va sin
  // código de país y `595` pegado a un `0` da un número que no existe.
  const whatsappHref = (org.whatsapp ?? '').replace(/\D/g, '').length >= 6
    ? getWhatsAppLink({
        phone: org.whatsapp!,
        message: `¡Hola ${org.name}! Vi su tienda en el Marketplace y quería hacer una consulta.`,
      })
    : null

  // Lista base repetida hasta tener al menos 6 items para bucle continuo impecable
  const baseList = useMemo(() => {
    const list = org.featured_products || []
    if (list.length === 0) return []
    let repeated = [...list]
    while (repeated.length < 6) {
      repeated = [...repeated, ...list]
    }
    return repeated
  }, [org.featured_products])

  // Duración dinámica para mantener una velocidad suave y constante (~4.5s por producto)
  const animationDuration = useMemo(() => {
    return `${Math.max(30, (baseList.length + 1) * 4.5)}s`
  }, [baseList.length])

  return (
    <section className="border-t border-border/80 pt-10 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la Organización */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Link
              href={`/${org.slug}/inicio`}
              className="group/logo relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-white p-1 shadow-xs transition-transform duration-300 hover:scale-105 dark:bg-slate-900"
            >
              {org.logo_url ? (
                <Image
                  src={org.logo_url}
                  alt={org.name}
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${org.slug}/inicio`}
                  className="text-base sm:text-lg font-bold text-foreground transition-colors hover:text-primary"
                >
                  {org.name}
                </Link>
                <span className="relative flex h-2 w-2" title="Tienda activa">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </div>

              {/* Ubicación, conteo de productos, WhatsApp y Redes Sociales */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {org.city && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                    {org.city}
                  </span>
                )}
                {org.city && <span>·</span>}
                <span className="font-semibold text-foreground/80">
                  {org.products_count} {org.products_count === 1 ? 'producto' : 'productos'}
                </span>

                {whatsappHref && (
                  <>
                    <span>·</span>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`WhatsApp de ${org.name}`}
                      aria-label={`WhatsApp de ${org.name}`}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                )}

                {socialLinks.map((social) => {
                  const Icon = SOCIAL_ICONS[social.platform]
                  return (
                    <span key={social.platform} className="inline-flex items-center gap-1.5">
                      <span>·</span>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${social.label} de ${org.name}: ${social.handle}`}
                        aria-label={`${social.label} de ${org.name}: ${social.handle}`}
                        className={cn(
                          'inline-flex items-center gap-1 font-semibold transition-colors hover:underline',
                          social.platform === 'instagram' && 'text-pink-700 hover:text-pink-800 dark:text-pink-400',
                          social.platform === 'facebook' && 'text-blue-700 hover:text-blue-800 dark:text-blue-400',
                          social.platform === 'tiktok' && 'text-foreground hover:text-foreground/80 dark:text-zinc-200'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{social.label}</span>
                      </a>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Botones de control de movimiento continuo y acceso a la tienda */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Badge de estado animado (En movimiento / Pausado) */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setIsPaused((p) => !p)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs cursor-pointer',
                !isPaused
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted'
              )}
              title={!isPaused ? 'Pausar movimiento automático' : 'Activar movimiento automático'}
              aria-label={!isPaused ? 'Estado del carrusel: en movimiento' : 'Estado del carrusel: pausado'}
            >
              <span className="relative flex h-2 w-2">
                {!isPaused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    !isPaused ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  )}
                />
              </span>
              <span>{!isPaused ? 'En movimiento' : 'Pausado'}</span>
            </button>

            {/* Botón de Play/Pausa de movimiento */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setIsPaused((p) => !p)}
              aria-label={!isPaused ? 'Pausar movimiento automático' : 'Reanudar movimiento automático'}
              title={!isPaused ? 'Pausar movimiento' : 'Reanudar movimiento'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-background shadow-xs transition-all hover:bg-muted cursor-pointer',
                !isPaused ? 'text-primary border-primary/40' : 'text-muted-foreground'
              )}
            >
              {!isPaused ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-border/80 bg-card text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <Link href={`/${org.slug}/inicio`}>
                <span>Ir a la tienda</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Carrusel Continuo de Productos tipo Marquee con pausa en hover */}
        {baseList.length > 0 ? (
          <div className="relative w-full overflow-hidden select-none py-1">
            {/* Sombras laterales de desvanecimiento para entrada y salida suave */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20 bg-gradient-to-l from-background to-transparent" />

            {/* Pistas continuas con animación marquee horizontal */}
            <div
              className="flex w-max items-center gap-3.5 sm:gap-4 py-2 animate-marquee-left hover:[animation-play-state:paused] motion-reduce:animate-none"
              style={{
                animationDuration,
                animationPlayState: isPaused ? 'paused' : undefined,
              }}
            >
              {/* Pista 1 */}
              <div className="flex shrink-0 items-center gap-3.5 sm:gap-4">
                {baseList.map((product, idx) => (
                  <OrgProductCard
                    key={`track1-${product.id}-${idx}`}
                    product={product}
                    org={org}
                    onSelectProduct={onSelectProduct}
                  />
                ))}
                <OrgCatalogCard org={org} />
              </div>

              {/* Pista 2 (Duplicado idéntico para bucle continuo 100% suave) */}
              <div className="flex shrink-0 items-center gap-3.5 sm:gap-4" aria-hidden="true">
                {baseList.map((product, idx) => (
                  <OrgProductCard
                    key={`track2-${product.id}-${idx}`}
                    product={product}
                    org={org}
                    onSelectProduct={onSelectProduct}
                    tabIndex={-1}
                  />
                ))}
                <OrgCatalogCard org={org} tabIndex={-1} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Esta tienda aún no tiene productos disponibles.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
              <Link href={`/${org.slug}/inicio`}>
                <span>Visitar tienda</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export function MarketplaceOrgProductGrid({ organizations }: Props) {
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)

  return (
    <>
      {organizations.map((org) => (
        <OrgProductSection
          key={org.id}
          org={org}
          onSelectProduct={setSelected}
        />
      ))}

      {/* Shared modal */}
      <MarketplaceProductModal
        product={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

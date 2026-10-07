'use client'

import { useState, useSyncExternalStore } from 'react'
import { AppImage as Image } from '@/components/ui/app-image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, MessageCircle, Search, Truck, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import {
  STOREFRONT_EYEBROW_CLASS,
  STOREFRONT_HEADING_CLASS,
  STOREFRONT_RADIUS_CLASS,
  type StorefrontStyle,
} from '@/lib/website/storefront-style'
import type { CompanyInfo, HeroContent } from '@/types/website-settings'
import type { PublicProduct } from '@/types/public'
import type { PublishedHeroAction, StorefrontCapabilities, StorefrontTracking } from '@/lib/website/storefront-capabilities'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

interface HeroCampaignProps {
  style: Exclude<StorefrontStyle, 'classic'>
  companyInfo: CompanyInfo
  heroContent: HeroContent
  phoneClean: string
  contactHref: string
  hasRepairs: boolean
  capabilities?: StorefrontCapabilities
  primaryAction?: PublishedHeroAction
  tracking?: StorefrontTracking
}

/** Textos por defecto de la portada cuando el dueño no cargó los suyos: «prendas» solo en Moda. */
const DEFAULT_HERO_COPY: Partial<Record<StorefrontStyle, { badge: string; title: string; subtitle: string; cta: string }>> = {
  tech: { badge: 'Tecnología', title: 'Lo último en tecnología', subtitle: 'Equipos, accesorios y servicio técnico con garantía y envíos a todo el país.', cta: 'Ver productos' },
  modern: { badge: 'Nuevo', title: 'Diseño que se nota', subtitle: 'Productos elegidos con cuidado para tu día a día.', cta: 'Ver productos' },
  beauty: { badge: 'Belleza & cuidado', title: 'Tu rutina de belleza, en un solo lugar', subtitle: 'Maquillaje, skincare y fragancias para cuidarte todos los días.', cta: 'Ver productos' },
}
const FASHION_HERO_COPY = { badge: 'Nueva colección & Tendencias', title: 'Tu estilo, tu mejor versión', subtitle: 'Prendas de alta calidad, envíos a todo el país y las mejores marcas para toda la familia.', cta: 'Ver la colección' }

const subscribeToHydration = () => () => undefined
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

/** Fotos del mosaico: los productos más nuevos que tienen imagen propia. */
export function pickCampaignProducts(products: PublicProduct[], excludedIds: string[] = [], limit = 3) {
  return products
    .filter((product) => Boolean(product.image?.trim()) && !excludedIds.includes(product.id))
    .slice(0, limit)
}

/** Con tres fotos la primera ocupa la columna entera; con menos se reparten. */
function tileSpan(index: number, total: number) {
  if (total === 1) return 'col-span-2 row-span-2'
  if (total === 2 || index === 0) return 'row-span-2'
  return ''
}

export function HeroCampaign({
  style,
  companyInfo,
  heroContent,
  phoneClean,
  contactHref,
  hasRepairs,
  capabilities,
  primaryAction = { kind: 'products', href: '/productos' },
  tracking = hasRepairs
    ? { kind: 'repairs', href: '/mis-reparaciones' }
    : { kind: 'orders', href: '/track' },
}: HeroCampaignProps) {
  const pathname = usePathname()
  const router = useRouter()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const [searchQuery, setSearchQuery] = useState('')
  const [failedImageIds, setFailedImageIds] = useState<string[]>([])
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )

  const { data, isLoading } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const loadingPhotos = !mounted || (isLoading && !data)
  const photos = mounted ? pickCampaignProducts(data ?? [], failedImageIds) : []
  void (STOREFRONT_RADIUS_CLASS[style]);
  const isSport = style === 'sport'
  // Cosmética se fotografía sobre blanco: las fotos van enteras, no recortadas.
  const isBeauty = style === 'beauty'
  const defaults = DEFAULT_HERO_COPY[style] ?? FASHION_HERO_COPY

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = searchQuery.trim()
    router.push(query ? `${tenantPrefix}/productos?q=${encodeURIComponent(query)}` : `${tenantPrefix}/productos`)
  }

  return (
    <section className="relative border-b border-border/80 bg-background overflow-hidden" data-storefront-hero={style}>
      {/* Fondo atmosférico sutil */}
      <div className={cn('pointer-events-none absolute inset-0', isBeauty
        ? 'bg-gradient-to-br from-pink-50 via-rose-50/50 to-fuchsia-50/40 dark:from-pink-950/20 dark:via-transparent dark:to-fuchsia-950/10'
        : 'bg-gradient-to-b from-primary/5 via-transparent to-transparent')} />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-12 lg:gap-14 lg:py-16">
          {/* Lado izquierdo: Textos y CTAs estilo Giulio Cesare */}
          <div className="flex flex-col items-start lg:col-span-5">
            <span className={STOREFRONT_EYEBROW_CLASS[style]}>
              {heroContent.badge || defaults.badge}
            </span>

            <h1
              className={cn(
                'mt-4 text-balance text-4xl text-foreground sm:text-5xl',
                isSport ? 'leading-[0.95] lg:text-7xl' : 'leading-[1.05] lg:text-6xl',
                STOREFRONT_HEADING_CLASS[style]
              )}
            >
              {heroContent.title || defaults.title}
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {heroContent.subtitle || defaults.subtitle}
            </p>

            {/* Botones estilo píldora rounded-full idénticos a Giulio Cesare */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="group/btn h-12 rounded-full bg-primary text-primary-foreground font-bold px-7 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-105 active:translate-y-0"
              >
                {primaryAction.kind === 'contact' ? (
                  <a href={contactHref} target={phoneClean ? '_blank' : undefined} rel={phoneClean ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2">
                    <span>{heroContent.ctaPrimaryText || 'Solicitar información'}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                  </a>
                ) : (
                  <Link href={`${tenantPrefix}${primaryAction.href}`} className="inline-flex items-center gap-2">
                    <span>{heroContent.ctaPrimaryText || (primaryAction.kind === 'services' ? 'Ver servicios' : defaults.cta)}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                  </Link>
                )}
              </Button>

              {primaryAction.kind !== 'contact' && <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-border/80 bg-background/80 font-semibold px-7 shadow-xs hover:bg-muted transition-all duration-200"
              >
                <a
                  href={contactHref}
                  target={phoneClean ? '_blank' : undefined}
                  rel={phoneClean ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-2"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4 text-[#25D366]" />
                  <span>{heroContent.ctaSecondaryText || 'Contactar por WhatsApp'}</span>
                </a>
              </Button>}
            </div>

            {/* Buscador píldora minimalista */}
            {(capabilities?.hasCatalog ?? true) && <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="mt-8 flex w-full max-w-md items-center gap-3 rounded-full border border-border/80 bg-card px-4 py-1.5 shadow-xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
            >
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Buscar productos"
                placeholder="¿Qué estás buscando hoy?"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Buscar
              </button>
            </form>}

            {tracking.kind !== 'none' && tracking.href && <Link
              href={`${tenantPrefix}${tracking.href}`}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {tracking.kind === 'repairs' ? (
                <Wrench aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Truck aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              )}
              <span>
                {tracking.kind === 'repairs'
                  ? heroContent.trackRepairText || '¿Tenés una orden técnica? Rastreá tu equipo aquí'
                  : '¿Hiciste una compra? Seguí tu pedido'}
              </span>
            </Link>}
          </div>

          {/* Lado derecho: Mosaico editorial de fotos de productos */}
          <div className="lg:col-span-7">
            {loadingPhotos ? (
              <div aria-hidden="true" className="grid h-80 grid-cols-2 grid-rows-2 gap-3 sm:h-[30rem] sm:gap-4 lg:h-[34rem]">
                <div className="row-span-2 animate-pulse rounded-2xl bg-muted/70" />
                <div className="animate-pulse rounded-2xl bg-muted/60" />
                <div className="animate-pulse rounded-2xl bg-muted/60" />
              </div>
            ) : photos.length > 0 ? (
              <ul className="grid h-80 grid-cols-2 grid-rows-2 gap-3 sm:h-[30rem] sm:gap-4 lg:h-[34rem]">
                {photos.map((product, index) => {
                  const src = resolveProductImageUrl(product.image)
                  return (
                    <li key={product.id} className={cn('relative', tileSpan(index, photos.length))}>
                      <Link
                        href={`${tenantPrefix}/productos/${product.id}`}
                        className={cn(
                          'group absolute inset-0 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          isBeauty ? 'rounded-3xl border border-pink-100 bg-white dark:border-pink-900/40' : 'rounded-2xl bg-muted'
                        )}
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          priority={index === 0}
                          sizes="(max-width: 1024px) 50vw, 30vw"
                          className={cn('transition-transform duration-700 group-hover:scale-105', isBeauty ? 'object-contain p-6' : 'object-cover')}
                          onError={() => setFailedImageIds((ids) => [...ids, product.id])}
                        />
                        <span className={cn('absolute inset-x-0 bottom-0 px-4 pb-4 text-xs font-semibold sm:text-sm', isBeauty
                          ? 'bg-gradient-to-t from-white via-white/80 to-transparent pt-10 text-foreground dark:from-black/70 dark:via-black/30 dark:text-white'
                          : 'bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-16 text-white')}>
                          <span className="line-clamp-1 group-hover:text-primary-foreground transition-colors">
                            {product.name}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className={cn('flex h-56 items-end p-6 text-primary-foreground shadow-lg sm:h-[30rem] sm:p-10 lg:h-[34rem]', isBeauty ? 'rounded-3xl bg-gradient-to-br from-pink-400 via-rose-400 to-fuchsia-500' : 'rounded-2xl bg-gradient-to-tr from-primary to-primary/80')}>
                <p className={cn('text-balance text-4xl leading-none sm:text-6xl font-extrabold', STOREFRONT_HEADING_CLASS[style])}>
                  {companyInfo.name || 'Nueva colección'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

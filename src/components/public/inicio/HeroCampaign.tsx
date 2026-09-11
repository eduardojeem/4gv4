'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

interface HeroCampaignProps {
  style: Exclude<StorefrontStyle, 'classic'>
  companyInfo: CompanyInfo
  heroContent: HeroContent
  phoneClean: string
  contactHref: string
  hasRepairs: boolean
}

/** Fotos del mosaico: los productos mas nuevos que tienen imagen propia. */
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

/**
 * Portada de los aspectos Moda y Deportivo: el mensaje a un lado y fotos del
 * catalogo al otro, como la campaña de una tienda de ropa. No muestra las
 * estadisticas de garantia y despacho del aspecto clasico.
 */
export function HeroCampaign({ style, companyInfo, heroContent, phoneClean, contactHref, hasRepairs }: HeroCampaignProps) {
  const pathname = usePathname()
  const router = useRouter()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const [searchQuery, setSearchQuery] = useState('')
  const [failedImageIds, setFailedImageIds] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data, isLoading } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const loadingPhotos = !mounted || (isLoading && !data)
  const photos = mounted ? pickCampaignProducts(data ?? [], failedImageIds) : []
  const radius = STOREFRONT_RADIUS_CLASS[style]
  const isSport = style === 'sport'

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = searchQuery.trim()
    router.push(query ? `${tenantPrefix}/productos?q=${encodeURIComponent(query)}` : `${tenantPrefix}/productos`)
  }

  return (
    <section className="border-b border-border/80 bg-background" data-storefront-hero={style}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-12 lg:gap-14 lg:py-16">
          <div className="flex flex-col items-start lg:col-span-5">
            <span className={STOREFRONT_EYEBROW_CLASS[style]}>{heroContent.badge || 'Nueva colección'}</span>

            <h1
              className={cn(
                'mt-4 text-balance text-4xl text-foreground sm:text-5xl',
                isSport ? 'leading-[0.95] lg:text-7xl' : 'leading-[1.05] lg:text-6xl',
                STOREFRONT_HEADING_CLASS[style]
              )}
            >
              {heroContent.title || 'Los mejores productos al mejor precio'}
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {heroContent.subtitle ||
                'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.'}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className={cn('h-12 gap-2 px-7', radius, isSport ? 'font-black uppercase tracking-wider' : 'font-medium tracking-wide')}
              >
                <Link href={`${tenantPrefix}/productos`}>
                  {heroContent.ctaPrimaryText || 'Ver la colección'}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className={cn('h-12 gap-2 px-7', radius, isSport ? 'font-bold uppercase tracking-wider' : 'font-medium')}
              >
                <a
                  href={contactHref}
                  target={phoneClean ? '_blank' : undefined}
                  rel={phoneClean ? 'noopener noreferrer' : undefined}
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  {heroContent.ctaSecondaryText || 'Contactar por WhatsApp'}
                </a>
              </Button>
            </div>

            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="mt-8 flex w-full max-w-md items-center gap-3 border-b border-foreground/25 transition-colors focus-within:border-foreground"
            >
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Buscar productos"
                placeholder="¿Qué estás buscando?"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="submit"
                className="shrink-0 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-primary"
              >
                Buscar
              </button>
            </form>

            <Link
              href={hasRepairs ? `${tenantPrefix}/mis-reparaciones` : `${tenantPrefix}/track`}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {hasRepairs ? (
                <Wrench aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Truck aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              <span>
                {hasRepairs
                  ? heroContent.trackRepairText || '¿Tenés una orden técnica? Rastreá tu equipo aquí'
                  : '¿Hiciste una compra? Seguí tu pedido'}
              </span>
            </Link>
          </div>

          <div className="lg:col-span-7">
            {loadingPhotos ? (
              <div aria-hidden="true" className="grid h-80 grid-cols-2 grid-rows-2 gap-2 sm:h-[30rem] sm:gap-3 lg:h-[34rem]">
                <div className={cn('row-span-2 animate-pulse bg-muted', radius)} />
                <div className={cn('animate-pulse bg-muted', radius)} />
                <div className={cn('animate-pulse bg-muted', radius)} />
              </div>
            ) : photos.length > 0 ? (
              <ul className="grid h-80 grid-cols-2 grid-rows-2 gap-2 sm:h-[30rem] sm:gap-3 lg:h-[34rem]">
                {photos.map((product, index) => {
                  const src = resolveProductImageUrl(product.image)
                  return (
                    <li key={product.id} className={cn('relative', tileSpan(index, photos.length))}>
                      <Link
                        href={`${tenantPrefix}/productos/${product.id}`}
                        className={cn(
                          'group absolute inset-0 overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          radius
                        )}
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          priority={index === 0}
                          sizes="(max-width: 1024px) 50vw, 30vw"
                          className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
                          unoptimized={src.startsWith('data:')}
                          onError={() => setFailedImageIds((ids) => [...ids, product.id])}
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 pb-3 pt-12 text-xs font-medium text-white sm:px-4 sm:pb-4 sm:text-sm">
                          <span className="line-clamp-1">{product.name}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className={cn('flex h-56 items-end bg-primary p-6 text-primary-foreground sm:h-[30rem] sm:p-10 lg:h-[34rem]', radius)}>
                <p className={cn('text-balance text-4xl leading-none sm:text-6xl', STOREFRONT_HEADING_CLASS[style])}>
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

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle, Search, Sparkles, Truck, Wrench } from 'lucide-react'
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
    <section className="relative border-b border-border/80 bg-background overflow-hidden" data-storefront-hero={style}>
      {/* Fondo atmosférico sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-12 lg:gap-14 lg:py-16">
          {/* Lado izquierdo: Textos y CTAs estilo Giulio Cesare */}
          <div className="flex flex-col items-start lg:col-span-5">
            <span className={STOREFRONT_EYEBROW_CLASS[style]}>
              {heroContent.badge || 'Nueva colección & Tendencias'}
            </span>

            <h1
              className={cn(
                'mt-4 text-balance text-4xl text-foreground sm:text-5xl',
                isSport ? 'leading-[0.95] lg:text-7xl' : 'leading-[1.05] lg:text-6xl',
                STOREFRONT_HEADING_CLASS[style]
              )}
            >
              {heroContent.title || 'Tu estilo, tu mejor versión'}
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {heroContent.subtitle ||
                'Prendas de alta calidad, envíos a todo el país y las mejores marcas para toda la familia.'}
            </p>

            {/* Botones estilo píldora rounded-full idénticos a Giulio Cesare */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="group/btn h-12 rounded-full bg-primary text-primary-foreground font-bold px-7 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-105 active:translate-y-0"
              >
                <Link href={`${tenantPrefix}/productos`} className="inline-flex items-center gap-2">
                  <span>{heroContent.ctaPrimaryText || 'Ver la colección'}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </Link>
              </Button>

              <Button
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
              </Button>
            </div>

            {/* Buscador píldora minimalista */}
            <form
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
            </form>

            <Link
              href={hasRepairs ? `${tenantPrefix}/mis-reparaciones` : `${tenantPrefix}/track`}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {hasRepairs ? (
                <Wrench aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Truck aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              )}
              <span>
                {hasRepairs
                  ? heroContent.trackRepairText || '¿Tenés una orden técnica? Rastreá tu equipo aquí'
                  : '¿Hiciste una compra? Seguí tu pedido'}
              </span>
            </Link>
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
                        className="group absolute inset-0 overflow-hidden rounded-2xl bg-muted shadow-sm hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          priority={index === 0}
                          sizes="(max-width: 1024px) 50vw, 30vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          unoptimized={src.startsWith('data:')}
                          onError={() => setFailedImageIds((ids) => [...ids, product.id])}
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-4 pt-16 text-xs font-semibold text-white sm:text-sm">
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
              <div className="flex h-56 items-end rounded-2xl bg-gradient-to-tr from-primary to-primary/80 p-6 text-primary-foreground sm:h-[30rem] sm:p-10 lg:h-[34rem] shadow-lg">
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

'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle, Zap } from 'lucide-react'
import { useHydrated } from '@/hooks/use-hydrated'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn, formatPrice } from '@/lib/utils'
import type { CompanyInfo, HeroContent } from '@/types/website-settings'
import { pickCampaignProducts } from './HeroCampaign'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

interface SportHeroProps {
  companyInfo: CompanyInfo
  heroContent: HeroContent
  contactHref: string
  phoneClean: string
}

/**
 * Portada de Deportivo: fondo oscuro, una franja diagonal con el color de marca
 * y el último ingreso en grande como «drop». Todo sale del catálogo real.
 */
export function SportHero({ companyInfo, heroContent, contactHref, phoneClean }: SportHeroProps) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const mounted = useHydrated()
  const [failedIds, setFailedIds] = useState<string[]>([])
  const { data } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const [drop, ...rest] = mounted ? pickCampaignProducts(data ?? [], failedIds, 3) : []
  const dropPrice = drop ? (drop.has_offer && drop.offer_price ? drop.offer_price : drop.sale_price) : 0

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white" data-storefront-hero="sport">
      {/* Franja diagonal con el color de marca */}
      <div aria-hidden="true" className="absolute inset-y-0 right-[-12%] hidden w-[46%] -skew-x-12 bg-primary lg:block" />
      <div aria-hidden="true" className="absolute inset-y-0 right-[30%] hidden w-3 -skew-x-12 bg-lime-300 lg:block" />

      <div className="container relative mx-auto grid items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-12 lg:px-8 lg:py-20">
        <div className="lg:col-span-6">
          <span className="inline-flex -skew-x-6 items-center gap-1.5 bg-lime-300 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-slate-950">
            <Zap aria-hidden="true" className="h-3 w-3" />
            {heroContent.badge || 'Nueva temporada'}
          </span>
          <h1 className="mt-5 text-balance text-5xl font-black uppercase italic leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl">
            {heroContent.title || companyInfo.name || 'Rendí al máximo'}
          </h1>
          <p className="mt-5 max-w-md text-base text-slate-300 sm:text-lg">
            {heroContent.subtitle || 'Calzado, ropa y equipamiento para entrenar, correr y competir.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`${tenantPrefix}/productos`}
              className="group inline-flex h-12 -skew-x-6 items-center gap-2 bg-primary px-7 text-sm font-black uppercase italic tracking-wide text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
            >
              <span className="skew-x-6">{heroContent.ctaPrimaryText || 'Comprar ahora'}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 skew-x-6 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={contactHref}
              target={phoneClean ? '_blank' : undefined}
              rel={phoneClean ? 'noopener noreferrer' : undefined}
              className="inline-flex h-12 -skew-x-6 items-center gap-2 border-2 border-white/80 px-6 text-sm font-black uppercase italic tracking-wide text-white transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4 skew-x-6" />
              <span className="skew-x-6">{heroContent.ctaSecondaryText || 'Consultar'}</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-6">
          {drop ? (
            <div className="grid grid-cols-3 gap-3">
              <Link
                href={`${tenantPrefix}/productos/${drop.id}`}
                className="group relative col-span-2 row-span-2 block aspect-[3/4] overflow-hidden rounded-md bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
              >
                <Image
                  src={resolveProductImageUrl(drop.image)}
                  alt={drop.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 66vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={() => setFailedIds((ids) => [...ids, drop.id])}
                />
                <span className="absolute left-3 top-3 -skew-x-6 bg-lime-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-950">
                  New drop
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-14">
                  <span className="block line-clamp-1 text-sm font-black uppercase italic">{drop.name}</span>
                  {dropPrice > 0 && <span className="text-lg font-black text-lime-300">{formatPrice(dropPrice)}</span>}
                </span>
              </Link>
              {rest.map((product) => (
                <Link
                  key={product.id}
                  href={`${tenantPrefix}/productos/${product.id}`}
                  className="group relative block aspect-[3/4] overflow-hidden rounded-md bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                >
                  <Image
                    src={resolveProductImageUrl(product.image)}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={() => setFailedIds((ids) => [...ids, product.id])}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div
              aria-hidden="true"
              className={cn(
                'flex aspect-[4/3] items-end -skew-x-3 bg-primary p-6 sm:p-10',
                !mounted && 'animate-pulse'
              )}
            >
              <span className="skew-x-3 text-5xl font-black uppercase italic leading-none tracking-tighter text-primary-foreground sm:text-7xl">
                {companyInfo.name || 'Sport'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

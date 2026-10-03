'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, BadgePercent, Search, ShoppingBasket } from 'lucide-react'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import type { CompanyInfo, HeroContent } from '@/types/website-settings'
import { ProductCard } from '@/components/public/ProductCard'
import { categoryCoverImages } from './CategoryCollections'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

function useTenantPrefix() {
  const tenantSlug = getTenantSlugFromPathname(usePathname())
  return { tenantSlug, tenantPrefix: tenantSlug ? `/${tenantSlug}` : '' }
}

/** Productos en oferta con stock: la vidriera de un súper. */
export function marketDealsKey(tenantSlug: string) {
  return withOrgQuery('/api/public/products?per_page=12&has_offer=true&in_stock=true&sort=newest', tenantSlug)
}

/**
 * Portada de Supermercado: en un súper se entra a buscar, así que el buscador
 * va primero y grande, con las ofertas a un toque.
 */
export function MarketHero({ companyInfo, heroContent }: { companyInfo: CompanyInfo; heroContent: HeroContent }) {
  const router = useRouter()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const [query, setQuery] = useState('')
  const { data: deals } = useSWR(marketDealsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const dealsCount = deals?.length ?? 0

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    router.push(term ? `${tenantPrefix}/productos?q=${encodeURIComponent(term)}` : `${tenantPrefix}/productos`)
  }

  return (
    <section className="bg-primary text-primary-foreground" data-storefront-hero="market">
      <div className="container mx-auto grid gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:items-center lg:px-8">
        <div className="lg:col-span-8">
          <p className="text-sm font-semibold text-primary-foreground/80">{heroContent.badge || companyInfo.name || 'Tu súper'}</p>
          <h1 className="mt-1 text-balance text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {heroContent.title || '¿Qué necesitás hoy?'}
          </h1>
          {heroContent.subtitle && <p className="mt-2 max-w-xl text-sm text-primary-foreground/85 sm:text-base">{heroContent.subtitle}</p>}

          <form role="search" onSubmit={search} className="mt-5 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-1.5 shadow-lg">
            <Search aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar productos"
              placeholder="Buscá leche, arroz, detergente…"
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Buscar
            </button>
          </form>
        </div>

        <Link
          href={`${tenantPrefix}/ofertas`}
          className="group flex items-center gap-4 rounded-2xl bg-amber-300 p-5 text-amber-950 shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:col-span-4"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-950 text-amber-300">
            <BadgePercent aria-hidden="true" className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black leading-tight">Ofertas de la semana</span>
            <span className="block text-sm font-semibold">
              {dealsCount > 0 ? `${dealsCount} ${dealsCount === 1 ? 'producto rebajado' : 'productos rebajados'}` : 'Precios especiales'}
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}

/** Categorías como pasillos: círculos chicos y muchos a la vista. */
export function MarketAisles() {
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const { categories, isLoading } = usePublicCategories()
  const { data: products } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  if (!mounted || isLoading) return null

  const aisles = categories
    .filter((category) => (category.productCount ?? 0) > 0)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, 12)
  if (aisles.length === 0) return null
  const covers = categoryCoverImages(products ?? [])

  return (
    <section aria-labelledby="market-aisles" className="border-b bg-background py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="market-aisles" className="text-lg font-black tracking-tight sm:text-xl">Pasillos</h2>
          <Link href={`${tenantPrefix}/productos`} className="text-sm font-semibold text-primary hover:underline">
            Ver todo
          </Link>
        </div>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0 lg:grid-cols-12">
          {aisles.map((category) => {
            const cover = covers.get(category.id)
            return (
              <li key={category.id} className="w-20 shrink-0 sm:w-auto">
                <Link
                  href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                  className="group flex flex-col items-center gap-1.5 text-center focus-visible:outline-none"
                >
                  <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-transparent transition group-hover:ring-primary group-focus-visible:ring-primary">
                    {cover ? (
                      <Image src={resolveProductImageUrl(cover)} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <ShoppingBasket aria-hidden="true" className="h-6 w-6 text-primary" />
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold leading-tight">{category.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** Fila de ofertas con desplazamiento lateral; si no hay rebajas no se muestra. */
export function MarketDeals() {
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const { data: deals } = useSWR(marketDealsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  if (!mounted || !deals?.length) return null

  return (
    <section aria-labelledby="market-deals" className="bg-amber-50 py-8 dark:bg-amber-950/20 sm:py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-950">
              Ahorrá
            </span>
            <h2 id="market-deals" className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Ofertas de la semana</h2>
          </div>
          <Link href={`${tenantPrefix}/ofertas`} className="shrink-0 text-sm font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {deals.map((product) => (
            <li key={product.id} className="w-44 shrink-0 snap-start sm:w-52">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

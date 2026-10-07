'use client'

import { useRef, useState, type ReactNode } from 'react'
import { AppImage as Image } from '@/components/ui/app-image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, BadgePercent, ChevronLeft, ChevronRight, Search, ShoppingBasket } from 'lucide-react'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { marketDiscountTiers, productDiscountPct } from '@/lib/public/market'
import { cn } from '@/lib/utils'
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
  return withOrgQuery('/api/public/products?per_page=48&has_offer=true&in_stock=true&sort=newest', tenantSlug)
}

/** Los productos con stock de un pasillo. */
export function marketAisleKey(tenantSlug: string, categoryId: string) {
  return withOrgQuery(`/api/public/products?per_page=12&in_stock=true&sort=newest&category_id=${encodeURIComponent(categoryId)}`, tenantSlug)
}

/** Las categorías con productos, de la más grande a la más chica. */
function useAisles(limit: number) {
  const { categories, isLoading } = usePublicCategories()
  const aisles = categories
    .filter((category) => !category.parent_id && (category.productCount ?? 0) > 0)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit)
  return { aisles, isLoading }
}

/** Fila con desplazamiento lateral y flechas en pantallas grandes. */
function ScrollRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const scroll = (direction: 1 | -1) => {
    const list = listRef.current
    if (list) list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' })
  }
  const arrow = 'absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:flex'

  return (
    <div className="relative">
      <button type="button" onClick={() => scroll(-1)} className={cn(arrow, '-left-3')} aria-label={`${label}: anteriores`}>
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </button>
      <ul ref={listRef} className={cn('-mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-1', className)}>
        {children}
      </ul>
      <button type="button" onClick={() => scroll(1)} className={cn(arrow, '-right-3')} aria-label={`${label}: siguientes`}>
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  )
}

function SectionHeader({ id, title, eyebrow, href, linkLabel = 'Ver todo' }: { id: string; title: string; eyebrow?: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow}
        <h2 id={id} className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline">
          {linkLabel} <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

/**
 * Portada de Supermercado: en un súper se entra a buscar, así que el buscador
 * va primero y grande, con búsquedas rápidas por pasillo y las ofertas a un toque.
 */
export function MarketHero({ companyInfo, heroContent }: { companyInfo: CompanyInfo; heroContent: HeroContent }) {
  const router = useRouter()
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const [query, setQuery] = useState('')
  const { data: deals } = useSWR(marketDealsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const { aisles } = useAisles(6)
  const dealsCount = deals?.length ?? 0
  const bestDiscount = Math.max(0, ...(deals ?? []).map(productDiscountPct))

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    router.push(term ? `${tenantPrefix}/productos?query=${encodeURIComponent(term)}` : `${tenantPrefix}/productos`)
  }

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground" data-storefront-hero="market">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-black/10" />
      <div className="container relative mx-auto grid gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:items-center lg:px-8">
        <div className="lg:col-span-8">
          <p className="text-sm font-semibold text-primary-foreground/80">{heroContent.badge || companyInfo.name || 'Tu súper'}</p>
          <h1 className="mt-1 text-balance text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {heroContent.title || '¿Qué necesitás hoy?'}
          </h1>
          {heroContent.subtitle && <p className="mt-2 max-w-xl text-sm text-primary-foreground/85 sm:text-base">{heroContent.subtitle}</p>}

          <form role="search" onSubmit={search} className="mt-5 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg">
            <Search aria-hidden="true" className="ml-3 h-5 w-5 shrink-0 text-slate-400" />
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
              className="h-11 shrink-0 rounded-full bg-primary px-6 text-sm font-black uppercase tracking-wide text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Buscar
            </button>
          </form>

          {/* Búsquedas rápidas: los pasillos más grandes, a un toque. */}
          {mounted && aisles.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-primary-foreground/75">Más buscado:</span>
              {aisles.map((aisle) => (
                <Link
                  key={aisle.id}
                  href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(aisle.id)}`}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground ring-1 ring-white/25 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {aisle.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link
          href={`${tenantPrefix}/ofertas`}
          className="group flex items-center gap-4 rounded-3xl bg-amber-300 p-5 text-amber-950 shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:col-span-4"
        >
          <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-md">
            {bestDiscount > 0 ? (
              <>
                <span className="text-[10px] font-bold uppercase leading-none">Hasta</span>
                <span className="text-lg font-black leading-none">{bestDiscount}%</span>
              </>
            ) : (
              <BadgePercent aria-hidden="true" className="h-7 w-7" />
            )}
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

/** Pasillos: tarjetas con foto en un carrusel, como en un súper online. */
export function MarketAisles() {
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const { aisles, isLoading } = useAisles(24)
  const { data: products } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  if (!mounted || isLoading || aisles.length === 0) return null
  const covers = categoryCoverImages(products ?? [])

  return (
    <section aria-labelledby="market-aisles" className="border-b bg-background py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader id="market-aisles" title="Pasillos" href={`${tenantPrefix}/productos`} />
        <ScrollRow label="Pasillos">
          {aisles.map((category) => {
            const cover = covers.get(category.id)
            return (
              <li key={category.id} className="w-24 shrink-0 snap-start sm:w-28">
                <Link
                  href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                  className="group flex flex-col items-center gap-2 text-center focus-visible:outline-none"
                >
                  <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white shadow-2xs transition group-hover:border-primary group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary dark:bg-muted/40">
                    {cover ? (
                      <Image src={resolveProductImageUrl(cover)} alt="" fill sizes="112px" className="object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <ShoppingBasket aria-hidden="true" className="h-8 w-8 text-primary" />
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-bold leading-tight">{category.name}</span>
                </Link>
              </li>
            )
          })}
        </ScrollRow>
      </div>
    </section>
  )
}

/**
 * Ofertas con «Descuentos» por escalón (20% OFF, 30% OFF…): tocar un escalón
 * filtra la fila. Si no hay rebajas no se muestra.
 */
export function MarketDeals() {
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const { data: deals } = useSWR(marketDealsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const [minDiscount, setMinDiscount] = useState(0)
  if (!mounted || !deals?.length) return null

  const tiers = marketDiscountTiers(deals)
  const visible = deals
    .filter((product) => productDiscountPct(product) >= minDiscount)
    .sort((a, b) => productDiscountPct(b) - productDiscountPct(a))

  return (
    <section aria-labelledby="market-deals" className="bg-amber-50 py-8 dark:bg-amber-950/20 sm:py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="market-deals"
          title="Ofertas de la semana"
          href={`${tenantPrefix}/ofertas`}
          linkLabel="Ver todas"
          eyebrow={(
            <span className="mb-1 inline-block rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-950">
              Ahorrá
            </span>
          )}
        />

        {tiers.length > 1 && (
          <div className="mb-5" role="group" aria-label="Filtrar por descuento">
            <p className="mb-2 text-sm font-black">Descuentos</p>
            <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setMinDiscount(0)}
                aria-pressed={minDiscount === 0}
                className={cn(
                  'flex h-16 shrink-0 flex-col items-center justify-center rounded-2xl px-4 text-sm font-black shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  minDiscount === 0 ? 'bg-foreground text-background' : 'bg-background text-foreground ring-1 ring-border hover:ring-foreground/40'
                )}
              >
                Todas
                <span className="text-[10px] font-semibold opacity-75">{deals.length}</span>
              </button>
              {tiers.map((tier) => {
                const active = minDiscount === tier.min
                return (
                  <button
                    key={tier.min}
                    type="button"
                    onClick={() => setMinDiscount(tier.min)}
                    aria-pressed={active}
                    aria-label={`${tier.min}% de descuento o más: ${tier.count} ${tier.count === 1 ? 'producto' : 'productos'}`}
                    className={cn(
                      'flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl leading-none shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      active ? 'bg-red-700 text-white ring-2 ring-red-900/30 scale-105' : 'bg-red-600 text-white hover:bg-red-700'
                    )}
                  >
                    <span className="text-xl font-black">{tier.min}<span className="text-xs align-top">%</span></span>
                    <span className="mt-0.5 text-[10px] font-black tracking-widest">OFF{tier.min < 50 ? '+' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <ScrollRow label="Ofertas">
          {visible.map((product) => (
            <li key={product.id} className="w-44 shrink-0 snap-start sm:w-52">
              <ProductCard product={product} />
            </li>
          ))}
        </ScrollRow>
      </div>
    </section>
  )
}

function MarketAisleRow({ aisle, tenantSlug, tenantPrefix }: { aisle: { id: string; name: string }; tenantSlug: string; tenantPrefix: string }) {
  const { data: products } = useSWR(marketAisleKey(tenantSlug, aisle.id), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  if (!products || products.length < 2) return null
  const headingId = `market-aisle-${aisle.id}`

  return (
    <section aria-labelledby={headingId} className="py-6 sm:py-8">
      <SectionHeader id={headingId} title={aisle.name} href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(aisle.id)}`} />
      <ScrollRow label={aisle.name}>
        {products.map((product) => (
          <li key={product.id} className="w-44 shrink-0 snap-start sm:w-52">
            <ProductCard product={product} />
          </li>
        ))}
      </ScrollRow>
    </section>
  )
}

/** Una fila por cada uno de los pasillos más grandes, como las góndolas del súper. */
export function MarketAisleRows({ limit = 3 }: { limit?: number }) {
  const mounted = useHydrated()
  const { tenantSlug, tenantPrefix } = useTenantPrefix()
  const { aisles } = useAisles(limit)
  if (!mounted || aisles.length === 0) return null

  return (
    <div className="border-b bg-background">
      <div className="container mx-auto divide-y divide-border/60 px-4 sm:px-6 lg:px-8">
        {aisles.map((aisle) => (
          <MarketAisleRow key={aisle.id} aisle={aisle} tenantSlug={tenantSlug} tenantPrefix={tenantPrefix} />
        ))}
      </div>
    </div>
  )
}

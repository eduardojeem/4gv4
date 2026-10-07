'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { AppImage as Image } from '@/components/ui/app-image'
import { useHydrated } from '@/hooks/use-hydrated'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { STOREFRONT_EYEBROW_CLASS, STOREFRONT_HEADING_CLASS } from '@/lib/website/storefront-style'
import { cn, formatPrice } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

/**
 * Una rutina armada con productos de la tienda: uno por categoría, con foto y
 * stock, priorizando ofertas y destacados. Si no hay al menos dos categorías
 * distintas, no hay rutina que mostrar.
 */
export function pickRoutineProducts(products: PublicProduct[], limit = 4): PublicProduct[] {
  const candidates = products.filter((product) => product.in_stock !== false && Boolean(product.image?.trim()) && product.category?.id)
  const rank = (product: PublicProduct) => (product.has_offer ? 0 : product.featured ? 1 : 2)
  const ordered = [...candidates].sort((a, b) => rank(a) - rank(b))
  const seen = new Set<string>()
  const picked: PublicProduct[] = []
  for (const product of ordered) {
    const categoryId = product.category!.id
    if (seen.has(categoryId)) continue
    seen.add(categoryId)
    picked.push(product)
    if (picked.length === limit) break
  }
  return picked.length >= 2 ? picked : []
}

function displayPrice(product: PublicProduct) {
  const sale = Number(product.sale_price) || 0
  const offer = Number(product.offer_price) || 0
  const onOffer = Boolean(product.has_offer) && offer > 0 && offer < sale
  return { price: onOffer ? offer : sale, original: onOffer ? sale : null }
}

export function BeautyRoutine() {
  const mounted = useHydrated()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { data } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const routine = mounted ? pickRoutineProducts(data ?? []) : []
  if (routine.length === 0) return null

  return (
    <section aria-labelledby="rutina-titulo" className="border-b border-border/70 bg-gradient-to-b from-pink-50/60 to-background py-12 dark:from-pink-950/10 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <span className={STOREFRONT_EYEBROW_CLASS.beauty}>
            <Sparkles aria-hidden="true" className="mr-1 inline h-3 w-3" />
            Paso a paso
          </span>
          <h2 id="rutina-titulo" className={cn('mt-3 text-2xl text-foreground sm:text-3xl lg:text-4xl', STOREFRONT_HEADING_CLASS.beauty)}>
            Armá tu rutina
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Una selección de nuestra tienda para empezar: un producto de cada categoría.
          </p>
        </div>

        <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {routine.map((product, index) => {
            const { price, original } = displayPrice(product)
            return (
              <li key={product.id}>
                <Link
                  href={`${tenantPrefix}/productos/${product.id}`}
                  className="group flex h-full flex-col rounded-3xl border border-pink-200/60 bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-pink-900/40 sm:p-4"
                >
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-pink-700 dark:text-pink-300">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs text-white">{index + 1}</span>
                    <span className="truncate">{product.category?.name}</span>
                  </span>
                  <span className="relative mt-3 block aspect-square overflow-hidden rounded-2xl bg-white">
                    <Image
                      src={resolveProductImageUrl(product.image)}
                      alt={product.name}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-3 line-clamp-2 text-sm text-foreground">{product.name}</span>
                  {hidesPublicPrice(product) ? (
                    <span className="mt-1 text-xs text-muted-foreground">Precio a consultar</span>
                  ) : (
                    <span className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">{formatPrice(price)}</span>
                      {original && <del className="text-xs tabular-nums text-muted-foreground">{formatPrice(original)}</del>}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 text-center">
          <Link
            href={`${tenantPrefix}/productos`}
            className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/70 px-5 py-2 text-sm text-foreground transition-colors hover:bg-pink-50 dark:hover:bg-pink-950/30"
          >
            Ver todos los productos <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default BeautyRoutine

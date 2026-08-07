'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/public/ProductCard'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import type { PublicProduct } from '@/types/public'

const fetcher = async (url: string): Promise<PublicProduct[]> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  const products = body?.data?.products
  if (!res.ok || !Array.isArray(products)) {
    throw new Error('Failed to fetch products')
  }
  return products as PublicProduct[]
}

/**
 * Storefront "featured products" grid for the public home. Pulls real catalog
 * products (newest first) scoped to the current tenant and reuses the public
 * ProductCard. Hidden entirely when the store has no products.
 */
export function FeaturedProducts() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const { data, error, isLoading } = useSWR(
    withOrgQuery('/api/public/products?per_page=8&sort=newest', tenantSlug),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])

  const products = data ?? []
  const effectiveIsLoading = !isMounted || isLoading

  // Nothing to sell yet → don't render an empty section.
  if (!effectiveIsLoading && (error || products.length === 0)) return null

  return (
    <section id="productos" className="bg-background py-16 md:py-20">
      <div className="container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Package className="h-3.5 w-3.5" />
              Catálogo
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Productos destacados
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo último que sumamos a la tienda.
            </p>
          </div>
          <Button asChild variant="outline" className="hidden shrink-0 gap-2 sm:inline-flex">
            <Link href={`${tenantPrefix}/productos`}>
              Ver todo el catálogo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {effectiveIsLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href={`${tenantPrefix}/productos`}>
              Ver todo el catálogo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

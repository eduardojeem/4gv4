'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Building2, Package } from 'lucide-react'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

type Org = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  products_count: number
  featured_products: PublicProduct[]
}

type Props = {
  organizations: Org[]
}

export function MarketplaceOrgProductGrid({ organizations }: Props) {
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)

  return (
    <>
      {organizations.map((org) => (
        <section key={org.id} className="border-t border-slate-100 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {org.logo_url ? (
                    <Image
                      src={org.logo_url}
                      alt={org.name}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">{org.name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {org.products_count} productos
                  </p>
                </div>
              </div>
              <Link
                href={`/${org.slug}/inicio`}
                className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
              >
                Ir a la tienda
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {org.featured_products.slice(0, 5).map((product) => {
                const imageSrc = resolveProductImageUrl(product.image)
                // Build a MarketplaceProduct-compatible object for the modal
                const asMarketplace: MarketplaceProduct = {
                  ...product,
                  organization_id: org.id,
                  organization_name: org.name,
                  organization_slug: org.slug,
                }
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelected(asMarketplace)}
                    aria-label={`Ver ${product.name}`}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-all hover:border-cyan-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                          sizes="200px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {product.name}
                      </p>
                      <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                        {formatPrice(product.sale_price)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
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

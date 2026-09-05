'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Building2, Eye, Package, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import { FavoriteButton } from './Favorites'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

type Org = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  city?: string | null
  address?: string | null
  maps_url?: string | null
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
                  organization_logo_url: org.logo_url ?? null,
                  organization_city: org.city ?? null,
                  organization_address: org.address ?? null,
                  organization_maps_url: org.maps_url ?? null,
                }
                return (
                  <div
                    key={product.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md shadow-2xs p-3"
                  >
                    {/* Imagen (clic abre el detalle) */}
                    <div className="absolute right-2 top-2 z-20"><FavoriteButton item={{ productId: product.id, slug: org.slug, name: product.name, store: org.name, image: product.image, price: product.sale_price }} /></div>
                    <div
                      onClick={() => setSelected(asMarketplace)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(asMarketplace) }}
                      aria-label={`Ver detalle de ${product.name}`}
                      className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/40 cursor-pointer"
                    >
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          sizes="200px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-7 w-7 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-1 flex-col justify-between">
                      <div>
                        <h4
                          onClick={() => setSelected(asMarketplace)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(asMarketplace) }}
                          className="line-clamp-2 text-xs font-semibold leading-snug text-foreground transition-colors hover:text-primary cursor-pointer"
                        >
                          {product.name}
                        </h4>
                      </div>

                      <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {formatPrice(product.sale_price)}
                        </p>

                        <div className="grid grid-cols-2 gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelected(asMarketplace)}
                            className="h-7 rounded-lg text-[11px] font-semibold gap-1 px-1.5 hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Detalle</span>
                          </Button>

                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-lg text-[11px] font-semibold gap-1 px-1.5 border-border/80 hover:bg-primary/10 hover:text-primary"
                          >
                            <Link href={`/${org.slug}/productos/${product.id}`}>
                              <span>Tienda</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
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

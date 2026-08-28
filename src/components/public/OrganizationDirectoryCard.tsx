import Image from 'next/image'
import Link from 'next/link'
import { Building2, ExternalLink, Package, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

type Props = {
  organization: MarketplaceOrganization
  className?: string
}

export function OrganizationDirectoryCard({ organization, className }: Props) {
  const storeUrl = `/${organization.slug}/inicio`
  const previewProducts = organization.featured_products.slice(0, 3)

  return (
    <Link
      href={storeUrl}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_8px_28px_-4px_rgba(6,182,212,0.18)]',
        'dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700',
        className
      )}
    >
      {/* Product preview thumbnails + logo overlay */}
      <div className="relative grid h-28 grid-cols-3 overflow-visible bg-slate-100 dark:bg-slate-900">
        {previewProducts.length > 0 ? (
          previewProducts.map((product, i) => {
            const src = resolveProductImageUrl(product.image)
            return (
              <div key={product.id} className={cn('relative overflow-hidden', i === 0 && previewProducts.length === 1 && 'col-span-3')}>
                {src ? (
                  <Image
                    src={src}
                    alt={product.name}
                    fill
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    sizes="120px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="col-span-3 flex items-center justify-center">
            <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
        )}

        {/* Logo superpuesto */}
        <div className="absolute -bottom-5 left-3 z-10 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900">
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 font-bold text-xs text-white">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 px-4 pt-7 pb-3">
        <h3 className="truncate font-semibold text-slate-900 dark:text-slate-50">{organization.name}</h3>
        <p className="truncate text-xs text-slate-400 dark:text-slate-500">/{organization.slug}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Package className="h-3 w-3" />
          {organization.products_count} producto{organization.products_count !== 1 ? 's' : ''}
        </p>
        {(organization.review_count ?? 0) > 0 && (
          <p className={cn(
            'mt-1 flex items-center gap-1 text-xs',
            Number(organization.review_rating_avg ?? 0) < 3
              ? 'text-red-500 dark:text-red-400'
              : Number(organization.review_rating_avg ?? 0) < 4
                ? 'text-orange-500 dark:text-orange-400'
                : 'text-slate-500 dark:text-slate-400'
          )}>
            <Star className={cn(
              'h-3 w-3',
              Number(organization.review_rating_avg ?? 0) < 3
                ? 'fill-red-400 text-red-400'
                : Number(organization.review_rating_avg ?? 0) < 4
                  ? 'fill-orange-400 text-orange-400'
                  : 'fill-yellow-400 text-yellow-400'
            )} />
            {Number(organization.review_rating_avg ?? 0).toFixed(1)}
            <span className="text-slate-400">({organization.review_count})</span>
            {Number(organization.review_rating_avg ?? 0) < 3 && (
              <span className="ml-1 text-[10px] font-medium text-red-500">⚠️</span>
            )}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Visitar tienda</span>
        <ExternalLink className="h-3.5 w-3.5 text-cyan-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-cyan-400" />
      </div>
    </Link>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { Building2, ExternalLink, Package } from 'lucide-react'
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
      {/* Product preview thumbnails */}
      <div className="grid h-28 grid-cols-3 overflow-hidden bg-slate-100 dark:bg-slate-900">
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
      </div>

      {/* Body */}
      <div className="flex flex-1 items-start gap-3 p-4">
        {/* Logo */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {organization.logo_url ? (
            <Image
              src={organization.logo_url}
              alt={organization.name}
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          ) : (
            <Building2 className="h-5 w-5 text-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-50">{organization.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">/{organization.slug}</p>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Package className="h-3 w-3" />
            {organization.products_count} producto{organization.products_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Visitar tienda</span>
        <ExternalLink className="h-3.5 w-3.5 text-cyan-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-cyan-400" />
      </div>
    </Link>
  )
}

import Link from 'next/link'
import { Tag, ArrowRight } from 'lucide-react'
import type { MarketplaceBrand } from '@/lib/public/marketplace'

// Paletas de letras para el avatar de marca
const LETTER_PALETTES = [
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
]

function getBrandPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return LETTER_PALETTES[Math.abs(hash) % LETTER_PALETTES.length]
}

type MarketplaceBrandsSectionProps = {
  brands: MarketplaceBrand[]
  /** compact = carrusel horizontal (para la home), full = grid (para la página de categorías) */
  variant?: 'carousel' | 'grid'
  title?: string
  subtitle?: string
  showViewAll?: boolean
  maxItems?: number
}

export function MarketplaceBrandsSection({
  brands,
  variant = 'carousel',
  title = 'Explorar por marca',
  subtitle = 'Encontrá productos de tus marcas favoritas',
  showViewAll = true,
  maxItems,
}: MarketplaceBrandsSectionProps) {
  if (brands.length === 0) return null

  const displayBrands = maxItems ? brands.slice(0, maxItems) : brands

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        {showViewAll && brands.length > (maxItems ?? 0) && (
          <Link
            href="/marketplace/productos"
            className="hidden items-center gap-1 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400 sm:flex"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Carousel variant */}
      {variant === 'carousel' && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {displayBrands.map((brand, i) => {
            const palette = getBrandPalette(brand.name)
            const initial = brand.name.charAt(0).toUpperCase()
            const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

            return (
              <Link
                key={brand.name}
                href={href}
                style={{ scrollSnapAlign: 'start' }}
                className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-700"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold transition-transform duration-200 group-hover:scale-110 ${palette}`}>
                  {initial}
                </div>
                <span className="max-w-[80px] truncate text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {brand.name}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {brand.product_count} productos
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Grid variant */}
      {variant === 'grid' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {displayBrands.map((brand) => {
            const palette = getBrandPalette(brand.name)
            const initial = brand.name.charAt(0).toUpperCase()
            const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

            return (
              <Link
                key={brand.name}
                href={href}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-violet-700"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black transition-transform duration-300 group-hover:scale-110 ${palette}`}>
                  {initial}
                </div>
                <div>
                  <p className="line-clamp-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {brand.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {brand.product_count} producto{brand.product_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

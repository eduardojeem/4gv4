'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { 
  Tag, 
  ArrowRight, 
  Search, 
  X, 
  Star, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MarketplaceBrand } from '@/lib/public/marketplace'

// Paletas de letras y auras de brillo para el avatar de marca
const BRAND_PALETTES = [
  { avatar: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400', glow: 'bg-cyan-500' },
  { avatar: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', glow: 'bg-violet-500' },
  { avatar: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', glow: 'bg-amber-500' },
  { avatar: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', glow: 'bg-emerald-500' },
  { avatar: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400', glow: 'bg-rose-500' },
  { avatar: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', glow: 'bg-blue-500' },
  { avatar: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400', glow: 'bg-fuchsia-500' },
  { avatar: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400', glow: 'bg-orange-500' },
  { avatar: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400', glow: 'bg-teal-500' },
  { avatar: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400', glow: 'bg-indigo-500' },
]

function getBrandPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return BRAND_PALETTES[Math.abs(hash) % BRAND_PALETTES.length]
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

const PAGE_SIZE = 25

export function MarketplaceBrandsSection({
  brands,
  variant = 'carousel',
  title = 'Explorar por marca',
  subtitle = 'Encontrá productos de tus marcas favoritas',
  showViewAll = true,
  maxItems,
}: MarketplaceBrandsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Resetear página al buscar
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Filtrar marcas
  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return brands
    return brands.filter((b) => b.name.toLowerCase().includes(query))
  }, [brands, searchQuery])

  // Calcular paginación para la grilla
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE

  // Marcas a mostrar en base a variante
  const displayBrands = useMemo(() => {
    if (variant === 'grid') {
      return filteredBrands.slice(startIndex, startIndex + PAGE_SIZE)
    }
    return maxItems ? filteredBrands.slice(0, maxItems) : filteredBrands
  }, [variant, filteredBrands, startIndex, maxItems])

  // Guard: debe ir despues de todos los hooks (rules-of-hooks)
  if (brands.length === 0) return null

  return (
    <div className="space-y-6">
      
      {/* ── Header de Marcas ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        {/* Buscador de Marcas (visible en grid) */}
        {variant === 'grid' && (
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar marca..."
              className="h-9 rounded-xl pl-9 pr-8 text-xs border-slate-200/60 focus-visible:ring-cyan-500 bg-white/70 dark:bg-slate-900/60 dark:border-slate-800/80"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {showViewAll && brands.length > (maxItems ?? 0) && !searchQuery && (
          <Link
            href="/marketplace/productos"
            className="hidden items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 sm:flex"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* ── Variant: Carousel (Horizontal) ── */}
      {variant === 'carousel' && (
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide snap-x">
          {displayBrands.map((brand) => {
            const palette = getBrandPalette(brand.name)
            const initial = brand.name.charAt(0).toUpperCase()
            const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

            return (
              <Link
                key={brand.name}
                href={href}
                aria-label={`Ver productos de la marca ${brand.name}, tiene ${brand.product_count} productos`}
                className="group relative flex shrink-0 snap-start flex-col items-center gap-2.5 rounded-2xl border border-slate-200/50 bg-white/70 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800/40 dark:bg-slate-950/60 dark:hover:border-cyan-700/50"
              >
                {/* Orbe de brillo trasero */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 ${palette.glow}`} />

                <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold transition-transform duration-300 group-hover:scale-105 ${palette.avatar}`}>
                  {initial}
                </div>
                <span className="max-w-[80px] truncate text-center text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {brand.name}
                </span>
                <span className="rounded-full bg-slate-50 border border-slate-200/20 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {brand.product_count} productos
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Variant: Grid ── */}
      {variant === 'grid' && (
        displayBrands.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {displayBrands.map((brand) => {
                const palette = getBrandPalette(brand.name)
                const initial = brand.name.charAt(0).toUpperCase()
                const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

                return (
                  <Link
                    key={brand.name}
                    href={href}
                    aria-label={`Ver productos de la marca ${brand.name}, tiene ${brand.product_count} productos`}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-slate-200/50 bg-white/70 p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg dark:border-slate-800/40 dark:bg-slate-950/60 dark:hover:border-cyan-700/50"
                  >
                    {/* Orbe de brillo trasero */}
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 ${palette.glow}`} />

                    <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold transition-all duration-300 group-hover:scale-105 shadow-sm ${palette.avatar}`}>
                      {initial}
                    </div>
                    <div className="relative">
                      <p className="line-clamp-1 text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
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

            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-center gap-2 pt-4">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all ${
                        safePage === n
                          ? 'border-cyan-500 bg-cyan-600 text-white shadow-sm'
                          : 'border-slate-200/60 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/60'
                      }`}
                      aria-label={`Página ${n}`}
                      aria-current={safePage === n ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  Mostrando {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredBrands.length)} de {filteredBrands.length} marcas
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Empty State marcas */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/50 bg-white/40 py-16 text-center dark:border-slate-800/40 dark:bg-slate-900/20 max-w-md mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900 mb-4">
              <Star className="h-6 w-6 text-slate-350 dark:text-slate-600 animate-spin duration-[8000ms]" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              No se encontraron marcas
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No hay marcas asociadas que coincidan con "{searchQuery}".
            </p>
          </div>
        )
      )}
    </div>
  )
}

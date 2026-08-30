'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Tag,
  ArrowRight,
  Search,
  X,
  Star,
  ChevronLeft,
  ChevronRight,
  Store,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MarketplaceBrand } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

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

function BrandLogo({
  brand,
  size = 'md',
}: {
  brand: MarketplaceBrand
  size?: 'sm' | 'md' | 'lg'
}) {
  const [imageError, setImageError] = useState(false)
  const palette = getBrandPalette(brand.name)
  const initial = brand.name.charAt(0).toUpperCase()
  const logoUrl = brand.logo_url?.trim()

  const sizeClasses = {
    sm: 'h-10 w-10 text-sm rounded-xl',
    md: 'h-12 w-12 text-base rounded-xl',
    lg: 'h-14 w-14 text-xl rounded-2xl',
  }[size]

  if (logoUrl && !imageError) {
    return (
      <div className={cn('relative shrink-0 overflow-hidden border border-border/80 bg-white p-1.5 shadow-xs transition-transform duration-200 group-hover:scale-105 dark:bg-slate-900', sizeClasses)}>
        <Image
          src={logoUrl}
          alt={`Logo de ${brand.name}`}
          fill
          unoptimized
          sizes="64px"
          onError={() => setImageError(true)}
          className="object-contain p-1"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center font-extrabold shadow-xs transition-transform duration-200 group-hover:scale-105',
        sizeClasses,
        palette.avatar
      )}
    >
      {initial}
    </div>
  )
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

const PAGE_SIZE = 24

export function MarketplaceBrandsSection({
  brands,
  variant = 'carousel',
  title = 'Explorar por marca',
  subtitle = 'Encontrá productos de las principales marcas del catálogo',
  showViewAll = true,
  maxItems,
}: MarketplaceBrandsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Resetear página al buscar
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Filtrar marcas activas (solo marcas con productos disponibles)
  const activeBrands = useMemo(() => {
    return brands.filter((b) => b.product_count > 0)
  }, [brands])

  // Filtrar marcas por búsqueda
  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return activeBrands
    return activeBrands.filter((b) => b.name.toLowerCase().includes(query))
  }, [activeBrands, searchQuery])

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
  if (activeBrands.length === 0) return null

  return (
    <div className="space-y-6">
      {/* ── Header de Marcas ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Buscador de Marcas (visible en grid) */}
        {variant === 'grid' && (
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar marca..."
              className="h-9 rounded-xl pl-9 pr-8 text-xs border-border/80 bg-background focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {showViewAll && activeBrands.length > (maxItems ?? 0) && !searchQuery && (
          <Link
            href="/marketplace/productos"
            className="hidden items-center gap-1 text-xs font-semibold text-primary hover:underline sm:flex"
          >
            Ver todos los productos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* ── Variant: Carousel (Horizontal) ── */}
      {variant === 'carousel' && (
        <div className="flex gap-3.5 overflow-x-auto pb-3 scrollbar-hide snap-x">
          {displayBrands.map((brand) => {
            const palette = getBrandPalette(brand.name)
            const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

            return (
              <Link
                key={brand.name}
                href={href}
                aria-label={`Ver productos de la marca ${brand.name}, tiene ${brand.product_count} productos`}
                className="group relative flex shrink-0 snap-start flex-col items-center gap-2.5 rounded-2xl border border-border/80 bg-card px-5 py-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
              >
                {/* Orbe de brillo trasero */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 ${palette.glow}`} />

                <BrandLogo brand={brand} size="md" />

                <span className="max-w-[90px] truncate text-center text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {brand.name}
                </span>

                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {brand.product_count} {brand.product_count === 1 ? 'producto' : 'productos'}
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
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {displayBrands.map((brand) => {
                const palette = getBrandPalette(brand.name)
                const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

                return (
                  <Link
                    key={brand.name}
                    href={href}
                    aria-label={`Ver productos de la marca ${brand.name}, tiene ${brand.product_count} productos`}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border/80 bg-card p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                  >
                    {/* Orbe de brillo trasero */}
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 ${palette.glow}`} />

                    <BrandLogo brand={brand} size="lg" />

                    <div className="relative min-w-0 w-full">
                      <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {brand.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {brand.product_count} {brand.product_count === 1 ? 'producto' : 'productos'}
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
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCurrentPage(n)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all',
                        safePage === n
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border/80 bg-background text-foreground hover:bg-muted'
                      )}
                      aria-label={`Página ${n}`}
                      aria-current={safePage === n ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Mostrando {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredBrands.length)} de {filteredBrands.length} marcas
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Empty State marcas */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card max-w-md mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
              <Star className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
              No se encontraron marcas
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              No hay marcas con productos activos que coincidan con &ldquo;{searchQuery}&rdquo;.
            </p>
          </div>
        )
      )}
    </div>
  )
}

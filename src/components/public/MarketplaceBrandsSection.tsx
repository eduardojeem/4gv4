'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Tag,
  ArrowRight,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Store,
  Package,
  Sparkles,
  Play,
  Pause,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MarketplaceBrand } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

// Paletas de letras y auras de brillo para el avatar de marca
const BRAND_PALETTES = [
  { avatar: 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/60', glow: 'bg-cyan-500' },
  { avatar: 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/60', glow: 'bg-violet-500' },
  { avatar: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60', glow: 'bg-amber-500' },
  { avatar: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60', glow: 'bg-emerald-500' },
  { avatar: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60', glow: 'bg-rose-500' },
  { avatar: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60', glow: 'bg-blue-500' },
  { avatar: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-800/60', glow: 'bg-fuchsia-500' },
  { avatar: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60', glow: 'bg-orange-500' },
  { avatar: 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60', glow: 'bg-teal-500' },
  { avatar: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60', glow: 'bg-indigo-500' },
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
  const initial = brand.name.trim().charAt(0).toUpperCase() || 'M'
  const logoUrl = brand.logo_url?.trim()

  const sizeClasses = {
    sm: 'h-10 w-10 text-sm rounded-xl',
    md: 'h-13 w-13 text-base rounded-2xl',
    lg: 'h-16 w-16 text-xl rounded-2xl',
  }[size]

  if (logoUrl && !imageError) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden border border-border/80 bg-white p-1.5 shadow-xs transition-transform duration-300 group-hover:scale-105 group-hover:rotate-1 dark:border-border/60 dark:bg-slate-900',
          sizeClasses
        )}
      >
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
        'relative flex shrink-0 items-center justify-center font-black tracking-tight border shadow-xs transition-transform duration-300 group-hover:scale-105 group-hover:rotate-1',
        sizeClasses,
        palette.avatar
      )}
    >
      {initial}
    </div>
  )
}

function MarqueeVerticalBrandCard({
  brand,
  tabIndex,
}: {
  brand: MarketplaceBrand
  tabIndex?: number
}) {
  const palette = getBrandPalette(brand.name)
  const href = `/marketplace/productos?marca=${encodeURIComponent(brand.name)}`

  return (
    <Link
      href={href}
      tabIndex={tabIndex}
      aria-label={`Ver productos de la marca ${brand.name}, tiene ${brand.product_count} productos`}
      className="group relative flex h-[180px] sm:h-[195px] w-36 sm:w-44 shrink-0 flex-col items-center justify-between rounded-2xl border border-border/80 bg-card p-4 text-center transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 dark:bg-card/80 dark:hover:bg-card"
    >
      {/* Orbe de brillo trasero con respiración suave */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl opacity-0 blur-xl transition-all duration-500 group-hover:opacity-20',
          palette.glow
        )}
      />

      {/* Encabezado: Logo y Nombre */}
      <div className="relative flex flex-col items-center gap-2.5 w-full">
        <BrandLogo brand={brand} size="md" />

        <div className="w-full min-w-0">
          <span className="block truncate text-xs sm:text-sm font-bold text-foreground transition-colors group-hover:text-primary">
            {brand.name}
          </span>
          {brand.organization_count > 1 ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Store className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />
              {brand.organization_count} tiendas
            </span>
          ) : (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
              Catálogo oficial
            </span>
          )}
        </div>
      </div>

      {/* Pie: Conteo y Microacción con animación fluida */}
      <div className="relative flex w-full items-center justify-between border-t border-border/50 pt-2">
        <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {brand.product_count} {brand.product_count === 1 ? 'prod.' : 'prods.'}
        </span>

        <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary opacity-0 -translate-x-1.5 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
          Ver
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}

type MarketplaceBrandsSectionProps = {
  brands: MarketplaceBrand[]
  /** compact = carrusel horizontal / marquee (para la home), full = grid (para la página de categorías) */
  variant?: 'carousel' | 'grid'
  title?: string
  subtitle?: string
  showViewAll?: boolean
  viewAllHref?: string
  maxItems?: number
}

const PAGE_SIZE = 24

export function MarketplaceBrandsSection({
  brands,
  variant = 'carousel',
  title = 'Explorar por marca',
  subtitle = 'Encontrá productos de las principales marcas del catálogo',
  showViewAll = true,
  viewAllHref = '/marketplace/categorias#marcas',
  maxItems,
}: MarketplaceBrandsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'popular' | 'alpha' | 'stores'>('popular')
  const [currentPage, setCurrentPage] = useState(1)
  const [isPaused, setIsPaused] = useState(false)

  // Resetear página al buscar o cambiar de orden
  const filterKey = JSON.stringify([searchQuery, sortBy])
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey)
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey)
    setCurrentPage(1)
  }

  // Filtrar marcas activas (solo marcas con productos disponibles)
  const activeBrands = useMemo(() => {
    return brands.filter((b) => b.product_count > 0)
  }, [brands])

  // Lista base para el marquee garantizando flujo continuo sin vacíos (mínimo 8 elementos)
  const baseList = useMemo(() => {
    if (activeBrands.length === 0) return []
    let list = [...activeBrands]
    while (list.length < 8) {
      list = [...list, ...activeBrands]
    }
    return maxItems ? list.slice(0, Math.max(8, maxItems)) : list
  }, [activeBrands, maxItems])

  // Velocidad constante del marquee idéntica a Empresas Asociadas
  const animationDuration = useMemo(() => {
    return `${Math.max(28, baseList.length * 3.5)}s`
  }, [baseList.length])

  // Filtrar y ordenar marcas para la cuadrícula
  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const list = query
      ? activeBrands.filter((b) => b.name.toLowerCase().includes(query))
      : activeBrands

    if (variant === 'grid') {
      return [...list].sort((a, b) => {
        if (sortBy === 'alpha') {
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        }
        if (sortBy === 'stores') {
          return (b.organization_count ?? 0) - (a.organization_count ?? 0) || b.product_count - a.product_count
        }
        // default: popular (mayor cantidad de productos)
        return b.product_count - a.product_count || a.name.localeCompare(b.name, 'es')
      })
    }

    return list
  }, [activeBrands, searchQuery, variant, sortBy])

  // Calcular paginación para la grilla
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE

  // Marcas a mostrar en la cuadrícula
  const displayBrands = useMemo(() => {
    if (variant === 'grid') {
      return filteredBrands.slice(startIndex, startIndex + PAGE_SIZE)
    }
    return maxItems ? filteredBrands.slice(0, maxItems) : filteredBrands
  }, [variant, filteredBrands, startIndex, maxItems])

  // Guard: DEBE ir después de todos los hooks para respetar estrictamente las reglas de React
  if (activeBrands.length === 0) return null

  return (
    <div className="space-y-6">
      {/* ── Header de Marcas ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Tag className="h-4 w-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              {title}
            </h2>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
              {activeBrands.length}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Buscador de Marcas (visible en grid) */}
        {variant === 'grid' && (
          <div className="relative w-full sm:max-w-[260px]">
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Acciones del Carrusel con movimiento continuo idéntico a Empresas Asociadas */}
        {variant === 'carousel' && (
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Pill indicador de movimiento continuo */}
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all border shadow-2xs',
                !isPaused
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted'
              )}
              title={!isPaused ? 'Pausar movimiento automático' : 'Activar movimiento automático'}
              aria-label={!isPaused ? 'Estado del carrusel: en movimiento' : 'Estado del carrusel: pausado'}
            >
              <span className="relative flex h-2 w-2">
                {!isPaused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    !isPaused ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  )}
                />
              </span>
              <span>{!isPaused ? 'En movimiento' : 'Pausado'}</span>
            </button>

            {/* Botón de Play/Pausa de movimiento */}
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={!isPaused ? 'Pausar movimiento automático' : 'Reanudar movimiento automático'}
              title={!isPaused ? 'Pausar movimiento' : 'Reanudar movimiento'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-background shadow-xs transition-all hover:bg-muted',
                !isPaused ? 'text-primary border-primary/40' : 'text-muted-foreground'
              )}
            >
              {!isPaused ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </button>

            {showViewAll && (
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                <span>Ver todas las marcas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Variante: Carousel (Marquee continuo manteniendo el diseño vertical de tarjetas) ── */}
      {variant === 'carousel' && (
        <div className="relative w-full overflow-hidden select-none py-1">
          {/* Sombras laterales de desvanecimiento para entrada y salida impecables */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28 bg-gradient-to-l from-background to-transparent" />

          {/* Pista continua con animación de movimiento de derecha a izquierda y pausa en hover */}
          <div
            className="flex w-max items-center gap-4 py-3 animate-marquee-left hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{
              animationDuration,
              animationPlayState: isPaused ? 'paused' : undefined,
            }}
          >
            {/* Pista 1 */}
            <div className="flex shrink-0 items-center gap-4">
              {baseList.map((brand, idx) => (
                <MarqueeVerticalBrandCard
                  key={`track1-${brand.name}-${idx}`}
                  brand={brand}
                />
              ))}
            </div>

            {/* Pista 2 (Duplicado idéntico para bucle infinito continuo) */}
            <div className="flex shrink-0 items-center gap-4" aria-hidden="true">
              {baseList.map((brand, idx) => (
                <MarqueeVerticalBrandCard
                  key={`track2-${brand.name}-${idx}`}
                  brand={brand}
                  tabIndex={-1}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Variante: Grid ── */}
      {variant === 'grid' && (
        <div className="space-y-6">
          {/* Barra de herramientas: Filtros de ordenamiento y contador */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/50 p-1 w-fit">
              <button
                type="button"
                onClick={() => setSortBy('popular')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  sortBy === 'popular'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Más populares
              </button>
              <button
                type="button"
                onClick={() => setSortBy('alpha')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  sortBy === 'alpha'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                A - Z
              </button>
              <button
                type="button"
                onClick={() => setSortBy('stores')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  sortBy === 'stores'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Store className="h-3.5 w-3.5 text-cyan-500" />
                Más tiendas
              </button>
            </div>

            <div className="text-xs font-medium text-muted-foreground">
              {searchQuery ? (
                <span>
                  {filteredBrands.length} marca{filteredBrands.length === 1 ? '' : 's'} encontrada{filteredBrands.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span>{activeBrands.length} marcas disponibles</span>
              )}
            </div>
          </div>

          {displayBrands.length > 0 ? (
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
                      className="group relative flex h-[210px] sm:h-[225px] flex-col items-center justify-between rounded-2xl border border-border/80 bg-card p-4 text-center transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 dark:bg-card/80 dark:hover:bg-card"
                    >
                      {/* Orbe de brillo trasero */}
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-0 rounded-2xl opacity-0 blur-xl transition-all duration-500 group-hover:opacity-20',
                          palette.glow
                        )}
                      />

                      <BrandLogo brand={brand} size="lg" />

                      <div className="relative min-w-0 w-full space-y-1">
                        <p className="truncate text-sm sm:text-base font-bold text-foreground transition-colors group-hover:text-primary">
                          {brand.name}
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                            <Package className="h-3 w-3" />
                            {brand.product_count} {brand.product_count === 1 ? 'producto' : 'productos'}
                          </span>
                          {brand.organization_count > 1 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                              <Store className="h-3 w-3" />
                              {brand.organization_count} tiendas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full items-center justify-center border-t border-border/50 pt-2 text-xs font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100">
                        <span className="flex items-center gap-1">
                          Explorar marca
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
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
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Mostrando {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredBrands.length)} de {filteredBrands.length} marcas
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Estado Vacío de marcas */
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 p-10 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  No se encontraron marcas
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  No hay marcas activas que coincidan con &ldquo;{searchQuery}&rdquo;.
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

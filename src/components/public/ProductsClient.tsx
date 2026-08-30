'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowDownAZ,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  FolderTree,
  LayoutGrid,
  LayoutList,
  Package,
  Search,
  Sparkles,
  Store,
  Tag,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct, MarketplaceCategory, MarketplaceBrand } from '@/lib/public/marketplace'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import { cn } from '@/lib/utils'

type SortKey = 'default' | 'price_asc' | 'price_desc' | 'discount_desc' | 'newest' | 'name_asc'
type ViewMode = 'grid' | 'compact'

const PAGE_SIZE = 24

type Props = {
  products: MarketplaceProduct[]
  categories?: MarketplaceCategory[]
  brands?: MarketplaceBrand[]
  initialQuery?: string
  initialCategory?: string
  initialSubcategory?: string
  initialBrand?: string
}

const SORT_OPTIONS: { id: SortKey; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'default', label: 'Relevancia y destacados', shortLabel: 'Relevancia', icon: Sparkles },
  { id: 'price_asc', label: 'Precio: menor a mayor', shortLabel: 'Menor precio', icon: ArrowDownNarrowWide },
  { id: 'price_desc', label: 'Precio: mayor a menor', shortLabel: 'Mayor precio', icon: ArrowUpNarrowWide },
  { id: 'discount_desc', label: 'Mayores descuentos (%)', shortLabel: 'Más descuento', icon: Flame },
  { id: 'newest', label: 'Más recientes añadidos', shortLabel: 'Más recientes', icon: Clock },
  { id: 'name_asc', label: 'Nombre (A – Z)', shortLabel: 'Nombre A–Z', icon: ArrowDownAZ },
]

export function ProductsClient({
  products,
  categories = [],
  brands = [],
  initialQuery = '',
  initialCategory = '',
  initialSubcategory = '',
  initialBrand = '',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(initialQuery)
  const [onlyOffers, setOnlyOffers] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')
  const [sortOpen, setSortOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  
  const sortRef = useRef<HTMLDivElement>(null)
  const gridTopRef = useRef<HTMLDivElement>(null)
  const lastFiltersRef = useRef({
    query: initialQuery,
    category: initialCategory,
    subcategory: initialSubcategory,
    brand: initialBrand,
  })

  // Cerrar dropdown de ordenamiento al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false)
      }
    }
    if (sortOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [sortOpen])

  // ─── Sincronización del Buscador con URL (Debounce) ─────────────────────────
  useEffect(() => {
    const trimmedQuery = query.trim()
    const urlQuery = searchParams.get('q') ?? ''

    if (trimmedQuery === urlQuery) return

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (trimmedQuery) {
        params.set('q', trimmedQuery)
      } else {
        params.delete('q')
      }
      setPage(1)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, 400)

    return () => clearTimeout(handler)
  }, [query, router, pathname, searchParams])

  // Resetear página local al cambiar filtros o ordenamientos locales
  useEffect(() => {
    setPage(1)
  }, [onlyOffers, sort])

  // Sincronizar inputs si cambian los parámetros en la URL
  useEffect(() => {
    const filtersChanged =
      lastFiltersRef.current.query !== initialQuery ||
      lastFiltersRef.current.category !== initialCategory ||
      lastFiltersRef.current.subcategory !== initialSubcategory ||
      lastFiltersRef.current.brand !== initialBrand

    if (filtersChanged) {
      setQuery(initialQuery)
      setPage(1)
      lastFiltersRef.current = {
        query: initialQuery,
        category: initialCategory,
        subcategory: initialSubcategory,
        brand: initialBrand,
      }
    }
  }, [initialQuery, initialCategory, initialSubcategory, initialBrand])

  // ─── Funciones para actualizar filtros en URL ──────────────────────────────
  const updateUrlParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (key === 'categoria' && !value) {
      params.delete('subcategoria')
    }
    setPage(1)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const clearAllFilters = () => {
    setQuery('')
    setOnlyOffers(false)
    setSort('default')
    setPage(1)
    router.push(pathname, { scroll: false })
  }

  // ─── Subcategorías (Hijos) de la Categoría Activa ────────────────────────────
  const activeCategory = useMemo(() => {
    if (!initialCategory) return null
    return categories.find((c) => c.id === initialCategory) ?? null
  }, [categories, initialCategory])

  const childSubcategories = useMemo(() => {
    if (!initialCategory) return []
    return categories.filter((c) => c.parent_id === initialCategory && c.id !== initialCategory)
  }, [categories, initialCategory])

  // ─── Marcas contextuales (Marcas presentes en los productos actuales) ────────
  const contextBrands = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((p) => {
      const b = p.brand?.trim()
      if (b) {
        map.set(b, (map.get(b) ?? 0) + 1)
      }
    })

    if (map.size > 0) {
      return Array.from(map.entries())
        .map(([name, count]) => {
          const brandMeta = brands.find((b) => b.name.toLowerCase() === name.toLowerCase())
          return {
            name,
            count,
            logo_url: brandMeta?.logo_url,
          }
        })
        .sort((a, b) => b.count - a.count)
    }

    return brands
      .filter((b) => b.product_count > 0)
      .map((b) => ({ name: b.name, count: b.product_count, logo_url: b.logo_url }))
  }, [products, brands])

  // ─── Filtrado y Ordenamiento Local ──────────────────────────────────────────
  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price).length,
    [products]
  )

  const currentSortOption = useMemo(() => {
    return SORT_OPTIONS.find((s) => s.id === sort) ?? SORT_OPTIONS[0]
  }, [sort])

  const filtered = useMemo(() => {
    let result = products

    // Filtro por ofertas localmente
    if (onlyOffers) {
      result = result.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
    }

    // Ordenar localmente
    switch (sort) {
      case 'price_asc':
        result = [...result].sort((a, b) => {
          const pa = a.has_offer && a.offer_price ? a.offer_price : a.sale_price
          const pb = b.has_offer && b.offer_price ? b.offer_price : b.sale_price
          return pa - pb
        })
        break
      case 'price_desc':
        result = [...result].sort((a, b) => {
          const pa = a.has_offer && a.offer_price ? a.offer_price : a.sale_price
          const pb = b.has_offer && b.offer_price ? b.offer_price : b.sale_price
          return pb - pa
        })
        break
      case 'discount_desc':
        result = [...result].sort((a, b) => {
          const discA = a.has_offer && a.offer_price ? (1 - a.offer_price / a.sale_price) : 0
          const discB = b.has_offer && b.offer_price ? (1 - b.offer_price / b.sale_price) : 0
          return discB - discA
        })
        break
      case 'newest':
        result = [...result].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        break
      case 'name_asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        break
      case 'default':
      default:
        result = [...result].sort((a, b) => {
          if (a.featured && !b.featured) return -1
          if (!a.featured && b.featured) return 1
          if (a.has_offer && !b.has_offer) return -1
          if (!a.has_offer && b.has_offer) return 1
          return 0
        })
        break
    }

    return result
  }, [products, onlyOffers, sort])

  // ─── Paginación ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  function goToPage(p: number) {
    setPage(p)
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (safePage > 3) pages.push('…')
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i)
    if (safePage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  const hasAnyFilter = Boolean(
    query.trim() !== '' ||
    initialCategory !== '' ||
    initialSubcategory !== '' ||
    initialBrand !== '' ||
    onlyOffers ||
    sort !== 'default'
  )

  const gridClass =
    view === 'grid'
      ? 'grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      : 'grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

  const CurrentSortIcon = currentSortOption.icon

  return (
    <>
      {/* ── TOOLBAR DE BÚSQUEDA Y FILTROS ───────────────────────────────────── */}
      <div className="mb-8 space-y-4 bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        
        {/* Fila 1: Búsqueda + Selector de Marca + Toggle de Vista */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por producto, descripción o código..."
              className="h-10 rounded-xl pl-10 pr-9 text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Marca (Dropdown) */}
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select
                value={initialBrand}
                onChange={(e) => updateUrlParam('marca', e.target.value)}
                className="h-10 rounded-xl border border-border/80 bg-background px-3 py-1 text-xs font-semibold text-foreground outline-none transition-colors hover:border-primary/50"
                aria-label="Filtrar por marca"
              >
                <option value="">Todas las marcas</option>
                {contextBrands.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle de Vista */}
            <div className="flex items-center rounded-xl border border-border/80 bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                  view === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Vista cuadrícula"
                aria-pressed={view === 'grid'}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('compact')}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                  view === 'compact'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Vista compacta"
                aria-pressed={view === 'compact'}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Selector de Relevancia Mejorado, Ofertas y Conteo */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            
            {/* ── SELECTOR DE RELEVANCIA / ORDEN MODERNO Y PREMIUM ── */}
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 font-semibold transition-all shadow-xs select-none',
                  sort !== 'default'
                    ? 'border-primary/60 text-primary ring-1 ring-primary/20'
                    : 'border-border/80 text-foreground hover:border-primary/40'
                )}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                aria-label="Criterio de ordenamiento"
              >
                <CurrentSortIcon className={cn(
                  'h-3.5 w-3.5',
                  sort !== 'default' ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span>{currentSortOption.label}</span>
                <ChevronDown className={cn(
                  'h-3.5 w-3.5 opacity-60 transition-transform duration-200',
                  sortOpen && 'rotate-180'
                )} />
              </button>

              {/* Menú Desplegable Flotante */}
              {sortOpen && (
                <div className="absolute left-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ordenar productos por:
                  </div>
                  {SORT_OPTIONS.map((option) => {
                    const OptionIcon = option.icon
                    const isSelected = sort === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSort(option.id)
                          setSortOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground font-bold'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <OptionIcon className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                          <span className="truncate">{option.label}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Solo Ofertas */}
            {offersCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyOffers((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold transition-all shadow-xs',
                  onlyOffers
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400'
                    : 'border-border/80 bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                <Tag className="h-3.5 w-3.5 text-rose-500" />
                Ofertas
                <span className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums',
                  onlyOffers
                    ? 'bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {offersCount}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-muted-foreground">
              {filtered.length > 0 && (
                <span className="font-bold text-foreground tabular-nums">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}{' '}
                </span>
              )}
              de <strong className="text-foreground">{filtered.length}</strong> productos
            </p>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground shadow-xs"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Subcategorías / Ramas Hijas (si la categoría seleccionada tiene hijos) ── */}
        {initialCategory && childSubcategories.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
              <FolderTree className="h-3.5 w-3.5 text-primary" />
              <span>Subcategorías de {activeCategory?.name ?? 'la categoría'}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateUrlParam('subcategoria', '')}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                  !initialSubcategory
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border/80 bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                Todas las subcategorías
              </button>
              {childSubcategories.map((sub) => {
                const isSubActive = initialSubcategory === sub.id
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => updateUrlParam('subcategoria', isSubActive ? '' : sub.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border',
                      isSubActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <span>{sub.name}</span>
                    <span className={cn(
                      'rounded-full px-1.5 py-px text-[10px]',
                      isSubActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {sub.product_count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Franja de Marcas Rápidas / Sugerencias de Marcas ── */}
        {contextBrands.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span>
                  {initialCategory
                    ? `Marcas sugeridas en ${activeCategory?.name ?? 'esta categoría'}:`
                    : 'Marcas disponibles:'}
                </span>
              </div>

              {initialBrand && (
                <button
                  type="button"
                  onClick={() => updateUrlParam('marca', '')}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Ver todas las marcas
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
              <button
                type="button"
                onClick={() => updateUrlParam('marca', '')}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-xs',
                  !initialBrand
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'
                )}
              >
                Todas las marcas
              </button>

              {contextBrands.map((brand) => {
                const isBrandActive = initialBrand.toLowerCase() === brand.name.toLowerCase()
                return (
                  <button
                    key={brand.name}
                    type="button"
                    onClick={() => updateUrlParam('marca', isBrandActive ? '' : brand.name)}
                    className={cn(
                      'group shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs',
                      isBrandActive
                        ? 'border-violet-500 bg-violet-600 text-white ring-2 ring-violet-400/30'
                        : 'border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {brand.logo_url ? (
                      <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-md bg-white p-0.5 shadow-xs">
                        <Image
                          src={brand.logo_url}
                          alt=""
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <span className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase',
                        isBrandActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        {brand.name.charAt(0)}
                      </span>
                    )}
                    <span>{brand.name}</span>
                    <span className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums',
                      isBrandActive ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {brand.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Chips de Filtros Activos (Mostrados juntos al lado) ── */}
        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground">Filtros activos:</span>

            {/* Chip de Categoría */}
            {initialCategory && (
              <button
                type="button"
                onClick={() => updateUrlParam('categoria', '')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
              >
                <span>Categoría: {activeCategory?.name ?? products.find((p) => p.category?.id === initialCategory)?.category?.name ?? 'Seleccionada'}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Chip de Subcategoría */}
            {initialSubcategory && (
              <button
                type="button"
                onClick={() => updateUrlParam('subcategoria', '')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
              >
                <span>Subcategoría: {categories.find((c) => c.id === initialSubcategory)?.name ?? 'Seleccionada'}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Chip de Marca (Al lado de la categoría) */}
            {initialBrand && (
              <button
                type="button"
                onClick={() => updateUrlParam('marca', '')}
                className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <span>Marca: {initialBrand}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Chip de Búsqueda */}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted/80"
              >
                <span>Texto: &ldquo;{query}&rdquo;</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Chip de Ofertas */}
            {onlyOffers && (
              <button
                type="button"
                onClick={() => setOnlyOffers(false)}
                className="flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <span>Solo ofertas</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Chip de Orden Especial */}
            {sort !== 'default' && (
              <button
                type="button"
                onClick={() => setSort('default')}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80"
              >
                <span>Orden: {currentSortOption.shortLabel}</span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── GRID DE PRODUCTOS ───────────────────────────────────────────────── */}
      <div ref={gridTopRef} className="-mt-4 pt-4" />

      {filtered.length > 0 ? (
        <div className={gridClass}>
          {paginated.map((product) => {
            const imageSrc = resolveProductImageUrl(product.image)
            const hasOffer =
              product.has_offer &&
              product.offer_price != null &&
              product.offer_price < product.sale_price
            const displayPrice = hasOffer ? product.offer_price! : product.sale_price
            const discountPct = hasOffer
              ? Math.round((1 - product.offer_price! / product.sale_price) * 100)
              : 0
            const isCompact = view === 'compact'

            return (
              <button
                key={`${product.organization_slug}-${product.id}`}
                type="button"
                onClick={() => setSelected(product)}
                aria-label={`Ver ${product.name}`}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg',
                  isCompact ? 'p-3' : 'p-4'
                )}
              >
                {/* Imagen */}
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/40">
                  <Image
                    src={imageSrc}
                    alt={product.name}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Badges superiores */}
                  <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
                    {hasOffer && discountPct > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <Tag className="h-2.5 w-2.5" />
                        -{discountPct}%
                      </span>
                    )}
                    {product.featured && !hasOffer && (
                      <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <Sparkles className="h-2.5 w-2.5" />
                        Top
                      </span>
                    )}
                  </div>

                  {!product.in_stock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                      <span className="rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenido */}
                <div className="mt-3 flex flex-1 flex-col justify-between">
                  <div>
                    {/* Tienda */}
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <Store className="h-3 w-3 shrink-0" />
                      <span className="truncate">{product.organization_name}</span>
                    </div>

                    {/* Categoría / Marca */}
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                      {product.brand && (
                        <span className="font-medium text-foreground">{product.brand}</span>
                      )}
                      {product.category && (
                        <span>{product.category.name}</span>
                      )}
                    </div>

                    {/* Nombre del Producto */}
                    <h3 className={cn(
                      'mt-1.5 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary',
                      isCompact ? 'line-clamp-1 text-xs' : 'line-clamp-2 text-sm'
                    )}>
                      {product.name}
                    </h3>
                  </div>

                  {/* Precios */}
                  <div className="mt-3 flex items-baseline justify-between border-t border-border/60 pt-2">
                    <div>
                      <p className="text-base font-bold tabular-nums text-foreground">
                        {formatPrice(displayPrice)}
                      </p>
                      {hasOffer && (
                        <p className="text-[11px] text-muted-foreground line-through">
                          {formatPrice(product.sale_price)}
                        </p>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 hidden sm:inline">
                      Ver →
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card max-w-lg mx-auto">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            No se encontraron productos
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
            No hay productos que coincidan con los filtros aplicados.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Limpiar todos los filtros
          </button>
        </div>
      )}

      {/* ── PAGINACIÓN ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {pageNumbers().map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n as number)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all',
                    safePage === n
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border/80 bg-background text-foreground hover:bg-muted'
                  )}
                >
                  {n}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Página {safePage} de {totalPages}
          </p>
        </div>
      )}

      {/* Modal de Detalle de Producto */}
      <MarketplaceProductModal
        product={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

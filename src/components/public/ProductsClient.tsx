'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Package,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { MarketplaceProductModal } from './MarketplaceProductModal'

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'default' | 'price_asc' | 'price_desc' | 'name_asc'
type ViewMode = 'grid' | 'compact'

const PAGE_SIZE = 24

type Props = {
  products: MarketplaceProduct[]
  initialQuery?: string
  initialCategory?: string
}

// ─── Sort labels ──────────────────────────────────────────────────────────────
const SORT_LABELS: Record<SortKey, string> = {
  default: 'Relevancia',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
  name_asc: 'Nombre A–Z',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ProductsClient({
  products,
  initialQuery = '',
  initialCategory = '',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(initialQuery)
  const [onlyOffers, setOnlyOffers] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')
  const [view, setView] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  const gridTopRef = useRef<HTMLDivElement>(null)
  const lastFiltersRef = useRef({ query: initialQuery, category: initialCategory })

  // ─── Sincronización del Buscador con URL (Debounce) ─────────────────────────
  useEffect(() => {
    const trimmedQuery = query.trim()
    const urlQuery = searchParams.get('q') ?? ''

    // Solo disparar si la búsqueda local difiere de la URL
    if (trimmedQuery === urlQuery) return

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      if (trimmedQuery) {
        params.set('q', trimmedQuery)
      } else {
        params.delete('q')
      }
      // Resetear paginado al filtrar
      setPage(1)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, 400)

    return () => clearTimeout(handler)
  }, [query, router, pathname, searchParams])

  // Resetear página local al cambiar filtros o ordenamientos locales
  useEffect(() => {
    setPage(1)
  }, [onlyOffers, sort])

  // Sincronizar el input local y resetear página si cambian los filtros externos
  useEffect(() => {
    const filtersChanged =
      lastFiltersRef.current.query !== initialQuery ||
      lastFiltersRef.current.category !== initialCategory

    if (filtersChanged) {
      setQuery(initialQuery)
      setPage(1)
      lastFiltersRef.current = { query: initialQuery, category: initialCategory }
    }
  }, [initialQuery, initialCategory])

  // ─── Modificar Parámetro de Categoría en URL ────────────────────────────────
  const setCategoryParam = (catId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (catId) {
      params.set('categoria', catId)
    } else {
      params.delete('categoria')
    }
    setPage(1)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // ─── Datos Derivados ────────────────────────────────────────────────────────
  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price).length,
    [products]
  )

  const filtered = useMemo(() => {
    let result = products

    // Filtrar por ofertas localmente
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
      case 'name_asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'es'))
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

  const hasFilter = query.trim() !== '' || initialCategory !== '' || onlyOffers
  
  const clearAll = () => {
    setQuery('')
    setOnlyOffers(false)
    setSort('default')
    setPage(1)
    router.push(pathname, { scroll: false })
  }

  const gridClass =
    view === 'grid'
      ? 'grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      : 'grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

  return (
    <>
      {/* ── TOOLBAR PREMIUM GLASSMORPHISM ──────────────────────────────────── */}
      <div className="mb-8 space-y-4 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md shadow-sm">
        
        {/* Fila 1: Búsqueda + Toggle de Vista */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por producto, marca, código..."
              className="h-11 rounded-2xl pl-11 pr-10 text-sm border-slate-200/60 bg-white/80 dark:bg-slate-900/80 dark:border-slate-800"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-350"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Toggle de Vista */}
          <div className="flex items-center rounded-2xl border border-slate-200/60 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-sm">
            <button
              onClick={() => setView('grid')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                view === 'grid'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              aria-label="Vista cuadrícula"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setView('compact')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                view === 'compact'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              aria-label="Vista compacta"
              aria-pressed={view === 'compact'}
            >
              <LayoutList className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros, Ordenamiento y Limpiar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Orden */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent outline-none cursor-pointer pr-1"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k} className="dark:bg-slate-900">
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            {/* Solo Ofertas */}
            {offersCount > 0 && (
              <button
                onClick={() => setOnlyOffers((v) => !v)}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-all shadow-sm ${
                  onlyOffers
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400'
                    : 'border-slate-200/60 bg-white/80 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                Ofertas
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    onlyOffers
                      ? 'bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {offersCount}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Resultados y contador */}
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {filtered.length > 0 && (
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}{' '}
                </span>
              )}
              de{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {filtered.length}
              </span>{' '}
              productos
            </p>

            {/* Limpiar todos los filtros */}
            {hasFilter && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 shadow-sm"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Chip de Categoría Activa */}
        {initialCategory && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Categoría seleccionada:</span>
            <button
              onClick={() => setCategoryParam('')}
              className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-800/40 dark:bg-cyan-950/40 dark:text-cyan-300"
            >
              {products.find((p) => p.category?.id === initialCategory)?.category?.name ?? 'Categoría'}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── GRID DE PRODUCTOS PREMIUM ─────────────────────────────────────── */}
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
                aria-label={`Ver detalles de ${product.name}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-white/80 dark:border-slate-800/40 dark:bg-slate-950/60 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/5"
              >
                {/* Imagen */}
                <div className={`relative overflow-hidden bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-800/30 ${isCompact ? 'aspect-square' : 'aspect-[4/3]'}`}>
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={product.name}
                      fill
                      className={`object-contain transition-transform duration-500 group-hover:scale-105 ${isCompact ? 'p-2' : 'p-4'}`}
                      sizes={
                        isCompact
                          ? '(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw'
                          : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      }
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package
                        className={`text-slate-350 dark:text-slate-650 ${isCompact ? 'h-6 w-6' : 'h-10 w-10'}`}
                      />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                    {hasOffer && discountPct > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        <Tag className="h-2.5 w-2.5" />
                        -{discountPct}%
                      </span>
                    )}
                    {product.featured && !hasOffer && (
                      <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        ★ Destacado
                      </span>
                    )}
                  </div>

                  {/* Sin stock */}
                  {!product.in_stock && (
                    <div className="absolute inset-0 flex items-end justify-center bg-white/40 pb-3 backdrop-blur-[1.5px] dark:bg-slate-950/40">
                      <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={`flex flex-1 flex-col ${isCompact ? 'p-3' : 'p-4'}`}>
                  <p className={`font-semibold text-cyan-600 dark:text-cyan-400 tracking-wide uppercase ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                    {product.organization_name}
                  </p>
                  <h3 className={`mt-1 line-clamp-2 flex-1 font-bold text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${isCompact ? 'text-xs' : 'text-sm'}`}>
                    {product.name}
                  </h3>
                  <div className={`flex items-baseline justify-between ${isCompact ? 'mt-2' : 'mt-3'}`}>
                    <div>
                      <p
                        className={`font-black tabular-nums leading-none ${
                          hasOffer
                            ? 'text-rose-600 dark:text-rose-450'
                            : 'text-slate-850 dark:text-slate-100'
                        } ${isCompact ? 'text-sm' : 'text-base'}`}
                      >
                        {formatPrice(displayPrice)}
                      </p>
                      {hasOffer && (
                        <p className={`mt-0.5 text-slate-400 line-through dark:text-slate-500 leading-none ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                          {formatPrice(product.sale_price)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-24 text-center dark:border-slate-800 dark:bg-slate-900/10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-900">
            <Package className="h-8 w-8 text-slate-350 dark:text-slate-650" />
          </div>
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">
            Sin productos coincidentes
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-slate-500 dark:text-slate-400 mx-auto">
            {query
              ? `No encontramos resultados para "${query}" en el Marketplace.`
              : 'Ningún producto coincide con los filtros aplicados en este momento.'}
          </p>
          <button
            onClick={clearAll}
            className="mt-6 flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros y ver todos
          </button>
        </div>
      )}

      {/* ── CONTROLES DE PAGINACIÓN ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-1.5">
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Página anterior"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-850 dark:bg-slate-900 dark:text-slate-450"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          {pageNumbers().map((n, i) =>
            n === '…' ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-9 w-9 items-center justify-center text-sm text-slate-400"
              >
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => goToPage(n as number)}
                aria-label={`Página ${n}`}
                aria-current={safePage === n ? 'page' : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                  safePage === n
                    ? 'border-cyan-500 bg-cyan-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-900 dark:text-slate-350'
                }`}
              >
                {n}
              </button>
            )
          )}

          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Página siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-850 dark:bg-slate-900 dark:text-slate-450"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      )}

      {totalPages > 1 && (
        <p className="mt-3 text-center text-[10px] font-semibold text-slate-450 dark:text-slate-500">
          Página {safePage} de {totalPages} &middot; {PAGE_SIZE} productos por página
        </p>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <MarketplaceProductModal
        product={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

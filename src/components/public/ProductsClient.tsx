'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
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

const PAGE_SIZE = 50

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
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [onlyOffers, setOnlyOffers] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')
  const [view, setView] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  const gridTopRef = useRef<HTMLDivElement>(null)

  // Sincronizar con el filtro de URL (pill bar de categorías navega con Link)
  useEffect(() => { setCategory(initialCategory); setPage(1) }, [initialCategory])
  useEffect(() => { setQuery(initialQuery);    setPage(1) }, [initialQuery])

  // Resetear página al cambiar cualquier filtro o sort
  useEffect(() => { setPage(1) }, [query, category, onlyOffers, sort])

  // ─── Derived data ──────────────────────────────────────────────────────────
  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price).length,
    [products]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    let result = products.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.organization_name.toLowerCase().includes(q) &&
        !p.brand?.toLowerCase().includes(q) &&
        !p.category?.name.toLowerCase().includes(q)
      )
        return false
      if (category && p.category?.id !== category) return false
      if (onlyOffers && !(p.has_offer && p.offer_price && p.offer_price < p.sale_price)) return false
      return true
    })

    // Ordenar
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
  }, [products, query, category, onlyOffers, sort])

  // ─── Paginación ───────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePageime = Math.min(page, totalPages)
  const pageStart = (safePageime - 1) * PAGE_SIZE
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  function goToPage(p: number) {
    setPage(p)
    // Scroll suave al tope del grid
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Generar números de página con elipsis
  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (safePageime > 3) pages.push('…')
    for (let i = Math.max(2, safePageime - 1); i <= Math.min(totalPages - 1, safePageime + 1); i++) pages.push(i)
    if (safePageime < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  const hasFilter = query.trim() !== '' || category !== '' || onlyOffers
  const clearAll = () => { setQuery(''); setCategory(''); setOnlyOffers(false); setSort('default') }

  // ─── Grid classes según view mode ─────────────────────────────────────────
  const gridClass =
    view === 'grid'
      ? 'grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      : 'grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

  return (
    <>
      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">

        {/* Fila 1: búsqueda + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto, empresa, marca..."
              className="h-10 rounded-xl pl-9 pr-9 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setView('grid')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              aria-label="Vista cuadrícula"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('compact')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                view === 'compact'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              aria-label="Vista compacta"
              aria-pressed={view === 'compact'}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Fila 2: filtros + contador */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none dark:text-slate-300"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Solo ofertas */}
          {offersCount > 0 && (
            <button
              onClick={() => setOnlyOffers((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                onlyOffers
                  ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              <Tag className="h-3 w-3" />
              Ofertas
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
                  onlyOffers
                    ? 'bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {offersCount}
              </span>
            </button>
          )}

          {/* Separador visual */}
          <div className="ml-auto flex items-center gap-3">
            {/* Contador con rango paginado */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length > 0 && (
                <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}{' '}
                </span>
              )}
              de{' '}
              <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {filtered.length}
              </span>
              {hasFilter && filtered.length !== products.length && ` (de ${products.length} total)`}
            </p>

            {/* Limpiar filtros */}
            {hasFilter && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
              >
                <X className="h-3 w-3" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Chip de filtro activo de categoría */}
        {category && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Categoría activa:</span>
            <button
              onClick={() => setCategory('')}
              className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300"
            >
              {products.find((p) => p.category?.id === category)?.category?.name ?? 'Filtrada'}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── GRID DE PRODUCTOS ─────────────────────────────────────────────── */}
      {/* Anchor para scroll-to-top de paginación */}
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
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-800 dark:hover:shadow-cyan-500/5"
              >
                {/* Imagen */}
                <div className={`relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 ${isCompact ? 'aspect-square' : 'aspect-[4/3]'}`}>
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={product.name}
                      fill
                      className={`object-contain transition-transform duration-300 group-hover:scale-105 ${isCompact ? 'p-2' : 'p-4'}`}
                      sizes={
                        isCompact
                          ? '(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw'
                          : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      }
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package
                        className={`text-slate-300 dark:text-slate-600 ${isCompact ? 'h-6 w-6' : 'h-10 w-10'}`}
                      />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    {hasOffer && discountPct > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Tag className="h-2 w-2" />
                        -{discountPct}%
                      </span>
                    )}
                    {product.featured && !hasOffer && (
                      <span className="rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Sin stock */}
                  {!product.in_stock && (
                    <div className="absolute inset-0 flex items-end justify-center bg-white/30 pb-2 backdrop-blur-[1px] dark:bg-slate-900/30">
                      <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={`flex flex-1 flex-col ${isCompact ? 'p-2' : 'p-3'}`}>
                  <p className={`truncate font-semibold text-cyan-700 dark:text-cyan-400 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {product.organization_name}
                  </p>
                  <h3 className={`mt-0.5 line-clamp-2 flex-1 font-semibold text-slate-900 dark:text-slate-50 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                    {product.name}
                  </h3>
                  <div className={`${isCompact ? 'mt-1.5' : 'mt-2'}`}>
                    <p
                      className={`font-bold tabular-nums leading-none ${
                        hasOffer
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-slate-50'
                      } ${isCompact ? 'text-sm' : 'text-base'}`}
                    >
                      {formatPrice(displayPrice)}
                    </p>
                    {hasOffer && (
                      <p className={`text-slate-400 line-through dark:text-slate-500 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                        {formatPrice(product.sale_price)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* ── EMPTY STATE ──────────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center dark:border-slate-800 dark:bg-slate-900/20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-900">
            <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            Sin resultados
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            {query
              ? `No encontramos productos para "${query}"`
              : 'Ningún producto coincide con los filtros aplicados.'}
          </p>
          <button
            onClick={clearAll}
            className="mt-5 flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5" />
            Ver todos los productos
          </button>
        </div>
      )}

      {/* ── CONTROLES DE PAGINACIÓN ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          {/* Anterior */}
          <button
            onClick={() => goToPage(safePageime - 1)}
            disabled={safePageime === 1}
            aria-label="Página anterior"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Números de página */}
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
                aria-current={safePageime === n ? 'page' : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-all ${
                  safePageime === n
                    ? 'border-cyan-500 bg-cyan-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {n}
              </button>
            )
          )}

          {/* Siguiente */}
          <button
            onClick={() => goToPage(safePageime + 1)}
            disabled={safePageime === totalPages}
            aria-label="Página siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Info de página debajo de los controles */}
      {totalPages > 1 && (
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          Página {safePageime} de {totalPages} &middot; {PAGE_SIZE} productos por página
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

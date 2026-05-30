'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Package, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

type Props = {
  products: MarketplaceProduct[]
  initialQuery?: string
  initialCategory?: string
}

export function ProductsClient({ products, initialQuery = '', initialCategory = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [onlyOffers, setOnlyOffers] = useState(false)

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    products.forEach((p) => {
      if (p.category) seen.set(p.category.id, p.category.name)
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price).length,
    [products]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.organization_name.toLowerCase().includes(q)) return false
      if (category && p.category?.id !== category) return false
      if (onlyOffers && !(p.has_offer && p.offer_price)) return false
      return true
    })
  }, [products, query, category, onlyOffers])

  const hasFilter = query.trim() !== '' || category !== '' || onlyOffers

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto o empresa..."
            className="h-10 pl-9 pr-9"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Offers toggle */}
        {offersCount > 0 && (
          <button
            onClick={() => setOnlyOffers((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              onlyOffers
                ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400'
            }`}
          >
            <Tag className="h-3 w-3" />
            Solo ofertas ({offersCount})
          </button>
        )}

        {/* Count + clear */}
        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length}{hasFilter && filtered.length !== products.length ? ` de ${products.length}` : ''} producto{products.length !== 1 ? 's' : ''}
          </p>
          {hasFilter && (
            <button
              onClick={() => { setQuery(''); setCategory(''); setOnlyOffers(false) }}
              className="flex items-center gap-1 text-xs text-cyan-700 hover:underline dark:text-cyan-400"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => {
            const imageSrc = resolveProductImageUrl(product.image)
            const hasOffer = product.has_offer && product.offer_price && product.offer_price < product.sale_price
            const displayPrice = hasOffer ? product.offer_price! : product.sale_price
            const discountPct = hasOffer ? Math.round((1 - product.offer_price! / product.sale_price) * 100) : 0

            return (
              <Link
                key={`${product.organization_slug}-${product.id}`}
                href={`/${product.organization_slug}/productos/${product.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={product.name}
                      fill
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  {hasOffer && discountPct > 0 && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      <Tag className="h-2.5 w-2.5" />
                      -{discountPct}%
                    </span>
                  )}
                  {product.featured && !hasOffer && (
                    <span className="absolute left-2 top-2 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Destacado
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="truncate text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                    {product.organization_name}
                  </p>
                  {product.category && (
                    <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{product.category.name}</p>
                  )}
                  <h3 className="mt-1 line-clamp-2 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {product.name}
                  </h3>
                  <div className="mt-2">
                    <p className={`text-base font-bold ${hasOffer ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50'}`}>
                      {formatPrice(displayPrice)}
                    </p>
                    {hasOffer && (
                      <p className="text-xs text-slate-400 line-through dark:text-slate-500">
                        {formatPrice(product.sale_price)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Package className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-slate-700 dark:text-slate-300">Sin resultados</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Probá otro término o cambiá los filtros.
          </p>
          <button
            onClick={() => { setQuery(''); setCategory(''); setOnlyOffers(false) }}
            className="mt-4 text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Ver todos los productos
          </button>
        </div>
      )}
    </div>
  )
}

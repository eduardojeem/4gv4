'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Heart,
  Search,
  Store,
  ArrowRight,
  Share2,
  Filter,
  X,
  LayoutGrid,
  List,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Info,
  Check,
  Tag,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { FavoriteButton } from './Favorites'
import { initializeFavorites, useFavorites } from '@/lib/public/favorites-store'
import { favoriteKey } from '@/lib/public/favorites-schema'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()

type SortOption = 'name_asc' | 'name_desc' | 'store_asc'
type ViewMode = 'grid' | 'list'

export function FavoritesPage() {
  const state = useFavorites()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [store, setStore] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Lista única de tiendas con cantidad de productos guardados
  const stores = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    state.items.forEach((item) => {
      const existing = map.get(item.slug)
      if (existing) {
        existing.count += 1
      } else {
        map.set(item.slug, { name: item.store, count: 1 })
      }
    })
    return [...map.entries()]
      .map(([slug, data]) => ({ slug, name: data.name, count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.items])

  // Filtrado y ordenamiento de productos favoritos
  const filtered = useMemo(() => {
    const q = normalizeText(query)
    const result = state.items.filter((item) => {
      const matchStore = !store || item.slug === store
      const matchQuery = !q || normalizeText(`${item.name} ${item.store}`).includes(q)
      return matchStore && matchQuery
    })

    return result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
      if (sortBy === 'store_asc') return a.store.localeCompare(b.store)
      return 0
    })
  }, [state.items, store, query, sortBy])

  const hasActiveFilters = Boolean(query || store || sortBy !== 'name_asc')

  const resetFilters = () => {
    setQuery('')
    setStore('')
    setSortBy('name_asc')
  }

  const handleShareList = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mis productos favoritos en el Marketplace',
          text: `Mirá mi lista de productos favoritos (${state.items.length} guardados):`,
          url,
        })
      } catch {
        // Compartir cancelado por el usuario
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado al portapapeles')
    }
  }

  const handleShareProduct = async (item: { name: string; slug: string; productId: string }) => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/${item.slug}/productos/${item.productId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(item.productId)
      toast.success(`Enlace de "${item.name}" copiado`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="min-h-[80vh] bg-background">
      {/* ── Breadcrumb & Header Hero ── */}
      <div className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/marketplace" className="hover:text-foreground transition-colors">
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-foreground">Favoritos</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20">
                  <Heart className="h-6 w-6 fill-primary/20 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                    Mis favoritos
                    {state.items.length > 0 && (
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {state.items.length}
                      </span>
                    )}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {state.account
                      ? 'Tus productos guardados, sincronizados con tu cuenta.'
                      : 'Guardados en este navegador. Iniciá sesión desde el encabezado para sincronizarlos.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              {state.items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareList}
                  className="h-9 gap-1.5 rounded-xl border-border/80 bg-card text-xs font-semibold shadow-xs hover:bg-accent"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Compartir lista</span>
                </Button>
              )}
              <Button
                asChild
                size="sm"
                className="h-9 gap-1.5 rounded-xl text-xs font-bold shadow-xs"
              >
                <Link href="/marketplace/productos">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Explorar catálogo</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Banner de error / sincronización */}
        {state.error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <span>{state.error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void initializeFavorites(user?.id ?? null)}
              className="h-8 border-destructive/40 text-xs font-bold hover:bg-destructive hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Reintentar
            </Button>
          </div>
        )}

        {state.busy && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-4 text-sm text-muted-foreground animate-pulse shadow-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <p role="status">Sincronizando favoritos…</p>
          </div>
        )}

        {/* ── Barra de Búsqueda, Filtros y Vista ── */}
        <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-sm space-y-3">
          <div className="grid gap-3 sm:grid-cols-12 items-center">
            {/* Buscador */}
            <div className="sm:col-span-6 lg:col-span-5 relative">
              <label htmlFor="favorites-search" className="sr-only">
                Buscar favoritos
              </label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="favorites-search"
                type="search"
                aria-label="Buscar favoritos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por producto o tienda…"
                className="h-11 w-full rounded-xl border border-border/80 bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-accent transition-colors"
                  aria-label="Borrar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selector de Tienda */}
            <div className="sm:col-span-3 lg:col-span-3">
              <label htmlFor="store-filter" className="sr-only">
                Filtrar por tienda
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  id="store-filter"
                  aria-label="Filtrar por tienda"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate"
                >
                  <option value="">Todas las tiendas ({state.items.length})</option>
                  {stores.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Selector de Orden */}
            <div className="sm:col-span-3 lg:col-span-2">
              <label htmlFor="sort-filter" className="sr-only">
                Ordenar por
              </label>
              <div className="relative">
                <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  id="sort-filter"
                  aria-label="Ordenar por"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate"
                >
                  <option value="name_asc">Nombre: A → Z</option>
                  <option value="name_desc">Nombre: Z → A</option>
                  <option value="store_asc">Por Tienda</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Botón Limpiar & Alternador de Vista */}
            <div className="sm:col-span-12 lg:col-span-2 flex items-center justify-between lg:justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                disabled={!query && !store && sortBy === 'name_asc'}
                className="h-10 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 px-3 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar filtros</span>
              </Button>

              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all',
                    viewMode === 'grid' && 'bg-card text-foreground shadow-xs'
                  )}
                  title="Vista en cuadrícula"
                  aria-label="Vista en cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all',
                    viewMode === 'list' && 'bg-card text-foreground shadow-xs'
                  )}
                  title="Vista en lista"
                  aria-label="Vista en lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Contador de Resultados y Avisos ── */}
        {!state.error && state.items.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground px-1">
            <p role="status">
              Mostrando <span className="font-bold text-foreground">{filtered.length}</span> de{' '}
              <span className="font-bold text-foreground">{state.items.length}</span> favoritos guardados
            </p>
            <span className="flex items-center gap-1.5 text-muted-foreground/80">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Precios y stock actualizados en la tienda de cada vendedor.
            </span>
          </div>
        )}

        {/* ── Estado Vacío (Sin Favoritos o Sin Coincidencias) ── */}
        {!state.busy && !filtered.length && (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 sm:p-14 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20 mb-4">
              {state.items.length > 0 ? (
                <Filter className="h-8 w-8 text-primary" />
              ) : (
                <Heart className="h-8 w-8 text-primary fill-primary/15" />
              )}
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">
              {state.items.length > 0
                ? 'No hay favoritos que coincidan con estos filtros.'
                : 'Todavía no guardaste productos como favoritos.'}
            </h3>

            <p className="max-w-md mx-auto text-xs sm:text-sm text-muted-foreground mb-6">
              {state.items.length > 0
                ? 'Probá cambiando los términos de búsqueda o seleccionando otra tienda para ver tus productos guardados.'
                : 'Explorá el catálogo del Marketplace y tocá el icono de corazón en cualquier producto para guardarlo aquí y consultarlo cuando quieras.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {state.items.length > 0 ? (
                <Button onClick={resetFilters} className="h-10 rounded-xl px-5 font-bold shadow-xs">
                  Restablecer filtros
                </Button>
              ) : (
                <>
                  <Button asChild className="h-11 rounded-xl px-6 font-bold shadow-xs">
                    <Link href="/marketplace/productos">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Explorar productos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl px-6 font-semibold shadow-xs">
                    <Link href="/marketplace">
                      Ir al Marketplace
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Lista de Productos Favoritos ── */}
        {filtered.length > 0 && (
          <ul
            className={cn(
              viewMode === 'grid'
                ? 'grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
                : 'flex flex-col space-y-3'
            )}
          >
            {filtered.map((item) => {
              const productUrl = `/${item.slug}/productos/${item.productId}`
              const storeUrl = `/${item.slug}`

              if (viewMode === 'list') {
                return (
                  <li
                    key={favoriteKey(item)}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                        <Tag className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={storeUrl}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors mb-0.5"
                        >
                          <Store className="h-3 w-3" />
                          <span>{item.store}</span>
                        </Link>
                        <Link href={productUrl} className="block group/title">
                          <h2 className="truncate text-sm font-bold text-foreground group-hover/title:text-primary transition-colors">
                            {item.name}
                          </h2>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShareProduct(item)}
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                        title="Copiar enlace"
                      >
                        {copiedId === item.productId ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        asChild
                        size="sm"
                        className="h-9 rounded-xl px-4 text-xs font-bold gap-1.5 shadow-xs"
                      >
                        <Link href={productUrl}>
                          <span>Ver en tienda</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>

                      <FavoriteButton item={item} />
                    </div>
                  </li>
                )
              }

              // Card Grid Mode
              return (
                <li
                  key={favoriteKey(item)}
                  className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <div>
                    {/* Header de la Tarjeta: Tienda y Botón Favorito */}
                    <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-border/60">
                      <Link
                        href={storeUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors truncate"
                      >
                        <Store className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{item.store}</span>
                      </Link>

                      <div className="shrink-0">
                        <FavoriteButton item={item} />
                      </div>
                    </div>

                    {/* Contenido del Producto */}
                    <div className="py-4 space-y-2">
                      <Link href={productUrl} className="block group/link">
                        <h2 className="text-base font-extrabold text-foreground leading-snug line-clamp-2 group-hover/link:text-primary transition-colors">
                          {item.name}
                        </h2>
                      </Link>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        Vendido por <span className="font-semibold text-foreground/80">{item.store}</span>
                      </p>
                    </div>
                  </div>

                  {/* Footer de la Tarjeta con Botones de Acción */}
                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareProduct(item)}
                      className="h-9 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1 border-border/80"
                      title="Compartir enlace de este producto"
                    >
                      {copiedId === item.productId ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[11px] text-emerald-600 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Compartir</span>
                        </>
                      )}
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      className="h-9 rounded-xl px-4 text-xs font-bold gap-1.5 shadow-xs flex-1 justify-center"
                    >
                      <Link href={productUrl}>
                        <span>Ver en tienda</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

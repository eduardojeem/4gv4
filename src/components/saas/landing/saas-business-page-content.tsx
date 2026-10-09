'use client'

import { AppImage } from '@/components/ui/app-image'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Search,
  Star,
  Store,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BusinessDirectoryPage } from '@/lib/public/business-directory'
import { describeCatalogState } from '@/lib/public/catalog-state'
import { rubroLabel } from '@/lib/public/organization-rubro'
import { organizationAccentColor } from '@/lib/public/organization-brand'
import { cn } from '@/lib/utils'

// Lo que tiene una tienda adherida, dicho sin promesas que nadie midió.
const ADHERED_PERKS = [
  {
    icon: Store,
    title: 'Tu tienda online',
    desc: 'Un enlace propio con fotos, precios y botón a WhatsApp.',
  },
  {
    icon: LayoutGrid,
    title: 'Presencia en el marketplace',
    desc: 'Tus productos publicados aparecen junto a los de otros comercios.',
  },
  {
    icon: Wallet,
    title: 'Ventas, stock y caja juntos',
    desc: 'Lo que vendés en el local y online descuenta del mismo stock.',
  },
]

interface Props {
  /** La primera página, armada en el servidor; las demás se piden al cambiar de página. */
  initialPage: BusinessDirectoryPage
}

const SEARCH_DELAY_MS = 300

export function SaaSBusinessPageContent({ initialPage }: Props) {
  const [result, setResult] = useState(initialPage)
  const [selectedRubro, setSelectedRubro] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const requestId = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cifras y rubros de todas las tiendas publicadas (no de la página): solo
  // negocios reales, sin completar la lista con comercios de ejemplo.
  const summary = initialPage.summary
  const hasStores = summary.stores > 0

  // Solo cuenta la última respuesta: si se cambia rápido de página o de
  // búsqueda, una respuesta vieja no pisa a la nueva.
  const loadPage = async (next: { page: number; rubro: string; q: string }, scroll = false) => {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(false)
    try {
      const params = new URLSearchParams({ page: String(next.page) })
      if (next.rubro !== 'all') params.set('rubro', next.rubro)
      if (next.q.trim()) params.set('q', next.q.trim())
      const response = await fetch(`/api/public/business-directory?${params}`)
      const body = await response.json()
      if (id !== requestId.current) return
      if (!response.ok || !body?.success) throw new Error(body?.error)
      setResult(body.data as BusinessDirectoryPage)
      if (scroll) document.getElementById('negocios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      if (id === requestId.current) setLoadError(true)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  const chooseRubro = (rubro: string) => {
    setSelectedRubro(rubro)
    void loadPage({ page: 1, rubro, q: searchQuery })
  }

  const changeSearch = (value: string) => {
    setSearchQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => void loadPage({ page: 1, rubro: selectedRubro, q: value }), SEARCH_DELAY_MS)
  }

  const goToPage = (page: number) => void loadPage({ page, rubro: selectedRubro, q: searchQuery }, true)

  const resetFilters = () => {
    setSelectedRubro('all')
    setSearchQuery('')
    void loadPage({ page: 1, rubro: 'all', q: '' })
  }

  const firstShown = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const lastShown = Math.min(result.page * result.pageSize, result.total)

  const stats = [
    { value: summary.stores, label: summary.stores === 1 ? 'negocio publicado' : 'negocios publicados' },
    { value: summary.cities, label: summary.cities === 1 ? 'ciudad' : 'ciudades' },
    { value: summary.products, label: summary.products === 1 ? 'producto publicado' : 'productos publicados' },
  ].filter((stat) => stat.value > 0)

  return (
    <div className="overflow-hidden">
      {/* ── PORTADA ── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 py-12 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.14),transparent)]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-600/30 bg-cyan-100/70 px-3.5 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Comercios adheridos
          </p>

          <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Negocios que crecen con{' '}
            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-blue-500">
              nuestra plataforma
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
            Tiendas, comercios y talleres que venden, controlan su stock y publican su catálogo con nosotros. Entrá a cualquiera y mirá cómo atiende.
          </p>

          {/* Cifras reales de lo que se muestra abajo. */}
          {stats.length > 0 && (
            <dl className="mx-auto mt-7 flex max-w-xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center">
                  <dt className="order-2 text-xs text-slate-500 dark:text-slate-400">{stat.label}</dt>
                  <dd className="order-1 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{stat.value.toLocaleString('es-PY')}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-xl bg-cyan-600 px-6 text-sm font-bold text-white hover:bg-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">
              <Link href="/register">
                Sumar mi negocio
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-6 text-sm font-semibold">
              <Link href="#negocios">Ver los negocios</Link>
            </Button>
          </div>

          <ul className="mt-10 grid gap-3 border-t border-slate-200 pt-7 text-left dark:border-slate-800 sm:grid-cols-3">
            {ADHERED_PERKS.map((perk) => {
              const Icon = perk.icon
              return (
                <li key={perk.title} className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{perk.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-slate-400">{perk.desc}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ── DIRECTORIO ── */}
      <section id="negocios" className="scroll-mt-20 bg-white py-12 dark:bg-slate-950 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Conocé las tiendas que ya operan en vivo
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Entrá a la tienda de cada comercio para ver sus productos y cómo atiende.
              </p>
            </div>

            {hasStores && (
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar tienda, ciudad o rubro"
                  placeholder="Buscar tienda o ciudad..."
                  value={searchQuery}
                  onChange={(e) => changeSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Rubros con negocios publicados, con cuántos hay de cada uno. */}
          {summary.rubros.length > 1 && (
            <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por rubro">
              {[['all', summary.stores] as const, ...summary.rubros].map(([rubro, count]) => {
                const isSelected = selectedRubro === rubro
                return (
                  <button
                    key={rubro}
                    type="button"
                    onClick={() => chooseRubro(rubro)}
                    aria-pressed={isSelected}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {rubro === 'all' ? 'Todos' : rubroLabel(rubro)}
                    <span className={cn('tabular-nums', isSelected ? 'opacity-70' : 'text-slate-400')}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {hasStores && result.total > 0 && (
            <p className="mt-5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              Mostrando {firstShown}–{lastShown} de {result.total} {result.total === 1 ? 'negocio' : 'negocios'}
            </p>
          )}

          {loadError && (
            <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              No pudimos cargar los negocios. Revisá tu conexión y probá de nuevo.
            </p>
          )}

          <ul aria-busy={loading} className={cn('mt-3 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-60')}>
            {result.items.map((store) => {
              const accent = organizationAccentColor(store)
              const catalog = describeCatalogState(store)
              const rubro = rubroLabel(store.rubro)
              return (
                <li
                  key={store.id}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  // El color que la tienda eligió para su página: la tarjeta anticipa lo que se va a encontrar.
                  style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {/* Su logo; las iniciales solo si no tiene. Sobre blanco para que un logo transparente se vea. */}
                    {store.logo_url ? (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
                        <AppImage
                          src={store.logo_url}
                          alt={`Logo de ${store.name}`}
                          loading="lazy"
                          className="h-full w-full object-contain p-1.5"
                        />
                      </span>
                    ) : (
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-sm font-black text-white"
                        style={accent ? { background: accent } : undefined}
                        aria-hidden="true"
                      >
                        {store.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-base font-bold text-slate-900 dark:text-white">{store.name}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                        {rubro && <span className="font-semibold text-slate-700 dark:text-slate-300">{rubro}</span>}
                        {rubro && store.city && <span aria-hidden="true">·</span>}
                        {store.city && <span>{store.city}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Solo lo que la tienda escribió: sin texto de relleno. */}
                  {(store.slogan || store.description) && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {store.slogan || store.description}
                    </p>
                  )}

                  {/* `maps_url` ya viene resuelto: el enlace que cargó la tienda o una búsqueda por su dirección. */}
                  {store.address && (
                    store.maps_url ? (
                      <a
                        href={store.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-cyan-700 hover:underline dark:text-slate-400 dark:hover:text-cyan-400"
                        title={`Ver «${store.name}» en el mapa`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{store.address}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                      </a>
                    ) : (
                      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{store.address}</span>
                      </p>
                    )
                  )}

                  {/* Lo que hay, sin redondear ni inventar. */}
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400" title={catalog.hint ?? undefined}>
                      <strong className="font-bold text-slate-900 dark:text-white">{catalog.label}</strong>
                      {catalog.hint && <span className="block text-[11px] text-slate-400">{catalog.hint}</span>}
                    </span>
                    {(store.review_count ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                        {Number(store.review_rating_avg ?? 0).toFixed(1)}
                        <span className="font-normal text-slate-400">({store.review_count})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin reseñas todavía</span>
                    )}
                  </div>

                  <Button asChild variant="outline" className="mt-3 h-9 w-full justify-between rounded-xl text-xs font-bold">
                    <Link href={`/${store.slug}/inicio`}>
                      Visitar tienda
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>

          {result.pageCount > 1 && (
            <nav aria-label="Páginas de negocios" className="mt-8 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToPage(result.page - 1)}
                disabled={loading || result.page <= 1}
                className="gap-1 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </Button>
              <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                Página {result.page} de {result.pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToPage(result.page + 1)}
                disabled={loading || result.page >= result.pageCount}
                className="gap-1 rounded-xl"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}

          {result.total === 0 && !loading && (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-800">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
              {/* No es lo mismo «el filtro no encontró» que «todavía no hay ninguno». */}
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {!hasStores
                  ? 'Todavía no hay negocios publicados'
                  : 'No se encontraron tiendas con ese filtro'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {!hasStores
                  ? 'Los comercios aparecen acá cuando publican su tienda en el marketplace.'
                  : 'Probá con otro rubro o borrá la búsqueda.'}
              </p>
              {hasStores && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4 rounded-xl text-xs"
                >
                  Ver todos los comercios
                </Button>
              )}
            </div>
          )}

          {hasStores && (
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              ¿Buscás productos?{' '}
              <Link href="/marketplace/empresas" className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400">
                Explorá el directorio completo del marketplace
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

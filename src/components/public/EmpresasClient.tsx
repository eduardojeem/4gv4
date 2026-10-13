'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowUpDown,
  Building2,
  Heart,
  Home,
  MapPin,
  Scissors,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store, Wrench,
  Car,
  X,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { OrganizationDirectoryCard } from '@/components/public/OrganizationDirectoryCard'
import { OrganizationDetailModal } from '@/components/public/OrganizationDetailModal'
import { HorizontalScroller } from '@/components/public/HorizontalScroller'
import { CompanyCityFilter } from '@/components/public/CompanyCityFilter'
import { normalizeCity } from '@/lib/public/city-normalizer'
import { rubroLabel } from '@/lib/public/organization-rubro'
import {
  cityFacets,
  filterOrganizations,
  parseSort,
  rubroFacets,
  sortOrganizations,
  SORT_OPTIONS,
  type SortId,
} from '@/lib/public/empresas-filters'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

type Props = {
  organizations: MarketplaceOrganization[]
  initialQuery?: string
  initialRubro?: string
  initialCity?: string
  initialSort?: string
}

const RUBRO_ICONS: Record<string, LucideIcon> = {
  tecnologia: Smartphone,
  indumentaria: Shirt,
  alimentos: ShoppingBasket,
  ferreteria: Wrench,
  belleza: Sparkles,
  barberia: Scissors,
  hogar: Home,
  salud: Heart,
  automotor: Car,
  comercio: Building2,
}

/** Los filtros tal como están en la URL; la URL es la que manda. */
function filtersFromUrl(params: URLSearchParams) {
  return {
    query: params.get('q') ?? '',
    rubro: params.get('rubro') || 'all',
    city: params.get('ciudad') || params.get('city') || 'all',
    sort: parseSort(params.get('orden')),
  }
}

export function EmpresasClient({
  organizations,
  initialQuery = '',
  initialRubro = 'all',
  initialCity = 'all',
  initialSort,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlKey = searchParams.toString()

  const [query, setQuery] = useState(initialQuery)
  const [selectedRubro, setSelectedRubro] = useState(initialRubro)
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [sort, setSort] = useState<SortId>(parseSort(initialSort))
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState<MarketplaceOrganization | null>(null)

  // La última búsqueda que escribimos en la URL. Si la URL cambia a otra cosa
  // fue el usuario (Atrás/Adelante) y hay que mostrar lo que dice; si es la
  // nuestra, no se pisa lo que siguió escribiendo mientras tanto.
  const lastWrittenQuery = useRef(initialQuery.trim())

  // Atrás y Adelante cambian la URL sin volver a montar el componente: sin
  // esto la URL quedaba limpia pero el chip «Rubro: Tecnología» seguía puesto.
  useEffect(() => {
    const fromUrl = filtersFromUrl(new URLSearchParams(urlKey))
    setSelectedRubro(fromUrl.rubro)
    setSelectedCity(fromUrl.city)
    setSort(fromUrl.sort)
    if (fromUrl.query !== lastWrittenQuery.current) {
      lastWrittenQuery.current = fromUrl.query
      setQuery(fromUrl.query)
    }
  }, [urlKey])

  const navigate = (params: URLSearchParams, mode: 'push' | 'replace' = 'push') => {
    const qs = params.toString()
    router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // La búsqueda va a la URL al dejar de escribir, reemplazando la entrada del
  // historial: antes cada pausa agregaba una y Atrás recorría «cel», «celu»…
  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery === lastWrittenQuery.current) return

    const handler = setTimeout(() => {
      const params = new URLSearchParams(urlKey)
      if (trimmedQuery) params.set('q', trimmedQuery)
      else params.delete('q')
      lastWrittenQuery.current = trimmedQuery
      navigate(params, 'replace')
    }, 400)

    return () => clearTimeout(handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlKey])

  const setParam = (key: string, value: string, fallback: string) => {
    const params = new URLSearchParams(urlKey)
    if (value && value !== fallback) params.set(key, value)
    else params.delete(key)
    if (key === 'ciudad') params.delete('city')
    navigate(params)
  }

  const handleRubroChange = (rubroId: string) => {
    setSelectedRubro(rubroId)
    setParam('rubro', rubroId, 'all')
  }

  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey)
    setParam('ciudad', cityKey, 'all')
  }

  const handleSortChange = (value: string) => {
    const next = parseSort(value)
    setSort(next)
    setParam('orden', next, 'destacadas')
  }

  const handleResetFilters = () => {
    setQuery('')
    setSelectedRubro('all')
    setSelectedCity('all')
    lastWrittenQuery.current = ''
    const params = new URLSearchParams()
    if (sort !== 'destacadas') params.set('orden', sort)
    navigate(params)
  }

  const filters = { query, rubro: selectedRubro, city: selectedCity }
  const filtered = useMemo(
    () => sortOrganizations(filterOrganizations(organizations, { query, rubro: selectedRubro, city: selectedCity }), sort),
    [organizations, query, selectedRubro, selectedCity, sort],
  )
  const rubros = useMemo(() => rubroFacets(organizations, filters), [organizations, query, selectedRubro, selectedCity]) // eslint-disable-line react-hooks/exhaustive-deps
  const cities = useMemo(() => cityFacets(organizations, filters), [organizations, query, selectedRubro, selectedCity]) // eslint-disable-line react-hooks/exhaustive-deps
  const countWithoutRubro = useMemo(
    () => filterOrganizations(organizations, filters, 'rubro').length,
    [organizations, query, selectedCity], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const activeRubroLabel = selectedRubro !== 'all' ? rubroLabel(selectedRubro) : null
  const activeCityMeta = cities.find(
    (c) => c.key === selectedCity || c.display.toLowerCase() === selectedCity.toLowerCase()
  )
  const activeCityDisplay = activeCityMeta?.display || normalizeCity(selectedCity)?.display || selectedCity
  const hasActiveFilters = Boolean(query || selectedRubro !== 'all' || selectedCity !== 'all')

  const chip = (active: boolean, disabled = false) => cn(
    'group shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-xs cursor-pointer'
      : disabled
        ? 'border-border/60 bg-background text-muted-foreground/50 cursor-not-allowed'
        : 'border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer'
  )
  const badge = (active: boolean) => cn(
    'rounded-full px-1.5 py-px text-[10px] tabular-nums',
    active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
  )

  return (
    <div className="space-y-6">
      {/* ── Panel de Control: Buscador, Ciudad, Orden y Rubros ── */}
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-12 items-end">
          {/* Buscador */}
          <div className="relative sm:col-span-6 lg:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por tienda, rubro o ciudad..."
              aria-label="Buscar tiendas"
              className="h-11 rounded-xl pl-10 pr-9 text-base sm:text-sm bg-background border-border/80 focus-visible:ring-primary [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-3">
            <CompanyCityFilter cities={cities} value={activeCityMeta?.key || selectedCity}
              selectedLabel={activeCityDisplay} total={filterOrganizations(organizations, filters, 'city').length}
              onChange={handleCityChange} />
          </div>

          {/* Orden */}
          <div className="sm:col-span-3 lg:col-span-2 relative">
            <ArrowUpDown className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              aria-label="Ordenar tiendas"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
              ▼
            </div>
          </div>

          {/* Contador de Tiendas */}
          <div className="flex justify-start pb-3 sm:col-span-12 lg:col-span-2 lg:justify-end">
            <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">
              <strong className="text-foreground">{filtered.length}</strong> de {organizations.length} tiendas
            </p>
          </div>
        </div>

        {/* ── Franja de Filtro por Rubros ── */}
        {rubros.length > 1 && (
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Filtrar por rubro comercial:</span>
            </div>

            <HorizontalScroller label="rubros" activeKey={selectedRubro} className="flex items-center gap-1.5 pb-1.5">
              <button
                type="button"
                data-active={selectedRubro === 'all' ? 'true' : undefined}
                aria-pressed={selectedRubro === 'all'}
                onClick={() => handleRubroChange('all')}
                className={chip(selectedRubro === 'all')}
              >
                <Store className={cn('h-3.5 w-3.5', selectedRubro === 'all' ? 'text-primary-foreground' : 'text-primary')} />
                <span>Todos los rubros</span>
                <span className={badge(selectedRubro === 'all')}>{countWithoutRubro}</span>
              </button>

              {rubros.map((rubro) => {
                const Icon = RUBRO_ICONS[rubro.id] ?? Store
                const isActive = selectedRubro === rubro.id
                // Sin tiendas con la búsqueda y la ciudad actuales: se ve, pero no se elige.
                const disabled = !isActive && rubro.count === 0

                return (
                  <button
                    key={rubro.id}
                    type="button"
                    data-active={isActive ? 'true' : undefined}
                    aria-pressed={isActive}
                    disabled={disabled}
                    onClick={() => handleRubroChange(rubro.id)}
                    className={chip(isActive, disabled)}
                  >
                    <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary-foreground' : disabled ? 'text-muted-foreground/50' : 'text-primary')} />
                    <span>{rubro.label}</span>
                    <span className={badge(isActive)}>{rubro.count}</span>
                  </button>
                )
              })}
            </HorizontalScroller>
          </div>
        )}

        {/* ── Chips de Filtros Activos ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground">Filtros activos:</span>

            {activeRubroLabel && (
              <button
                type="button"
                onClick={() => handleRubroChange('all')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 cursor-pointer"
              >
                <span>Rubro: {activeRubroLabel}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {selectedCity !== 'all' && (
              <button
                type="button"
                onClick={() => handleCityChange('all')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 cursor-pointer"
              >
                <MapPin className="h-3 w-3 text-primary" />
                <span>Ciudad: {activeCityDisplay}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted/80 cursor-pointer"
              >
                <span>Búsqueda: &ldquo;{query}&rdquo;</span>
                <X className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-primary hover:underline ml-1 cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* ── Grid de Tiendas ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((org) => (
            <OrganizationDirectoryCard
              key={org.id}
              organization={org}
              onOpenDetails={setSelectedOrgForDetails}
            />
          ))}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card max-w-md mx-auto">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-bold text-foreground">No se encontraron tiendas</h3>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {selectedCity !== 'all'
              ? `No hay tiendas registradas en "${activeCityDisplay}" con los filtros seleccionados.`
              : 'No hay tiendas que coincidan con los filtros seleccionados.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Restablecer todos los filtros
            </button>
          )}
        </div>
      )}

      {/* ── Modal de Detalle Completo de la Organización ── */}
      <OrganizationDetailModal
        organization={selectedOrgForDetails}
        open={Boolean(selectedOrgForDetails)}
        onClose={() => setSelectedOrgForDetails(null)}
      />
    </div>
  )
}

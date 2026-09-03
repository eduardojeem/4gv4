'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Building2,
  Heart,
  Home,
  MapPin,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Wrench,
  Car,
  X,
  Layers,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { OrganizationDirectoryCard, RUBRO_LABELS } from '@/components/public/OrganizationDirectoryCard'
import { OrganizationDetailModal } from '@/components/public/OrganizationDetailModal'
import { normalizeCity, removeAccents } from '@/lib/public/city-normalizer'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

type Props = {
  organizations: MarketplaceOrganization[]
  initialQuery?: string
  initialRubro?: string
  initialCity?: string
}

const RUBRO_FILTERS = [
  { id: 'all', label: 'Todos los rubros', icon: Store },
  { id: 'tecnologia', label: 'Tecnología & Celulares', icon: Smartphone },
  { id: 'indumentaria', label: 'Indumentaria & Moda', icon: Shirt },
  { id: 'alimentos', label: 'Gastronomía & Alimentos', icon: ShoppingBasket },
  { id: 'ferreteria', label: 'Ferretería & Obras', icon: Wrench },
  { id: 'belleza', label: 'Belleza & Cosmética', icon: Sparkles },
  { id: 'hogar', label: 'Hogar & Muebles', icon: Home },
  { id: 'salud', label: 'Salud & Farmacia', icon: Heart },
  { id: 'automotor', label: 'Automotor & Repuestos', icon: Car },
  { id: 'comercio', label: 'Comercio General', icon: Building2 },
]

export function EmpresasClient({
  organizations,
  initialQuery = '',
  initialRubro = 'all',
  initialCity = 'all',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(initialQuery)
  const [selectedRubro, setSelectedRubro] = useState(initialRubro)
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState<MarketplaceOrganization | null>(null)

  // Conteo de empresas por rubro
  const rubroCounts = useMemo(() => {
    const counts: Record<string, number> = { all: organizations.length }
    organizations.forEach((org) => {
      const r = org.rubro || 'comercio'
      counts[r] = (counts[r] ?? 0) + 1
    })
    return counts
  }, [organizations])

  // Lista de ciudades normalizadas y consolidadas con sus conteos
  const cityCounts = useMemo(() => {
    const map = new Map<string, { display: string; key: string; count: number }>()

    organizations.forEach((org) => {
      const norm = normalizeCity(org.city)
      if (norm) {
        const existing = map.get(norm.key)
        if (existing) {
          existing.count += 1
        } else {
          map.set(norm.key, { display: norm.display, key: norm.key, count: 1 })
        }
      }
    })

    return [...map.values()].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
  }, [organizations])

  // Sincronización de búsqueda con URL
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
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, 400)

    return () => clearTimeout(handler)
  }, [query, router, pathname, searchParams])

  const handleRubroChange = (rubroId: string) => {
    setSelectedRubro(rubroId)
    const params = new URLSearchParams(searchParams.toString())
    if (rubroId && rubroId !== 'all') {
      params.set('rubro', rubroId)
    } else {
      params.delete('rubro')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey)
    const params = new URLSearchParams(searchParams.toString())
    if (cityKey && cityKey !== 'all') {
      params.set('ciudad', cityKey)
    } else {
      params.delete('ciudad')
      params.delete('city')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleResetFilters = () => {
    setQuery('')
    setSelectedRubro('all')
    setSelectedCity('all')
    router.push(pathname, { scroll: false })
  }

  // Filtrado inteligente de organizaciones
  const filtered = useMemo(() => {
    let result = organizations

    // Filtro por Rubro
    if (selectedRubro && selectedRubro !== 'all') {
      result = result.filter((org) => (org.rubro || 'comercio') === selectedRubro)
    }

    // Filtro por Ciudad (unificando variantes y acentos)
    if (selectedCity && selectedCity !== 'all') {
      const selectedNorm = normalizeCity(selectedCity)
      const targetKey = selectedNorm?.key || removeAccents(selectedCity)

      result = result.filter((org) => {
        const orgNorm = normalizeCity(org.city)
        if (!orgNorm) return false
        return orgNorm.key === targetKey || orgNorm.display.toLowerCase() === selectedCity.toLowerCase()
      })
    }

    // Filtro por búsqueda de texto (tolerante a acentos y mayúsculas)
    const q = removeAccents(query)
    if (q) {
      result = result.filter((org) => {
        const normCity = normalizeCity(org.city)
        const nameMatch = removeAccents(org.name).includes(q)
        const slugMatch = removeAccents(org.slug).includes(q)
        const cityMatch = normCity
          ? removeAccents(normCity.display).includes(q) || normCity.key.includes(q)
          : false
        const rawCityMatch = org.city ? removeAccents(org.city).includes(q) : false
        const addressMatch = org.address ? removeAccents(org.address).includes(q) : false
        const verticalMatch = org.business_vertical ? removeAccents(org.business_vertical).includes(q) : false

        return nameMatch || slugMatch || cityMatch || rawCityMatch || addressMatch || verticalMatch
      })
    }

    return result
  }, [organizations, query, selectedRubro, selectedCity])

  const activeRubroMeta = RUBRO_FILTERS.find((r) => r.id === selectedRubro)
  const activeCityMeta = cityCounts.find(
    (c) => c.key === selectedCity || c.display.toLowerCase() === selectedCity.toLowerCase()
  )
  const activeCityDisplay = activeCityMeta?.display || normalizeCity(selectedCity)?.display || selectedCity
  const hasActiveFilters = Boolean(query || selectedRubro !== 'all' || selectedCity !== 'all')

  return (
    <div className="space-y-6">
      {/* ── Panel de Control: Buscador, Filtro por Ciudad y Rubros ── */}
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        {/* Buscador y Filtro por Ciudad */}
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          {/* Buscador */}
          <div className="sm:col-span-7 lg:col-span-6 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por tienda, rubro o ciudad..."
              className="h-10 rounded-xl pl-10 pr-9 text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-primary"
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

          {/* Filtro por Ciudad (Consolidado) */}
          <div className="sm:col-span-5 lg:col-span-4 relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <select
              aria-label="Filtrar por ciudad"
              value={activeCityMeta?.key || selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-border/80 bg-background pl-9 pr-8 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer truncate"
            >
              <option value="all">Todas las ciudades ({organizations.length})</option>
              {cityCounts.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.display} ({c.count})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
              ▼
            </div>
          </div>

          {/* Contador de Tiendas */}
          <div className="sm:col-span-12 lg:col-span-2 flex justify-start lg:justify-end">
            <p className="text-xs font-semibold text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> de {organizations.length} tiendas
            </p>
          </div>
        </div>

        {/* ── Franja de Filtro por Rubros ── */}
        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Filtrar por rubro comercial:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
            {RUBRO_FILTERS.map((rubro) => {
              const Icon = rubro.icon
              const count = rubroCounts[rubro.id] ?? 0
              const isActive = selectedRubro === rubro.id

              if (rubro.id !== 'all' && count === 0) return null

              return (
                <button
                  key={rubro.id}
                  type="button"
                  onClick={() => handleRubroChange(rubro.id)}
                  className={cn(
                    'group shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary-foreground' : 'text-primary')} />
                  <span>{rubro.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[10px] tabular-nums',
                      isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Chips de Filtros Activos ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground">Filtros activos:</span>

            {selectedRubro !== 'all' && activeRubroMeta && (
              <button
                type="button"
                onClick={() => handleRubroChange('all')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 cursor-pointer"
              >
                <span>Rubro: {activeRubroMeta.label}</span>
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
              className="text-xs font-medium text-primary hover:underline ml-1 cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* ── Grid de Tiendas ── */}
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

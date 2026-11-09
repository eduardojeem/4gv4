'use client'

import React, { useEffect, useState, useSyncExternalStore, useTransition, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  MapPin,
  ChevronDown,
  X,
  Search,
  Check,
  Globe,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { parseMarketplaceLocation, type MarketplaceLocation } from '@/lib/public/marketplace-location'
import { countryLabel } from '@/lib/regional/country-labels'
import { cn } from '@/lib/utils'

const PUBLIC_PATHS = new Set([
  '/marketplace',
  '/marketplace/explorar',
  '/marketplace/productos',
  '/marketplace/empresas',
  '/marketplace/buscar',
  '/marketplace/categorias',
])

const noopSubscribe = () => () => {}
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false)

export type LocationFacets = {
  countries: { code: string; label: string; count: number }[]
  cities: { key: string; label: string; countryCode: string | null; count: number }[]
}

/** Devuelve la bandera emoji a partir del código de país ISO */
export function getCountryFlag(code: string | null | undefined): string {
  if (!code || code === 'all' || code === 'unknown' || code.length !== 2) return '🌎'
  const upper = code.toUpperCase()
  const first = upper.charCodeAt(0) - 65 + 0x1f1e6
  const second = upper.charCodeAt(1) - 65 + 0x1f1e6
  return String.fromCodePoint(first, second)
}

export function useMarketplaceLocationHref() {
  const params = useSearchParams()
  const selection = parseMarketplaceLocation({
    country: params.get('country') ?? 'all',
    city: params.get('city') ?? params.get('ciudad') ?? 'all',
  })
  return (href: string) => {
    const url = new URL(href, 'https://marketplace.invalid')
    if (!PUBLIC_PATHS.has(url.pathname)) return href
    url.searchParams.set('country', selection.country)
    url.searchParams.set('city', selection.city)
    const path =
      url.pathname === '/marketplace' && (selection.country !== 'all' || selection.city !== 'all')
        ? '/marketplace/explorar'
        : url.pathname
    return path + url.search + url.hash
  }
}

export function MarketplaceLocationPicker() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [facets, setFacets] = useState<LocationFacets | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)

  const hydrated = useHydrated()
  const active = PUBLIC_PATHS.has(pathname)

  const countryParam = params.get('country') ?? 'all'
  const cityParam = params.get('city') ?? params.get('ciudad') ?? 'all'
  const selection = parseMarketplaceLocation({ country: countryParam, city: cityParam })

  // Estado temporal dentro del modal (draft)
  const [draftCountry, setDraftCountry] = useState(selection.country)
  const [draftCity, setDraftCity] = useState(selection.city)
  const [citySearchQuery, setCitySearchQuery] = useState('')

  // Al abrir el modal, el borrador arranca desde la ubicación elegida.
  const openDialog = (open: boolean) => {
    if (open) {
      setDraftCountry(selection.country)
      setDraftCity(selection.city)
      setCitySearchQuery('')
    }
    setDialogOpen(open)
  }

  // Carga de facets de ubicaciones
  useEffect(() => {
    if (!active) return
    let alive = true
    fetch('/api/marketplace/locations')
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<LocationFacets>
      })
      .then((value) => {
        if (alive) {
          setFacets(value)
          setError(false)
        }
      })
      .catch(() => {
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [active, attempt])

  // Persistencia y restauración de localStorage
  useEffect(() => {
    if (!active) return
    if (params.has('country') || params.has('city')) {
      try {
        localStorage.setItem(
          'marketplace_location_v1',
          JSON.stringify(
            parseMarketplaceLocation({
              country: params.get('country') ?? 'all',
              city: params.get('city') ?? 'all',
            })
          )
        )
      } catch {}
      return
    }
    if (params.has('ciudad')) return
    try {
      const saved = localStorage.getItem('marketplace_location_v1')
      if (!saved) return
      const parsed = parseMarketplaceLocation(JSON.parse(saved))
      if (parsed.country === 'all' && parsed.city === 'all') return
      const next = new URLSearchParams(params.toString())
      next.set('country', parsed.country)
      next.set('city', parsed.city)
      router.replace(
        (pathname === '/marketplace' ? '/marketplace/explorar' : pathname) + '?' + next.toString(),
        { scroll: false }
      )
    } catch {}
  }, [active, params, pathname, router])

  if (!active) return null

  const apply = (next: MarketplaceLocation) => {
    try {
      localStorage.setItem('marketplace_location_v1', JSON.stringify(next))
    } catch {}
    const query = new URLSearchParams(params.toString())
    query.set('country', next.country)
    query.set('city', next.city)
    query.delete('ciudad')
    query.delete('pagina')
    const path = ['/marketplace', '/marketplace/explorar'].includes(pathname)
      ? next.country === 'all' && next.city === 'all'
        ? '/marketplace'
        : '/marketplace/explorar'
      : pathname
    startTransition(() => router.replace(path + '?' + query.toString(), { scroll: false }))
    setDialogOpen(false)
  }

  // Ciudades filtradas por país seleccionado en draft
  const availableCities = (facets?.cities ?? []).filter(
    (item) => draftCountry === 'all' || (item.countryCode ?? 'unknown') === draftCountry
  )

  // Búsqueda de ciudad en vivo
  const searchedCities = availableCities.filter((c) => {
    if (!citySearchQuery.trim()) return true
    const q = citySearchQuery.trim().toLowerCase()
    return c.label.toLowerCase().includes(q)
  })

  // Etiquetas para la barra exterior
  const activeCountryObj = facets?.countries.find((c) => c.code === selection.country)
  const activeCountryLabel =
    selection.country === 'all'
      ? 'Todos los países'
      : activeCountryObj?.label || countryLabel(selection.country) || selection.country
  const activeCountryFlag = getCountryFlag(selection.country)

  const activeCityObj = facets?.cities.find((c) => c.key === selection.city)
  const activeCityLabel =
    selection.city === 'all'
      ? 'Todas las ciudades'
      : activeCityObj?.label || selection.city.split(':').pop() || selection.city

  const hasCustomFilter = selection.country !== 'all' || selection.city !== 'all'

  return (
    <section
      aria-label="Ubicación del marketplace"
      className="border-b border-border/70 bg-gradient-to-r from-card/90 via-background to-card/90 backdrop-blur-md shadow-2xs"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Lado izquierdo: Identificador y descripción */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Comercios con local en</span>
              {pending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary animate-pulse">
                  · Actualizando…
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
              Filtra tiendas y productos por disponibilidad y entrega directa en tu zona.
            </p>
          </div>
        </div>

        {/* Lado derecho: Botón Pill Premium de Selección */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openDialog(true)}
            className={cn(
              'group/loc flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all duration-200 active:scale-[0.98] cursor-pointer',
              hasCustomFilter
                ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border/80 bg-background/80 text-foreground hover:bg-muted hover:border-primary/40'
            )}
            aria-label={`Ubicación seleccionada: ${activeCountryLabel}, ${activeCityLabel}. Clic para cambiar.`}
          >
            <span className="text-sm leading-none" role="img" aria-hidden="true">
              {activeCountryFlag}
            </span>

            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {selection.country === 'all' && selection.city === 'all' ? (
                <span>Elegir país y ciudad</span>
              ) : (
                <span className="font-bold">
                  {selection.country !== 'all' ? activeCountryLabel : 'Todos'}
                  {' · '}
                  {selection.city !== 'all' ? activeCityLabel : 'Todas'}
                </span>
              )}
            </span>

            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover/loc:text-foreground transition-transform duration-200" />
          </button>

          {/* Botón rápido para limpiar filtro de ubicación */}
          {hasCustomFilter && (
            <button
              type="button"
              onClick={() => apply({ country: 'all', city: 'all' })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground shadow-2xs transition-colors cursor-pointer"
              title="Restablecer a todas las ubicaciones"
              aria-label="Restablecer ubicación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {error && (
            <button
              type="button"
              onClick={() => setAttempt((v) => v + 1)}
              className="text-xs text-destructive hover:underline ml-1"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>

      {/* ── Dialog Modal Moderno & Premium para Selección de Ubicación ── */}
      <Dialog open={dialogOpen} onOpenChange={openDialog}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-border/80 bg-background shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                  Elegí tu ubicación
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Mostramos tiendas y productos con local y entrega en tu zona.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-5 max-h-[68vh] overflow-y-auto">
            {/* 1. Selección de País */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                1. Seleccioná el País
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Opción Todos los países */}
                <button
                  type="button"
                  onClick={() => {
                    setDraftCountry('all')
                    setDraftCity('all')
                  }}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all cursor-pointer',
                    draftCountry === 'all'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border/80 bg-card hover:bg-muted text-foreground'
                  )}
                >
                  <span className="text-xl">🌎</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">Todos</p>
                    <p className="text-[10px] text-muted-foreground">Sin restricción</p>
                  </div>
                  {draftCountry === 'all' && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>

                {/* Países con tiendas */}
                {facets?.countries.map((c) => {
                  const isSelected = draftCountry === c.code
                  const flag = getCountryFlag(c.code)
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setDraftCountry(c.code)
                        setDraftCity('all')
                        setCitySearchQuery('')
                      }}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/80 bg-card hover:bg-muted text-foreground'
                      )}
                    >
                      <span className="text-xl">{flag}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{c.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {c.count} {c.count === 1 ? 'tienda' : 'tiendas'}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Selección de Ciudad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Seleccioná la Ciudad
                </label>
                {availableCities.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {availableCities.length} {availableCities.length === 1 ? 'ciudad' : 'ciudades'}
                  </span>
                )}
              </div>

              {/* Buscador de Ciudad */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  placeholder="Buscar ciudad o departamento…"
                  className="w-full rounded-xl border border-border/80 bg-card pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
                {citySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCitySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lista de ciudades */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-0.5">
                {/* Opción Todas las ciudades */}
                <button
                  type="button"
                  onClick={() => setDraftCity('all')}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                    draftCity === 'all'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border/70 bg-card hover:bg-muted text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">Todas las ciudades</span>
                  </div>
                  {draftCity === 'all' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>

                {searchedCities.map((city) => {
                  const isSelected = draftCity === city.key
                  const countryOfCity = facets?.countries.find(
                    (country) => country.code === (city.countryCode ?? 'unknown')
                  )
                  return (
                    <button
                      key={city.key}
                      type="button"
                      onClick={() => {
                        const locCountry = city.countryCode ?? 'unknown'
                        setDraftCountry(locCountry)
                        setDraftCity(city.key)
                      }}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/70 bg-card hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="min-w-0 truncate">
                          <span className="text-xs font-medium text-foreground truncate block">
                            {city.label}
                          </span>
                          {draftCountry === 'all' && countryOfCity && (
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {countryOfCity.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span className="text-[10px] text-muted-foreground font-semibold rounded-full bg-muted px-1.5 py-0.5">
                          {city.count}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </button>
                  )
                })}

                {searchedCities.length === 0 && (
                  <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                    No se encontraron ciudades con &ldquo;{citySearchQuery}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer de Acciones del Modal */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftCountry('all')
                setDraftCity('all')
              }}
              className="rounded-xl text-xs font-semibold gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => apply({ country: draftCountry, city: draftCity })}
                className="rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-sm"
              >
                <span>Aplicar ubicación</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

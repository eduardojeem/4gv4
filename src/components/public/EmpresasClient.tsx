'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Building2,
  Heart,
  Home,
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
import type { MarketplaceOrganization } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

type Props = {
  organizations: MarketplaceOrganization[]
  initialQuery?: string
  initialRubro?: string
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
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(initialQuery)
  const [selectedRubro, setSelectedRubro] = useState(initialRubro)

  // Conteo de empresas por rubro
  const rubroCounts = useMemo(() => {
    const counts: Record<string, number> = { all: organizations.length }
    organizations.forEach((org) => {
      const r = org.rubro || 'comercio'
      counts[r] = (counts[r] ?? 0) + 1
    })
    return counts
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

  // Filtrado de organizaciones
  const filtered = useMemo(() => {
    let result = organizations

    // Filtro por Rubro
    if (selectedRubro && selectedRubro !== 'all') {
      result = result.filter((org) => (org.rubro || 'comercio') === selectedRubro)
    }

    // Filtro por búsqueda
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (org) =>
          org.name.toLowerCase().includes(q) ||
          org.slug.toLowerCase().includes(q) ||
          (org.business_vertical ?? '').toLowerCase().includes(q)
      )
    }

    return result
  }, [organizations, query, selectedRubro])

  const activeRubroMeta = RUBRO_FILTERS.find((r) => r.id === selectedRubro)

  return (
    <div className="space-y-6">
      {/* ── Panel de Control: Buscador y Filtro de Rubros ── */}
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        {/* Buscador */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tienda o empresa..."
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

          <p className="shrink-0 text-xs font-semibold text-muted-foreground">
            Mostrando <strong className="text-foreground">{filtered.length}</strong> de {organizations.length} tiendas
          </p>
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

              // Si el rubro no tiene tiendas y no es "all", se puede ocultar o mostrar deshabilitado
              if (rubro.id !== 'all' && count === 0) return null

              return (
                <button
                  key={rubro.id}
                  type="button"
                  onClick={() => handleRubroChange(rubro.id)}
                  className={cn(
                    'group shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary-foreground' : 'text-primary')} />
                  <span>{rubro.label}</span>
                  <span className={cn(
                    'rounded-full px-1.5 py-px text-[10px] tabular-nums',
                    isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Chips de Filtros Activos ── */}
        {(selectedRubro !== 'all' || query) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground">Filtros activos:</span>

            {selectedRubro !== 'all' && activeRubroMeta && (
              <button
                type="button"
                onClick={() => handleRubroChange('all')}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
              >
                <span>Rubro: {activeRubroMeta.label}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted/80"
              >
                <span>Búsqueda: &ldquo;{query}&rdquo;</span>
                <X className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setQuery('')
                handleRubroChange('all')
              }}
              className="text-xs font-medium text-primary hover:underline ml-1"
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
            <OrganizationDirectoryCard key={org.id} organization={org} />
          ))}
        </div>
      ) : (
        /* Estado Vacío */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card max-w-md mx-auto">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-bold text-foreground">No se encontraron tiendas</h3>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            No hay tiendas que coincidan con los filtros seleccionados.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              handleRubroChange('all')
            }}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Ver todas las tiendas
          </button>
        </div>
      )}
    </div>
  )
}

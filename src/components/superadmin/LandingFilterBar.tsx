'use client'

import { useEffect, useRef } from 'react'
import { Check, ChevronDown, Download, ListFilter, Search, X, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CommerceRange } from '@/lib/superadmin/commerce-range'
import {
  EMPTY_LANDING_FILTERS,
  LANDING_PRESETS,
  LANDING_STATUSES,
  STALE_EDIT_DAYS,
  countActiveFilters,
  isPresetActive,
  presetFilters,
  toggleInList,
  verticalLabel,
  type LandingFacetCounts,
  type LandingFilters,
} from '@/lib/superadmin/landing-filters'
import { STATUS_PILLS } from './landing-store-meta'
import { cn } from '@/lib/utils'

/**
 * La barra de filtros de la lista de tiendas.
 *
 * Tenía cuatro renglones con todo a la vista —chips de estado, tres selectores
 * segmentados, dos menús— y costaba encontrar qué tocar. Ahora hay un buscador
 * y tres menús: los dos filtros que más se usan (estado y lo que falta) y «Más
 * filtros» para el resto. Los atajos van abajo, y lo elegido aparece solo
 * cuando hay algo elegido.
 */

export type LandingCheckOption = { key: LandingFilters['missing'][number]; label: string; essential: boolean }

const EDITED_OPTIONS = [
  { value: 'all', label: 'Cuando sea' },
  { value: 'recent', label: `En los últimos ${STALE_EDIT_DAYS} días` },
  { value: 'stale', label: `Hace más de ${STALE_EDIT_DAYS} días` },
  { value: 'never', label: 'Nunca' },
] as const

export function LandingFilterBar({
  filters,
  onChange,
  counts,
  presetCounts,
  checks,
  showSales,
  range,
  resultCount,
  onExport,
}: {
  filters: LandingFilters
  onChange: (next: LandingFilters) => void
  counts: LandingFacetCounts
  /** Cuántas tiendas trae cada atajo. */
  presetCounts: Record<string, number>
  checks: LandingCheckOption[]
  /** Sin métricas comerciales no hay con qué filtrar por ventas. */
  showSales: boolean
  range: CommerceRange
  resultCount: number
  onExport: () => void
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<LandingFilters>) => onChange({ ...filters, ...patch })
  const active = countActiveFilters(filters)
  const checkLabel = (key: string) => checks.find((check) => check.key === key)?.label ?? key

  // «/» lleva al buscador, como en la mayoría de los paneles.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const presets = LANDING_PRESETS.filter((preset) => showSales || !preset.needsSales)
  const moreCount = (filters.sales !== 'all' ? 1 : 0) + (filters.visibility !== 'all' ? 1 : 0) +
    (filters.edited !== 'all' ? 1 : 0) + filters.plans.length + filters.verticals.length

  const chips: Array<{ id: string; label: string; remove: () => void }> = [
    ...(filters.q.trim() ? [{ id: 'q', label: `«${filters.q.trim()}»`, remove: () => set({ q: '' }) }] : []),
    ...filters.statuses.map((status) => ({
      id: `estado-${status}`,
      label: STATUS_PILLS[status].label,
      remove: () => set({ statuses: filters.statuses.filter((item) => item !== status) }),
    })),
    ...filters.missing.map((key) => ({
      id: `falta-${key}`,
      label: `Sin ${checkLabel(key).toLowerCase()}`,
      remove: () => set({ missing: filters.missing.filter((item) => item !== key) }),
    })),
    ...(filters.sales !== 'all'
      ? [{ id: 'ventas', label: filters.sales === 'with' ? `Vendió ${range.label}` : `Sin ventas ${range.label}`, remove: () => set({ sales: 'all' }) }]
      : []),
    ...(filters.visibility !== 'all'
      ? [{ id: 'vitrina', label: filters.visibility === 'marketplace' ? 'En el marketplace' : 'Fuera del marketplace', remove: () => set({ visibility: 'all' }) }]
      : []),
    ...filters.plans.map((plan) => ({
      id: `plan-${plan}`,
      label: `Plan ${plan}`,
      remove: () => set({ plans: filters.plans.filter((item) => item !== plan) }),
    })),
    ...filters.verticals.map((vertical) => ({
      id: `rubro-${vertical}`,
      label: verticalLabel(vertical),
      remove: () => set({ verticals: filters.verticals.filter((item) => item !== vertical) }),
    })),
    ...(filters.edited !== 'all'
      ? [{
          id: 'editada',
          label: `Editada ${EDITED_OPTIONS.find((option) => option.value === filters.edited)?.label.toLowerCase()}`,
          remove: () => set({ edited: 'all' }),
        }]
      : []),
  ]

  return (
    <div className="space-y-3" role="search" aria-label="Filtrar tiendas">
      {/* 1. Buscar y filtrar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.q}
            onChange={(event) => set({ q: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Escape' && filters.q) { event.preventDefault(); set({ q: '' }) } }}
            placeholder="Buscar tienda"
            aria-label="Buscar tienda"
            aria-keyshortcuts="/"
            className="h-9 pl-9 pr-10"
          />
          {filters.q ? (
            <button
              type="button"
              onClick={() => set({ q: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Borrar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground" aria-hidden="true">
              /
            </kbd>
          )}
        </div>

        <FilterMenu label="Estado" count={filters.statuses.length} onClear={() => set({ statuses: [] })}>
          <OptionGroup label="Estado">
            {LANDING_STATUSES.map((status) => (
              <CheckOption
                key={status}
                label={STATUS_PILLS[status].label}
                dot={STATUS_PILLS[status].bar}
                count={counts.statuses[status]}
                checked={filters.statuses.includes(status)}
                onToggle={() => set({ statuses: toggleInList(filters.statuses, status) })}
              />
            ))}
          </OptionGroup>
        </FilterMenu>

        <FilterMenu label="Le falta" count={filters.missing.length} onClear={() => set({ missing: [] })}>
          {([['Imprescindible', true], ['Recomendado', false]] as const).map(([title, essential]) => (
            <OptionGroup key={title} label={title}>
              {checks.filter((check) => check.essential === essential).map((check) => (
                <CheckOption
                  key={check.key}
                  label={check.label}
                  count={counts.missing[check.key]}
                  checked={filters.missing.includes(check.key)}
                  onToggle={() => set({ missing: toggleInList(filters.missing, check.key) })}
                />
              ))}
            </OptionGroup>
          ))}
        </FilterMenu>

        <FilterMenu
          label="Más filtros"
          icon={<ListFilter className="h-3.5 w-3.5" aria-hidden="true" />}
          count={moreCount}
          wide
          onClear={() => set({ sales: 'all', visibility: 'all', edited: 'all', plans: [], verticals: [] })}
        >
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div>
              {showSales && (
                <OptionGroup label={`Ventas (${range.short})`} radio>
                  {([['all', 'Todas'], ['with', 'Con ventas'], ['without', 'Sin ventas']] as const).map(([value, label]) => (
                    <RadioOption
                      key={value}
                      label={label}
                      count={value === 'all' ? undefined : counts.sales[value]}
                      checked={filters.sales === value}
                      onSelect={() => set({ sales: value })}
                    />
                  ))}
                </OptionGroup>
              )}
              <OptionGroup label="Marketplace" radio>
                {([['all', 'Todas'], ['marketplace', 'Visibles en el marketplace'], ['hidden', 'Fuera del marketplace']] as const).map(([value, label]) => (
                  <RadioOption
                    key={value}
                    label={label}
                    count={value === 'all' ? undefined : counts.visibility[value]}
                    checked={filters.visibility === value}
                    onSelect={() => set({ visibility: value })}
                  />
                ))}
              </OptionGroup>
              <OptionGroup label="Página editada" radio>
                {EDITED_OPTIONS.map((option) => (
                  <RadioOption
                    key={option.value}
                    label={option.label}
                    count={option.value === 'all' ? undefined : counts.edited[option.value]}
                    checked={filters.edited === option.value}
                    onSelect={() => set({ edited: option.value })}
                  />
                ))}
              </OptionGroup>
            </div>
            <div>
              <OptionGroup label="Plan">
                {Object.keys(counts.plans).sort().map((plan) => (
                  <CheckOption
                    key={plan}
                    label={plan}
                    count={counts.plans[plan]}
                    checked={filters.plans.includes(plan)}
                    onToggle={() => set({ plans: toggleInList(filters.plans, plan) })}
                  />
                ))}
              </OptionGroup>
              <OptionGroup label="Rubro">
                {Object.keys(counts.verticals)
                  .sort((a, b) => verticalLabel(a).localeCompare(verticalLabel(b), 'es'))
                  .map((vertical) => (
                    <CheckOption
                      key={vertical}
                      label={verticalLabel(vertical)}
                      count={counts.verticals[vertical]}
                      checked={filters.verticals.includes(vertical)}
                      onToggle={() => set({ verticals: toggleInList(filters.verticals, vertical) })}
                    />
                  ))}
              </OptionGroup>
            </div>
          </div>
        </FilterMenu>

        <button
          type="button"
          onClick={onExport}
          disabled={resultCount === 0}
          aria-label={`Exportar ${resultCount} ${resultCount === 1 ? 'tienda' : 'tiendas'}`}
          title="Descargar la lista filtrada para Excel"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar
        </button>
      </div>

      {/* 2. Atajos */}
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Vistas rápidas">
        <span className="mr-1 inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Atajos:
        </span>
        {presets.map((preset) => {
          const selected = isPresetActive(filters, preset)
          const count = presetCounts[preset.id] ?? 0
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              aria-pressed={selected}
              disabled={count === 0 && !selected}
              onClick={() => onChange(selected ? EMPTY_LANDING_FILTERS : presetFilters(preset))}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors disabled:cursor-default disabled:opacity-40',
                selected ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground enabled:hover:bg-muted',
              )}
            >
              {preset.label}
              <span className={cn('tabular-nums', selected ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Lo elegido: solo cuando hay algo */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium text-foreground" aria-live="polite">
            {resultCount} {resultCount === 1 ? 'tienda' : 'tiendas'}
          </span>
          <ul className="flex flex-1 flex-wrap gap-1.5" aria-label="Filtros activos">
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  onClick={chip.remove}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-1.5 text-xs text-foreground hover:border-primary/40"
                  aria-label={`Quitar filtro: ${chip.label}`}
                >
                  {chip.label}
                  <X className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange(EMPTY_LANDING_FILTERS)}
            aria-label={`Limpiar filtros (${active})`}
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  )
}

/** Un botón que abre un menú de opciones, con cuántas hay elegidas. */
function FilterMenu({
  label,
  icon,
  count,
  wide,
  onClear,
  children,
}: {
  label: string
  icon?: React.ReactNode
  count: number
  wide?: boolean
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
            count > 0 ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-input bg-background text-foreground hover:bg-muted',
          )}
        >
          {icon}
          {label}
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('p-2', wide ? 'w-[min(34rem,calc(100vw-2rem))]' : 'w-64')}>
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
        {count > 0 && (
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Quitar {count === 1 ? 'este filtro' : 'estos filtros'}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function OptionGroup({ label, radio, children }: { label: string; radio?: boolean; children: React.ReactNode }) {
  return (
    <div role={radio ? 'radiogroup' : 'group'} aria-label={label} className="py-1">
      <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="space-y-px">{children}</div>
    </div>
  )
}

function CheckOption({
  label,
  count,
  checked,
  dot,
  onToggle,
}: {
  label: string
  count: number
  checked: boolean
  dot?: string
  onToggle: () => void
}) {
  const empty = count === 0 && !checked
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted', empty && 'cursor-default opacity-50 hover:bg-transparent')}>
      <input type="checkbox" className="h-4 w-4 shrink-0" checked={checked} disabled={empty} onChange={onToggle} />
      {dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden="true" />}
      <span className="flex-1 truncate text-foreground">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </label>
  )
}

function RadioOption({
  label,
  count,
  checked,
  onSelect,
}: {
  label: string
  count?: number
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', checked && 'font-medium')}
    >
      <span
        className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1 truncate text-foreground">{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </button>
  )
}

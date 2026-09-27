'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Check, ExternalLink, Eye, LayoutGrid, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { describeLastAccess } from '@/lib/superadmin/last-access'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import type { LandingAssessment, LandingStatus } from '@/lib/superadmin/landing-readiness'
import { storeBrandScope } from '@/lib/superadmin/store-brand'
import { STATUS_PILLS, type LandingStoreRowData } from './landing-store-meta'
import { LandingStoreDetailDialog } from './LandingStoreDetailDialog'
import { LandingFilterBar, type LandingCheckOption } from './LandingFilterBar'
import {
  EMPTY_LANDING_FILTERS,
  LANDING_PRESETS,
  countActiveFilters,
  landingFacetCounts,
  landingRowsToCsv,
  matchesLandingFilters,
  presetFilters,
  serializeLandingFilters,
  type LandingFilters,
} from '@/lib/superadmin/landing-filters'
import type { CommerceSummary, StoreCommerce } from '@/lib/superadmin/landing-commerce'
import type { CommerceRange } from '@/lib/superadmin/commerce-range'
import { formatGs } from './LandingCommercePanel'
import { cn } from '@/lib/utils'

export { STATUS_PILLS, type LandingStoreRowData } from './landing-store-meta'

/**
 * La lista de tiendas de la pantalla de landings.
 *
 * Cada fila mostraba los ocho puntos de la lista como etiquetas sueltas, sin
 * ventas ni visitas al lado y sin paginar: con muchas tiendas era una pared de
 * chips. La lista ahora dice de un vistazo cuánto le falta a cada tienda y cómo
 * vende; el detalle completo se abre en un modal desde la fila o la tarjeta.
 */

const STATUS_ORDER: LandingStatus[] = ['maintenance', 'incomplete', 'hidden', 'ready']

type SortKey = 'priority' | 'sales' | 'visitors' | 'score' | 'name' | 'updated'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'priority', label: 'Lo que pide acción primero' },
  { key: 'sales', label: 'Más ventas' },
  { key: 'visitors', label: 'Más visitantes' },
  { key: 'score', label: 'Menos preparadas' },
  { key: 'updated', label: 'Editadas hace poco' },
  { key: 'name', label: 'Nombre' },
]

type View = 'list' | 'cards'

export function LandingStoresSection({
  rows,
  filters,
  onFiltersChange,
  commerce,
  range,
  now,
}: {
  rows: LandingStoreRowData[]
  /** Compartidos con los cuadros de estado y las barras de lo que falta. */
  filters: LandingFilters
  onFiltersChange: (next: LandingFilters) => void
  commerce: CommerceSummary | null | undefined
  range: CommerceRange
  now: number
}) {
  const [sort, setSort] = useState<SortKey>('priority')
  const [view, setView] = useState<View>('list')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const filterKey = JSON.stringify(serializeLandingFilters(filters))
  const [seenFilterKey, setSeenFilterKey] = useState(filterKey)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailRow = detailId ? rows.find((row) => row.id === detailId) ?? null : null

  // Cualquier cambio de filtro, desde la barra o desde los cuadros de arriba,
  // vuelve a la primera página.
  if (seenFilterKey !== filterKey) {
    setSeenFilterKey(filterKey)
    setPage(1)
  }

  const salesOf = (id: string) => commerce?.byStore[id] ?? null

  const counts = useMemo(
    () => landingFacetCounts(rows, filters, (row) => commerce?.byStore[row.id], now),
    [rows, filters, commerce, now],
  )

  // Cada vista rápida cuenta sobre todas las tiendas, no sobre lo ya filtrado.
  const presetCounts = useMemo(() => Object.fromEntries(LANDING_PRESETS.map((preset) => {
    const presetSet = presetFilters(preset)
    return [preset.id, rows.filter((row) => matchesLandingFilters(row, presetSet, commerce?.byStore[row.id], now)).length]
  })), [rows, commerce, now])

  const checkOptions: LandingCheckOption[] = (rows[0]?.assessment.checks ?? []).map((check) => ({
    key: check.key,
    label: check.label,
    essential: check.essential,
  }))

  const sorted = useMemo(() => {
    const sales = (id: string) => commerce?.byStore[id]
    return rows
      .filter((row) => matchesLandingFilters(row, filters, sales(row.id), now))
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, 'es')
        switch (sort) {
          case 'sales':
            return (sales(b.id)?.sold ?? 0) - (sales(a.id)?.sold ?? 0) || byName
          case 'visitors':
            return (sales(b.id)?.visitors ?? 0) - (sales(a.id)?.visitors ?? 0) || byName
          case 'score':
            return a.assessment.score - b.assessment.score || byName
          case 'updated':
            return (b.assessment.lastUpdatedAt ?? '').localeCompare(a.assessment.lastUpdatedAt ?? '') || byName
          case 'name':
            return byName
          default:
            return STATUS_ORDER.indexOf(a.assessment.status) - STATUS_ORDER.indexOf(b.assessment.status) ||
              a.assessment.score - b.assessment.score || byName
        }
      })
  }, [rows, filters, sort, commerce, now])

  /** Descarga lo que se está viendo, con el orden elegido, para abrir en Excel. */
  const exportCsv = () => {
    const csv = landingRowsToCsv(sorted, (row) => commerce?.byStore[row.id], (status) => STATUS_PILLS[status].label)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tiendas-${new Date(now).toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const pagination = paginateList(sorted, String(page), String(pageSize))
  const showCommerce = Boolean(commerce)

  return (
    <section aria-labelledby="landing-stores" className="rounded-xl border border-border bg-card">
      {/* Encabezado: cuántas quedan, orden y vista */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <h2 id="landing-stores" className="text-sm font-bold text-foreground">Tiendas</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground" aria-live="polite">
          {countActiveFilters(filters) > 0 ? `${sorted.length} de ${rows.length}` : rows.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="landing-sort">Ordenar</label>
          <select
            id="landing-sort"
            value={sort}
            onChange={(event) => { setSort(event.target.value as SortKey); setPage(1) }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key} disabled={!showCommerce && (option.key === 'sales' || option.key === 'visitors')}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Vista">
            {([['list', List, 'Lista'], ['cards', LayoutGrid, 'Tarjetas']] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  view === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <LandingFilterBar
          filters={filters}
          onChange={onFiltersChange}
          counts={counts}
          presetCounts={presetCounts}
          checks={checkOptions}
          showSales={showCommerce}
          range={range}
          resultCount={sorted.length}
          onExport={exportCsv}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? 'No hay tiendas todavía.' : 'Ninguna tienda cumple todos los filtros.'}
          </p>
          {rows.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => onFiltersChange(EMPTY_LANDING_FILTERS)}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : view === 'list' ? (
        <div role="table" aria-label="Tiendas" className="text-sm">
          <div
            role="row"
            className="hidden border-b border-border px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] lg:gap-4"
          >
            <span role="columnheader">Tienda</span>
            <span role="columnheader">Preparación</span>
            <span role="columnheader">{showCommerce ? `Ventas · ${range.short}` : 'Ventas'}</span>
            <span role="columnheader">Visitantes</span>
            <span role="columnheader" className="text-right">Acciones</span>
          </div>
          <div className="divide-y divide-border">
            {pagination.items.map((row) => (
              <StoreListRow key={row.id} row={row} now={now} sales={salesOf(row.id)} showCommerce={showCommerce} onOpen={() => setDetailId(row.id)} />
            ))}
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {pagination.items.map((row) => (
            <StoreCard key={row.id} row={row} now={now} sales={salesOf(row.id)} showCommerce={showCommerce} range={range} onOpen={() => setDetailId(row.id)} />
          ))}
        </ul>
      )}

      {sorted.length > 0 && (
        <Pagination
          className="border-t border-border px-5 py-3"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.pageSize}
          totalItems={sorted.length}
          itemsPerPageOptions={[...SUPERADMIN_PAGE_SIZES]}
          onPageChange={setPage}
          onItemsPerPageChange={(size) => { setPageSize(size); setPage(1) }}
        />
      )}

      <LandingStoreDetailDialog
        row={detailRow}
        sales={detailRow ? salesOf(detailRow.id) : null}
        range={showCommerce ? range : null}
        now={now}
        onClose={() => setDetailId(null)}
      />
    </section>
  )
}

// ── Piezas compartidas ──────────────────────────────────────────────────────

function StoreAvatar({ row, size = 'md' }: { row: LandingStoreRowData; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  return row.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.logoUrl} alt="" className={cn(box, 'shrink-0 rounded-lg border border-border bg-background object-contain p-0.5')} />
  ) : (
    <div
      {...storeBrandScope(row.brandColor, row.customBrandColor)}
      className={cn(box, 'flex shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground')}
    >
      {row.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

/** El logo de la tarjeta: grande y sobre fondo propio, para que se lea sobre la franja. */
function StoreLogo({ row }: { row: LandingStoreRowData }) {
  return row.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.logoUrl} alt={`Logo de ${row.name}`} className="h-14 w-14 rounded-xl bg-background object-contain p-1" />
  ) : (
    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
      {row.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

function Readiness({ assessment }: { assessment: LandingAssessment }) {
  const done = assessment.checks.filter((check) => check.ok).length
  const total = assessment.checks.length
  return (
    <div className="flex items-center gap-2" title={`${done} de ${total} puntos cumplidos`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', STATUS_PILLS[assessment.status].bar)} style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{done}/{total}</span>
    </div>
  )
}

function StoreActions({ row, compact, onOpen }: { row: LandingStoreRowData; compact?: boolean; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpen} aria-label={`Ver detalle de ${row.name}`}>
        <Eye className="h-3.5 w-3.5" />
        Detalle
      </Button>
      <Button asChild variant="outline" size="sm" className={cn('h-8 gap-1.5 text-xs', compact && 'w-8 px-0')}>
        <a href={`/${row.slug}/inicio`} target="_blank" rel="noreferrer" aria-label={`Ver la landing de ${row.name}`}>
          <ExternalLink className="h-3.5 w-3.5" />
          {!compact && 'Ver'}
        </a>
      </Button>
      <Button asChild variant="ghost" size="sm" className={cn('h-8 gap-1.5 text-xs', compact && 'w-8 px-0')}>
        <Link href={`/superadmin/organizations/${encodeURIComponent(row.slug)}`} aria-label={`Ficha de ${row.name}`}>
          <Building2 className="h-3.5 w-3.5" />
          {!compact && 'Ficha'}
        </Link>
      </Button>
    </div>
  )
}

const hasSales = (sales: StoreCommerce | null) => Boolean(sales && (sales.sold > 0 || sales.onlineOrders > 0 || sales.counterSales > 0))

// ── Vista de lista ──────────────────────────────────────────────────────────

function StoreListRow({
  row,
  now,
  sales,
  showCommerce,
  onOpen,
}: {
  row: LandingStoreRowData
  now: number
  sales: StoreCommerce | null
  showCommerce: boolean
  onOpen: () => void
}) {
  const { assessment } = row
  const status = STATUS_PILLS[assessment.status]
  const missingEssentials = assessment.missingEssentials.map((check) => check.label)
  const missingSuggested = assessment.checks.filter((check) => !check.ok && !check.essential).map((check) => check.label)
  const updated = assessment.lastUpdatedAt ? describeLastAccess(assessment.lastUpdatedAt, now).label.toLowerCase() : null

  return (
    <div
      role="row"
      data-testid={`landing-${row.slug}`}
      className="grid gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] lg:items-center lg:gap-4"
    >
      {/* Tienda */}
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <StoreAvatar row={row} />
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="block max-w-full truncate text-left font-semibold text-foreground hover:underline">
            {row.name}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-semibold', status.pill)}>{status.label}</span>
            <span className="text-muted-foreground">{updated ? `editada ${updated}` : 'nunca editada'}</span>
          </div>
        </div>
      </div>

      {/* Preparación */}
      <div role="cell" className="min-w-0 space-y-1">
        <Readiness assessment={assessment} />
        <p className="truncate text-xs">
          {missingEssentials.length > 0 ? (
            <span className="text-amber-700 dark:text-amber-300">Falta: {missingEssentials.join(' · ')}</span>
          ) : missingSuggested.length > 0 ? (
            <span className="text-muted-foreground">Sugerido: {missingSuggested.join(' · ')}</span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400">Completa</span>
          )}
        </p>
      </div>

      {/* Ventas */}
      <div role="cell" className="min-w-0 text-xs" data-testid={`store-sales-${row.slug}`}>
        {!showCommerce ? (
          <span className="text-muted-foreground">—</span>
        ) : hasSales(sales) ? (
          <>
            <p className="font-semibold tabular-nums text-foreground">{formatGs(sales!.sold)}</p>
            <p className="text-muted-foreground">
              {sales!.counterSales} en local · {sales!.onlineOrders} {sales!.onlineOrders === 1 ? 'pedido web' : 'pedidos web'}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">Sin ventas</span>
        )}
      </div>

      {/* Visitantes */}
      <div role="cell" className="text-xs tabular-nums">
        {sales?.visitors == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <p className="font-semibold text-foreground">{sales.visitors.toLocaleString('es-PY')}</p>
            <p className="text-muted-foreground">{sales.conversion === null ? 'sin pedidos' : `${sales.conversion.toLocaleString('es-PY')}% pidió`}</p>
          </>
        )}
      </div>

      <div role="cell" className="lg:justify-self-end">
        <StoreActions row={row} onOpen={onOpen} compact />
      </div>
    </div>
  )
}

// ── Vista de tarjetas ───────────────────────────────────────────────────────

function StoreCard({
  row,
  now,
  sales,
  showCommerce,
  range,
  onOpen,
}: {
  row: LandingStoreRowData
  now: number
  sales: StoreCommerce | null
  showCommerce: boolean
  range: CommerceRange
  onOpen: () => void
}) {
  const { assessment } = row
  const status = STATUS_PILLS[assessment.status]
  const updated = assessment.lastUpdatedAt ? describeLastAccess(assessment.lastUpdatedAt, now).label.toLowerCase() : null
  const done = assessment.checks.filter((check) => check.ok).length
  const missingEssentials = assessment.missingEssentials.map((check) => check.label)

  return (
    <li
      data-testid={`landing-${row.slug}`}
      {...storeBrandScope(row.brandColor, row.customBrandColor)}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      {/* La franja lleva el color que la tienda eligió para su página. */}
      <div className="relative h-16 shrink-0 bg-primary" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/25" />
      </div>

      {/* Encima de la franja: sin `relative z-10` la franja tapaba el logo. */}
      <div className="relative z-10 flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="-mt-8 flex items-end justify-between gap-2">
          <div className="rounded-2xl border-4 border-card bg-card shadow-sm">
            <StoreLogo row={row} />
          </div>
          <span className={cn('mb-1 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', status.pill)}>
            {status.label}
          </span>
        </div>

        <div className="-mt-2 min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-left text-base font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            {row.name}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            /{row.slug}
            {row.activeProducts != null && ` · ${row.activeProducts.toLocaleString('es-PY')} productos`}
          </p>
        </div>

        {showCommerce && (
          <div className="rounded-lg bg-primary/5 py-2 text-center ring-1 ring-inset ring-primary/15">
            <dl className="grid grid-cols-3 divide-x divide-border">
              <div className="min-w-0 px-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vendido</dt>
                <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-foreground">{hasSales(sales) ? formatGs(sales!.sold, true) : '—'}</dd>
              </div>
              <div className="min-w-0 px-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pedidos web</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{sales?.onlineOrders ?? 0}</dd>
              </div>
              <div className="min-w-0 px-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Visitantes</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{sales?.visitors == null ? '—' : sales.visitors.toLocaleString('es-PY')}</dd>
              </div>
            </dl>
            <p className="mt-1 text-[10px] text-muted-foreground">Período: {range.short}</p>
          </div>
        )}

        {/* Preparación */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">Preparación</span>
            <span className="tabular-nums text-muted-foreground">{done} de {assessment.checks.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', status.bar)} style={{ width: `${(done / assessment.checks.length) * 100}%` }} />
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1" aria-label={`Lista de ${row.name}`}>
            {assessment.checks.map((check) => (
              <li
                key={check.key}
                title={check.ok ? check.label : check.hint}
                className={cn(
                  'flex min-w-0 items-center gap-1.5 text-xs',
                  check.ok ? 'text-foreground' : check.essential ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                )}
              >
                {check.ok
                  ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="tiene" />
                  : <X className="h-3.5 w-3.5 shrink-0" aria-label="falta" />}
                <span className="truncate">{check.label}</span>
              </li>
            ))}
          </ul>
          {missingEssentials.length === 0 && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Tiene todo lo imprescindible para vender.</p>
          )}
        </div>

        {/* Portada */}
        <div className="border-l-2 border-primary/40 pl-3 text-xs">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Portada</p>
          {assessment.heroTitle ? (
            <p className="mt-0.5 line-clamp-2 text-foreground">
              «{assessment.heroTitle}»
              {!assessment.heroCustom && <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">plantilla</span>}
            </p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">Sin portada cargada</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
        <span className="truncate text-[11px] text-muted-foreground">{updated ? `Editada ${updated}` : 'Nunca editada'}</span>
        <StoreActions row={row} compact onOpen={onOpen} />
      </div>
    </li>
  )
}

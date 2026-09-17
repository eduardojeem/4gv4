'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Eye, Info, MousePointerClick, Receipt, ShoppingBag } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CommerceSummary } from '@/lib/superadmin/landing-commerce'
import {
  MAX_RANGE_DAYS,
  RANGE_PRESETS,
  daysInRange,
  formatRangeDay,
  isValidDay,
  localDay,
  rangeQuery,
  selectableYears,
  type CommerceGranularity,
  type CommerceRange,
} from '@/lib/superadmin/commerce-range'
import { STOREFRONT_PAGE_LABELS, STOREFRONT_PAGES } from '@/lib/public/storefront-visits'
import { cn } from '@/lib/utils'

/**
 * Cómo le va comercialmente a las tiendas: lo vendido, los pedidos de la web,
 * las visitas y cuántas de esas visitas terminan en pedido.
 */

export function formatGs(value: number | null | undefined, compact = false) {
  if (value == null) return '—'
  if (compact && Math.abs(value) >= 1_000_000) {
    return `Gs. ${(value / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`
  }
  return `Gs. ${Math.round(value).toLocaleString('es-PY')}`
}

const formatInt = (value: number | null | undefined) => (value == null ? '—' : value.toLocaleString('es-PY'))

const monthFormatter = new Intl.DateTimeFormat('es-PY', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Cómo se nombra una barra: «16 sep», «sem. del 14 sep» o «sep 2026». */
function bucketLabel(bucket: string, granularity: CommerceGranularity, withYear: boolean) {
  if (granularity === 'month') return monthFormatter.format(new Date(`${bucket}T00:00:00Z`))
  if (granularity === 'week') return `sem. del ${formatRangeDay(bucket, withYear)}`
  return formatRangeDay(bucket, withYear)
}

const GRANULARITY_NOUN: Record<CommerceGranularity, string> = { day: 'día', week: 'semana', month: 'mes' }

type StoreName = { id: string; name: string; slug: string }

export function LandingCommercePanel({
  commerce,
  range,
  now,
  firstYear,
  stores,
  keepQuery = {},
}: {
  commerce: CommerceSummary | null
  range: CommerceRange
  now: number
  /** El primer año que se puede elegir. */
  firstYear?: number
  stores: StoreName[]
  /** Parámetros a conservar al cambiar de período (los filtros de la lista). */
  keepQuery?: Record<string, string>
}) {
  const storeById = new Map(stores.map((store) => [store.id, store]))
  const crossesYear = range.from.slice(0, 4) !== range.to.slice(0, 4) || range.days > 300

  return (
    <section aria-labelledby="landing-commerce" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="landing-commerce" className="text-base font-bold text-foreground">Resultados comerciales</h2>
          <p className="text-xs text-muted-foreground">
            Del {formatRangeDay(range.from, true)} al {formatRangeDay(range.to, true)} ({formatInt(range.days)} días) · se compara con
            el {formatRangeDay(range.previous.from, true)} al {formatRangeDay(range.previous.to, true)}
          </p>
        </div>
        <RangePicker key={`${range.key}:${range.from}:${range.to}`} range={range} now={now} firstYear={firstYear ?? Number(localDay(now).slice(0, 4))} keepQuery={keepQuery} />
      </div>

      {!commerce ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron leer las ventas o los pedidos. Las métricas comerciales no están disponibles.
        </div>
      ) : (
        <>
          <CommerceTiles commerce={commerce} />

          {!commerce.visitsAvailable && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Las visitas se empiezan a contar cuando se aplica la migración <code className="font-mono">storefront_daily_visits</code>.
              Hasta entonces no hay visitas ni conversión: no son cero, faltan los datos.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <SeriesBars
              title={`Vendido por ${GRANULARITY_NOUN[commerce.granularity]}`}
              subtitle="Mostrador + pedidos web cobrados"
              values={commerce.series.map((point) => ({ bucket: point.bucket, value: point.sold }))}
              granularity={commerce.granularity}
              withYear={crossesYear}
              format={(v) => formatGs(v)}
              emptyText="No hubo ventas en el período."
            />
            <SeriesBars
              title={`Visitantes por ${GRANULARITY_NOUN[commerce.granularity]}`}
              subtitle="Personas distintas por tienda y por día, sumadas"
              values={commerce.visitsAvailable ? commerce.series.map((point) => ({ bucket: point.bucket, value: point.visitors ?? 0 })) : []}
              granularity={commerce.granularity}
              withYear={crossesYear}
              format={(v) => `${formatInt(v)} visitantes`}
              emptyText={commerce.visitsAvailable ? 'No hubo visitas en el período.' : 'Sin registro de visitas todavía.'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <StoreRanking commerce={commerce} storeById={storeById} />
            <div className="space-y-4">
              <TopProducts commerce={commerce} storeById={storeById} />
              {commerce.visitsAvailable && <ViewsByPage commerce={commerce} />}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Elegir el período: los habituales a un toque, un año completo o un rango de
 * fechas. Todo son enlaces: el período queda en la dirección, junto con los
 * filtros de la lista.
 */
function RangePicker({
  range,
  now,
  firstYear,
  keepQuery,
}: {
  range: CommerceRange
  now: number
  firstYear: number
  keepQuery: Record<string, string>
}) {
  const today = localDay(now)
  const currentYear = Number(today.slice(0, 4))
  const hrefFor = (query: Record<string, string>) => `?${new URLSearchParams({ ...keepQuery, ...query })}`
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)

  const customValid = isValidDay(from) && isValidDay(to) && from <= to && to <= today && daysInRange(from, to) <= MAX_RANGE_DAYS
  const customDays = isValidDay(from) && isValidDay(to) && from <= to ? daysInRange(from, to) : null
  const isYear = /^\d{4}$/.test(range.key)
  const isCustom = range.key === 'personalizado'

  const pill = (active: boolean) => cn(
    'inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold transition-colors',
    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
  )

  return (
    <nav aria-label="Período" className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {RANGE_PRESETS.map((option) => (
        <Link key={option.key} href={hrefFor({ periodo: option.key })} scroll={false} aria-current={range.key === option.key ? 'page' : undefined} className={pill(range.key === option.key)}>
          {option.short}
        </Link>
      ))}
      <Link href={hrefFor({ periodo: 'anio' })} scroll={false} aria-current={range.key === 'anio' ? 'page' : undefined} className={pill(range.key === 'anio')}>
        Este año
      </Link>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={pill(isYear)} aria-current={isYear ? 'page' : undefined}>
            {isYear ? range.key : 'Año'}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1.5">
          <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">Año completo, contra el anterior</p>
          <ul className="max-h-64 overflow-y-auto">
            {selectableYears(now, firstYear).map((year) => (
              <li key={year}>
                <Link
                  href={hrefFor({ periodo: String(year) })}
                  scroll={false}
                  className={cn(
                    'flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                    range.key === String(year) ? 'font-semibold text-foreground' : 'text-foreground',
                  )}
                >
                  {year}
                  {year === currentYear && <span className="text-[11px] text-muted-foreground">hasta hoy</span>}
                </Link>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={pill(isCustom)} aria-current={isCustom ? 'page' : undefined}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {isCustom ? range.short : 'Fechas'}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3 p-3">
          <p className="text-xs text-muted-foreground">Elegí desde y hasta qué día. Se compara con la misma cantidad de días justo antes.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-medium text-foreground">
              Desde
              <input
                type="date"
                value={from}
                min={`${firstYear}-01-01`}
                max={today}
                onChange={(event) => setFrom(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-foreground">
              Hasta
              <input
                type="date"
                value={to}
                min={from || `${firstYear}-01-01`}
                max={today}
                onChange={(event) => setTo(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
          </div>
          <p className={cn('text-xs', customValid ? 'text-muted-foreground' : 'text-destructive')} role="status">
            {customDays === null
              ? 'La fecha «desde» tiene que ser anterior a «hasta».'
              : to > today
                ? 'No se puede elegir un día que todavía no pasó.'
                : customDays > MAX_RANGE_DAYS
                  ? 'Elegí como mucho tres años.'
                  : `${formatInt(customDays)} ${customDays === 1 ? 'día' : 'días'}`}
          </p>
          {customValid ? (
            <Link
              href={hrefFor(rangeQuery({ key: 'personalizado', from, to }))}
              scroll={false}
              className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Ver este período
            </Link>
          ) : (
            <button type="button" disabled className="h-8 w-full rounded-md bg-primary text-xs font-semibold text-primary-foreground opacity-50">
              Ver este período
            </button>
          )}
        </PopoverContent>
      </Popover>
    </nav>
  )
}

function CommerceTiles({ commerce }: { commerce: CommerceSummary }) {
  const { totals } = commerce
  const delta = totals.deltaPercent

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" aria-hidden="true" /> Vendido
        </p>
        <p className="mt-2 text-3xl font-bold text-foreground">{formatGs(totals.sold, true)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {delta === null ? (
            <span>Sin ventas en el período anterior</span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
              {delta >= 0 ? '+' : ''}{delta}% vs. período anterior
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totals.storesSelling} {totals.storesSelling === 1 ? 'tienda vendió' : 'tiendas vendieron'} · ticket promedio {formatGs(totals.averageTicket)}
        </p>
      </div>

      <Tile
        icon={ShoppingBag}
        label="Mostrador"
        value={formatGs(totals.counterRevenue, true)}
        detail={`${formatInt(totals.counterSales)} ${totals.counterSales === 1 ? 'venta' : 'ventas'} en el local`}
      />
      <Tile
        icon={MousePointerClick}
        label="Pedidos web"
        value={formatInt(totals.onlineOrders)}
        detail={`${formatGs(totals.onlineRevenue)} cobrados`}
      />
      <Tile
        icon={Eye}
        label="Visitantes"
        value={formatInt(totals.visitors)}
        detail={
          totals.visitors === null
            ? 'Sin registro de visitas'
            : `${formatInt(totals.views)} páginas vistas · ${totals.conversion === null ? 'sin conversión' : `${totals.conversion.toLocaleString('es-PY')}% hizo un pedido`}`
        }
      />
    </div>
  )
}

function Tile({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

/**
 * Columnas del período, una sola serie: el título dice qué es, sin leyenda.
 * Cada columna muestra su valor al pasar el mouse o con el foco. En períodos
 * largos se agrupa por semana o por mes para que las columnas se puedan leer.
 */
function SeriesBars({
  title,
  subtitle,
  values,
  granularity,
  withYear,
  format,
  emptyText,
}: {
  title: string
  subtitle: string
  values: Array<{ bucket: string; value: number }>
  granularity: CommerceGranularity
  withYear: boolean
  format: (value: number) => string
  emptyText: string
}) {
  const max = Math.max(0, ...values.map((v) => v.value))
  const peak = values.find((v) => v.value === max && max > 0)
  const label = (bucket: string) => bucketLabel(bucket, granularity, withYear)

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </figcaption>

      {max === 0 ? (
        <p className="flex h-36 items-center justify-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="relative mt-3 h-36">
            {/* Línea de referencia: el máximo, con su valor. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" aria-hidden="true" />
            <span className="pointer-events-none absolute right-0 -top-0.5 -translate-y-full text-[10px] tabular-nums text-muted-foreground">
              {format(max)}
            </span>
            <div className="absolute inset-0 flex items-end gap-[2px] border-b border-border">
              {values.map((point) => (
                <div
                  key={point.bucket}
                  tabIndex={0}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-none"
                  aria-label={`${label(point.bucket)}: ${format(point.value)}`}
                >
                  <div
                    className={cn(
                      'w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring',
                      point.value > 0 ? 'bg-primary' : 'bg-transparent',
                    )}
                    style={{ height: point.value > 0 ? `max(2px, ${(point.value / max) * 100}%)` : 0 }}
                  />
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
                  >
                    <span className="font-semibold">{label(point.bucket)}</span> · {format(point.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between gap-2 text-[10px] tabular-nums text-muted-foreground">
            <span>{label(values[0].bucket)}</span>
            {peak && <span className="truncate">Mejor {GRANULARITY_NOUN[granularity]}: {label(peak.bucket)}</span>}
            <span>{label(values[values.length - 1].bucket)}</span>
          </div>
        </>
      )}
    </figure>
  )
}

function StoreRanking({ commerce, storeById }: { commerce: CommerceSummary; storeById: Map<string, StoreName> }) {
  const rows = Object.entries(commerce.byStore)
    .filter(([, s]) => s.sold > 0 || s.previousSold > 0 || s.onlineOrders > 0 || (s.visitors ?? 0) > 0)
    .sort((a, b) => b[1].sold - a[1].sold || (b[1].visitors ?? 0) - (a[1].visitors ?? 0))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Tiendas por ventas</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">Ninguna tienda vendió ni recibió visitas en el período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-semibold">Tienda</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Vendido</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Variación</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pedidos web</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Visitantes</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {rows.map(([id, s]) => {
                const store = storeById.get(id)
                const delta = s.previousSold > 0 ? Math.round(((s.sold - s.previousSold) / s.previousSold) * 100) : null
                return (
                  <tr key={id} data-testid={`commerce-${store?.slug ?? id}`}>
                    <th scope="row" className="max-w-[180px] truncate px-4 py-2 text-left font-medium text-foreground">
                      {store ? (
                        <Link href={`/superadmin/organizations/${encodeURIComponent(store.slug)}`} className="hover:underline">
                          {store.name}
                        </Link>
                      ) : 'Tienda eliminada'}
                    </th>
                    <td className="px-3 py-2 text-right text-foreground">{formatGs(s.sold)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right',
                        delta === null ? 'text-muted-foreground' : delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
                      )}
                    >
                      {delta === null ? (s.sold > 0 ? 'Nueva' : '—') : `${delta >= 0 ? '+' : ''}${delta}%`}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">{formatInt(s.onlineOrders)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatInt(s.visitors)}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {s.conversion === null ? <span className="text-muted-foreground">—</span> : `${s.conversion.toLocaleString('es-PY')}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TopProducts({ commerce, storeById }: { commerce: CommerceSummary; storeById: Map<string, StoreName> }) {
  const max = Math.max(0, ...commerce.topProducts.map((p) => p.revenue))
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Lo más vendido</h3>
      </div>
      {commerce.topProducts.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">Sin productos vendidos en el período.</p>
      ) : (
        <ol className="space-y-2.5 px-4 py-3">
          {commerce.topProducts.map((product) => (
            <li key={product.key} className="text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-foreground" title={product.name}>{product.name}</span>
                <span className="shrink-0 tabular-nums text-foreground">{formatGs(product.revenue)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span className="truncate">{storeById.get(product.organizationId)?.name ?? 'Tienda'}</span>
                <span className="shrink-0 tabular-nums">{formatInt(product.units)} u.</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? (product.revenue / max) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ViewsByPage({ commerce }: { commerce: CommerceSummary }) {
  const total = STOREFRONT_PAGES.reduce((sum, page) => sum + (commerce.viewsByPage[page] ?? 0), 0)
  if (total === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Qué miran</h3>
      </div>
      <ul className="space-y-2 px-4 py-3">
        {STOREFRONT_PAGES.filter((page) => (commerce.viewsByPage[page] ?? 0) > 0).map((page) => {
          const views = commerce.viewsByPage[page] ?? 0
          const percent = Math.round((views / total) * 100)
          return (
            <li key={page} className="text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-foreground">{STOREFRONT_PAGE_LABELS[page]}</span>
                <span className="tabular-nums text-muted-foreground">{formatInt(views)} · {percent}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

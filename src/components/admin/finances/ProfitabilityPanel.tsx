'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Coins,
  Download,
  Eye,
  Info,
  Landmark,
  Layers,
  Package,
  Percent,
  PieChart,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency, getLocaleConfig } from '@/lib/currency'
import { cn } from '@/lib/utils'

type Group = 'sale' | 'repair' | 'product' | 'employee' | 'branch'
type CoverageFilter = 'all' | 'complete' | 'incomplete'
type SortKey = 'label' | 'revenue' | 'directCosts' | 'grossProfit' | 'margin'
type SortDirection = 'asc' | 'desc'

type Row = {
  id: string
  label: string
  revenue: number
  directCosts: number | null
  grossProfit: number | null
  complete: boolean
}

type DecoratedRow = Row & { margin: number | null; share: number }

const money = (value: number | null) =>
  value === null ? 'Sin cobertura' : formatCurrency(value)

const lossClass = (value: number | null) => (value !== null && value < 0 ? 'text-destructive' : '')

function coverage(row: Row) {
  return row.complete
    ? {
        label: 'Información completa',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
      }
    : {
        label: 'Cobertura incompleta',
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
      }
}

function marginTone(margin: number | null) {
  if (margin === null) return 'border-muted-foreground/20 bg-muted/60 text-muted-foreground'
  if (margin < 0) return 'border-destructive/30 bg-destructive/10 text-destructive font-semibold'
  if (margin < 0.15) return 'border-amber-300/60 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold'
  return 'border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
}

const GROUP_LABELS: Record<Group, string> = {
  sale: 'Venta',
  repair: 'Reparación',
  product: 'Producto',
  employee: 'Empleado',
  branch: 'Sucursal',
}

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'label', label: 'Detalle', numeric: false },
  { key: 'revenue', label: 'Ingresos', numeric: true },
  { key: 'directCosts', label: 'Costos directos', numeric: true },
  { key: 'grossProfit', label: 'Utilidad bruta', numeric: true },
  { key: 'margin', label: 'Margen', numeric: true },
]

const GROUP_ICONS: Record<Group, typeof ShoppingBag> = {
  sale: ShoppingBag,
  repair: Wrench,
  product: Package,
  employee: User,
  branch: Building2,
}

function ProfitabilityDetailModal({
  row,
  group,
  onClose,
  formatPercent,
}: {
  row: DecoratedRow
  group: Group
  onClose: () => void
  formatPercent: (val: number | null) => string
}) {
  const status = coverage(row)
  const Icon = GROUP_ICONS[group] || Layers
  const costPercentage =
    row.revenue > 0 && row.directCosts !== null
      ? Math.min(100, Math.round((row.directCosts / row.revenue) * 100))
      : null
  const profitPercentage =
    row.revenue > 0 && row.grossProfit !== null
      ? Math.round((row.grossProfit / row.revenue) * 100)
      : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl p-0 flex flex-col max-h-[88vh] overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Header Fijo y Visible */}
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b bg-card pr-12 text-left">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-semibold bg-background">
                  {GROUP_LABELS[group]}
                </Badge>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                {row.label}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1.5">
            Desglose financiero consolidado del servidor para este ítem en el período seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Métricas Principales en 4 Tarjetas de Alto Impacto */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-l-4 border-l-primary border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ingresos
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">
                  {money(row.revenue)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatPercent(row.share)} del período
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Costos Directos
                </span>
                <Coins className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg sm:text-xl font-bold text-muted-foreground tabular-nums">
                  {money(row.directCosts)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {costPercentage !== null ? `${costPercentage}% del ingreso` : 'Sin costo'}
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 shadow-xs',
                row.grossProfit !== null && row.grossProfit < 0
                  ? 'border-l-destructive'
                  : 'border-l-emerald-500',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Utilidad Bruta
                </span>
                <Landmark
                  className={cn(
                    'h-4 w-4',
                    row.grossProfit !== null && row.grossProfit < 0 ? 'text-destructive' : 'text-emerald-500',
                  )}
                />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className={cn(
                    'text-lg sm:text-xl font-bold tabular-nums',
                    row.grossProfit !== null && row.grossProfit < 0
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {money(row.grossProfit)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {row.grossProfit !== null && row.grossProfit >= 0 ? 'Ganancia comercial' : 'Pérdida directa'}
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 shadow-xs',
                row.margin !== null && row.margin < 0
                  ? 'border-l-destructive'
                  : 'border-l-indigo-500',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Margen Bruto
                </span>
                <Percent className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className={cn(
                    'text-lg sm:text-xl font-bold tabular-nums',
                    row.margin !== null && row.margin < 0 ? 'text-destructive' : 'text-indigo-600 dark:text-indigo-400',
                  )}
                >
                  {formatPercent(row.margin)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Retorno sobre venta</p>
              </CardContent>
            </Card>
          </div>

          {/* Desglose Proporcional Visual (Estructura de la Venta) */}
          {row.revenue > 0 && row.directCosts !== null && (
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Estructura Proporcional de la Venta
                </span>
                <span className="text-muted-foreground tabular-nums">
                  Total 100%: <strong>{money(row.revenue)}</strong>
                </span>
              </div>

              {/* Barra Proporcional */}
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                {costPercentage !== null && costPercentage > 0 && (
                  <div
                    style={{ width: `${Math.min(costPercentage, 100)}%` }}
                    className="bg-amber-500 transition-all flex items-center justify-center text-[10px] font-bold text-white"
                    title={`Costo directo: ${costPercentage}%`}
                  >
                    {costPercentage >= 15 ? `${costPercentage}%` : ''}
                  </div>
                )}
                {profitPercentage !== null && profitPercentage > 0 && (
                  <div
                    style={{ width: `${Math.min(profitPercentage, 100)}%` }}
                    className="bg-emerald-500 transition-all flex items-center justify-center text-[10px] font-bold text-white"
                    title={`Utilidad bruta: ${profitPercentage}%`}
                  >
                    {profitPercentage >= 15 ? `${profitPercentage}%` : ''}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-amber-500/5 p-2.5">
                  <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Costo de reposición / compra</span>
                    <strong className="text-foreground text-sm tabular-nums">
                      {money(row.directCosts)} ({costPercentage}%)
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-emerald-500/5 p-2.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Utilidad bruta comercial</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                      {money(row.grossProfit)} ({profitPercentage}%)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insight Económico Unitario */}
          {row.margin !== null ? (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                <Info className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Proyección de Rendimiento Unitario</p>
                <p className="leading-relaxed text-muted-foreground">
                  Por cada <strong>{formatCurrency(1000)}</strong> generados en esta actividad, el negocio retiene{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatCurrency(Math.round(row.margin * 1000))}
                  </strong>{' '}
                  ({formatPercent(row.margin)}) como utilidad bruta comercial disponible para absorber gastos fijos de local y nómina.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Costo histórico no registrado</p>
                <p className="leading-relaxed">
                  Este registro no posee un costo unitario asignado en el inventario o compra original. Para no distorsionar la rentabilidad, este ítem se excluye del margen global.
                </p>
              </div>
            </div>
          )}

          {/* Guía explicativa de lectura financiera */}
          <details className="group rounded-xl border border-border/70 bg-card text-xs overflow-hidden transition-all shadow-xs">
            <summary className="flex cursor-pointer items-center justify-between p-3.5 font-semibold text-foreground hover:bg-muted/40 transition-colors list-none select-none">
              <span className="flex items-center gap-2 text-primary font-medium">
                <Info className="h-4 w-4" />
                ¿Cómo interpretar estos cálculos? (Guía rápida)
              </span>
              <span className="text-muted-foreground transition-transform group-open:rotate-180 text-xs">▼</span>
            </summary>
            <div className="border-t border-border/60 p-4 space-y-3 bg-muted/10 text-muted-foreground leading-relaxed">
              <div>
                <p className="font-bold text-foreground">1. Ingresos vs Costos Directos:</p>
                <p>
                  Los <strong>Ingresos</strong> representan el valor total cobrado/facturado. Los <strong>Costos Directos</strong> corresponden exclusivamente al valor de compra de los productos vendidos o repuestos instalados (COGS).
                </p>
              </div>
              <div>
                <p className="font-bold text-foreground">2. Utilidad Bruta y Margen:</p>
                <p>
                  La <strong>Utilidad Bruta</strong> es la resta directa (<code className="text-[11px] font-mono text-foreground font-semibold">Ingresos - Costos Directos</code>). El <strong>Margen Bruto</strong> es el porcentaje de ganancia sobre el precio de venta.
                </p>
              </div>
              <div>
                <p className="font-bold text-foreground">3. ¿Por qué cubre costos fijos y nómina?:</p>
                <p>
                  La utilidad bruta no es la ganancia final de bolsillo: de este margen se deben financiar los sueldos del equipo, comisiones, alquiler, servicios e impuestos para finalmente obtener la <strong>Ganancia Neta</strong> del negocio.
                </p>
              </div>
            </div>
          </details>

          {/* Metadata del Registro */}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-xs divide-y divide-border/40 space-y-1">
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Identificador de sistema</span>
              <span className="font-mono text-foreground font-medium text-[11px] truncate max-w-[320px]">{row.id}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Tipo de agrupación</span>
              <span className="font-semibold text-foreground">{GROUP_LABELS[group]}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Participación en volumen del período</span>
              <span className="font-semibold text-foreground">{formatPercent(row.share)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 p-4 border-t bg-muted/20 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProfitabilityPanel({
  organizationId,
  filters,
}: {
  organizationId: string
  filters: AdminFinanceFilters
}) {
  const [group, setGroup] = useState<Group>('sale')
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedRow, setSelectedRow] = useState<DecoratedRow | null>(null)

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(getLocaleConfig().locale, {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
    [],
  )
  const formatPercent = (value: number | null) =>
    value === null ? 'Sin cobertura' : percentFormatter.format(value)

  const totals = useMemo(() => {
    const complete = rows.filter((row) => row.complete)
    const directCosts = complete.reduce((total, row) => total + (row.directCosts ?? 0), 0)
    const grossProfit = complete.reduce((total, row) => total + (row.grossProfit ?? 0), 0)
    const coveredRevenue = complete.reduce((total, row) => total + row.revenue, 0)
    return {
      revenue: rows.reduce((total, row) => total + row.revenue, 0),
      directCosts: complete.length > 0 ? directCosts : null,
      grossProfit: complete.length > 0 ? grossProfit : null,
      margin: coveredRevenue > 0 ? grossProfit / coveredRevenue : null,
      uncovered: rows.length - complete.length,
      completeCount: complete.length,
    }
  }, [rows])

  const decoratedRows = useMemo<DecoratedRow[]>(() => {
    const totalRevenue = rows.reduce((total, row) => total + Math.abs(row.revenue), 0)
    return rows.map((row) => ({
      ...row,
      margin: row.grossProfit === null || row.revenue === 0 ? null : row.grossProfit / row.revenue,
      share: totalRevenue > 0 ? Math.abs(row.revenue) / totalRevenue : 0,
    }))
  }, [rows])

  const marginHealth = useMemo(() => {
    let optimal = 0
    let moderate = 0
    let low = 0
    let negative = 0
    let incomplete = 0

    for (const row of decoratedRows) {
      if (row.margin === null) {
        incomplete++
      } else if (row.margin >= 0.3) {
        optimal++
      } else if (row.margin >= 0.15) {
        moderate++
      } else if (row.margin >= 0) {
        low++
      } else {
        negative++
      }
    }

    return { optimal, moderate, low, negative, incomplete }
  }, [decoratedRows])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const filtered = decoratedRows.filter((row) => {
      if (coverageFilter === 'complete' && !row.complete) return false
      if (coverageFilter === 'incomplete' && row.complete) return false
      return term === '' || row.label.toLocaleLowerCase().includes(term)
    })
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) => {
      if (sortKey === 'label') return direction * left.label.localeCompare(right.label)
      const leftValue = left[sortKey]
      const rightValue = right[sortKey]
      if (leftValue === null && rightValue === null) return left.label.localeCompare(right.label)
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      return direction * (leftValue - rightValue) || left.label.localeCompare(right.label)
    })
  }, [coverageFilter, decoratedRows, search, sortDirection, sortKey])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'label' ? 'asc' : 'desc')
  }

  const params = useMemo(() => {
    const value = new URLSearchParams({
      organizationId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      group,
    })
    if (filters.branchId) value.set('branchId', filters.branchId)
    return value
  }, [filters.branchId, filters.endDate, filters.startDate, group, organizationId])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void (async () => {
      const response = await fetch(`/api/admin/finances/profitability?${params.toString()}`)
      const payload = (await response.json().catch(() => null)) as { rows?: Row[]; error?: string } | null
      if (!active) return
      if (!response.ok) {
        setError(payload?.error ?? 'No se pudo cargar la rentabilidad.')
        setIsLoading(false)
        return
      }
      setError(null)
      setRows(payload?.rows ?? [])
      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [params])

  const showSkeleton = isLoading && rows.length === 0 && !error

  async function handleExport() {
    if (isExporting) return
    setIsExporting(true)
    setExportError(null)
    try {
      const exportParams = new URLSearchParams({ ...Object.fromEntries(params), kind: 'profitability' })
      const response = await fetch(`/api/admin/finances/export?${exportParams.toString()}`)
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setExportError(payload?.error ?? 'No se pudo exportar la rentabilidad.')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = response.headers.get('content-disposition')
      const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? 'rentabilidad.csv'
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('No se pudo exportar la rentabilidad.')
    } finally {
      setIsExporting(false)
    }
  }

  const hasRows = rows.length > 0
  const isFiltered = search.trim() !== '' || coverageFilter !== 'all'
  const emptyMessage =
    hasRows && isFiltered
      ? 'Ninguna fila coincide con la búsqueda o el filtro de cobertura.'
      : 'No hay datos de rentabilidad para este período.'

  return (
    <div className="space-y-5">
      {selectedRow && (
        <ProfitabilityDetailModal
          row={selectedRow}
          group={group}
          onClose={() => setSelectedRow(null)}
          formatPercent={formatPercent}
        />
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Rentabilidad</h2>
              {hasRows && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Explora ingresos, costos directos y margen de ganancia bruta calculado por el servidor.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            aria-busy={isExporting}
            className="gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exportando…' : 'Exportar rentabilidad'}
          </Button>
          {exportError && (
            <p role="alert" className="text-xs text-destructive">
              {exportError}
            </p>
          )}
        </div>
      </section>

      {showSkeleton ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Cargando rentabilidad">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : hasRows ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ingresos totales
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold tracking-tight tabular-nums">{money(totals.revenue)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total de ventas y reparaciones</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Costos directos
                </CardTitle>
                <Coins className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold tracking-tight tabular-nums">{money(totals.directCosts)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mercadería y repuestos con costo</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 shadow-sm',
                totals.grossProfit !== null && totals.grossProfit < 0
                  ? 'border-l-destructive'
                  : 'border-l-emerald-500',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Utilidad bruta
                </CardTitle>
                <Landmark
                  className={cn(
                    'h-4 w-4',
                    totals.grossProfit !== null && totals.grossProfit < 0 ? 'text-destructive' : 'text-emerald-500',
                  )}
                />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className={cn(
                    'text-xl font-bold tracking-tight tabular-nums',
                    totals.grossProfit !== null && totals.grossProfit < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {money(totals.grossProfit)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ingresos menos costo de compra</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 shadow-sm',
                totals.margin !== null && totals.margin < 0
                  ? 'border-l-destructive'
                  : 'border-l-indigo-500',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Margen bruto
                </CardTitle>
                <Percent className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className={cn(
                    'text-xl font-bold tracking-tight tabular-nums',
                    totals.margin !== null && totals.margin < 0 ? 'text-destructive' : 'text-indigo-600 dark:text-indigo-400',
                  )}
                >
                  {formatPercent(totals.margin)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Retorno promedio sobre ingresos</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground">Salud de márgenes:</span>
              {marginHealth.optimal > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {marginHealth.optimal} óptimos (&gt;30%)
                </span>
              )}
              {marginHealth.moderate > 0 && (
                <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  {marginHealth.moderate} moderados (15-30%)
                </span>
              )}
              {marginHealth.low > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {marginHealth.low} finos (&lt;15%)
                </span>
              )}
              {marginHealth.negative > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  {marginHealth.negative} con pérdida
                </span>
              )}
            </div>

            {totals.uncovered > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                El costo, la utilidad y el margen excluyen {totals.uncovered} de {rows.length} filas sin costo cargado.
              </span>
            )}
          </div>
        </div>
      ) : null}

      <section aria-labelledby="profitability-filters-heading" className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 id="profitability-filters-heading" className="sr-only">
          Filtros de rentabilidad
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[200px_1fr_200px]">
          <div className="space-y-1.5">
            <label htmlFor="profitability-group" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agrupar por
            </label>
            <Select value={group} onValueChange={(value) => setGroup(value as Group)}>
              <SelectTrigger id="profitability-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_LABELS) as Group[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {GROUP_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profitability-search" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="profitability-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Filtrar por ${GROUP_LABELS[group].toLocaleLowerCase()}`}
                disabled={!hasRows}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profitability-coverage" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cobertura de costos
            </label>
            <Select value={coverageFilter} onValueChange={(value) => setCoverageFilter(value as CoverageFilter)}>
              <SelectTrigger id="profitability-coverage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="complete">Solo completas</SelectItem>
                <SelectItem value="incomplete">Solo incompletas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasRows && (
          <p className="mt-3 text-xs text-muted-foreground">
            Mostrando {visibleRows.length} de {rows.length} filas por {GROUP_LABELS[group].toLocaleLowerCase()}.
          </p>
        )}
      </section>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className={cn('hidden overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm md:block', showSkeleton && 'md:hidden')}>
        <table className="w-full text-sm">
          <caption className="sr-only">
            Rentabilidad por {GROUP_LABELS[group].toLocaleLowerCase()}
          </caption>
          <thead>
            <tr className="border-b border-border/70 bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('px-4 py-3', column.numeric && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      sortKey === column.key && 'text-foreground font-bold',
                    )}
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {sortKey === column.key
                        ? `, ordenado ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}`
                        : ', ordenar'}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visibleRows.map((row) => {
              const status = coverage(row)
              // La fila es un atajo de mouse, no un control: sin tabIndex ni
              // onKeyDown propios, que la volvían un stop de teclado que no
              // anuncia nada. El acceso por teclado va por el botón "Ver
              // detalle" de la última celda.
              return (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRow(row)}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  title="Click para ver detalle completo"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-foreground">{row.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-primary/70"
                            style={{ width: `${Math.round(row.share * 100)}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-[11px]">
                          {percentFormatter.format(row.share)} del total
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-foreground">
                    {money(row.revenue)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-muted-foreground">
                    {money(row.directCosts)}
                  </td>
                  <td className={cn('px-4 py-3.5 text-right font-semibold tabular-nums', lossClass(row.grossProfit))}>
                    {money(row.grossProfit)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs tabular-nums', marginTone(row.margin))}>
                      {formatPercent(row.margin)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedRow(row)
                      }}
                      title="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Ver detalle</span>
                    </Button>
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && !error ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={cn('grid gap-3 md:hidden', showSkeleton && 'hidden')}>
        {visibleRows.map((row) => {
          const status = coverage(row)
          return (
            <article
              key={row.id}
              onClick={() => setSelectedRow(row)}
              className="cursor-pointer rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground">{row.label}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.round(row.share * 100)}%` }}
                  />
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {percentFormatter.format(row.share)} de los ingresos
                </span>
              </div>
              <dl className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-3 text-sm">
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">Ingresos</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{money(row.revenue)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">Costos directos</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{money(row.directCosts)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">Utilidad bruta</dt>
                  <dd className={cn('mt-0.5 font-bold tabular-nums', lossClass(row.grossProfit))}>
                    {money(row.grossProfit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">Margen</dt>
                  <dd className="mt-0.5">
                    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs tabular-nums', marginTone(row.margin))}>
                      {formatPercent(row.margin)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary gap-1 p-0 h-auto font-semibold"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRow(row)
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver detalle completo →
                </Button>
              </div>
            </article>
          )
        })}
        {visibleRows.length === 0 && !error ? (
          <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : null}
      </div>
    </div>
  )
}

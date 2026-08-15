'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

type Group = 'sale' | 'repair' | 'product' | 'employee' | 'branch'
type Row = {
  id: string
  label: string
  revenue: number
  directCosts: number | null
  grossProfit: number | null
  complete: boolean
}

const money = (value: number | null) =>
  value === null ? 'Sin cobertura' : formatCurrency(value)

// Una utilidad bruta negativa es una pérdida: se pinta en rojo para que
// salte a la vista en vez de leerse como cualquier otro número.
const lossClass = (value: number | null) => (value !== null && value < 0 ? 'text-destructive' : '')

function coverage(row: Row) {
  return row.complete
    ? { label: 'Información completa', className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' }
    : { label: 'Cobertura incompleta', className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' }
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
  const totals = useMemo(() => rows.reduce((total, row) => ({
    revenue: total.revenue + row.revenue,
    directCosts: total.directCosts + (row.directCosts ?? 0),
    grossProfit: total.grossProfit + (row.grossProfit ?? 0),
  }), { revenue: 0, directCosts: 0, grossProfit: 0 }), [rows])

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
      const payload = await response.json().catch(() => null) as { rows?: Row[]; error?: string } | null
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
    return () => { active = false }
  }, [params])

  // Skeleton solo en la carga inicial (todavía sin datos): al cambiar de
  // agrupación se conservan las filas anteriores visibles mientras llegan las
  // nuevas, en vez de parpadear al esqueleto.
  const showSkeleton = isLoading && rows.length === 0 && !error

  async function handleExport() {
    if (isExporting) return
    setIsExporting(true)
    setExportError(null)
    try {
      const exportParams = new URLSearchParams({ ...Object.fromEntries(params), kind: 'profitability' })
      const response = await fetch(`/api/admin/finances/export?${exportParams.toString()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
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

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Rentabilidad</h2>
          <p className="text-sm text-muted-foreground">
            Explora ingresos, costos y utilidad bruta calculados por el servidor.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            aria-busy={isExporting}
          >
            {isExporting ? 'Exportando…' : 'Exportar rentabilidad'}
          </Button>
          {exportError ? (
            <p role="alert" className="text-xs text-destructive">{exportError}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="profitability-group" className="text-sm font-medium shrink-0">
          Agrupar por
        </label>
        <Select value={group} onValueChange={(value) => setGroup(value as Group)}>
          <SelectTrigger id="profitability-group" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Venta</SelectItem>
            <SelectItem value="repair">Reparación</SelectItem>
            <SelectItem value="product">Producto</SelectItem>
            <SelectItem value="employee">Empleado</SelectItem>
            <SelectItem value="branch">Sucursal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {showSkeleton ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando rentabilidad">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ingresos visibles</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(totals.revenue)}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Costos directos visibles</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(totals.directCosts)}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Utilidad bruta visible</p><p className={cn('mt-1 text-lg font-semibold tabular-nums', totals.grossProfit < 0 ? 'text-destructive' : 'text-primary')}>{money(totals.grossProfit)}</p></div>
        </div>
      ) : null}

      <div className={cn('hidden overflow-hidden rounded-lg border md:block', showSkeleton && 'md:hidden')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3 text-right">Ingresos</th>
              <th className="px-4 py-3 text-right">Costos directos</th>
              <th className="px-4 py-3 text-right">Utilidad bruta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = coverage(row)
              return (
              <tr key={row.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(row.revenue)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(row.directCosts)}</td>
                <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', lossClass(row.grossProfit))}>{money(row.grossProfit)}</td>
              </tr>
              )
            })}
            {rows.length === 0 && !error ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">
                  No hay datos de rentabilidad para este período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={cn('grid gap-3 md:hidden', showSkeleton && 'hidden')}>
        {rows.map((row) => {
          const status = coverage(row)
          return (
            <article key={row.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-foreground">{row.label}</h3>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Ingresos</dt><dd className="mt-1 font-medium tabular-nums">{money(row.revenue)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Costos directos</dt><dd className="mt-1 font-medium tabular-nums">{money(row.directCosts)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Utilidad bruta</dt><dd className={cn('mt-1 font-semibold tabular-nums', lossClass(row.grossProfit))}>{money(row.grossProfit)}</dd></div>
              </dl>
            </article>
          )
        })}
        {rows.length === 0 && !error ? (
          <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No hay datos de rentabilidad para este período.</p>
        ) : null}
      </div>
    </section>
  )
}

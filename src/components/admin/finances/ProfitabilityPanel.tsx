'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'

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

export function ProfitabilityPanel({
  organizationId,
  filters,
}: {
  organizationId: string
  filters: AdminFinanceFilters
}) {
  const [group, setGroup] = useState<Group>('sale')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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
    void (async () => {
      const response = await fetch(`/api/admin/finances/profitability?${params.toString()}`)
      const payload = await response.json().catch(() => null) as { rows?: Row[]; error?: string } | null
      if (!active) return
      if (!response.ok) {
        setError(payload?.error ?? 'No se pudo cargar la rentabilidad.')
        return
      }
      setError(null)
      setRows(payload?.rows ?? [])
    })()
    return () => { active = false }
  }, [params])

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

      <label className="grid max-w-xs gap-1 text-sm font-medium">
        Agrupar por
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value as Group)}
          className="rounded-md border bg-background px-3 py-2"
        >
          <option value="sale">Venta</option>
          <option value="repair">Reparación</option>
          <option value="product">Producto</option>
          <option value="employee">Empleado</option>
          <option value="branch">Sucursal</option>
        </select>
      </label>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Detalle</th>
              <th className="p-2">Ingresos</th>
              <th className="p-2">Costos</th>
              <th className="p-2">Utilidad bruta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">
                  {row.label}
                  {!row.complete ? (
                    <span className="ml-2 text-xs text-amber-700">Cobertura incompleta</span>
                  ) : null}
                </td>
                <td className="p-2">{money(row.revenue)}</td>
                <td className="p-2">{money(row.directCosts)}</td>
                <td className="p-2">{money(row.grossProfit)}</td>
              </tr>
            ))}
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
    </section>
  )
}

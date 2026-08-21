'use client'

import { useEffect, useState } from 'react'
import { Edit, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary as RepairCostSummaryType } from '@/types/repairs'

type HistoryRow = {
  id: string
  revision_number: number
  actor_role: string
  reason?: string | null
  final_total: number
  previous_snapshot?: { finalTotal?: number } | null
  created_at: string
}

export function RepairCostSummary({
  summary,
  partsCount,
  editable,
  repairId,
  onEdit,
}: {
  summary: RepairCostSummaryType
  partsCount: number
  editable: boolean
  repairId?: string
  onEdit: () => void
}) {
  const [history, setHistory] = useState<HistoryRow[]>([])

  useEffect(() => {
    if (!repairId) return
    const controller = new AbortController()
    fetch(`/api/repairs/${repairId}/costs`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => setHistory(Array.isArray(body?.revisions) ? body.revisions : []))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setHistory([])
      })
    return () => controller.abort()
  }, [repairId, summary.revisionId])

  return (
    <section aria-label="Resumen de costos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Costos de la reparación</h3>
          <p className="text-xs text-muted-foreground">Mano de obra, repuestos y ajustes con IVA incluido</p>
        </div>
        {editable && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label="Editar costos y repuestos">
            <Edit className="mr-2 h-4 w-4" />
            Editar costos y repuestos
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
        <dl className="space-y-2 rounded-lg border bg-card p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mano de obra</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Repuestos ({partsCount})</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.partsSubtotal)}</dd></div>
          {summary.additionalCharges > 0 && <div className="flex justify-between gap-3"><dt>Cargos adicionales</dt><dd>{formatCurrency(summary.additionalCharges)}</dd></div>}
          <Separator />
          <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd className="font-semibold">{formatCurrency(summary.subtotalBeforeDiscount)}</dd></div>
          {(summary.discountAmount + summary.deductions) > 0 && <div className="flex justify-between gap-3 text-rose-600"><dt>Descuentos y deducciones</dt><dd>- {formatCurrency(summary.discountAmount + summary.deductions)}</dd></div>}
        </dl>

        <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pagado</dt><dd className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.paidAmount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pendiente</dt><dd className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(summary.balance)}</dd></div>
          <Separator />
          {summary.taxBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">El desglose de IVA se guardará en la próxima revisión.</p>
          ) : summary.taxBreakdown.map((tax) => (
            <div key={tax.rate} className="flex justify-between gap-3 text-xs">
              <dt>IVA incluido {tax.rate}%</dt><dd>{formatCurrency(tax.taxAmount)}</dd>
            </div>
          ))}
        </dl>

        <div className="flex min-h-36 flex-col justify-center rounded-lg border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Total final</p>
          <p aria-live="polite" className="mt-1 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(summary.finalTotal)}
          </p>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">IVA incluido · no se suma nuevamente</p>
        </div>
      </div>

      {history.length > 0 && (
        <details className="rounded-lg border bg-card p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Historial de cambios ({history.length})
          </summary>
          <ol className="mt-3 space-y-2 border-l pl-4 text-xs">
            {history.map((entry) => (
              <li key={entry.id}>
                <p className="font-medium">Revisión {entry.revision_number}: {formatCurrency(Number(entry.final_total))}</p>
                <p className="text-muted-foreground">{new Date(entry.created_at).toLocaleString('es-PY')} · {entry.actor_role}</p>
                {entry.reason && <p>{entry.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

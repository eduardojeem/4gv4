'use client'

import { useEffect, useState } from 'react'
import { Edit, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary as RepairCostSummaryType } from '@/types/repairs'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

type HistoryRow = {
  id: string
  revision_number: number
  actor_role: string
  actor_name?: string | null
  reason?: string | null
  final_total: number
  previous_snapshot?: { finalTotal?: number } | null
  parts_internal_cost?: number | null
  policy_snapshot?: { internalCostCorrection?: boolean; commercialPriceCorrection?: boolean } | null
  created_at: string
}

export function RepairCostSummary({
  summary,
  editable,
  repairId,
  onEdit,
  correctable = false,
  onCorrectInternalCost,
  onCorrectFinalPrice,
}: {
  summary: RepairCostSummaryType
  editable: boolean
  repairId?: string
  onEdit: () => void
  correctable?: boolean
  onCorrectInternalCost?: () => void
  onCorrectFinalPrice?: () => void
}) {
  const canViewCost = useCanViewCost()
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
          <p className="text-xs text-muted-foreground">Servicios, repuestos cobrados y ajustes con IVA incluido</p>
        </div>
        {editable && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label="Editar costos y repuestos">
            <Edit className="mr-2 h-4 w-4" />
            Editar costos y repuestos
          </Button>
        )}
        {!editable && correctable && onCorrectInternalCost && (
          <Button type="button" variant="outline" size="sm" onClick={onCorrectInternalCost} aria-label="Corregir costo interno">
            <Edit className="mr-2 h-4 w-4" />
            Corregir costo interno
          </Button>
        )}
        {!editable && correctable && onCorrectFinalPrice && (
          <Button type="button" variant="outline" size="sm" onClick={onCorrectFinalPrice} aria-label="Corregir precio final">
            <Edit className="mr-2 h-4 w-4" />
            Corregir precio final
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
        <div className="order-1 md:order-3 flex min-h-28 sm:min-h-36 flex-col justify-center rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30 shadow-xs">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">Total final</p>
          <p aria-live="polite" className="mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(summary.finalTotal)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">IVA incluido · no se suma nuevamente</p>
        </div>

        <dl className="order-2 md:order-1 space-y-2 rounded-2xl border bg-card p-4 text-xs sm:text-sm shadow-xs">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Servicios</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.servicesSubtotal ?? 0)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Repuestos cobrados</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.chargedPartsSubtotal ?? summary.partsSubtotal)}</dd></div>
          {summary.laborAmount > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mano de obra adicional</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd></div>}
          {canViewCost && (summary.includedMaterialsInternalCost ?? 0) > 0 && <div className="rounded-xl bg-amber-50 px-2.5 py-1.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex justify-between gap-3"><dt>Material incluido · interno</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.includedMaterialsInternalCost ?? 0)}</dd></div><p className="text-[10px]">Gs. 0 adicionales al cliente</p></div>}
          {summary.additionalCharges > 0 && <div className="flex justify-between gap-3"><dt>Cargos adicionales</dt><dd>{formatCurrency(summary.additionalCharges)}</dd></div>}
          <Separator />
          <div className="flex justify-between gap-3 font-semibold"><dt>Subtotal</dt><dd>{formatCurrency(summary.subtotalBeforeDiscount)}</dd></div>
          {(summary.discountAmount + summary.deductions) > 0 && <div className="flex justify-between gap-3 text-rose-600 font-semibold"><dt>Descuentos y deducciones</dt><dd>- {formatCurrency(summary.discountAmount + summary.deductions)}</dd></div>}
        </dl>

        <dl className="order-3 md:order-2 space-y-2 rounded-2xl border bg-muted/30 p-4 text-xs sm:text-sm shadow-xs">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pagado</dt><dd className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(summary.paidAmount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pendiente</dt><dd className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{formatCurrency(summary.balance)}</dd></div>
          <Separator />
          {summary.taxBreakdown.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">El desglose de IVA se guardará en la próxima revisión.</p>
          ) : summary.taxBreakdown.map((tax) => (
            <div key={tax.rate} className="flex justify-between gap-3 text-xs">
              <dt className="text-muted-foreground">IVA incluido {tax.rate}%</dt><dd className="tabular-nums font-medium">{formatCurrency(tax.taxAmount)}</dd>
            </div>
          ))}
        </dl>
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
                {entry.policy_snapshot?.internalCostCorrection && canViewCost && <p className="text-amber-700 dark:text-amber-300">Corrección interna · costo {formatCurrency(Number(entry.parts_internal_cost || 0))}</p>}
                {entry.policy_snapshot?.commercialPriceCorrection && <p className="text-sky-700 dark:text-sky-300">Corrección comercial del precio final</p>}
                <p className="text-muted-foreground">{new Date(entry.created_at).toLocaleString('es-PY')} · {entry.actor_name || entry.actor_role}</p>
                {entry.reason && <p>{entry.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Edit, History, TrendingUp, Package, Wrench, Coins, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary as RepairCostSummaryType, RepairPart } from '@/types/repairs'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { normalizeRepairLineType } from '@/lib/repairs/line-types'

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
  parts = [],
  editable,
  repairId,
  onEdit,
  correctable = false,
  onCorrectInternalCost,
  onCorrectFinalPrice,
}: {
  summary: RepairCostSummaryType
  parts?: RepairPart[]
  editable: boolean
  repairId?: string
  onEdit: () => void
  correctable?: boolean
  onCorrectInternalCost?: () => void
  onCorrectFinalPrice?: () => void
}) {
  const canViewCost = useCanViewCost()
  const [history, setHistory] = useState<HistoryRow[]>([])

  const totalInternalCost = Number(summary.partsInternalCost ?? 0)
  const finalTotal = Number(summary.finalTotal ?? 0)
  const grossProfit = Math.max(0, finalTotal - totalInternalCost)
  const profitMargin = finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0

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
    <section aria-label="Resumen de costos" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Costos de la reparación</h3>
          <p className="text-xs text-muted-foreground">Servicios, repuestos cobrados y ajustes con IVA incluido</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {/* Tarjeta de Rentabilidad y Ganancia (Visible para usuarios con permiso de ver costo) */}
      {canViewCost && (
        <div className="rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/80 via-background to-teal-50/40 p-4 sm:p-5 dark:border-emerald-900/80 dark:from-emerald-950/40 dark:via-background dark:to-teal-950/20 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200/60 dark:border-emerald-900/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                  Rentabilidad y Ganancia
                </h4>
                <p className="text-xs text-muted-foreground">
                  Diferencia entre el precio cobrado al cliente y el costo interno
                </p>
              </div>
            </div>
            <Badge variant="outline" className="font-extrabold text-xs px-2.5 py-1 border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 shadow-2xs">
              {profitMargin.toFixed(1)}% Margen
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5">
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precio Final (Venta)</span>
              <p className="text-xl sm:text-2xl font-black tabular-nums text-foreground mt-1">
                {formatCurrency(finalTotal)}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Total cobrado al cliente</span>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/30 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Costo Interno</span>
              <p className="text-xl sm:text-2xl font-black tabular-nums text-amber-900 dark:text-amber-200 mt-1">
                {formatCurrency(totalInternalCost)}
              </p>
              <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 block">Inversión en repuestos/insumos</span>
            </div>

            <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/60 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Ganancia Estimada</span>
              <p className="text-xl sm:text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300 mt-1">
                {formatCurrency(grossProfit)}
              </p>
              <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-0.5 block">Utilidad neta del trabajo</span>
            </div>
          </div>
        </div>
      )}

      {/* Desglose de totales y pagos */}
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

      {/* Tabla detallada de Servicios y Repuestos utilizados con costo interno y ganancia */}
      {parts.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Detalle de Servicios y Repuestos ({parts.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Concepto</th>
                  <th className="px-3 py-2.5 text-center">Tipo</th>
                  <th className="px-3 py-2.5 text-center">Cant.</th>
                  <th className="px-3 py-2.5 text-right">Precio Venta</th>
                  {canViewCost && (
                    <>
                      <th className="px-3 py-2.5 text-right text-amber-800 dark:text-amber-300">Costo Interno</th>
                      <th className="px-4 py-2.5 text-right text-emerald-800 dark:text-emerald-300">Ganancia</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {parts.map((part, idx) => {
                  const lineType = normalizeRepairLineType(part.lineType)
                  const lineTotal = Math.max(0, part.cost * part.quantity - (part.discountAmount ?? 0))
                  const internalUnit = part.internalCost ?? (lineType === 'service' ? 0 : part.cost)
                  const lineInternal = internalUnit * part.quantity
                  const lineProfit = Math.max(0, lineTotal - lineInternal)

                  return (
                    <tr key={part.databaseId || part.id || idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <p className="font-semibold">{part.name}</p>
                        {part.supplier && part.supplier !== 'Carga manual' && (
                          <p className="text-[10px] text-muted-foreground">{part.supplier}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {lineType === 'service' ? 'Servicio' : lineType === 'included_material' ? 'Material incluido' : 'Repuesto'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                        {part.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-foreground">
                        {formatCurrency(lineTotal)}
                      </td>
                      {canViewCost && (
                        <>
                          <td className="px-3 py-2.5 text-right font-medium tabular-nums text-amber-800 dark:text-amber-300">
                            {formatCurrency(lineInternal)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                            +{formatCurrency(lineProfit)}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

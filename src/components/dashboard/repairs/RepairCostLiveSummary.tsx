'use client'

import { CircleDollarSign, ReceiptText, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary } from '@/lib/repairs/cost-breakdown'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

export function RepairCostLiveSummary({ summary }: { summary: RepairCostSummary }) {
  const canViewCost = useCanViewCost()
  const includedTax = summary.taxBreakdown.reduce((total, row) => total + row.taxAmount, 0)
  const discounts = summary.discountAmount + summary.deductions
  const totalInternalCost = summary.partsInternalCost ?? 0
  const finalTotal = summary.finalTotal ?? 0
  const grossProfit = Math.max(0, finalTotal - totalInternalCost)
  const profitMargin = finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0

  return (
    <aside aria-label="Resumen de costos" className="h-fit overflow-hidden rounded-xl border bg-card lg:sticky lg:top-0">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <ReceiptText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Resumen en tiempo real</h3>
      </div>
      <dl className="space-y-3 px-4 py-4 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Mano de obra</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Servicios</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.servicesSubtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Repuestos cobrados</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.chargedPartsSubtotal)}</dd></div>
        {canViewCost && summary.includedMaterialsInternalCost > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-2 dark:bg-amber-950/30">
            <div className="flex justify-between gap-4">
              <dt className="text-amber-800 dark:text-amber-200">Material incluido</dt>
              <dd className="font-medium tabular-nums text-amber-800 dark:text-amber-200">{formatCurrency(summary.includedMaterialsInternalCost)}</dd>
            </div>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Costo interno; Gs. 0 adicionales al cliente.</p>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t pt-3"><dt>Subtotal antes de descuentos</dt><dd className="font-semibold tabular-nums">{formatCurrency(summary.subtotalBeforeDiscount)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Cargos adicionales</dt><dd className="tabular-nums">{formatCurrency(summary.additionalCharges)}</dd></div>
        <div className="flex justify-between gap-4 text-rose-600 dark:text-rose-400"><dt>Descuentos y deducciones</dt><dd className="tabular-nums">- {formatCurrency(discounts)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">IVA incluido</dt><dd className="tabular-nums">{formatCurrency(includedTax)}</dd></div>
      </dl>
      <div className="border-t bg-emerald-50 px-4 py-4 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"><CircleDollarSign className="h-4 w-4" />Total final</div>
        <p data-testid="editor-final-total" aria-live="polite" className="mt-1 text-3xl font-bold tracking-tight text-emerald-700 tabular-nums dark:text-emerald-300">{formatCurrency(summary.finalTotal)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-emerald-200 pt-3 text-sm dark:border-emerald-900">
          <div><p className="text-xs text-muted-foreground">Pagado</p><p className="font-semibold tabular-nums">{formatCurrency(summary.paidAmount)}</p></div>
          <div className="text-right"><p className="text-xs text-muted-foreground">Saldo pendiente</p><p className="font-semibold tabular-nums">{formatCurrency(summary.balance)}</p></div>
        </div>
      </div>
      {canViewCost && (
        <div className="border-t bg-indigo-50/70 p-4 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Rentabilidad estimada</span>
            </div>
            <Badge variant="outline" className="border-indigo-300 bg-indigo-100 font-bold text-[10px] text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {profitMargin.toFixed(1)}% Margen
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-indigo-200/70 bg-background/80 p-2 dark:border-indigo-900/60">
              <p className="text-[11px] text-muted-foreground">Costo interno</p>
              <p className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(totalInternalCost)}</p>
            </div>
            <div className="rounded-lg border border-indigo-200/70 bg-background/80 p-2 dark:border-indigo-900/60">
              <p className="text-[11px] text-indigo-900 dark:text-indigo-200">Ganancia bruta</p>
              <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{formatCurrency(grossProfit)}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

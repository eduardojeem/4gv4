import { CircleDollarSign, ReceiptText } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { RepairCostSummary } from '@/lib/repairs/cost-breakdown'

export function RepairCostLiveSummary({ summary }: { summary: RepairCostSummary }) {
  const includedTax = summary.taxBreakdown.reduce((total, row) => total + row.taxAmount, 0)
  const discounts = summary.discountAmount + summary.deductions

  return <aside aria-label="Resumen de costos" className="h-fit overflow-hidden rounded-xl border bg-card lg:sticky lg:top-0">
    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
      <ReceiptText className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">Resumen en tiempo real</h3>
    </div>
    <dl className="space-y-3 px-4 py-4 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Mano de obra</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Repuestos</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.partsSubtotal)}</dd></div>
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
  </aside>
}

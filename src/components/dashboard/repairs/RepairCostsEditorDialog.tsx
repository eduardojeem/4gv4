'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { calculateRepairCost, validateRepairCost, type RepairCostViolation } from '@/lib/repairs/cost-breakdown'
import type { Repair } from '@/types/repairs'
import { RepairPartsEditor, type EditableRepairPart } from './RepairPartsEditor'

function messageFor(violation: RepairCostViolation) {
  const messages = {
    NEGATIVE_AMOUNT: 'Los importes no pueden ser negativos.',
    PART_DISCOUNT_EXCEEDS_GROSS: 'El descuento de una pieza supera su importe.',
    DISCOUNT_EXCEEDS_SUBTOTAL: 'Los descuentos superan el subtotal.',
    DISCOUNT_LIMIT_EXCEEDED: 'El descuento supera el límite permitido del 20%.',
    PART_BELOW_COST: 'Una pieza queda debajo del costo de inventario.',
    OVERRIDE_REASON_REQUIRED: 'La excepción administrativa requiere un motivo de al menos 5 caracteres.',
    FINAL_BELOW_PAID_AMOUNT: 'El total no puede quedar por debajo del monto pagado.',
  }
  return messages[violation.code]
}

export function RepairCostsEditorDialog({ open, repair, maxDiscountPercent = 20, laborTaxRate = 10, onOpenChange, onSaved }: {
  open: boolean
  repair: Repair
  maxDiscountPercent?: number
  laborTaxRate?: 0 | 5 | 10
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return <RepairCostsEditorForm key={`${repair.id}-${open}`} open={open} repair={repair}
    maxDiscountPercent={maxDiscountPercent} laborTaxRate={laborTaxRate}
    onOpenChange={onOpenChange} onSaved={onSaved} />
}

function RepairCostsEditorForm({ open, repair, maxDiscountPercent, laborTaxRate, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; maxDiscountPercent: number; laborTaxRate: 0 | 5 | 10
  onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  const { isAdmin } = useAuth()
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [laborAmount, setLaborAmount] = useState(repair.laborCost || 0)
  const [parts, setParts] = useState<EditableRepairPart[]>(repair.parts.map((part, index) => ({
    key: part.databaseId || String(part.id || index), productId: part.productId, name: part.name,
    partNumber: part.partNumber, supplier: part.supplier, quantity: part.quantity,
    unitPrice: part.cost, unitCost: part.internalCost ?? part.cost,
    discountAmount: part.discountAmount ?? 0, taxRate: part.taxRate ?? laborTaxRate,
    availableStock: part.stockAvailable,
  })))
  const [additionalCharges, setAdditionalCharges] = useState(repair.additionalCharges || 0)
  const [deductions, setDeductions] = useState(repair.deductions || 0)
  const [discountAmount, setDiscountAmount] = useState(repair.discountAmount || 0)
  const [reason, setReason] = useState(repair.priceOverrideReason || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const input = useMemo(() => ({
    currency: 'PYG', laborAmount, laborTaxRate,
    parts: parts.map((part) => ({ key: part.key, quantity: part.quantity, unitPrice: part.unitPrice,
      unitCost: part.unitCost, discountAmount: part.discountAmount, taxRate: part.taxRate })),
    additionalCharges, deductions, discountAmount, paidAmount: repair.paidAmount || 0,
  }), [additionalCharges, deductions, discountAmount, laborAmount, laborTaxRate, parts, repair.paidAmount])
  const summary = useMemo(() => calculateRepairCost(input), [input])
  const violations = useMemo(() => validateRepairCost(input, {
    maxDiscountPercent, isAdmin, overrideReason: reason,
  }), [input, isAdmin, maxDiscountPercent, reason])

  const save = async () => {
    if (violations.length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/costs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laborAmount, additionalCharges, deductions, discountAmount,
          overrideReason: reason.trim() || null,
          idempotencyKey: crypto.randomUUID(),
          parts: parts.map((part) => ({ ...part })),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudieron guardar los costos.')
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los costos.')
      setStep('edit')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
    <DialogContent className="flex max-h-[94dvh] max-w-6xl flex-col overflow-hidden p-0">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>{step === 'edit' ? 'Editar costos y repuestos' : 'Vista previa de costos'}</DialogTitle>
        <DialogDescription>{step === 'edit' ? 'Los precios ya incluyen IVA. El total se valida nuevamente al confirmar.' : 'Revisá el desglose consolidado antes de guardar la revisión.'}</DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {step === 'edit' ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-lg border p-4"><h3 className="mb-3 font-semibold">Mano de obra</h3><Label htmlFor="fixed-labor">Mano de obra fija</Label><Input id="fixed-labor" type="number" min={0} value={laborAmount} onChange={(event) => setLaborAmount(Number(event.target.value) || 0)} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">IVA incluido {laborTaxRate}%</p></section>
            <section className="space-y-3"><h3 className="font-semibold">Repuestos</h3><RepairPartsEditor parts={parts} onChange={setParts} disabled={saving} /></section>
            <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3"><div><Label htmlFor="additional-charges">Cargos adicionales</Label><Input id="additional-charges" type="number" min={0} value={additionalCharges} onChange={(event) => setAdditionalCharges(Number(event.target.value) || 0)} /></div><div><Label htmlFor="general-discount">Descuento general</Label><Input id="general-discount" type="number" min={0} value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value) || 0)} /></div><div><Label htmlFor="deductions">Deducciones</Label><Input id="deductions" type="number" min={0} value={deductions} onChange={(event) => setDeductions(Number(event.target.value) || 0)} /></div></section>
            {(isAdmin || reason) && <div><Label htmlFor="cost-override-reason">Motivo de excepción</Label><Input id="cost-override-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatorio para autorizar una excepción" /></div>}
            {(violations.length > 0 || saveError) && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{saveError || messageFor(violations[0])}</div>}
          </div>
          <aside className="h-fit rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-0"><h3 className="font-semibold">Resumen en tiempo real</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt>Mano de obra</dt><dd>{formatCurrency(summary.laborAmount)}</dd></div><div className="flex justify-between"><dt>Subtotal de repuestos</dt><dd>{formatCurrency(summary.partsSubtotal)}</dd></div><div className="flex justify-between text-rose-600"><dt>Descuentos</dt><dd>- {formatCurrency(summary.discountAmount + summary.deductions)}</dd></div></dl><div className="mt-4 rounded-md bg-emerald-50 p-4 dark:bg-emerald-950/30"><p className="text-xs font-medium">Total final</p><p data-testid="editor-final-total" aria-live="polite" className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.finalTotal)}</p><p className="text-xs">Pendiente: {formatCurrency(summary.balance)}</p></div></aside>
        </div> : <div className="mx-auto max-w-3xl space-y-5"><section className="rounded-lg border p-4"><h3 className="font-semibold">Composición</h3><dl className="mt-3 space-y-2"><div className="flex justify-between"><dt>Mano de obra fija</dt><dd>{formatCurrency(summary.laborAmount)}</dd></div>{parts.map((part) => <div key={part.key} className="flex justify-between text-sm"><dt>{part.quantity} × {part.name}</dt><dd>{formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}</dd></div>)}<div className="flex justify-between"><dt>Descuentos y deducciones</dt><dd>- {formatCurrency(summary.discountAmount + summary.deductions)}</dd></div></dl></section><section className="rounded-lg border p-4"><h3 className="font-semibold">IVA incluido</h3>{summary.taxBreakdown.map((tax) => <p key={tax.rate} className="mt-2 flex justify-between text-sm"><span>Tasa {tax.rate}% · Base {formatCurrency(tax.taxableBase)}</span><strong>{formatCurrency(tax.taxAmount)}</strong></p>)}</section><div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"><p>Monto total final</p><p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.finalTotal)}</p><p className="mt-2 text-sm">Pagado {formatCurrency(summary.paidAmount)} · Pendiente {formatCurrency(summary.balance)}</p></div></div>}
      </div>
      <DialogFooter className="border-t bg-background px-4 py-3">
        {step === 'preview' && <Button type="button" variant="outline" disabled={saving} onClick={() => setStep('edit')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>}
        <Button type="button" variant={step === 'edit' ? 'default' : 'default'} disabled={saving || violations.length > 0} onClick={() => step === 'edit' ? setStep('preview') : void save()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 'preview' ? <Check className="mr-2 h-4 w-4" /> : null}
          {step === 'edit' ? 'Revisar y confirmar' : isAdmin && reason ? 'Autorizar y confirmar' : 'Confirmar costos'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, CircleDollarSign, Loader2, Wrench } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { calculateRepairCost, validateRepairCost, type RepairCostViolation } from '@/lib/repairs/cost-breakdown'
import type { Repair } from '@/types/repairs'
import { RepairCostLiveSummary } from './RepairCostLiveSummary'
import { RepairPartsEditor, type EditableRepairPart } from './RepairPartsEditor'

const violationMessages: Record<RepairCostViolation['code'], string> = {
  NEGATIVE_AMOUNT: 'Los importes no pueden ser negativos.', PART_DISCOUNT_EXCEEDS_GROSS: 'El descuento de una pieza supera su importe.',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'Los descuentos superan el subtotal.', DISCOUNT_LIMIT_EXCEEDED: 'El descuento supera el límite permitido.',
  PART_BELOW_COST: 'Una pieza queda debajo del costo de inventario.', OVERRIDE_REASON_REQUIRED: 'La excepción administrativa requiere un motivo de al menos 5 caracteres.',
  FINAL_BELOW_PAID_AMOUNT: 'El total no puede quedar por debajo del monto pagado.',
}

export function RepairCostsEditorDialog({ open, repair, maxDiscountPercent = 20, laborTaxRate = 10, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; maxDiscountPercent?: number; laborTaxRate?: 0 | 5 | 10
  onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return <RepairCostsEditorForm key={`${repair.id}-${open}`} open={open} repair={repair} maxDiscountPercent={maxDiscountPercent} laborTaxRate={laborTaxRate} onOpenChange={onOpenChange} onSaved={onSaved} />
}

function RepairCostsEditorForm({ open, repair, maxDiscountPercent, laborTaxRate, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; maxDiscountPercent: number; laborTaxRate: 0 | 5 | 10
  onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  const { isAdmin } = useAuth()
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [laborAmount, setLaborAmount] = useState(repair.laborCost || 0)
  const [parts, setParts] = useState<EditableRepairPart[]>(repair.parts.map((part, index) => ({
    key: part.databaseId || String(part.id || index), productId: part.productId, name: part.name, partNumber: part.partNumber,
    supplier: part.supplier, quantity: part.quantity, unitPrice: part.cost, unitCost: part.internalCost ?? part.cost,
    discountAmount: part.discountAmount ?? 0, taxRate: part.taxRate ?? laborTaxRate, availableStock: part.stockAvailable,
  })))
  const [additionalCharges, setAdditionalCharges] = useState(repair.additionalCharges || 0)
  const [deductions, setDeductions] = useState(repair.deductions || 0)
  const [discountAmount, setDiscountAmount] = useState(repair.discountAmount || 0)
  const [reason, setReason] = useState(repair.priceOverrideReason || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const input = useMemo(() => ({ currency: 'PYG', laborAmount, laborTaxRate,
    parts: parts.map((part) => ({ key: part.key, quantity: part.quantity, unitPrice: part.unitPrice, unitCost: part.unitCost, discountAmount: part.discountAmount, taxRate: part.taxRate })),
    additionalCharges, deductions, discountAmount, paidAmount: repair.paidAmount || 0,
  }), [additionalCharges, deductions, discountAmount, laborAmount, laborTaxRate, parts, repair.paidAmount])
  const summary = useMemo(() => calculateRepairCost(input), [input])
  const violations = useMemo(() => validateRepairCost(input, { maxDiscountPercent, isAdmin, overrideReason: reason }), [input, isAdmin, maxDiscountPercent, reason])

  const save = async () => {
    if (violations.length > 0) return
    setSaving(true); setSaveError(null)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/costs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ laborAmount, additionalCharges, deductions, discountAmount, overrideReason: reason.trim() || null, idempotencyKey: crypto.randomUUID(), parts }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudieron guardar los costos.')
      await onSaved(); onOpenChange(false)
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los costos.'); setStep('edit') }
    finally { setSaving(false) }
  }

  const deviceLabel = [repair.brand, repair.model].filter(Boolean).join(' ') || repair.device
  const invalidPartKeys = new Set(violations.filter((item) => item.partKey).map((item) => item.partKey as string))
  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
    <DialogContent className="flex h-[96dvh] max-h-[96dvh] w-[calc(100%-1rem)] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px] lg:w-[calc(100%-2rem)]">
      <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><DialogTitle>{step === 'edit' ? 'Editar costos y repuestos' : 'Vista previa de costos'}</DialogTitle><DialogDescription className="mt-1">{repair.customer.name} · {deviceLabel}</DialogDescription></div><span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">Paso {step === 'edit' ? '1' : '2'} de 2</span></div><div aria-label="Progreso" className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium"><Step number={1} label="Editar costos" active /><Step number={2} label="Confirmar" active={step === 'preview'} /></div></DialogHeader>
      <div className="flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-5">
        {step === 'edit' ? <div className="grid gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(340px,0.8fr)]"><div className="min-w-0 space-y-4">
          <section className="rounded-xl border bg-card p-4"><div className="mb-4 flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /><div><h3 className="font-semibold">Mano de obra</h3><p className="text-xs text-muted-foreground">Monto fijo con IVA incluido del {laborTaxRate}%.</p></div></div><Label htmlFor="fixed-labor">Mano de obra fija</Label><MoneyInput id="fixed-labor" value={laborAmount} onChange={setLaborAmount} prominent /></section>
          <section className="rounded-xl border bg-card p-4"><div className="mb-4"><h3 className="font-semibold">Repuestos utilizados</h3><p className="text-xs text-muted-foreground">Buscá en inventario y ajustá cantidad, precio o descuento.</p></div><RepairPartsEditor parts={parts} onChange={setParts} disabled={saving} invalidPartKeys={invalidPartKeys} /></section>
          <section className="rounded-xl border bg-card p-4"><div className="mb-4"><h3 className="font-semibold">Ajustes del total</h3><p className="text-xs text-muted-foreground">Aplicá cargos o deducciones al presupuesto consolidado.</p></div><div className="grid gap-4 sm:grid-cols-3"><MoneyField id="additional-charges" label="Cargos adicionales" value={additionalCharges} onChange={setAdditionalCharges} /><MoneyField id="general-discount" label="Descuento general" value={discountAmount} onChange={setDiscountAmount} /><MoneyField id="deductions" label="Deducciones" value={deductions} onChange={setDeductions} /></div></section>
          {(isAdmin || reason) && <div className="rounded-xl border bg-card p-4"><Label htmlFor="cost-override-reason">Motivo de excepción administrativa</Label><Input id="cost-override-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explicá por qué autorizás esta excepción" className="mt-1" /></div>}
          {(violations.length > 0 || saveError) && <div role="alert" aria-live="assertive" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{saveError || violationMessages[violations[0].code]}</span></div>}
        </div><RepairCostLiveSummary summary={summary} /></div> : <Preview summary={summary} parts={parts} />}
      </div>
      <DialogFooter className="flex-row justify-between gap-2 border-t bg-background px-3 py-3 sm:px-5"><Button type="button" variant="ghost" disabled={saving} onClick={() => step === 'preview' ? setStep('edit') : onOpenChange(false)}>{step === 'preview' && <ArrowLeft className="mr-2 h-4 w-4" />}{step === 'preview' ? 'Volver a editar' : 'Cancelar'}</Button><Button type="button" disabled={saving || violations.length > 0} onClick={() => step === 'edit' ? setStep('preview') : void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 'preview' ? <Check className="mr-2 h-4 w-4" /> : null}{step === 'edit' ? 'Revisar y confirmar' : 'Confirmar costos'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function Step({ number, label, active }: { number: number; label: string; active: boolean }) { return <div className={`flex items-center gap-2 ${active ? '' : 'text-muted-foreground'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{number}</span><span>{label}</span></div> }
function MoneyInput({ id, value, onChange, prominent }: { id: string; value: number; onChange: (value: number) => void; prominent?: boolean }) { return <div className="relative mt-1"><Input id={id} type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className={`pr-10 text-right tabular-nums ${prominent ? 'h-11 font-semibold' : ''}`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Gs.</span></div> }
function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) { return <div><Label htmlFor={id}>{label}</Label><MoneyInput id={id} value={value} onChange={onChange} /></div> }
function Preview({ summary, parts }: { summary: ReturnType<typeof calculateRepairCost>; parts: EditableRepairPart[] }) { return <div className="mx-auto max-w-3xl space-y-4"><section className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Composición del monto</h3><dl className="mt-3 divide-y text-sm"><div className="flex justify-between py-2"><dt>Mano de obra fija</dt><dd className="font-medium tabular-nums">{formatCurrency(summary.laborAmount)}</dd></div>{parts.map((part) => <div key={part.key} className="flex justify-between gap-4 py-2"><dt>{part.quantity} × {part.name}</dt><dd className="font-medium tabular-nums">{formatCurrency(Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}</dd></div>)}<div className="flex justify-between py-2 text-rose-600"><dt>Descuentos y deducciones</dt><dd>- {formatCurrency(summary.discountAmount + summary.deductions)}</dd></div></dl></section><section className="rounded-xl border bg-card p-4"><h3 className="font-semibold">IVA incluido</h3>{summary.taxBreakdown.map((tax) => <p key={tax.rate} className="mt-2 flex justify-between gap-4 text-sm"><span>Tasa {tax.rate}% · Base {formatCurrency(tax.taxableBase)}</span><strong className="tabular-nums">{formatCurrency(tax.taxAmount)}</strong></p>)}</section><div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"><div className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-5 w-5" />Monto total final</div><p className="mt-1 text-3xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300">{formatCurrency(summary.finalTotal)}</p><p className="mt-3 border-t border-emerald-200 pt-3 text-sm dark:border-emerald-900">Pagado {formatCurrency(summary.paidAmount)} · Pendiente {formatCurrency(summary.balance)}</p></div></div> }

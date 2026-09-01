'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, History, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import type { Repair } from '@/types/repairs'

type EditableCost = { partId: string; name: string; quantity: number; previousUnitCost: number; unitCost: number }

export function RepairInternalCostCorrectionDialog({ open, repair, onOpenChange, onSaved }: {
  open: boolean
  repair: Repair
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return <CorrectionForm key={`${repair.id}-${open}`} open={open} repair={repair} onOpenChange={onOpenChange} onSaved={onSaved} />
}

function CorrectionForm({ open, repair, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  const initialRows = useMemo<EditableCost[]>(() => repair.parts
    .filter((part): part is typeof part & { databaseId: string } => Boolean(part.databaseId))
    .map((part) => ({
      partId: part.databaseId,
      name: part.name,
      quantity: part.quantity,
      previousUnitCost: part.internalCost ?? part.cost,
      unitCost: part.internalCost ?? part.cost,
    })), [repair.parts])
  const [rows, setRows] = useState(initialRows)
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<'edit' | 'confirm'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previousTotal = useMemo(() => rows.reduce((sum, row) => sum + row.previousUnitCost * row.quantity, 0), [rows])
  const newTotal = useMemo(() => rows.reduce((sum, row) => sum + row.unitCost * row.quantity, 0), [rows])
  const changedRows = rows.filter((row) => row.unitCost !== row.previousUnitCost)
  const saleTotal = repair.finalCost ?? repair.estimatedCost ?? 0
  const previousMargin = saleTotal - previousTotal
  const newMargin = saleTotal - newTotal
  const canContinue = changedRows.length > 0 && reason.trim().length >= 10 && rows.every((row) => Number.isFinite(row.unitCost) && row.unitCost >= 0)

  const save = async () => {
    if (!canContinue) return
    setSaving(true); setError(null)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/costs/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrections: changedRows.map((row) => ({ partId: row.partId, unitCost: row.unitCost })),
          reason: reason.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudo corregir el costo interno.')
      await onSaved()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo corregir el costo interno.')
      setStep('edit')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><ShieldCheck className="h-5 w-5" /></span>
          <div><DialogTitle>Corregir costo interno</DialogTitle><DialogDescription className="mt-1">Reparación entregada · el precio y el pago del cliente no cambiarán.</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {step === 'edit' ? <div className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Corrección administrativa auditada</p>
            <p className="mt-1 text-xs">Solo cambia el costo interno y la rentabilidad. No modifica stock, total cobrado, pagos, entrega ni caja.</p>
          </div>
          {rows.length === 0 ? <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">Esta reparación no tiene repuestos identificables para corregir.</div> : <div className="space-y-3">
            {rows.map((row) => <div key={row.partId} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_150px_170px] sm:items-end">
              <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">Cantidad {row.quantity} · anterior {formatCurrency(row.previousUnitCost)} por unidad</p></div>
              <div><Label htmlFor={`old-${row.partId}`}>Costo anterior</Label><Input id={`old-${row.partId}`} value={row.previousUnitCost} disabled className="mt-1 text-right" /></div>
              <div><Label htmlFor={`new-${row.partId}`}>Nuevo costo interno</Label><div className="relative mt-1"><Input id={`new-${row.partId}`} type="number" min={0} value={row.unitCost} onChange={(event) => setRows((current) => current.map((item) => item.partId === row.partId ? { ...item, unitCost: Number(event.target.value) || 0 } : item))} className="pr-10 text-right font-semibold" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Gs.</span></div></div>
            </div>)}
          </div>}
          <div><Label htmlFor="cost-correction-reason">Motivo obligatorio</Label><Input id="cost-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: Error de digitación, faltaron tres ceros" className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Mínimo 10 caracteres. Quedará visible en el historial.</p></div>
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
        </div> : <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Resumen de la corrección</div><dl className="mt-4 space-y-3 text-sm"><AmountRow label="Costo interno anterior" value={previousTotal} /><AmountRow label="Nuevo costo interno" value={newTotal} strong /><AmountRow label="Diferencia" value={newTotal - previousTotal} /><hr /><AmountRow label="Precio al cliente (sin cambios)" value={saleTotal} strong /><AmountRow label="Ganancia anterior" value={previousMargin} /><AmountRow label="Ganancia corregida" value={newMargin} strong /></dl></div>
          {newTotal > saleTotal && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />El costo interno supera el precio cobrado. La reparación quedará con margen negativo.</div>}
          <div className="rounded-xl border bg-muted/30 p-3 text-sm"><span className="font-medium">Motivo:</span> {reason.trim()}</div>
          <p className="text-xs text-muted-foreground">Al confirmar se agregará una revisión inmutable con tu usuario, fecha, valores anteriores y nuevos.</p>
        </div>}
      </div>
      <DialogFooter className="flex-row justify-between gap-2 border-t px-4 py-3 sm:px-6">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => step === 'confirm' ? setStep('edit') : onOpenChange(false)}>{step === 'confirm' && <ArrowLeft className="mr-2 h-4 w-4" />}{step === 'confirm' ? 'Volver' : 'Cancelar'}</Button>
        <Button type="button" disabled={saving || !canContinue} onClick={() => step === 'edit' ? setStep('confirm') : void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 'confirm' ? <Check className="mr-2 h-4 w-4" /> : null}{step === 'edit' ? 'Revisar corrección' : 'Confirmar corrección'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function AmountRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={`tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}>{formatCurrency(value)}</dd></div>
}

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, HandCoins, Loader2, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import type { Repair } from '@/types/repairs'

export function RepairFinalPriceCorrectionDialog({ open, repair, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return <FinalPriceForm key={`${repair.id}-${open}`} open={open} repair={repair} onOpenChange={onOpenChange} onSaved={onSaved} />
}

function FinalPriceForm({ open, repair, onOpenChange, onSaved }: {
  open: boolean; repair: Repair; onOpenChange: (open: boolean) => void; onSaved: () => void | Promise<void>
}) {
  const router = useRouter()
  const currentTotal = repair.finalCost ?? repair.estimatedCost ?? 0
  const paid = repair.paidAmount ?? 0
  const [newTotal, setNewTotal] = useState(currentTotal)
  const [reason, setReason] = useState('')
  // «Dar saldo por perdido»: el precio baja a lo pagado y la deuda sale de Por cobrar,
  // con el motivo registrado. Es la misma corrección auditada, con el caso a la vista.
  const [writeOff, setWriteOff] = useState(false)
  const [step, setStep] = useState<'edit' | 'confirm'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const difference = newTotal - currentTotal
  const overpayment = Math.max(0, paid - newTotal)
  const newBalance = Math.max(0, newTotal - paid)
  const newStatus = useMemo(() => {
    if (newTotal === 0) return paid > 0 ? 'Anticipo a favor' : 'Sin costo'
    if (paid >= newTotal) return 'Pagado'
    if (paid > 0) return 'Pago parcial'
    return 'Pendiente'
  }, [newTotal, paid])
  const canContinue = Number.isFinite(newTotal) && newTotal >= 0 && newTotal !== currentTotal && reason.trim().length >= 10 && overpayment === 0
  const outstanding = Math.max(0, currentTotal - paid)
  const finalReason = writeOff ? `Saldo dado por perdido (${formatCurrency(outstanding)}): ${reason.trim()}` : reason.trim()

  const save = async () => {
    if (!canContinue) return
    setSaving(true); setError(null)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/costs/final-correction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newFinalTotal: newTotal, reason: finalReason.slice(0, 500), idempotencyKey: crypto.randomUUID() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudo corregir el precio final.')
      await onSaved(); onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo corregir el precio final.'); setStep('edit')
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><ReceiptText className="h-5 w-5" /></span><div><DialogTitle>Corregir precio final</DialogTitle><DialogDescription className="mt-1">Ajuste comercial auditado de una reparación entregada.</DialogDescription></div></div></DialogHeader>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {step === 'edit' ? <div className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm"><p>Precio actual: <strong>{formatCurrency(currentTotal)}</strong></p><p className="mt-1">Pagado: <strong>{formatCurrency(paid)}</strong></p></div>
          {outstanding > 0 && !writeOff ? <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><HandCoins className="h-4 w-4 text-muted-foreground" />¿El cliente no va a pagar el saldo de {formatCurrency(outstanding)}?</p>
            <p className="text-xs text-muted-foreground">Llevá el precio a lo que ya pagó: la deuda deja de figurar en Por cobrar y queda registrado el motivo. No toca la caja ni los pagos.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { setWriteOff(true); setNewTotal(paid) }}>Dar saldo por perdido</Button>
          </div> : null}
          {writeOff ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">Saldo dado por perdido: {formatCurrency(outstanding)}</p>
            <p className="text-xs">El precio queda en {formatCurrency(paid)} (lo pagado). Contá abajo por qué no se va a cobrar.</p>
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2" onClick={() => { setWriteOff(false); setNewTotal(currentTotal) }}>Volver a corregir el precio</Button>
          </div> : null}
          <div><Label htmlFor="corrected-final-price">Nuevo precio final</Label><div className="relative mt-1"><Input id="corrected-final-price" type="number" min={0} value={newTotal} disabled={writeOff} onChange={(event) => setNewTotal(Number(event.target.value) || 0)} className="h-12 pr-12 text-right text-lg font-bold" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Gs.</span></div></div>
          <div><Label htmlFor="final-price-correction-reason">{writeOff ? '¿Por qué no se va a cobrar?' : 'Motivo obligatorio'}</Label><Input id="final-price-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={writeOff ? 'Ej.: El cliente no responde hace 6 meses' : 'Ej.: El precio final fue digitado incorrectamente'} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Mínimo 10 caracteres. Quedará registrado con tu usuario y fecha.</p></div>
          {overpayment > 0 && <div role="alert" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />Existe un excedente de {formatCurrency(overpayment)}</div><p className="text-xs">No se puede reducir el precio por debajo de lo pagado sin registrar qué ocurrió con ese dinero. Creá y resolvé primero un caso de devolución o saldo a favor en Posventa.</p><Button type="button" variant="outline" size="sm" onClick={() => { router.push(`/dashboard/after-sales?repairId=${repair.id}`) }}>Ir a Posventa</Button></div>}
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
        </div> : <div className="space-y-4"><div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Resumen antes de confirmar</h3><dl className="mt-4 space-y-3 text-sm"><AmountRow label="Precio anterior" value={currentTotal} /><AmountRow label="Nuevo precio final" value={newTotal} strong /><AmountRow label="Diferencia" value={difference} /><hr /><AmountRow label="Pagado (sin cambios)" value={paid} /><AmountRow label="Nuevo saldo pendiente" value={newBalance} strong /><div className="flex justify-between"><dt className="text-muted-foreground">Estado financiero</dt><dd className="font-semibold">{newStatus}</dd></div></dl></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><strong>Motivo:</strong> {finalReason}</div><p className="text-xs text-muted-foreground">No se modificarán pagos existentes, caja, costo interno, piezas ni inventario.</p></div>}
      </div>
      <DialogFooter className="flex-row justify-between gap-2 border-t px-4 py-3 sm:px-6"><Button type="button" variant="ghost" disabled={saving} onClick={() => step === 'confirm' ? setStep('edit') : onOpenChange(false)}>{step === 'confirm' && <ArrowLeft className="mr-2 h-4 w-4" />}{step === 'confirm' ? 'Volver' : 'Cancelar'}</Button><Button type="button" disabled={saving || !canContinue} onClick={() => step === 'edit' ? setStep('confirm') : void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 'confirm' ? <Check className="mr-2 h-4 w-4" /> : null}{step === 'edit' ? 'Revisar corrección' : writeOff ? 'Dar saldo por perdido' : 'Confirmar nuevo precio'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function AmountRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={`tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}>{value < 0 ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}</dd></div>
}

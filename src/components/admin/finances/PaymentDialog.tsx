'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PaymentDialog({ open, onOpenChange, organizationId, obligationId, branchId, payrollEntryId, outstandingAmount, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; obligationId?: string; payrollEntryId?: string; branchId: string | null | undefined; outstandingAmount?: number; onSaved: () => void | Promise<void>
}) {
  const [method, setMethod] = useState('bank_transfer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const target = payrollEntryId ? `/api/admin/finances/payroll/${payrollEntryId}/payments` : `/api/admin/finances/obligations/${obligationId}/payments`
  async function submit(formData: FormData) {
    if (isSubmitting) return
    setIsSubmitting(true); setError(null)
    idempotencyKeyRef.current ??= `payment-${crypto.randomUUID()}`
    const payment = { amount: Number(formData.get('amount')), paymentMethod: method, paymentDate: formData.get('paymentDate'), cashSessionId: method === 'cash' ? formData.get('cashSessionId') : undefined, reference: String(formData.get('reference')) || undefined }
    const response = await fetch(`${target}?organizationId=${organizationId}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKeyRef.current }, body: JSON.stringify(payrollEntryId ? payment : { ...payment, branchId }) })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) { setError(payload?.error ?? 'No se pudo registrar el pago.'); return }
    await onSaved(); idempotencyKeyRef.current = null; onOpenChange(false)
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Registrar pago</DialogTitle><DialogDescription>El servidor valida el saldo disponible y la sesión de caja.</DialogDescription></DialogHeader><form action={submit} className="grid gap-4">{outstandingAmount !== undefined ? <p className="text-sm text-muted-foreground">Pendiente autorizado: ₲ {Math.round(outstandingAmount).toLocaleString('es-PY')}</p> : null}<label className="grid gap-1 text-sm font-medium">Monto<input name="amount" type="number" min="0.01" max={outstandingAmount} step="0.01" required className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium">Método de pago<select aria-label="Método de pago" value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-md border bg-background px-3 py-2"><option value="bank_transfer">Transferencia bancaria</option><option value="cash">Efectivo</option><option value="other">Otro</option></select></label>{method === 'cash' ? <label className="grid gap-1 text-sm font-medium">Sesión de caja<input name="cashSessionId" aria-label="Sesión de caja" required className="rounded-md border bg-background px-3 py-2" /></label> : null}<label className="grid gap-1 text-sm font-medium">Fecha de pago<input name="paymentDate" type="date" required className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium">Referencia (opcional)<input name="reference" className="rounded-md border bg-background px-3 py-2" /></label>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registrando…' : 'Registrar pago'}</Button></DialogFooter></form></DialogContent></Dialog>
}

'use client'

import { useRef, useState } from 'react'
import {
  Banknote,
  Building,
  CheckCircle2,
  Coins,
  CreditCard,
  FileText,
  Loader2,
  Wallet,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'

export function PaymentDialog({
  open,
  onOpenChange,
  organizationId,
  obligationId,
  payrollEntryId,
  branchId,
  outstandingAmount,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  obligationId?: string
  payrollEntryId?: string
  branchId: string | null | undefined
  outstandingAmount?: number
  onSaved: () => void | Promise<void>
}) {
  const [method, setMethod] = useState('bank_transfer')
  const [amountValue, setAmountValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)

  const target = payrollEntryId
    ? `/api/admin/finances/payroll/${payrollEntryId}/payments`
    : `/api/admin/finances/obligations/${obligationId}/payments`

  async function submit(formData: FormData) {
    if (isSubmitting) return
    const amount = Number(formData.get('amount'))
    if (outstandingAmount !== undefined && amount > outstandingAmount) {
      setError(`El monto no puede superar el pendiente autorizado (${formatCurrency(outstandingAmount)}).`)
      return
    }
    setIsSubmitting(true)
    setError(null)
    idempotencyKeyRef.current ??= `payment-${crypto.randomUUID()}`
    const rawDate = String(formData.get('paymentDate') ?? '').trim()
    const isoMatch = rawDate.match(/\d{4}-\d{2}-\d{2}$/)
    const paymentDate = isoMatch ? isoMatch[0] : (rawDate || new Date().toISOString().slice(0, 10))

    const payment = {
      amount,
      paymentMethod: method,
      paymentDate,
      cashSessionId: method === 'cash' ? formData.get('cashSessionId') : undefined,
      reference: String(formData.get('reference')) || undefined,
    }
    const response = await fetch(`${target}?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKeyRef.current },
      body: JSON.stringify(payrollEntryId ? payment : { ...payment, branchId }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo registrar el pago.')
      return
    }
    await onSaved()
    idempotencyKeyRef.current = null
    onOpenChange(false)
  }

  function handleFillTotal() {
    if (outstandingAmount !== undefined) {
      setAmountValue(String(outstandingAmount))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden sm:rounded-2xl shadow-2xl border-border/80">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Registrar pago</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {payrollEntryId
                  ? 'Emite un pago total o parcial correspondiente a la nómina de este colaborador.'
                  : 'Registra la cancelación o abono de esta obligación financiera.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form action={submit} className="p-6 space-y-4">
          {/* Card de Saldo Pendiente Autorizado */}
          {outstandingAmount !== undefined ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Saldo pendiente autorizado
                </span>
                <p className="text-lg font-bold text-amber-950 dark:text-amber-200 tabular-nums mt-0.5">
                  {formatCurrency(outstandingAmount)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillTotal}
                className="h-8 text-xs font-semibold bg-background border-amber-500/30 hover:bg-amber-500/20 text-amber-950 dark:text-amber-200 shrink-0"
              >
                Pagar total
              </Button>
            </div>
          ) : null}

          {/* Campo de Monto */}
          <div className="space-y-1.5">
            <label htmlFor="payment-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monto
            </label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              min="0.01"
              max={outstandingAmount}
              step="0.01"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              placeholder="0"
              required
              className="text-base font-bold tabular-nums"
            />
          </div>

          {/* Método de Pago */}
          <div className="space-y-1.5">
            <label htmlFor="payment-method" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Método de pago
            </label>
            <select
              id="payment-method"
              aria-label="Método de pago"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="bank_transfer">Transferencia bancaria</option>
              <option value="cash">Efectivo</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {/* Sesión de Caja (solo si es efectivo) */}
          {method === 'cash' ? (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <label htmlFor="cash-session-id" className="text-xs font-semibold uppercase tracking-wider text-primary">
                Sesión de caja
              </label>
              <Input
                id="cash-session-id"
                name="cashSessionId"
                aria-label="Sesión de caja"
                placeholder="ID o código de la sesión de caja"
                required
                className="bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                Los egresos en efectivo requieren vincularse a una sesión de caja abierta.
              </p>
            </div>
          ) : null}

          {/* Fecha de Pago */}
          <div className="space-y-1.5">
            <label htmlFor="payment-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fecha de pago
            </label>
            <Input
              id="payment-date"
              name="paymentDate"
              aria-label="Fecha de pago"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              onFocus={(e) => {
                e.currentTarget.select()
              }}
            />
          </div>

          {/* Referencia Opcional */}
          <div className="space-y-1.5">
            <label htmlFor="payment-reference" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Referencia (opcional)
            </label>
            <Input
              id="payment-reference"
              name="reference"
              placeholder="Ej. Comprobante de transferencia #12345"
            />
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter className="pt-3 border-t gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                'Registrar pago'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


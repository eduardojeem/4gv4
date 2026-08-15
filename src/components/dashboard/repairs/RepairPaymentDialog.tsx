'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  Banknote,
  CreditCard,
  Smartphone,
  Loader2,
  DollarSign,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Repair } from '@/types/repairs'
import { useCashRegister } from '@/hooks/useCashRegister'
import { OpenCashRegisterDialog } from '@/app/dashboard/pos/components/OpenCashRegisterDialog'

export type QuickPayMethod = 'cash' | 'card' | 'transfer' | 'credit'
export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface RepairPaymentResult {
  idempotencyKey: string
  method: QuickPayMethod
  amount: number
  reference?: string
  note?: string
  /** Solo para method === 'credit'. */
  interestRate?: number
  installments?: { count: number; frequency: CreditFrequency }
}

interface RepairPaymentDialogProps {
  open: boolean
  repair: Repair | null
  onOpenChange: (open: boolean) => void
  onConfirm: (repairId: string, result: RepairPaymentResult) => Promise<void>
}

// Se exportan para que RepairDeliveryDialog reuse el mismo selector de método
// y de cuotas al cobrar en el momento de la entrega, en vez de duplicarlos.
export const PAYMENT_METHODS: { id: QuickPayMethod; label: string; icon: React.ElementType; requiresRef: boolean }[] = [
  { id: 'cash',     label: 'Efectivo',       icon: Banknote,    requiresRef: false },
  { id: 'card',     label: 'Tarjeta',        icon: CreditCard,  requiresRef: true  },
  { id: 'transfer', label: 'Transferencia',  icon: Smartphone,  requiresRef: true  },
  { id: 'credit',   label: 'Crédito',        icon: CalendarClock, requiresRef: false },
]

export const CREDIT_FREQUENCIES: { id: CreditFrequency; label: string }[] = [
  { id: 'weekly',   label: 'Semanal'   },
  { id: 'biweekly', label: 'Quincenal' },
  { id: 'monthly',  label: 'Mensual'   },
]

const METHODS = PAYMENT_METHODS
const FREQUENCIES = CREDIT_FREQUENCIES

export function RepairPaymentDialog({
  open,
  repair,
  onOpenChange,
  onConfirm,
}: RepairPaymentDialogProps) {
  const cashRegister = useCashRegister()
  const checkOpenSessionRef = useRef(cashRegister.checkOpenSession)
  // Saldo real pendiente: si ya se cobró algo antes (a cuenta, o desde el
  // POS), no tiene sentido sugerir el costo total de nuevo.
  const totalDue = repair ? (repair.finalCost ?? repair.estimatedCost ?? 0) : 0
  const alreadyPaid = repair?.paidAmount ?? 0
  const persistedBalanceDue = Math.max(0, totalDue - alreadyPaid)

  const [method, setMethod] = useState<QuickPayMethod>('cash')
  const [amount, setAmount] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Términos de crédito (solo aplican con method === 'credit')
  const [installmentCount, setInstallmentCount] = useState('3')
  const [frequency, setFrequency] = useState<CreditFrequency>('monthly')
  const [interestRate, setInterestRate] = useState('0')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [cashStatus, setCashStatus] = useState<'checking' | 'open' | 'closed'>('checking')
  const [isOpeningRegister, setIsOpeningRegister] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')
  const [isOpening, setIsOpening] = useState(false)
  const [currentBalanceOverride, setCurrentBalanceOverride] = useState<number | null>(null)
  const [balanceRefreshMessage, setBalanceRefreshMessage] = useState<string | null>(null)
  const balanceDue = currentBalanceOverride ?? persistedBalanceDue

  useEffect(() => {
    checkOpenSessionRef.current = cashRegister.checkOpenSession
  }, [cashRegister.checkOpenSession])

  const refreshCashStatus = useCallback(async () => {
    setCashStatus('checking')
    const session = await checkOpenSessionRef.current()
    setCashStatus(session ? 'open' : 'closed')
    return Boolean(session)
  }, [])

  useEffect(() => {
    if (open) {
      setIdempotencyKey(`repair-payment-${crypto.randomUUID()}`)
      void refreshCashStatus()
    }
  }, [open, repair?.id, refreshCashStatus])

  const isCredit = method === 'credit'
  const parsedAmount = parseFloat(amount) || 0
  const parsedCashReceived = parseFloat(cashReceived) || 0
  const amountExceedsBalance = parsedAmount > balanceDue
  const invalidCreditAmount = isCredit && parsedAmount !== balanceDue
  const insufficientCash = method === 'cash' && parsedCashReceived < parsedAmount
  const changeDue = method === 'cash' ? Math.max(0, parsedCashReceived - parsedAmount) : 0
  const requiresOpenRegister = !isCredit

  const handleClose = () => {
    if (isSubmitting) return
    setMethod('cash')
    setAmount('')
    setCashReceived('')
    setReference('')
    setNote('')
    setInstallmentCount('3')
    setFrequency('monthly')
    setInterestRate('0')
    setIsOpeningRegister(false)
    setOpeningAmount('0')
    setOpeningNote('')
    setCurrentBalanceOverride(null)
    setBalanceRefreshMessage(null)
    onOpenChange(false)
  }

  const handleOpenRegister = async (initialAmount: number, openingReference: string) => {
    setIsOpening(true)
    try {
      const opened = await cashRegister.openRegister('principal', initialAmount, undefined, openingReference)
      if (!opened) return
      setIsOpeningRegister(false)
      setOpeningAmount('0')
      setOpeningNote('')
      await refreshCashStatus()
    } finally {
      setIsOpening(false)
    }
  }

  const handleConfirm = async () => {
    if (!repair) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    if (parsed > balanceDue || (isCredit && parsed !== balanceDue)) return
    if (method === 'cash' && parsedCashReceived < parsed) return

    const selectedMethod = METHODS.find(m => m.id === method)
    if (selectedMethod?.requiresRef && !reference.trim()) return

    const count = Math.max(1, Math.floor(Number(installmentCount) || 0))
    const rate = Math.max(0, Number(interestRate) || 0)
    if (isCredit && count < 1) return

    setIsSubmitting(true)
    try {
      await onConfirm(repair.id, {
        idempotencyKey,
        method,
        amount: parsed,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        ...(isCredit ? { interestRate: rate, installments: { count, frequency } } : {}),
      })
      handleClose()
    } catch (error) {
      const paymentError = error as { code?: string; currentBalance?: number; message?: string }
      if (
        ['REPAIR_HAS_NO_BALANCE', 'REPAIR_PAYMENT_EXCEEDS_BALANCE', 'REPAIR_CREDIT_MUST_COVER_BALANCE'].includes(paymentError.code || '') &&
        Number.isFinite(paymentError.currentBalance) &&
        Number(paymentError.currentBalance) >= 0
      ) {
        const nextAmount = Number(paymentError.currentBalance)
        setCurrentBalanceOverride(nextAmount)
        setBalanceRefreshMessage(paymentError.message || 'El saldo pendiente fue actualizado.')
        setAmount(nextAmount > 0 ? String(nextAmount) : '')
        if (nextAmount <= 0) setCashReceived('')
        if (method === 'cash' && parsedCashReceived < nextAmount) {
          setCashReceived(String(nextAmount))
        }
        return
      }
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!repair) return null

  // Vista previa del crédito: total financiado y valor por cuota.
  const creditPrincipal = parseFloat(amount) || 0
  const creditCount = Math.max(1, Math.floor(Number(installmentCount) || 0))
  const creditFinanced = creditPrincipal * (1 + (Math.max(0, Number(interestRate) || 0) / 100))
  const creditPerInstallment = creditCount > 0 ? creditFinanced / creditCount : 0

  const canConfirm = parsedAmount > 0 && !amountExceedsBalance && !invalidCreditAmount && balanceDue > 0 &&
    (!METHODS.find(m => m.id === method)?.requiresRef || reference.trim().length > 0) &&
    (!isCredit || creditCount >= 1) &&
    (!insufficientCash) &&
    (!requiresOpenRegister || cashStatus === 'open')

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Procesar pago de reparación
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                </Badge>
                <span className="text-sm font-medium text-foreground">
                  {repair.customer.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {repair.brand} {repair.model} — {repair.issue}
              </p>
              <p className="text-xs text-muted-foreground">
                Cobro a cuenta: no marca el equipo como entregado. Para entregar, usá el botón &quot;Entregar&quot;.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto px-1">
          {/* Saldo pendiente destacado */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {alreadyPaid > 0 ? 'Saldo pendiente' : 'Total a cobrar'}
            </span>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(balanceDue)}
            </span>
          </div>
          {balanceRefreshMessage && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
              {balanceRefreshMessage}
            </p>
          )}
          {alreadyPaid > 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              Ya se registraron {formatCurrency(alreadyPaid)} de {formatCurrency(totalDue)}.
            </p>
          )}

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => {
                const Icon = m.icon
                const selected = method === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethod(m.id)
                      if (m.id === 'credit') setAmount(balanceDue.toString())
                      if (m.id === 'cash' && parsedAmount > 0 && parsedCashReceived < parsedAmount) {
                        setCashReceived(parsedAmount.toString())
                      }
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all',
                      selected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
            cashStatus === 'open'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
              : cashStatus === 'closed'
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                : 'bg-muted/30',
          )}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {cashStatus === 'open' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : cashStatus === 'closed' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
              {cashStatus === 'open' ? 'Caja abierta' : cashStatus === 'closed' ? 'Caja cerrada' : 'Consultando caja'}
            </div>
            {cashStatus === 'closed' && (
              <Button type="button" size="sm" variant="outline" onClick={() => setIsOpeningRegister(true)}>
                Abrir caja
              </Button>
            )}
          </div>
          {requiresOpenRegister && cashStatus === 'closed' && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Abrí la caja para cobrar en efectivo, tarjeta o transferencia. El crédito puede registrarse sin caja.
            </p>
          )}

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">{isCredit ? 'Monto a financiar' : 'Monto aplicado a la reparación'}</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              max={balanceDue}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={balanceDue.toString()}
              className="text-lg font-semibold"
              disabled={isSubmitting}
            />
            {amountExceedsBalance && (
              <p className="text-xs text-red-600">El monto supera el saldo pendiente.</p>
            )}
            {invalidCreditAmount && !amountExceedsBalance && (
              <p className="text-xs text-amber-700 dark:text-amber-300">El crédito debe cubrir el saldo completo.</p>
            )}
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setAmount(balanceDue.toString())
                if (method === 'cash') setCashReceived(balanceDue.toString())
              }}
            >
              Usar saldo pendiente ({formatCurrency(balanceDue)})
            </button>
          </div>

          {method === 'cash' && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash-received">Efectivo recibido del cliente</Label>
                <Input
                  id="cash-received"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={cashReceived}
                  onChange={event => setCashReceived(event.target.value)}
                  placeholder="Monto entregado por el cliente"
                  className="text-lg font-semibold tabular-nums"
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Montos rápidos de efectivo">
                {[50000, 100000, 200000, 500000].map(quickAmount => (
                  <Button
                    key={quickAmount}
                    type="button"
                    size="sm"
                    variant={parsedCashReceived === quickAmount ? 'default' : 'outline'}
                    aria-pressed={parsedCashReceived === quickAmount}
                    onClick={() => setCashReceived(String(quickAmount))}
                    className="px-2 text-xs tabular-nums"
                  >
                    {formatCurrency(quickAmount)}
                  </Button>
                ))}
              </div>
              {insufficientCash && cashReceived.trim() !== '' && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  El efectivo recibido no alcanza para cubrir el monto aplicado.
                </p>
              )}
              {parsedAmount > 0 && !insufficientCash && (
                <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">Vuelto</span>
                  <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              )}
              <p className="text-[11px] leading-snug text-muted-foreground">
                Solo el monto aplicado se registra como pago; el efectivo recibido se usa para calcular el vuelto.
              </p>
            </div>
          )}

          {/* Términos de crédito */}
          {isCredit && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cred-count" className="text-xs">N° de cuotas</Label>
                  <Input
                    id="cred-count"
                    type="number"
                    min={1}
                    max={60}
                    value={installmentCount}
                    onChange={e => setInstallmentCount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-rate" className="text-xs">Interés (%)</Label>
                  <Input
                    id="cred-rate"
                    type="number"
                    min={0}
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frecuencia</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {FREQUENCIES.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id)}
                      className={cn(
                        'rounded border-2 py-1.5 text-xs font-medium transition-all',
                        frequency === f.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/30'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {creditPrincipal > 0 && (
                <div className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {creditCount} {creditCount === 1 ? 'cuota' : 'cuotas'} de
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(creditPerInstallment)}
                  </span>
                </div>
              )}
              <p className="text-[11px] leading-snug text-muted-foreground">
                Se registrará una deuda a crédito del cliente. La reparación queda saldada; el saldo se cobra por el módulo de créditos.
              </p>
            </div>
          )}

          {/* Referencia (tarjeta / transferencia) */}
          {METHODS.find(m => m.id === method)?.requiresRef && (
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">
                {method === 'card' ? 'N° de Autorización' : 'N° de Referencia'}
              </Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder={method === 'card' ? 'Últimos 4 dígitos' : 'Número de referencia'}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Nota opcional */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">
              Nota <span className="text-xs">(opcional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej: Cliente pagó con vuelto, quedó conforme..."
              rows={2}
              className="resize-none text-sm"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCredit ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            {isCredit ? 'Registrar Crédito' : 'Confirmar Cobro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <OpenCashRegisterDialog
      open={isOpeningRegister}
      onOpenChange={setIsOpeningRegister}
      amount={openingAmount}
      onAmountChange={setOpeningAmount}
      note={openingNote}
      onNoteChange={setOpeningNote}
      registerName="Caja Principal"
      isSubmitting={isOpening}
      onSubmit={handleOpenRegister}
    />
    </>
  )
}

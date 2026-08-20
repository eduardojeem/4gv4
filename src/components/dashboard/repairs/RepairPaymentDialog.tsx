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
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
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
import { toast } from 'sonner'

export type QuickPayMethod = 'cash' | 'card' | 'transfer' | 'credit'
export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface RepairPaymentResult {
  idempotencyKey: string
  purpose?: 'payment' | 'deposit'
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
  onDefinePrice?: (repair: Repair) => void
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
  onDefinePrice,
}: RepairPaymentDialogProps) {
  const cashRegister = useCashRegister()
  const checkOpenSessionRef = useRef(cashRegister.checkOpenSession)
  // Saldo real pendiente: si ya se cobró algo antes (a cuenta, o desde el
  // POS), no tiene sentido sugerir el costo total de nuevo.
  // Usa el mismo total persistido que muestran el detalle y valida la API.
  // La lista puede no incluir el desglose completo de una reparación
  // automática, por lo que recalcularlo aquí puede producir un falso cero.
  const hasDefinedPrice = Boolean(repair) && (
    (repair!.finalCost !== null && repair!.finalCost !== undefined)
    || Number(repair!.estimatedCost) > 0
  )
  const isUnpricedDeposit = Boolean(repair) && !hasDefinedPrice
  const totalDue = hasDefinedPrice && repair
    ? Math.max(0, Number(repair.finalCost ?? repair.estimatedCost) || 0)
    : 0
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

  const [customerCreditLimit, setCustomerCreditLimit] = useState<number | null>(null)
  const [isEnablingCredit, setIsEnablingCredit] = useState(false)
  const [creditStatusLoaded, setCreditStatusLoaded] = useState(false)

  const isCredit = method === 'credit'

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
      if (isUnpricedDeposit || (totalDue > 0 && persistedBalanceDue > 0)) {
        void refreshCashStatus()
      }
    }
  }, [isUnpricedDeposit, open, repair?.id, persistedBalanceDue, refreshCashStatus, totalDue])

  useEffect(() => {
    if (open && isUnpricedDeposit && method === 'credit') setMethod('cash')
  }, [isUnpricedDeposit, method, open])

  useEffect(() => {
    if (!open || !isCredit || !repair?.customer?.id) {
      setCustomerCreditLimit(null)
      setCreditStatusLoaded(false)
      return
    }
    let active = true
    setCreditStatusLoaded(false)
    fetch(`/api/customers?search=${encodeURIComponent(repair.customer.phone || repair.customer.name || '')}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const list = data?.data?.customers || data?.data || []
        const matched = Array.isArray(list) ? list.find((c: { id?: string }) => c.id === repair.customer?.id) : null
        if (matched) {
          setCustomerCreditLimit(Number(matched.credit_limit) || 0)
        } else {
          setCustomerCreditLimit(0)
        }
        setCreditStatusLoaded(true)
      })
      .catch(() => {
        if (active) setCreditStatusLoaded(true)
      })
    return () => { active = false }
  }, [open, isCredit, repair?.customer?.id, repair?.customer?.name, repair?.customer?.phone])

  const handleEnableCustomerCredit = async (limitAmount?: number) => {
    if (!repair?.customer?.id) return
    setIsEnablingCredit(true)
    try {
      const newLimit = limitAmount || Math.max(1000000, balanceDue)
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: repair.customer.id,
          credit_limit: newLimit,
        }),
      })
      const data = await res.json()
      if (data?.success) {
        setCustomerCreditLimit(newLimit)
        toast.success(`Línea de crédito habilitada: ${formatCurrency(newLimit)}`)
      } else {
        toast.error(data?.error || 'No se pudo habilitar el crédito')
      }
    } catch {
      toast.error('Error de conexión al habilitar el crédito')
    } finally {
      setIsEnablingCredit(false)
    }
  }
  const parsedAmount = parseFloat(amount) || 0
  const parsedCashReceived = parseFloat(cashReceived) || 0
  const amountExceedsBalance = hasDefinedPrice && parsedAmount > balanceDue
  const invalidCreditAmount = isCredit && (!hasDefinedPrice || parsedAmount !== balanceDue)
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
    if ((hasDefinedPrice && parsed > balanceDue) || (isCredit && parsed !== balanceDue)) return
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
        purpose: isUnpricedDeposit ? 'deposit' : 'payment',
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
  const isFullyPaid = hasDefinedPrice && balanceDue <= 0

  const canConfirm = parsedAmount > 0 && !amountExceedsBalance && !invalidCreditAmount && (isUnpricedDeposit || balanceDue > 0) &&
    (!METHODS.find(m => m.id === method)?.requiresRef || reference.trim().length > 0) &&
    (!isCredit || creditCount >= 1) &&
    (!insufficientCash) &&
    (!requiresOpenRegister || cashStatus === 'open')

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-help-id="repair-payment">
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

        {isFullyPaid ? (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30" role="status">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-emerald-950 dark:text-emerald-100">Reparación totalmente pagada</h3>
                  <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80">No queda ningún importe por cobrar.</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3 text-center">
                <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="mt-1 font-semibold tabular-nums">{formatCurrency(totalDue)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Pagado</dt><dd className="mt-1 font-semibold tabular-nums">{formatCurrency(alreadyPaid)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Saldo pendiente</dt><dd className="mt-1 font-semibold tabular-nums">{formatCurrency(0)}</dd></div>
              </dl>
              {balanceRefreshMessage && <p className="text-sm text-muted-foreground" role="status">{balanceRefreshMessage}</p>}
            </div>
            <DialogFooter><Button onClick={handleClose}>Cerrar</Button></DialogFooter>
          </>
        ) : (
          <>
        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto px-1">
          {isUnpricedDeposit && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30" role="status">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="space-y-1">
                <h3 className="font-semibold text-amber-950 dark:text-amber-100">Precio pendiente de definir</h3>
                <p className="text-sm leading-5 text-amber-900/80 dark:text-amber-200/80">
                  Este importe quedará registrado como anticipo. El saldo se calculará cuando se defina el precio final.
                </p>
                {alreadyPaid > 0 && <p className="text-xs font-medium">Anticipos registrados: {formatCurrency(alreadyPaid)}</p>}
                {onDefinePrice && (
                  <button type="button" className="text-xs font-semibold text-primary underline-offset-2 hover:underline" onClick={() => onDefinePrice(repair)}>
                    Definir precio ahora
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Saldo pendiente destacado */}
          {!isUnpricedDeposit && <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {alreadyPaid > 0 ? 'Saldo pendiente' : 'Total a cobrar'}
            </span>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(balanceDue)}
            </span>
          </div>}
          {balanceRefreshMessage && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
              {balanceRefreshMessage}
            </p>
          )}
          {alreadyPaid > 0 && !isUnpricedDeposit && (
            <p className="text-xs text-muted-foreground -mt-2">
              Ya se registraron {formatCurrency(alreadyPaid)} de {formatCurrency(totalDue)}.
            </p>
          )}

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-2 gap-2" data-help-id="repair-credit">
              {METHODS.filter(m => !isUnpricedDeposit || m.id !== 'credit').map(m => {
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

          <div data-help-id="repair-cash-status" className={cn(
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
              <Button data-help-id="repair-open-cash" type="button" size="sm" variant="outline" onClick={() => setIsOpeningRegister(true)}>
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
          <div className="space-y-1.5" data-help-id="repair-payment-amount">
            <Label htmlFor="pay-amount">{isUnpricedDeposit ? 'Monto del adelanto' : isCredit ? 'Monto a financiar' : 'Monto aplicado a la reparación'}</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₲</span>
              <Input
                id="pay-amount"
                type="text"
                inputMode="numeric"
                value={formatThousands(amount)}
                onChange={e => setAmount(parseThousands(e.target.value).toString())}
                placeholder={isUnpricedDeposit ? '0' : formatThousands(balanceDue)}
                className="pl-7 text-lg font-bold font-mono"
                disabled={isSubmitting}
              />
            </div>
            {amountExceedsBalance && (
              <p className="text-xs text-red-600">El monto supera el saldo pendiente.</p>
            )}
            {invalidCreditAmount && !amountExceedsBalance && (
              <p className="text-xs text-amber-700 dark:text-amber-300">El crédito debe cubrir el saldo completo.</p>
            )}
            {!isUnpricedDeposit && <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setAmount(balanceDue.toString())
                if (method === 'cash') setCashReceived(balanceDue.toString())
              }}
            >
              Usar saldo pendiente ({formatCurrency(balanceDue)})
            </button>}
          </div>

          {method === 'cash' && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash-received">Efectivo recibido del cliente</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₲</span>
                  <Input
                    id="cash-received"
                    type="text"
                    inputMode="numeric"
                    value={formatThousands(cashReceived)}
                    onChange={event => setCashReceived(parseThousands(event.target.value).toString())}
                    placeholder="Monto entregado por el cliente"
                    className="pl-7 text-lg font-bold font-mono tabular-nums"
                    disabled={isSubmitting}
                  />
                </div>
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
            <div data-help-id="repair-credit-terms" className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
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
              {creditStatusLoaded && customerCreditLimit !== null && customerCreditLimit <= 0 && (
                <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Cliente sin crédito activo</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {repair?.customer?.name || 'Este cliente'} no tiene una línea de crédito asignada (0 ₲).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCustomerCredit(Math.max(1000000, balanceDue))}
                      className="h-7 px-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 shadow-xs"
                    >
                      {isEnablingCredit ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                      Habilitar Crédito ({formatCurrency(Math.max(1000000, balanceDue))})
                    </Button>
                    <button
                      type="button"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCustomerCredit(500000)}
                      className="text-[10px] px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold text-amber-800 dark:text-amber-300"
                    >
                      ₲ 500.000
                    </button>
                    <button
                      type="button"
                      disabled={isEnablingCredit}
                      onClick={() => handleEnableCustomerCredit(2000000)}
                      className="text-[10px] px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold text-amber-800 dark:text-amber-300"
                    >
                      ₲ 2.000.000
                    </button>
                  </div>
                </div>
              )}

              {creditStatusLoaded && customerCreditLimit !== null && customerCreditLimit > 0 && (
                <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Línea habilitada: {formatCurrency(customerCreditLimit)}
                  </span>
                  <button
                    type="button"
                    disabled={isEnablingCredit}
                    onClick={() => handleEnableCustomerCredit(customerCreditLimit + Math.max(500000, balanceDue))}
                    className="text-[10px] text-emerald-800 dark:text-emerald-200 underline font-semibold hover:opacity-80"
                  >
                    Aumentar límite
                  </button>
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
            {isUnpricedDeposit ? 'Registrar adelanto' : isCredit ? 'Registrar Crédito' : 'Confirmar Cobro'}
          </Button>
        </DialogFooter>
          </>
        )}
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

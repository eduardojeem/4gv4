'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { CheckCircle2, PackageX, Wrench, Loader2, AlertTriangle, DollarSign, ExternalLink, ArrowLeft } from 'lucide-react'
import { Repair, RepairDeliveryOutcome } from '@/types/repairs'
import { useCashRegister } from '@/hooks/useCashRegister'
import { OpenCashRegisterDialog } from '@/app/dashboard/pos/components/OpenCashRegisterDialog'
import {
  PAYMENT_METHODS,
  CREDIT_FREQUENCIES,
  type QuickPayMethod,
  type CreditFrequency,
} from './RepairPaymentDialog'
import type { UnrepairedCloseoutRequest } from '@/lib/repairs/unrepaired-closeout'
import {
  isUnrepairedCloseoutDraftComplete,
  UnrepairedCloseoutPanel,
  type UnrepairedCloseoutDraft,
} from './UnrepairedCloseoutPanel'

export interface RepairedDeliveryConfirmPayload {
  idempotencyKey: string
  allowOutstandingBalance: boolean
  outcome: 'repaired'
  note?: string
  payment?: {
    method: QuickPayMethod
    amount: number
    idempotencyKey: string
    reference?: string
    interestRate?: number
    installments?: { count: number; frequency: CreditFrequency }
  }
}
export type RepairDeliveryConfirmPayload = RepairedDeliveryConfirmPayload | UnrepairedCloseoutRequest

interface RepairDeliveryDialogProps {
  open: boolean
  repair: Repair | null
  onOpenChange: (open: boolean) => void
  onConfirm: (repairId: string, payload: RepairDeliveryConfirmPayload) => Promise<void>
  /**
   * Muestra el paso de cobro integrado a la entrega. Se apaga en pantallas
   * donde quien entrega no maneja caja (p.ej. el tablero del técnico), para
   * no ofrecer un "Cobrar y Entregar" que en realidad no cobraría nada.
   * Default true.
   */
  allowPayment?: boolean
}

const outcomes: {
  value: RepairDeliveryOutcome
  label: string
  description: string
  icon: React.ElementType
  color: string
  border: string
  bg: string
}[] = [
  {
    value: 'repaired',
    label: 'Reparado y funcionando',
    description: 'El equipo fue reparado correctamente y funciona sin problemas.',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    value: 'withdrawn',
    label: 'Retirado sin reparar',
    description: 'El cliente retiró el equipo antes de completar la reparación.',
    icon: PackageX,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-400 dark:border-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    value: 'unrepairable',
    label: 'No fue posible reparar',
    description: 'El equipo tiene daños irreparables o no se encontraron los repuestos.',
    icon: Wrench,
    color: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-400 dark:border-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
  },
]

export function RepairDeliveryDialog({
  open,
  repair,
  onOpenChange,
  onConfirm,
  allowPayment = true,
}: RepairDeliveryDialogProps) {
  const cashRegister = useCashRegister()
  const checkOpenSessionRef = useRef(cashRegister.checkOpenSession)
  const [selected, setSelected] = useState<RepairDeliveryOutcome | null>(null)
  const [step, setStep] = useState<'outcome' | 'payment'>('outcome')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cobro integrado a la entrega. Se muestra siempre que quede saldo, pero
  // el monto solo se sugiere de entrada cuando el resultado es "reparado":
  // si no funcionó, no tiene sentido empujar el cobro por defecto (aunque
  // se deja visible por si corresponde cobrar una revisión/diagnóstico).
  const [method, setMethod] = useState<QuickPayMethod>('cash')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [deliverUnpaid, setDeliverUnpaid] = useState(false)
  const [installmentCount, setInstallmentCount] = useState('3')
  const [frequency, setFrequency] = useState<CreditFrequency>('monthly')
  const [interestRate, setInterestRate] = useState('0')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [cashStatus, setCashStatus] = useState<'checking' | 'open' | 'closed'>('checking')
  const [isOpeningRegister, setIsOpeningRegister] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')
  const [isOpening, setIsOpening] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [unrepairedDraft, setUnrepairedDraft] = useState<UnrepairedCloseoutDraft | null>(null)

  const totalDue = repair ? (repair.finalCost ?? repair.estimatedCost ?? 0) : 0
  const alreadyPaid = repair?.paidAmount ?? 0
  const balanceDue = Math.max(0, totalDue - alreadyPaid)
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

  // Al elegir "reparado y funcionando" con saldo pendiente, se sugiere cobrar
  // el saldo completo. En los otros resultados el monto arranca vacío: el
  // cobro queda disponible pero no se empuja (ver comentario arriba).
  useEffect(() => {
    if (allowPayment && selected === 'repaired' && balanceDue > 0) {
      setAmount(prev => (prev ? prev : balanceDue.toString()))
    }
  }, [allowPayment, selected, balanceDue])

  useEffect(() => {
    if (open) {
      setIdempotencyKey(`repair-delivery-${crypto.randomUUID()}`)
      void refreshCashStatus()
    }
  }, [open, repair?.id, refreshCashStatus])

  const handleClose = () => {
    if (isSubmitting) return
    setSelected(null)
    setStep('outcome')
    setNote('')
    setMethod('cash')
    setAmount('')
    setReference('')
    setDeliverUnpaid(false)
    setInstallmentCount('3')
    setFrequency('monthly')
    setInterestRate('0')
    setIsOpeningRegister(false)
    setOpeningAmount('0')
    setOpeningNote('')
    setSubmissionError(null)
    setUnrepairedDraft(null)
    onOpenChange(false)
  }

  const handleOpenRegister = async (initialAmount: number, openingReference: string) => {
    setSubmissionError(null)
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

  const parsedAmount = parseFloat(amount) || 0
  const wantsCharge = step === 'payment' && allowPayment && parsedAmount > 0
  // Guardrail: si queda saldo y no se va a cobrar nada, hay que confirmar a
  // propósito que se entrega igual (fiado). Antes esto pasaba en silencio.
  // No aplica donde no se ofrece cobro (allowPayment=false): ahí la entrega
  // sigue funcionando exactamente como antes de este cambio.
  const remainingAfterPayment = Math.max(0, balanceDue - parsedAmount)
  const needsUnpaidConfirm = allowPayment && remainingAfterPayment > 0
  const selectedMethod = PAYMENT_METHODS.find(m => m.id === method)
  const unrepairedNeedsRegister = unrepairedDraft?.settlement.kind === 'payment'
    ? unrepairedDraft.settlement.method !== 'transfer'
    : unrepairedDraft?.settlement.kind === 'refund' && unrepairedDraft.settlement.method === 'cash'
  const requiresOpenRegister = selected === 'repaired' ? wantsCharge && !isCredit : Boolean(unrepairedNeedsRegister)

  const creditCount = Math.max(1, Math.floor(Number(installmentCount) || 0))

  const canConfirm = !!selected && !isSubmitting && (selected === 'repaired'
    ? (!needsUnpaidConfirm || deliverUnpaid) &&
      (!wantsCharge || ((!selectedMethod?.requiresRef || reference.trim().length > 0) && (!isCredit || creditCount >= 1)))
    : !!unrepairedDraft && isUnrepairedCloseoutDraftComplete(repair!, unrepairedDraft)) &&
    (!requiresOpenRegister || cashStatus === 'open')

  const handleConfirm = async () => {
    if (!repair || !selected) return
    setSubmissionError(null)
    setIsSubmitting(true)
    try {
      if (selected !== 'repaired') {
        if (!unrepairedDraft) return
        await onConfirm(repair.id, {
          ...unrepairedDraft,
          outcome: selected,
          note: note.trim() || undefined,
          idempotencyKey,
        })
        handleClose()
        return
      }
      const payload: RepairDeliveryConfirmPayload = {
        idempotencyKey,
        allowOutstandingBalance: !allowPayment || remainingAfterPayment > 0,
        outcome: selected,
        note: note.trim() || undefined,
      }
      if (wantsCharge) {
        payload.payment = {
          idempotencyKey,
          method,
          amount: parsedAmount,
          reference: reference.trim() || undefined,
          ...(isCredit
            ? { interestRate: Math.max(0, Number(interestRate) || 0), installments: { count: creditCount, frequency } }
            : {}),
        }
      }
      await onConfirm(repair.id, payload)
      handleClose()
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'REPAIR_CASH_REGISTER_NOT_OPEN') {
        setCashStatus('closed')
      }
      setSubmissionError(error instanceof Error ? error.message : 'No se pudo registrar la entrega')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmLabel = useMemo(() => {
    if (selected !== 'repaired' && unrepairedDraft) {
      if (unrepairedDraft.settlement.kind === 'payment') return 'Cobrar y entregar'
      if (unrepairedDraft.settlement.kind === 'refund') return 'Devolver y entregar'
      if (unrepairedDraft.settlement.kind === 'store_credit') return 'Crear saldo a favor y entregar'
      return 'Cerrar y entregar'
    }
    if (isCredit && wantsCharge) return 'Registrar Crédito y Entregar'
    if (wantsCharge) return 'Cobrar y Entregar'
    return 'Confirmar Entrega'
  }, [isCredit, selected, unrepairedDraft, wantsCharge])

  if (!repair) return null

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            {step === 'payment' ? selected === 'repaired' ? 'Cobrar reparación' : 'Cerrar reparación sin reparar' : 'Confirmar Entrega'}
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
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" aria-label="Progreso de entrega">
          <div className={cn(
            'rounded-md border px-3 py-2 text-xs font-semibold',
            step === 'outcome' ? 'border-primary bg-primary/5 text-primary' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
          )}>
            1. Resultado
          </div>
          <div className={cn(
            'rounded-md border px-3 py-2 text-xs font-semibold',
            step === 'payment' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground',
          )}>
            2. Cierre y entrega
          </div>
        </div>

        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto px-1">
          {step === 'outcome' && <div className="space-y-3">
            <p className="text-sm font-medium">¿Cuál fue el resultado?</p>
            <div className="flex flex-col gap-2">
              {outcomes.map((o) => {
                const Icon = o.icon
                const isSelected = selected === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setSelected(o.value)
                      if (o.value === 'repaired' && allowPayment && balanceDue > 0) {
                        setAmount((current) => current || balanceDue.toString())
                        setStep('payment')
                      } else if (o.value !== 'repaired') {
                        setAmount('')
                        setDeliverUnpaid(false)
                        setUnrepairedDraft({
                          charge: { mode: 'none' },
                          parts: [],
                          settlement: alreadyPaid > 0 ? { kind: 'store_credit' } : { kind: 'none' },
                        })
                        setStep('payment')
                      }
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all duration-150',
                      isSelected
                        ? `${o.border} ${o.bg}`
                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                    )}
                  >
                    <Icon
                      className={cn('mt-0.5 h-5 w-5 shrink-0', isSelected ? o.color : 'text-muted-foreground')}
                    />
                    <div>
                      <p className={cn('text-sm font-semibold', isSelected ? o.color : 'text-foreground')}>
                        {o.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

          </div>}

          {step === 'payment' && selected !== null && selected !== 'repaired' && (
            <UnrepairedCloseoutPanel
              repair={repair}
              value={unrepairedDraft}
              onChange={setUnrepairedDraft}
              disabled={isSubmitting}
            />
          )}

          {step === 'payment' && selected !== 'repaired' && requiresOpenRegister && (
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
              cashStatus === 'open' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
            )}>
              <span className="flex items-center gap-2 text-sm font-medium">
                {cashStatus === 'open' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {cashStatus === 'open' ? 'Caja abierta' : 'Caja cerrada'}
              </span>
              {cashStatus === 'closed' && <Button type="button" size="sm" variant="outline" onClick={() => setIsOpeningRegister(true)}>Abrir caja</Button>}
            </div>
          )}

          {/* Cobro: solo aparece si hay algo pendiente y la pantalla lo permite. */}
          {step === 'payment' && allowPayment && selected === 'repaired' && balanceDue > 0 && (
            <div className="space-y-3 rounded-lg border p-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  {selected === 'repaired' ? 'Cobrar al entregar' : 'Cobrar algo (ej. revisión)'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(balanceDue)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-xs">
                <div>
                  <span className="block text-muted-foreground">Total</span>
                  <strong>{formatCurrency(totalDue)}</strong>
                </div>
                <div>
                  <span className="block text-muted-foreground">Pagado</span>
                  <strong>{formatCurrency(alreadyPaid)}</strong>
                </div>
                <div>
                  <span className="block text-muted-foreground">Pendiente</span>
                  <strong>{formatCurrency(balanceDue)}</strong>
                </div>
              </div>

              {selected === 'repaired' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!repair.customer?.id) return
                    handleClose()
                    window.location.href = `/dashboard/pos?customerId=${repair.customer.id}&repairId=${repair.id}`
                  }}
                  disabled={!repair.customer?.id}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Cobrar por POS: cuenta como venta del día</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </button>
              )}

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {selected === 'repaired' ? 'o cobrar acá (queda en caja, no en ventas)' : 'cobrar acá'}
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className={cn(
                'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSubmissionError(null)
                      setIsOpeningRegister(true)
                    }}
                  >
                    Abrir caja
                  </Button>
                )}
              </div>
              {cashStatus === 'closed' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Abrí la caja para cobrar aquí. También podés registrar crédito o entregar y cobrar después.
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
                onClick={() => {
                  setAmount('')
                  setDeliverUnpaid(false)
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Entregar y cobrar después
              </Button>

              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map(m => {
                  const Icon = m.icon
                  const isSelected = method === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-[11px] font-medium transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery-pay-amount" className="text-xs">
                  {isCredit ? 'Monto a financiar' : 'Monto a cobrar'}
                </Label>
                <Input
                  id="delivery-pay-amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>

              {isCredit && (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="delivery-cred-count" className="text-xs">N° de cuotas</Label>
                      <Input
                        id="delivery-cred-count"
                        type="number"
                        min={1}
                        max={60}
                        value={installmentCount}
                        onChange={e => setInstallmentCount(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="delivery-cred-rate" className="text-xs">Interés (%)</Label>
                      <Input
                        id="delivery-cred-rate"
                        type="number"
                        min={0}
                        value={interestRate}
                        onChange={e => setInterestRate(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CREDIT_FREQUENCIES.map(f => (
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
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Se registrará una deuda a crédito del cliente en vez de mover caja.
                  </p>
                </div>
              )}

              {selectedMethod?.requiresRef && (
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-pay-ref" className="text-xs">
                    {method === 'card' ? 'N° de Autorización' : 'N° de Referencia'}
                  </Label>
                  <Input
                    id="delivery-pay-ref"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={method === 'card' ? 'Últimos 4 dígitos' : 'Número de referencia'}
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {needsUnpaidConfirm && (
                <label className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs">
                  <Checkbox
                    checked={deliverUnpaid}
                    onCheckedChange={(v) => setDeliverUnpaid(v === true)}
                    className="mt-0.5"
                  />
                  <span className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Entregar dejando un saldo pendiente de {formatCurrency(remainingAfterPayment)} (se cobrará después).
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="space-y-1.5 pt-1">
            <label className="text-sm font-medium text-muted-foreground">
              Nota de entrega <span className="text-xs">(opcional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Se cambió la pantalla, el cliente quedó conforme..."
              rows={2}
              className="resize-none text-sm"
              disabled={isSubmitting}
            />
          </div>

          {submissionError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submissionError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'payment' ? (
            <Button variant="outline" onClick={() => setStep('outcome')} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {confirmLabel}
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

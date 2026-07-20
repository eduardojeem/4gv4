'use client'

import { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle2,
  PackageX,
  Wrench,
  Loader2,
  DollarSign,
  CalendarClock,
} from 'lucide-react'
import { Repair, RepairDeliveryOutcome } from '@/types/repairs'

export type QuickPayMethod = 'cash' | 'card' | 'transfer' | 'credit'
export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface RepairPaymentResult {
  method: QuickPayMethod
  amount: number
  reference?: string
  markDelivered: boolean
  outcome?: RepairDeliveryOutcome
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

const METHODS: { id: QuickPayMethod; label: string; icon: React.ElementType; requiresRef: boolean }[] = [
  { id: 'cash',     label: 'Efectivo',       icon: Banknote,    requiresRef: false },
  { id: 'card',     label: 'Tarjeta',        icon: CreditCard,  requiresRef: true  },
  { id: 'transfer', label: 'Transferencia',  icon: Smartphone,  requiresRef: true  },
  { id: 'credit',   label: 'Crédito',        icon: CalendarClock, requiresRef: false },
]

const FREQUENCIES: { id: CreditFrequency; label: string }[] = [
  { id: 'weekly',   label: 'Semanal'   },
  { id: 'biweekly', label: 'Quincenal' },
  { id: 'monthly',  label: 'Mensual'   },
]

const OUTCOMES: { value: RepairDeliveryOutcome; label: string; icon: React.ElementType; cls: string }[] = [
  { value: 'repaired',     label: 'Reparado',     icon: CheckCircle2, cls: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { value: 'withdrawn',    label: 'Retirado',     icon: PackageX,     cls: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  { value: 'unrepairable', label: 'Sin reparar',  icon: Wrench,       cls: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
]

export function RepairPaymentDialog({
  open,
  repair,
  onOpenChange,
  onConfirm,
}: RepairPaymentDialogProps) {
  const total = repair ? (repair.finalCost ?? repair.estimatedCost ?? 0) : 0

  const [method, setMethod] = useState<QuickPayMethod>('cash')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [markDelivered, setMarkDelivered] = useState(true)
  const [outcome, setOutcome] = useState<RepairDeliveryOutcome>('repaired')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Términos de crédito (solo aplican con method === 'credit')
  const [installmentCount, setInstallmentCount] = useState('3')
  const [frequency, setFrequency] = useState<CreditFrequency>('monthly')
  const [interestRate, setInterestRate] = useState('0')

  const isCredit = method === 'credit'

  const handleClose = () => {
    if (isSubmitting) return
    setMethod('cash')
    setAmount('')
    setReference('')
    setMarkDelivered(true)
    setOutcome('repaired')
    setNote('')
    setInstallmentCount('3')
    setFrequency('monthly')
    setInterestRate('0')
    onOpenChange(false)
  }

  const handleConfirm = async () => {
    if (!repair) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return

    const selectedMethod = METHODS.find(m => m.id === method)
    if (selectedMethod?.requiresRef && !reference.trim()) return

    const count = Math.max(1, Math.floor(Number(installmentCount) || 0))
    const rate = Math.max(0, Number(interestRate) || 0)
    if (isCredit && count < 1) return

    setIsSubmitting(true)
    try {
      await onConfirm(repair.id, {
        method,
        amount: parsed,
        reference: reference.trim() || undefined,
        markDelivered,
        outcome: markDelivered ? outcome : undefined,
        note: note.trim() || undefined,
        ...(isCredit ? { interestRate: rate, installments: { count, frequency } } : {}),
      })
      handleClose()
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

  const canConfirm = !!parseFloat(amount) && parseFloat(amount) > 0 &&
    (!METHODS.find(m => m.id === method)?.requiresRef || reference.trim().length > 0) &&
    (!isCredit || creditCount >= 1)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Cobrar Reparación
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

        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto px-1">
          {/* Monto total destacado */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Total a cobrar</span>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(total)}
            </span>
          </div>

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
                    onClick={() => setMethod(m.id)}
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

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">{isCredit ? 'Monto a financiar' : 'Monto recibido'}</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={total.toString()}
              className="text-lg font-semibold"
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => setAmount(total.toString())}
            >
              Usar total exacto ({formatCurrency(total)})
            </button>
          </div>

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

          {/* Toggle entregar */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Entregar equipo ahora</p>
              <p className="text-xs text-muted-foreground mt-0.5">Marcar como entregado al confirmar</p>
            </div>
            <Switch
              checked={markDelivered}
              onCheckedChange={setMarkDelivered}
              disabled={isSubmitting}
            />
          </div>

          {/* Resultado de entrega */}
          {markDelivered && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label>Resultado de la reparación</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {OUTCOMES.map(({ value, label, icon: Icon, cls }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOutcome(value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded border-2 p-2 text-center text-[11px] font-medium transition-all',
                      outcome === value ? cls : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
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
  )
}

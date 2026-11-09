'use client'

import { useRef, useState } from 'react'
import { Banknote, Landmark, ArrowLeftRight, Receipt, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { parseManualPaymentAmount, manualPaymentDateIso } from './subscription-edit'

const PAID_PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const
const METHODS = [
  { value: 'Efectivo', description: 'Dinero recibido en persona', Icon: Banknote },
  { value: 'Depósito bancario', description: 'Depósito acreditado en cuenta', Icon: Landmark },
  { value: 'Transferencia', description: 'Transferencia ya verificada', Icon: ArrowLeftRight },
  { value: 'Otro', description: 'Otro cobro recibido fuera del sistema', Icon: Receipt },
] as const

type Props = {
  subscriptionId: string
  currentPlan: string | null
  suggestedAmount: number | null
  onPendingChange?: (pending: boolean) => void
  onRecorded: () => void
}

function todayInputValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Registra un cobro externo, conservando el contrato de activación mensual existente. */
export function ManualPaymentForm({ subscriptionId, currentPlan, suggestedAmount, onRecorded, onPendingChange }: Props) {
  const initialPlan = PAID_PLANS.find(plan => plan === currentPlan?.toUpperCase()) ?? 'BASIC'
  const [plan, setPlan] = useState<string>(initialPlan)
  const [amount, setAmount] = useState(currentPlan?.toUpperCase() === initialPlan && suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : '')
  const [method, setMethod] = useState<string>(METHODS[0].value)
  const [reference, setReference] = useState('')
  const [paidAt, setPaidAt] = useState(todayInputValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const inFlight = useRef(false)

  function changePlan(value: string) {
    setPlan(value)
    setAmount(value === currentPlan?.toUpperCase() && suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : '')
    setError(null)
  }
  function validate() {
    return { amount: parseManualPaymentAmount(amount), paidAt: manualPaymentDateIso(paidAt, todayInputValue()) }
  }
  function review() {
    try {
      validate()
      setError(null)
      setReviewing(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Revisá los datos.')
    }
  }
  async function submit() {
    if (inFlight.current) return
    let validated: ReturnType<typeof validate>
    try {
      validated = validate()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Revisá los datos.')
      return
    }
    inFlight.current = true
    onPendingChange?.(true)
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/superadmin/subscriptions/${encodeURIComponent(subscriptionId)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, amount: validated.amount, method, reference: reference.trim() || undefined, paidAt: validated.paidAt }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setError(payload?.error || 'No se pudo registrar el pago.')
        return
      }
      toast.success('Pago registrado: el plan quedó activo por un mes.')
      setReference('')
      onRecorded()
    } catch {
      setError('No se pudo conectar para registrar el pago.')
    } finally {
      inFlight.current = false
      onPendingChange?.(false)
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Banknote aria-hidden className="size-5" /></span>
        <div><h3 className="text-sm font-bold">Registrar pago manual</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Registrá un cobro que ya recibiste. Este formulario no realiza cargos a tarjetas ni inicia transferencias. Al confirmar activa el plan por un mes.</p></div>
      </div>
      {!reviewing && <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-plan" className="text-xs">Plan a activar</Label>
          <select id="manual-plan" value={plan} onChange={event => changePlan(event.target.value)} disabled={saving} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
            {PAID_PLANS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          {plan !== currentPlan?.toUpperCase() && <p className="text-xs text-amber-700 dark:text-amber-300">Vas a cambiar el plan. Ingresá el importe recibido para este plan; no se calcula automáticamente.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-amount" className="text-xs">Monto cobrado (₲)</Label>
          <Input id="manual-amount" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} disabled={saving} className="h-11" placeholder="Ej.: 150.000" />
        </div>
        <fieldset disabled={saving} className="space-y-2 sm:col-span-2">
          <legend className="mb-2 text-xs font-semibold">Medio del cobro recibido</legend>
          <div className="grid gap-2 sm:grid-cols-2">{METHODS.map(({ value, description, Icon }) => <label key={value} className={cn('flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', method === value ? 'border-emerald-400 bg-emerald-100/60 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-border bg-background hover:bg-muted/50')}>
            <input type="radio" name="manual-payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} className="mt-1 size-4 shrink-0 accent-emerald-600" />
            <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold"><Icon aria-hidden className="size-4 shrink-0" />{value}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span>
          </label>)}</div>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="manual-date" className="text-xs">Fecha del cobro</Label>
          <Input id="manual-date" type="date" max={todayInputValue()} value={paidAt} onChange={event => setPaidAt(event.target.value)} disabled={saving} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-reference" className="text-xs">Referencia o recibo (opcional)</Label>
          <Input id="manual-reference" maxLength={160} value={reference} onChange={event => setReference(event.target.value)} disabled={saving} className="h-11" />
        </div>
      </div>}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {reviewing && <div className="space-y-3 rounded-xl border bg-background p-4"><h4 className="font-semibold">Confirmá el cobro recibido</h4><p>{plan} · ₲ {amount} · {method}</p><p className="text-sm">Fecha: {paidAt}{reference ? ` · Referencia: ${reference}` : ''}. Al confirmar se registra el cobro y se activa el plan por un mes.</p><Button variant="outline" className="min-h-11" disabled={saving} onClick={() => setReviewing(false)}>Volver a editar</Button></div>}
      <Button type="button" onClick={() => reviewing ? void submit() : review()} disabled={saving} className="min-h-11 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
        {saving && <Loader2 aria-hidden className="size-4 animate-spin" />}{reviewing ? 'Confirmar pago y activar plan' : 'Revisar pago'}
      </Button>
    </section>
  )
}

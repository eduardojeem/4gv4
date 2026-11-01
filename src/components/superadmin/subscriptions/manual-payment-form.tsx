'use client'

import { useState } from 'react'
import { Banknote, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAID_PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const
const METHODS = ['Efectivo', 'Depósito bancario', 'Transferencia', 'Otro'] as const

type Props = {
  subscriptionId: string
  currentPlan: string | null
  /** Precio mensual del plan actual, para proponer el monto. */
  suggestedAmount: number | null
  onRecorded: () => void
}

function todayInputValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * Cobro hecho fuera de Pagopar o de la transferencia con comprobante. Aplica
 * el plan por un mes con la misma lógica que los pagos en línea y queda en el
 * historial y en la auditoría.
 */
export function ManualPaymentForm({ subscriptionId, currentPlan, suggestedAmount, onRecorded }: Props) {
  const initialPlan = PAID_PLANS.find((plan) => plan === currentPlan?.toUpperCase()) ?? 'BASIC'
  const [plan, setPlan] = useState<string>(initialPlan)
  const [amount, setAmount] = useState(suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : '')
  const [method, setMethod] = useState<string>(METHODS[0])
  const [reference, setReference] = useState('')
  const [paidAt, setPaidAt] = useState(todayInputValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const value = Number(amount.replace(/[^\d]/g, ''))
    if (!Number.isInteger(value) || value <= 0) {
      setError('Ingresá el monto cobrado en guaraníes.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/superadmin/subscriptions/${encodeURIComponent(subscriptionId)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          amount: value,
          method,
          reference: reference.trim() || undefined,
          paidAt: new Date(`${paidAt}T12:00:00-03:00`).toISOString(),
        }),
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
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Banknote className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold">Registrar pago manual</h3>
          <p className="text-xs text-muted-foreground">
            Para cobros en efectivo, depósito u otro medio. Activa el plan por un mes, igual que un pago en línea.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Plan</Label>
          <Select value={plan} onValueChange={setPlan} disabled={saving}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAID_PLANS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-amount" className="text-xs">Monto cobrado (₲)</Label>
          <Input id="manual-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={saving} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Medio</Label>
          <Select value={method} onValueChange={setMethod} disabled={saving}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHODS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-date" className="text-xs">Fecha del cobro</Label>
          <Input id="manual-date" type="date" max={todayInputValue()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} disabled={saving} className="h-9" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="manual-reference" className="text-xs">Referencia o recibo (opcional)</Label>
          <Input id="manual-reference" maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} className="h-9" />
        </div>
      </div>

      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}

      <Button type="button" size="sm" onClick={() => void submit()} disabled={saving} className="gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Registrar pago y activar plan
      </Button>
    </section>
  )
}

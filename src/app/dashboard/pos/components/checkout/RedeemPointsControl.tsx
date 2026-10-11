'use client'

import { useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DraftNumberInput } from '@/components/ui/draft-number-input'

export type RedemptionConfig = { value: number; min: number | null }

/**
 * Canjear puntos por saldo a favor desde el cobro.
 *
 * El saldo a favor ya es una forma de pago del POS, así que después del canje
 * el cajero lo aplica como siempre. Cada intento lleva su clave: un doble clic
 * o un reintento no canjea dos veces.
 */
export function RedeemPointsControl({
  customerId,
  balance,
  redemption,
  formatCurrency,
  onRedeemed,
}: {
  customerId: string
  balance: number
  redemption: RedemptionConfig
  formatCurrency: (amount: number) => string
  onRedeemed: (result: { points: number; amount: number; balance: number }) => void
}) {
  const [open, setOpen] = useState(false)
  const [points, setPoints] = useState(balance)
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)

  const min = redemption.min ?? 1
  if (balance < min) {
    return (
      <p className="max-w-[12rem] text-[11px] leading-snug text-muted-foreground">
        Canjea desde {min.toLocaleString('es-PY')} puntos.
      </p>
    )
  }

  const valid = points >= min && points <= balance
  const amount = Math.round(points * redemption.value)

  const redeem = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const response = await fetch(`/api/loyalty/customers/${encodeURIComponent(customerId)}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, idempotencyKey: attemptKey }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) throw new Error(body?.error || 'No se pudieron canjear los puntos.')
      toast.success(`Canje hecho: ${formatCurrency(body.data.amount)} de saldo a favor`, {
        description: 'Aplicalo como forma de pago en «Saldo a favor».',
      })
      onRedeemed(body.data)
      setOpen(false)
      setAttemptKey(crypto.randomUUID())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron canjear los puntos.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg text-xs font-semibold" onClick={() => { setPoints(balance); setOpen(true) }}>
        <Gift className="h-3.5 w-3.5" />
        Canjear por {formatCurrency(Math.round(balance * redemption.value))}
      </Button>
    )
  }

  return (
    <div className="w-56 space-y-2 rounded-lg border bg-background p-2.5 text-left">
      <label className="block text-[11px] font-semibold text-muted-foreground" htmlFor={`redeem-${customerId}`}>
        Puntos a canjear (máx. {balance.toLocaleString('es-PY')})
      </label>
      <DraftNumberInput
        id={`redeem-${customerId}`}
        value={points}
        onValueChange={setPoints}
        min={min}
        max={balance}
        className="h-8 text-sm tabular-nums"
      />
      <p className="text-xs tabular-nums">
        = <strong className="font-semibold">{formatCurrency(amount)}</strong> de saldo a favor
      </p>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" className="h-8 flex-1 text-xs font-semibold" disabled={!valid || saving} onClick={() => void redeem()}>
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Canjear
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

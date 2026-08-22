'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/components/dashboard/orders/format'

type StoreCreditData = {
  ledgerBalance: number
  reservedBalance: number
  availableBalance: number
  movements: Array<{ id: string; amount: number; reason: string; created_at: string }>
  reservations: Array<{ id: string; amount: number; status: string; reserved_at: string }>
}

export function PublicStoreCredit({
  authenticated,
  organizationSlug,
  orderTotal,
  amount = 0,
  onAmountChange,
}: {
  authenticated: boolean
  organizationSlug: string | null
  orderTotal?: number
  amount?: number
  onAmountChange?: (amount: number) => void
}) {
  const [data, setData] = useState<StoreCreditData | null>(null)
  const [settled, setSettled] = useState(false)
  const loading = authenticated && !settled
  const maximum = useMemo(
    () => Math.max(0, Math.min(data?.availableBalance ?? 0, orderTotal ?? Number.POSITIVE_INFINITY)),
    [data?.availableBalance, orderTotal]
  )

  useEffect(() => {
    if (!authenticated) {
      return
    }

    const controller = new AbortController()
    const params = organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''
    fetch(`/api/public/store-credit${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo consultar el saldo.')
        setData(payload.data)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setData(null)
      })
      .finally(() => setSettled(true))

    return () => controller.abort()
  }, [authenticated, organizationSlug])

  if (!authenticated) return null

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-emerald-600 p-2 text-white"><BadgeDollarSign className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Saldo a favor</p>
          <p className="text-xs leading-5 text-muted-foreground">Podés usarlo como medio de pago, total o parcialmente.</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Consultando saldo" />}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border bg-background p-3">
              <p className="text-muted-foreground">Saldo disponible</p>
              <p className="mt-1 text-base font-black text-emerald-700 dark:text-emerald-300">{formatMoney(data.availableBalance)}</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-muted-foreground">Saldo reservado</p>
              <p className="mt-1 text-base font-black">{formatMoney(data.reservedBalance)}</p>
            </div>
          </div>

          {orderTotal != null && onAmountChange && data.availableBalance > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="store-credit-amount" className="text-xs font-bold">Usar saldo a favor</label>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onAmountChange(maximum)}>
                  Usar máximo
                </Button>
              </div>
              <Input
                id="store-credit-amount"
                type="number"
                inputMode="decimal"
                min={0}
                max={maximum}
                step="0.01"
                value={amount || ''}
                placeholder="0"
                onChange={(event) => onAmountChange(Math.max(0, Math.min(maximum, Number(event.target.value) || 0)))}
              />
              <p className="flex gap-1.5 text-[11px] leading-4 text-muted-foreground">
                <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
                Se reservará al enviar el pedido. Se descontará al confirmarlo y se liberará si se cancela.
              </p>
            </div>
          )}

          {data.availableBalance <= 0 && (
            <p className="text-xs text-muted-foreground">No tenés saldo disponible para aplicar en este momento.</p>
          )}
        </>
      )}
    </section>
  )
}

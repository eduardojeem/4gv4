import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet } from 'lucide-react'
import { useCheckout } from '../../contexts/CheckoutContext'

interface StoreCreditPanelProps {
  customerId?: string | null
  cartTotal: number
  formatCurrency: (amount: number) => string
}

/**
 * Aplica el saldo a favor del cliente a la venta en curso.
 *
 * El saldo no descuenta el total: la venta sigue valiendo lo mismo y el saldo
 * cubre parte de lo que hay que cobrar. Tratarlo como descuento falsearia los
 * ingresos del dia.
 */
export function StoreCreditPanel({ customerId, cartTotal, formatCurrency }: StoreCreditPanelProps) {
  const { storeCreditApplied, setStoreCreditApplied } = useCheckout()
  const [balance, setBalance] = useState(0)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!customerId) return
    let cancelled = false

    const load = async () => {
      // Lo aplicado pertenece al cliente anterior: se descarta antes de traer
      // el saldo del nuevo. El estado local se reinicia solo porque el padre
      // remonta el panel con `key={customerId}`.
      setStoreCreditApplied(0)

      try {
        const response = await fetch(`/api/customers/${customerId}/store-credit`)
        if (!response.ok) return
        const payload = await response.json().catch(() => null)
        if (cancelled || !payload?.success) return
        setBalance(Number(payload.data?.balance || 0))
      } catch {
        // Sin saldo visible el cobro sigue funcionando igual: no bloqueamos la
        // venta por un dato accesorio.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [customerId, setStoreCreditApplied])

  if (!customerId || balance <= 0) return null

  // Nunca se puede aplicar mas que el saldo ni mas que la venta: el sobrante
  // queda como saldo, no se devuelve como vuelto.
  const maxApplicable = Math.min(balance, cartTotal)
  const parsedDraft = Number((draft || '').replace(/[^\d]/g, '')) || 0

  const apply = (amount: number) => {
    const capped = Math.max(0, Math.min(amount, maxApplicable))
    setStoreCreditApplied(capped)
    setDraft(capped > 0 ? String(capped) : '')
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-500/30 dark:bg-indigo-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-lg bg-indigo-100 p-1.5 dark:bg-indigo-500/20 shrink-0">
            <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Saldo a favor</p>
            <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
              Disponible: {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {storeCreditApplied > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-indigo-700 dark:text-indigo-300"
            onClick={() => apply(0)}
          >
            Quitar
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs bg-white dark:bg-transparent"
            onClick={() => apply(maxApplicable)}
          >
            Aplicar {formatCurrency(maxApplicable)}
          </Button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => apply(parsedDraft)}
          placeholder="Monto parcial"
          className="h-8 text-sm bg-white dark:bg-transparent"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-xs shrink-0"
          onClick={() => apply(parsedDraft)}
          disabled={parsedDraft <= 0}
        >
          Usar
        </Button>
      </div>

      {storeCreditApplied > 0 && (
        <p className="mt-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          Se aplican {formatCurrency(storeCreditApplied)}. Queda por cobrar{' '}
          {formatCurrency(Math.max(0, cartTotal - storeCreditApplied))}.
        </p>
      )}
    </div>
  )
}

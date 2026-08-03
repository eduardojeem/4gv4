'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface StoreCreditMovement {
  id: string
  amount: number
  reason: string
  created_at: string
}

/**
 * Saldo a favor del cliente (plata que la organizacion le debe, al reves del
 * credito de financiacion). Se oculta cuando el saldo es cero para no sumar
 * ruido a las metricas del cliente promedio, que nunca tuvo una devolucion.
 */
export function StoreCreditCard({ customerId }: { customerId?: string | null }) {
  const [balance, setBalance] = useState(0)
  const [lastMovement, setLastMovement] = useState<StoreCreditMovement | null>(null)

  useEffect(() => {
    if (!customerId) return
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}/store-credit`)
        if (!response.ok) return
        const payload = await response.json().catch(() => null)
        if (cancelled || !payload?.success) return
        setBalance(Number(payload.data?.balance || 0))
        setLastMovement(payload.data?.movements?.[0] ?? null)
      } catch {
        // El saldo a favor es informativo: si falla, la ficha del cliente se
        // muestra igual en lugar de romperse por un dato secundario.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (balance <= 0) return null

  return (
    <Card className="border border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-950/20">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            Saldo a favor
          </p>
          <p className="text-xl font-bold tracking-tight text-indigo-900 dark:text-indigo-200 tabular-nums">
            {formatCurrency(balance)}
          </p>
          {lastMovement && (
            <p className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80 truncate">
              {lastMovement.reason}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-500/20 shrink-0">
          <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
      </CardContent>
    </Card>
  )
}

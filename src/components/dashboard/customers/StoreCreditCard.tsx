'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface StoreCreditMovement {
  id: string
  amount: number
  reason: string
  source_type: 'after_sales' | 'sale' | 'repair' | 'manual'
  source_id: string | null
  created_at: string
}

/**
 * Saldo a favor del cliente (plata que la organizacion le debe, al reves del
 * credito de financiacion). Se oculta cuando el saldo es cero para no sumar
 * ruido a las metricas del cliente promedio, que nunca tuvo una devolucion.
 */
export function StoreCreditCard({ customerId }: { customerId?: string | null }) {
  const [balance, setBalance] = useState(0)
  const [movements, setMovements] = useState<StoreCreditMovement[]>([])
  const [loading, setLoading] = useState(Boolean(customerId))
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const retry = useCallback(() => setReloadKey(value => value + 1), [])

  useEffect(() => {
    if (!customerId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/customers/${customerId}/store-credit?page=1&pageSize=20`)
        if (!response.ok) throw new Error('No se pudo cargar el saldo a favor.')
        const payload = await response.json().catch(() => null)
        if (!payload?.success) throw new Error(payload?.error || 'No se pudo cargar el saldo a favor.')
        if (cancelled) return
        setBalance(Number(payload.data?.balance || 0))
        setMovements(payload.data?.movements ?? [])
      } catch {
        if (!cancelled) setError('No se pudo cargar el saldo a favor.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [customerId, reloadKey])

  if (!customerId) return null

  const sourceLabel = (source: StoreCreditMovement['source_type']) => ({
    after_sales: 'Posventa',
    sale: 'Venta',
    repair: 'Reparación',
    manual: 'Ajuste manual',
  })[source] || 'Movimiento'

  return (
    <Card className="border border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-950/20 sm:col-span-2">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            Saldo a favor
          </p>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando saldo…
              </p>
            ) : error ? (
              <div className="space-y-2" role="alert">
                <p className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={retry}>Reintentar</Button>
              </div>
            ) : (
              <>
                <p className="text-xl font-bold tracking-tight text-indigo-900 dark:text-indigo-200 tabular-nums">
                  {formatCurrency(balance)}
                </p>
                <p className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                  {balance > 0 ? 'Disponible para aplicar como medio de pago' : 'Sin saldo disponible'}
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-500/20 shrink-0">
            <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {!loading && !error && movements.length > 0 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-indigo-700 hover:bg-transparent dark:text-indigo-300"
              aria-expanded={expanded}
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {expanded ? 'Ocultar movimientos' : 'Ver movimientos'}
            </Button>
            {expanded && (
              <ul className="divide-y divide-indigo-200/70 rounded-md border border-indigo-200/70 bg-white/70 dark:divide-indigo-500/20 dark:border-indigo-500/20 dark:bg-slate-950/30" aria-label="Movimientos de saldo a favor">
                {movements.map(movement => (
                  <li key={movement.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{movement.reason}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {sourceLabel(movement.source_type)} · {new Date(movement.created_at).toLocaleString('es-PY')}
                      </p>
                    </div>
                    <span className={`shrink-0 font-semibold tabular-nums ${movement.amount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {movement.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(Number(movement.amount)))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

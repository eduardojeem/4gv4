'use client'

import { useCallback, useEffect, useState } from 'react'
import { endOfDay, startOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'

import type { CreditReport } from '@/lib/reports/credit-report'

/**
 * La cartera de creditos para la pestaña «Créditos».
 *
 * `usePosStats` solo trae los creditos OTORGADOS en el periodo: no dice cuanto
 * se debe en total, cuanto esta vencido ni cuanto se cobro. Eso ya lo calcula
 * `/api/reports/credits` (`buildCreditReport`), con el modulo de creditos
 * exigido en el servidor. Se reusa en vez de recalcularlo en el navegador.
 *
 * El periodo se arma igual que en `usePosStats` —inicio y fin del dia local—
 * para que las dos consultas cubran exactamente el mismo rango.
 */
export type CreditPortfolioState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; report: CreditReport }
  /** Un error no se muestra como ceros: se dice que no se pudo cargar. */
  | { status: 'error'; message: string }

export interface UseCreditPortfolioReturn {
  state: CreditPortfolioState
  refetch: () => Promise<void>
}

export function useCreditPortfolio(dateRange: DateRange | undefined, enabled: boolean): UseCreditPortfolioReturn {
  const [state, setState] = useState<CreditPortfolioState>({ status: 'idle' })

  const from = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null
  const to = dateRange?.from ? endOfDay(dateRange.to || dateRange.from).toISOString() : null
  const requestKey = enabled && from && to ? `${from}:${to}` : null
  const [previousRequestKey, setPreviousRequestKey] = useState(requestKey)
  if (previousRequestKey !== requestKey) {
    setPreviousRequestKey(requestKey)
    setState({ status: requestKey ? 'loading' : 'idle' })
  }

  const load = useCallback(
    async (signal?: AbortSignal): Promise<CreditPortfolioState | undefined> => {
      if (!from || !to) return
      try {
        const params = new URLSearchParams({ from, to })
        const res = await fetch(`/api/reports/credits?${params.toString()}`, { cache: 'no-store', signal })
        const body = (await res.json().catch(() => null)) as { success?: boolean; data?: CreditReport; error?: string } | null
        if (signal?.aborted) return
        if (!res.ok || !body?.success || !body.data) {
          return { status: 'error', message: body?.error ?? 'No se pudo cargar la cartera de créditos.' }
        }
        return { status: 'ready', report: body.data }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        return { status: 'error', message: 'Error de conexión al cargar la cartera de créditos.' }
      }
    },
    [from, to]
  )

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void load(controller.signal).then(result => {
      if (result && !controller.signal.aborted) setState(result)
    })
    return () => controller.abort()
  }, [enabled, load])

  const refetch = useCallback(async () => {
    if (!enabled || !from || !to) return
    setState({ status: 'loading' })
    const result = await load()
    if (result) setState(result)
  }, [enabled, from, to, load])

  return { state: requestKey && state.status === 'idle' ? { status: 'loading' } : state, refetch }
}

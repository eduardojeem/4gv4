'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { endOfDay, startOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'

import { useTenantScope } from '@/hooks/use-tenant-scope'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import type { CreditReport } from '@/lib/reports/credit-report'

/**
 * La cartera de creditos para la pestaÃ±a Â«CrÃ©ditosÂ».
 *
 * `usePosStats` solo trae los creditos OTORGADOS en el periodo: no dice cuanto
 * se debe en total, cuanto esta vencido ni cuanto se cobro. Eso ya lo calcula
 * `/api/reports/credits` (`buildCreditReport`), con el modulo de creditos
 * exigido en el servidor. Se reusa en vez de recalcularlo en el navegador.
 *
 * El periodo se arma igual que en `usePosStats` â€”inicio y fin del dia localâ€”
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
  const { scope, currentScope, organizationId: scopeOrganizationId } = useTenantScope()
  const { organization, isLoading } = useActiveOrganization()
  const { selectedBranchId } = useBranch()
  const from = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null
  const to = dateRange?.from ? endOfDay(dateRange.to || dateRange.from).toISOString() : null
  const ready = enabled && !isLoading && organization?.id && organization.id === scopeOrganizationId && from && to
  const requestKey = ready ? JSON.stringify([scope, organization.id, selectedBranchId, from, to]) : null
  const keyRef = useRef(requestKey)
  const sequence = useRef(0)
  useLayoutEffect(() => { keyRef.current = requestKey; sequence.current++ }, [requestKey])
  const [snapshot, setSnapshot] = useState<{ key: string; state: CreditPortfolioState } | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!requestKey || !from || !to) return false
    const request = ++sequence.current
    const valid = () => !signal?.aborted && keyRef.current === requestKey && currentScope.current === scope && sequence.current === request
    setSnapshot({ key: requestKey, state: { status: 'loading' } })
    try {
      const params = new URLSearchParams({ from, to })
      const response = await fetch(`/api/reports/credits?${params}`, { cache: 'no-store', signal, headers: branchHeaders(selectedBranchId) })
      const body = await response.json().catch(() => null) as { success?: boolean; data?: CreditReport; error?: string } | null
      if (!valid()) return false
      if (!response.ok || !body?.success || !body.data) throw new Error(body?.error || 'No se pudo cargar la cartera de créditos.')
      setSnapshot({ key: requestKey, state: { status: 'ready', report: body.data } })
      return true
    } catch (error) {
      if (!valid()) return false
      setSnapshot({ key: requestKey, state: { status: 'error', message: error instanceof Error ? error.message : 'Error de conexión al cargar la cartera de créditos.' } })
      return false
    }
  }, [requestKey, from, to, scope, currentScope, selectedBranchId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => { controller.abort(); sequence.current++ }
  }, [load])

  const refetch = useCallback(async () => {
    if (!await load()) throw new Error('No se pudo actualizar la cartera de créditos.')
  }, [load])
  const state: CreditPortfolioState = !requestKey ? { status: 'idle' } : snapshot?.key === requestKey ? snapshot.state : { status: 'loading' }
  return { state, refetch }
}

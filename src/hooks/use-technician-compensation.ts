import { useCallback, useEffect, useState } from 'react'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import {
  DEFAULT_COMPENSATION,
  type CompensationConfig,
  type EarningsResult,
} from '@/lib/technician/earnings'

/**
 * Config de compensación + ganancia del mes de un técnico.
 * Solo hace fetch cuando `enabled` (evita pedir datos sensibles a no-admins).
 */
export function useTechnicianCompensation(technicianId: string, enabled: boolean) {
  const { selectedBranchId } = useBranch()
  const [compensation, setCompensation] = useState<CompensationConfig>({ ...DEFAULT_COMPENSATION })
  const [earnings, setEarnings] = useState<EarningsResult | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)

  const load = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/repairs/technicians/${technicianId}/compensation`, {
        headers: branchHeaders(selectedBranchId),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setCompensation(data.compensation)
      setEarnings(data.earnings)
    } catch (err) {
      console.error('[useTechnicianCompensation]', err)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, technicianId, selectedBranchId])

  useEffect(() => { void load() }, [load])

  return { compensation, earnings, isLoading, refresh: load }
}

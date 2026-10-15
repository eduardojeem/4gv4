import { useCallback, useEffect, useRef, useState } from 'react'
import { useBranch } from '@/contexts/branch-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { branchHeaders } from '@/lib/branches/client'
import { DEFAULT_COMPENSATION, type CompensationConfig, type EarningsResult } from '@/lib/technician/earnings'

export function useTechnicianCompensation(technicianId: string, enabled: boolean) {
  const { selectedBranchId } = useBranch()
  const organizationContext = useOptionalActiveOrganization()
  const organizationId = organizationContext?.organization?.id ?? ''
  const scope = [organizationId, technicianId, selectedBranchId ?? 'all', enabled].join(':')
  const currentScope = useRef(scope)
  currentScope.current = scope
  const sequence = useRef(0)
  const [state, setState] = useState<{ scope: string; compensation: CompensationConfig; earnings: EarningsResult | null; error: string | null }>({
    scope: '', compensation: { ...DEFAULT_COMPENSATION }, earnings: null, error: null,
  })
  const [loading, setLoading] = useState(enabled)
  const load = useCallback(async () => {
    if (!enabled || organizationContext?.isLoading) return
    const request = ++sequence.current
    setLoading(true)
    try {
      const response = await fetch('/api/repairs/technicians/' + technicianId + '/compensation', {
        cache: 'no-store', headers: { ...branchHeaders(selectedBranchId), ...(organizationId ? { 'x-organization-id': organizationId } : {}) },
      })
      if (!response.ok) throw new Error('No se pudieron cargar las condiciones de remuneración.')
      const data = await response.json()
      if (request === sequence.current && currentScope.current === scope) setState({ scope, compensation: data.compensation, earnings: data.earnings, error: null })
    } catch (error) {
      if (request === sequence.current && currentScope.current === scope) setState({ scope, compensation: { ...DEFAULT_COMPENSATION }, earnings: null, error: error instanceof Error ? error.message : 'No se pudieron cargar las condiciones.' })
    } finally {
      if (request === sequence.current && currentScope.current === scope) setLoading(false)
    }
  }, [enabled, organizationContext?.isLoading, organizationId, technicianId, selectedBranchId, scope])
  useEffect(() => {
    const invalidate = () => { ++sequence.current; setState({ scope: '', compensation: { ...DEFAULT_COMPENSATION }, earnings: null, error: null }) }
    const cancel = () => { ++sequence.current }
    void load()
    window.addEventListener('organization:changed', invalidate)
    return () => { cancel(); window.removeEventListener('organization:changed', invalidate) }
  }, [load])
  const visible = enabled && !organizationContext?.isLoading && state.scope === scope
  return {
    compensation: visible ? state.compensation : { ...DEFAULT_COMPENSATION },
    earnings: visible ? state.earnings : null,
    error: visible ? state.error : null,
    isLoading: enabled && (loading || !visible),
    refresh: load,
  }
}

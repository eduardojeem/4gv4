'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import type { StartGuidePreferences, StartGuideResult } from '@/lib/onboarding/start-guide'
import type { deriveOnboardingChecklist } from '@/lib/onboarding/shared-setup'

export interface BusinessStartGuidePayload {
  organizationId: string
  branchId: string | null
  preferences: StartGuidePreferences
  guide: StartGuideResult
  limitations: string[]
  setupChecklist: ReturnType<typeof deriveOnboardingChecklist>
}
export function useBusinessStartGuide() {
  const context = useOptionalActiveOrganization()
  const { selectedBranchId } = useBranch()
  const organizationId = context?.organization?.id ?? ''
  const enabled = Boolean(organizationId && !context?.isLoading && ['owner', 'admin'].includes(context?.organization?.role ?? ''))
  const scope = `${organizationId}:${selectedBranchId ?? 'all'}:${enabled}`
  const currentScope = useRef(scope); currentScope.current = scope
  const sequence = useRef(0)
  const [state, setState] = useState<{ scope: string; data: BusinessStartGuidePayload | null; error: string | null; loading: boolean; saving: boolean }>({ scope: '', data: null, error: null, loading: false, saving: false })
  const requestHeaders = useCallback(() => ({ 'x-organization-id': organizationId, ...(selectedBranchId ? { 'x-branch-id': selectedBranchId } : {}) }), [organizationId, selectedBranchId])
  const refresh = useCallback(async () => {
    if (!enabled) return
    const request = ++sequence.current
    setState(previous => ({ scope, data: previous.scope === scope ? previous.data : null, error: null, loading: true, saving: false }))
    try {
      const response = await fetch('/api/onboarding/start-guide', { headers: requestHeaders(), cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'No se pudo comprobar la preparación.')
      if (payload.organizationId !== organizationId || payload.branchId !== (selectedBranchId ?? null) || !Array.isArray(payload.guide?.tasks)) throw new Error('La organización o sucursal cambió. Actualizá la guía.')
      if (currentScope.current === scope && request === sequence.current) setState({ scope, data: payload, error: null, loading: false, saving: false })
    } catch (error) {
      if (currentScope.current === scope && request === sequence.current) setState({ scope, data: null, error: error instanceof Error ? error.message : 'No se pudo comprobar la preparación.', loading: false, saving: false })
    }
  }, [enabled, scope, requestHeaders, organizationId, selectedBranchId])
  useEffect(() => {
    const invalidate = () => { ++sequence.current }
    void refresh()
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('business-start-guide:changed', onFocus)
    return () => { invalidate(); window.removeEventListener('focus', onFocus); window.removeEventListener('business-start-guide:changed', onFocus) }
  }, [refresh])
  const savePreferences = useCallback(async (preferences: StartGuidePreferences) => {
    if (!enabled || currentScope.current !== scope) return false
    setState(previous => ({ ...previous, saving: true, error: null }))
    try {
      const response = await fetch('/api/onboarding/start-guide', { method: 'PATCH', headers: { ...requestHeaders(), 'content-type': 'application/json' }, body: JSON.stringify(preferences) })
      if (!response.ok) { const payload = await response.json(); throw new Error(payload?.error || 'No se pudieron guardar las preferencias.') }
      if (currentScope.current === scope) await refresh()
      return true
    } catch (error) {
      if (currentScope.current === scope) setState(previous => ({ ...previous, saving: false, error: error instanceof Error ? error.message : 'No se pudieron guardar las preferencias.' }))
      return false
    }
  }, [enabled, scope, requestHeaders, refresh])
  const visible = enabled && state.scope === scope
  return { enabled, data: visible ? state.data : null, error: visible ? state.error : null, loading: enabled && (!visible || state.loading), saving: visible && state.saving, refresh, savePreferences }
}

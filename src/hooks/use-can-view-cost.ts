'use client'

import { useEffect, useState } from 'react'
import { useTenantScope } from '@/hooks/use-tenant-scope'

type CostAccess = { canReadCost: boolean; canUpdateCost: boolean }
const denied: CostAccess = { canReadCost: false, canUpdateCost: false }
type Pending = { controller: AbortController; consumers: number; promise: Promise<CostAccess> }
// Only coalesce in-flight browser requests. Results are never reused across mounts or tenants.
const pending = new Map<string, Pending>()

function acquire(scope: string, organizationId: string): Pending {
  const existing = pending.get(scope)
  if (existing && !existing.controller.signal.aborted) { existing.consumers++; return existing }
  const controller = new AbortController()
  const entry: Pending = { controller, consumers: 1, promise: Promise.resolve(denied) }
  entry.promise = fetch('/api/products/access', { cache: 'no-store', signal: controller.signal })
    .then(async response => {
      if (!response.ok) return denied
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object') return denied
      const access = data as Record<string, unknown>
      if (access.organizationId !== organizationId) return denied
      // A hidden cost must never become an implicit zero write in a visual form.
      return { canReadCost: access.canReadCost === true, canUpdateCost: access.canReadCost === true && access.canUpdateCost === true }
    }).catch(() => denied).finally(() => { if (pending.get(scope) === entry) pending.delete(scope) })
  pending.set(scope, entry)
  return entry
}

/** The server resolves membership and grants for the active organization; global roles are not authority. */
export function useProductCostAccess(): CostAccess {
  const { scope, currentScope, organizationId, userId } = useTenantScope()
  const [state, setState] = useState<{ scope: string; access: CostAccess } | null>(null)
  useEffect(() => {
    if (!organizationId || !userId) return
    let active = true
    const entry = acquire(scope, organizationId)
    void entry.promise.then(access => {
      if (active && currentScope.current === scope) setState({ scope, access })
    })
    return () => {
      active = false
      if (--entry.consumers === 0) entry.controller.abort()
    }
  }, [scope, currentScope, organizationId, userId])
  return organizationId && userId && state?.scope === scope ? state.access : denied
}

export function useCanViewCost(): boolean { return useProductCostAccess().canReadCost }
export function useCanUpdateCost(): boolean { return useProductCostAccess().canUpdateCost }

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'

/** Also reacts immediately to the switch event, before refreshed providers arrive. */
export function useTenantScope() {
  const { user } = useAuth()
  const active = useOptionalActiveOrganization()
  const [switched, setSwitched] = useState<{ userId: string | undefined; id: string } | null>(null)
  const organizationId = (switched?.userId === user?.id ? switched?.id : null) ?? active?.organization?.id ?? user?.organization?.id ?? null
  const scope = `${user?.id ?? ''}:${organizationId ?? ''}`
  const currentScope = useRef(scope)
  useLayoutEffect(() => { currentScope.current = scope }, [scope])
  useEffect(() => {
    const onChange = (event: Event) => {
      const id = (event as CustomEvent<{ organizationId?: string }>).detail?.organizationId
      if (!id) return
      currentScope.current = `${user?.id ?? ''}:${id}`
      setSwitched({ userId: user?.id, id })
    }
    window.addEventListener('organization:changed', onChange)
    return () => window.removeEventListener('organization:changed', onChange)
  }, [user?.id])
  return { scope, currentScope, organizationId, userId: user?.id }
}

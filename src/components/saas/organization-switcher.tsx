'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { OrganizationRole } from '@/lib/saas/permissions'
import type { SaaSPlan } from '@/lib/saas/plans'

type OrganizationOption = {
  id: string
  name: string
  slug: string
  plan: SaaSPlan
  logo_url: string | null
  role: OrganizationRole
}

type OrganizationsResponse = {
  organizations: OrganizationOption[]
  activeOrganization: OrganizationOption | null
}

const roleLabel: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Caja',
  technician: 'Tecnico',
  seller: 'Ventas',
  customer: 'Cliente',
}

export function OrganizationSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadOrganizations() {
      try {
        const response = await fetch('/api/organizations', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json() as OrganizationsResponse
        if (!mounted) return

        setOrganizations(payload.organizations ?? [])
        setActiveId(payload.activeOrganization?.id ?? payload.organizations?.[0]?.id ?? '')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadOrganizations()

    return () => {
      mounted = false
    }
  }, [])

  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === activeId) ?? null,
    [organizations, activeId]
  )

  const switchOrganization = useCallback(async (organizationId: string) => {
    if (!organizationId || organizationId === activeId || switching) return

    setSwitching(true)
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })

      if (!response.ok) return

      setActiveId(organizationId)
      window.dispatchEvent(new CustomEvent('organization:changed', { detail: { organizationId } }))
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }, [activeId, router, switching])

  if (loading || organizations.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground',
          compact ? 'h-8' : 'h-9'
        )}
      >
        <Building2 className="h-4 w-4" />
        {!compact && <span>Empresa</span>}
      </div>
    )
  }

  if (organizations.length === 1 && activeOrganization) {
    return (
      <div
        className={cn(
          'flex max-w-[220px] items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 text-sm',
          compact ? 'h-8' : 'h-9'
        )}
        title={activeOrganization.name}
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        {!compact && <span className="truncate">{activeOrganization.name}</span>}
      </div>
    )
  }

  return (
    <Select value={activeId} onValueChange={switchOrganization} disabled={switching}>
      <SelectTrigger
        size={compact ? 'sm' : 'default'}
        className={cn('max-w-[240px] bg-background', compact ? 'w-[150px]' : 'w-[220px]')}
        aria-label="Cambiar empresa activa"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Empresa" />
        {switching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </SelectTrigger>
      <SelectContent align="end">
        {organizations.map((organization) => (
          <SelectItem key={organization.id} value={organization.id}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{organization.name}</span>
              <span className="text-xs text-muted-foreground">
                {roleLabel[organization.role]} - {organization.plan}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

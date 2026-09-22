'use client'

import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import type { NavBadgeKey } from '@/config/admin-navigation'

export type AdminNavBadges = Partial<Record<NavBadgeKey, number>>
const EMPTY_BADGES: AdminNavBadges = {}

/**
 * Contadores para el menu del admin.
 *
 * El monitor de cajas es la unica seccion que genera alertas, y no habia forma
 * de enterarse sin entrar: la pantalla tiene su globito, el menu no mostraba
 * nada. Con doce alertas criticas el menu se veia igual que un dia tranquilo.
 *
 * Se cuenta en la base con `head: true`, sin traer las filas: es un numero, no
 * una lista. Y se escucha el alta de alertas para que el punto aparezca sin
 * recargar, que es el momento en que sirve.
 */
export function useAdminNavBadges(): AdminNavBadges {
  const { organization } = useActiveOrganization()
  const organizationId = organization?.id
  const { selectedBranchId } = useBranch()
  const key = useMemo(() => organizationId ? ['admin-nav-badges', organizationId, selectedBranchId] as const : null,
    [organizationId, selectedBranchId])
  const { data: badges = EMPTY_BADGES, mutate: refresh } = useSWR(key, async () => {
    try {
      const supabase = createClient()
      let query = supabase
        .from('cash_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_resolved', false)

      query = withBranchFilter(query, selectedBranchId)

      const { count, error } = await query
      // Un menu no puede romperse por un contador: si falla, no se muestra nada.
      if (error) return

      return { 'cash-alerts': count ?? 0 } as AdminNavBadges
    } catch {
      // Ídem: el menu sigue funcionando sin el punto.
    }
    return EMPTY_BADGES
  }, { revalidateOnFocus: false })

  useEffect(() => {
    if (!organizationId) return

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`admin-nav-badges:${organizationId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cash_alerts',
          filter: `organization_id=eq.${organizationId}`,
        }, () => {
          void refresh()
        })
        .subscribe()
    } catch {
      channel = null
    }

    return () => {
      if (channel) {
        try {
          createClient().removeChannel(channel)
        } catch {
          // El canal se cae solo al desmontar.
        }
      }
    }
  }, [organizationId, refresh])

  return organizationId ? badges : EMPTY_BADGES
}

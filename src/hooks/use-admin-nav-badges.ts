'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import type { NavBadgeKey } from '@/config/admin-navigation'

export type AdminNavBadges = Partial<Record<NavBadgeKey, number>>

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
  const [badges, setBadges] = useState<AdminNavBadges>({})
  const { organization } = useActiveOrganization()
  const { selectedBranchId } = useBranch()

  const refresh = useCallback(async () => {
    if (!organization?.id) {
      setBadges({})
      return
    }

    try {
      const supabase = createClient()
      let query = supabase
        .from('cash_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('is_resolved', false)

      query = withBranchFilter(query, selectedBranchId)

      const { count, error } = await query
      // Un menu no puede romperse por un contador: si falla, no se muestra nada.
      if (error) return

      setBadges({ 'cash-alerts': count ?? 0 })
    } catch {
      // Ídem: el menu sigue funcionando sin el punto.
    }
  }, [organization?.id, selectedBranchId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!organization?.id) return

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`admin-nav-badges:${organization.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cash_alerts',
          filter: `organization_id=eq.${organization.id}`,
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
  }, [organization?.id, refresh])

  return badges
}

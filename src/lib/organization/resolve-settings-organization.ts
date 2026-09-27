import type { SupabaseClient } from '@supabase/supabase-js'

import { getCurrentOrganizationContext } from '@/lib/saas/context'

type AdminClient = Pick<SupabaseClient, 'from'>

/**
 * La organizacion cuya configuracion se esta mirando o editando.
 *
 * La carga (`/api/settings/shared`) y el guardado (`/api/admin/system/settings`)
 * decidian segun QUIEN pedia, no segun QUE organizacion estaba en pantalla: a un
 * superadmin la carga le devolvia la fila global de la plataforma y el guardado
 * escribia en ella. Dentro de su propia organizacion, el nombre, el RUC y el IVA
 * de su empresa terminaban en la configuracion de toda la plataforma, y el POS y
 * los tickets mostraban los datos de la plataforma. La pantalla lo tapaba
 * redirigiendo a todo superadmin a /superadmin/settings.
 *
 * Carga y guardado usan esta misma funcion, asi que no pueden apuntar a
 * organizaciones distintas.
 *
 * `requireStaff`: para un superadmin no cuenta una organizacion donde solo es
 * cliente de la tienda publica. Mostrarle «Configuracion de la organizacion» de
 * una tienda donde compro seria confundir las dos cosas.
 */
export async function resolveSettingsOrganizationId(
  admin: AdminClient,
  userId: string,
  options: { requireStaff?: boolean } = {}
): Promise<string | null> {
  let organizationId = (await getCurrentOrganizationContext(userId))?.id ?? null

  if (!organizationId) {
    let fallback = admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
    if (options.requireStaff) fallback = fallback.neq('role', 'customer')

    const { data: membership } = await fallback
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    organizationId = (membership as { organization_id?: string } | null)?.organization_id ?? null
  }

  if (organizationId && options.requireStaff) {
    const { data: member } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    const role = (member as { role?: string } | null)?.role
    if (!role || role === 'customer') return null
  }

  return organizationId
}

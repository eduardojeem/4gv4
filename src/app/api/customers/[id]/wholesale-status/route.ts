import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveWholesaleAccessForUser } from '@/lib/auth/wholesale-access'
import { logger } from '@/lib/logger'

/**
 * Consulta de solo lectura: si el cliente tiene precio mayorista habilitado,
 * para poder mostrar el precio correcto al cotizar (repuestos, servicios).
 *
 * Distinto de /api/customers/[id]/set-wholesale, que es admin-only porque
 * OTORGA el acceso. Acá solo se pregunta "¿qué precio le corresponde?", que
 * es el mismo nivel de sensibilidad que ver el precio mayorista en sí — no
 * hace falta ser admin para eso, cualquiera que pueda vender ya lo ve.
 *
 * Se usa el cliente admin para leer `user_permissions`: esa tabla tiene RLS
 * restringido a `user_id = auth.uid() OR is_admin()`, así que un vendedor
 * consultando el permiso de OTRO usuario con el cliente normal obtendría
 * cero filas en silencio (no un error) y el sistema respondería "no es
 * mayorista" aunque sí lo sea. El permiso ya se validó arriba con
 * `crm.customers.read`; acá el admin client se usa solo para resolver un
 * booleano, nunca se devuelven las filas de permisos en sí.
 *
 * Un cliente sin cuenta vinculada (`profile_id` nulo, el caso más común en un
 * mostrador) no tiene forma de tener mayorista activo hoy: se devuelve false.
 */

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (_request, { organization }, routeContext) => {
    try {
      const id = await getRouteId(routeContext)
      if (!id) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      const admin = createAdminSupabase()
      const { data: customer, error } = await admin
        .from('customers')
        .select('profile_id, customer_type, segment')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (error) throw error
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Cliente no encontrado.' }, { status: 404 })
      }

      const isWholesaleByType = (customer.customer_type || '').toLowerCase() === 'wholesale' ||
        (customer.customer_type || '').toLowerCase() === 'mayorista' ||
        (customer.segment || '').toLowerCase() === 'wholesale' ||
        (customer.segment || '').toLowerCase() === 'mayorista'

      if (isWholesaleByType) {
        return NextResponse.json({ success: true, data: { isWholesale: true, hasAccount: Boolean(customer.profile_id) } })
      }

      if (!customer.profile_id) {
        return NextResponse.json({ success: true, data: { isWholesale: false, hasAccount: false } })
      }

      const isWholesale = await resolveWholesaleAccessForUser(admin, customer.profile_id, organization.id)
      return NextResponse.json({ success: true, data: { isWholesale, hasAccount: true } })
    } catch (error) {
      logger.error('Wholesale status check error', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudo verificar el estado mayorista.' },
        { status: 500 }
      )
    }
  }
)

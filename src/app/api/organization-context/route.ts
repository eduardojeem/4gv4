import { NextResponse } from 'next/server'
import { requireAuth, getAuthResponse } from '@/lib/auth/require-auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import type { OrganizationRole } from '@/lib/saas/permissions'
export type ActiveOrganizationPayload = {
  id: string
  name: string
  slug: string
  role: OrganizationRole
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function GET(_request?: Request) {
  try {
    const auth = await requireAuth()
    const denied = getAuthResponse(auth)
    if (denied) {
      denied.headers.set('Cache-Control', 'private, no-store')
      return denied
    }
    if (!auth.authenticated) return response({ error: 'No autenticado' }, 401)
    const organization = await getCurrentOrganizationContext(auth.user.id)
    if (organization)
      return response({
        activeOrganization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: organization.role,
        } satisfies ActiveOrganizationPayload,
      })
    // Una selección inválida o un fallo de carga no equivale a no tener negocio.
    const { data, error } = await createAdminSupabase()
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .neq('role', 'customer')
      .limit(1)
    if (error || !Array.isArray(data))
      return response(
        {
          error: 'No pudimos comprobar tus empresas. Volvé a intentar.',
          code: 'BUSINESS_ACCESS_UNAVAILABLE',
        },
        503,
      )
    if (data?.length)
      return response(
        {
          error:
            'No pudimos resolver la empresa seleccionada. Revisá la selección y volvé a intentar.',
          code: 'ACTIVE_ORGANIZATION_UNAVAILABLE',
        },
        409,
      )
    return response(
      {
        error: 'No tenés una membresía activa en una empresa.',
        code: 'NO_ACTIVE_BUSINESS_MEMBERSHIP',
      },
      403,
    )
  } catch {
    return response(
      {
        error: 'No pudimos verificar el acceso a tu empresa. Volvé a intentar.',
        code: 'BUSINESS_ACCESS_UNAVAILABLE',
      },
      503,
    )
  }
}

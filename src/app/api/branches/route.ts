import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

export async function GET() {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  try {
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const organization = await getCurrentOrganizationContext(auth.user.id)
    if (!organization && auth.role === 'super_admin') {
      return NextResponse.json({ branches: [] })
    }

    if (!organization && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'No se pudo resolver la organizacion activa.' }, { status: 403 })
    }

    const supabase = createAdminSupabase()
    let query = supabase
      .from('branches')
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (organization) {
      query = query.eq('organization_id', organization.id)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ branches: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

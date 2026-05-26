import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/auth/role-utils'

function toProfileStatus(value: unknown) {
  return value === 'active' || value === 'inactive' || value === 'suspended'
    ? value
    : 'active'
}

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = createAdminSupabase()

    const [roleResult, profileResult, permissionsResult] = await Promise.all([
      admin
        .from('user_roles')
        .select('role,is_active')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('full_name, avatar_url, phone, status, role')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('user_permissions')
        .select('permission,is_active')
        .eq('user_id', user.id),
    ])

    const roleRow = roleResult.data as { role?: string | null; is_active?: boolean | null } | null
    const profileRow = profileResult.data as {
      full_name?: string | null
      avatar_url?: string | null
      phone?: string | null
      status?: string | null
      role?: string | null
    } | null
    const permissionRows = (permissionsResult.data ?? []) as Array<{
      permission?: string | null
      is_active?: boolean | null
    }>

    const role = normalizeRole(roleRow?.role ?? profileRow?.role ?? undefined) ?? 'cliente'

    return NextResponse.json({
      role,
      status: roleRow?.is_active === false ? 'inactive' : toProfileStatus(profileRow?.status),
      profile: {
        name: profileRow?.full_name || '',
        avatar_url: profileRow?.avatar_url || '',
        phone: profileRow?.phone || '',
      },
      permissions: permissionRows
        .filter((row) => row.is_active !== false)
        .map((row) => row.permission)
        .filter((permission): permission is string => Boolean(permission)),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

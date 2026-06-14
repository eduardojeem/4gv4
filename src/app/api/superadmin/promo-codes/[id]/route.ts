import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = await request.json().catch(() => null) as { isActive?: unknown } | null
  if (!body || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive es obligatorio.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: previous } = await admin.from('subscription_promo_codes').select('id, code, is_active').eq('id', id).maybeSingle()
  if (!previous) return NextResponse.json({ error: 'Código no encontrado.' }, { status: 404 })

  const { data: code, error } = await admin
    .from('subscription_promo_codes')
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: body.isActive ? 'promo_code.activated' : 'promo_code.deactivated',
    resource: 'subscription_promo_codes',
    resourceId: id,
    oldValues: { is_active: previous.is_active },
    newValues: { is_active: body.isActive },
    request,
  })

  return NextResponse.json({ code })
}

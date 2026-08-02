import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import {
  validateGlobalNotification,
  type GlobalNotificationInput,
} from '@/lib/superadmin/notification-validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null) as GlobalNotificationInput | null
  if (!body) return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: previous, error: previousError } = await admin
    .from('global_notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 })
  if (!previous) return NextResponse.json({ error: 'Notificacion no encontrada.' }, { status: 404 })

  const validation = validateGlobalNotification({ ...previous, ...body })
  if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
  const notification = validation.data

  if (notification.target_org_ids) {
    const { count, error: targetError } = await admin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .in('id', notification.target_org_ids)
    if (targetError) return NextResponse.json({ error: 'No se pudieron validar las organizaciones.' }, { status: 500 })
    if (count !== notification.target_org_ids.length) {
      return NextResponse.json({ error: 'Una o mas organizaciones no existen.' }, { status: 400 })
    }
  }

  const { data, error } = await admin
    .from('global_notifications')
    .update({
      ...notification,
      sent_at: notification.status === 'sent' ? previous.sent_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'notification.updated',
    resource: 'global_notifications',
    resourceId: id,
    oldValues: previous,
    newValues: notification,
    request,
  })
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { id } = await params
  const admin = createAdminSupabase()
  const { data: previous, error: loadError } = await admin
    .from('global_notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!previous) return NextResponse.json({ error: 'Notificacion no encontrada.' }, { status: 404 })

  const { error } = await admin.from('global_notifications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'notification.deleted',
    resource: 'global_notifications',
    resourceId: id,
    oldValues: previous,
    request,
    severity: 'high',
  })
  return NextResponse.json({ ok: true })
}

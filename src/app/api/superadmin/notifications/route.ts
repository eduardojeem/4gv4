import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import {
  validateGlobalNotification,
  type GlobalNotificationInput,
} from '@/lib/superadmin/notification-validation'

export async function GET(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? ''
  const page = Math.max(0, Number(searchParams.get('page') ?? 0))
  const PAGE_SIZE = 25

  const admin = createAdminSupabase()
  await admin.rpc('dispatch_due_global_notifications')

  let query = admin
    .from('global_notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (['draft', 'scheduled', 'sent'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => null) as GlobalNotificationInput | null
  if (!body) return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })

  const validation = validateGlobalNotification(body)
  if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
  const notification = validation.data

  const admin = createAdminSupabase()
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
    .insert({
      ...notification,
      sent_at: notification.status === 'sent' ? new Date().toISOString() : null,
      created_by: superAdmin.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'notification.created',
    resource: 'global_notifications',
    resourceId: data.id,
    newValues: notification,
    request,
  })
  return NextResponse.json(data, { status: 201 })
}

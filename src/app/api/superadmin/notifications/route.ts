import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

export async function GET(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? ''
  const page = Math.max(0, Number(searchParams.get('page') ?? 0))
  const PAGE_SIZE = 25

  const admin = createAdminSupabase()
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

  const body = await request.json() as {
    title?: string
    body?: string
    type?: string
    target?: string
    target_org_ids?: string[]
    status?: string
    scheduled_at?: string | null
  }

  const { title, body: msgBody, type, target, target_org_ids, status, scheduled_at } = body

  if (!title?.trim() || !msgBody?.trim()) {
    return NextResponse.json({ error: 'Titulo y cuerpo son obligatorios.' }, { status: 400 })
  }
  if (!['info', 'warning', 'success', 'danger'].includes(type ?? '')) {
    return NextResponse.json({ error: 'Tipo invalido.' }, { status: 400 })
  }
  if (!['all', 'specific'].includes(target ?? '')) {
    return NextResponse.json({ error: 'Destino invalido.' }, { status: 400 })
  }
  if (!['draft', 'scheduled', 'sent'].includes(status ?? '')) {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('global_notifications')
    .insert({
      title: title.trim(),
      body: msgBody.trim(),
      type: type ?? 'info',
      target: target ?? 'all',
      target_org_ids: target === 'specific' ? (target_org_ids ?? []) : null,
      status: status ?? 'draft',
      scheduled_at: status === 'scheduled' ? (scheduled_at ?? null) : null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      created_by: superAdmin.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

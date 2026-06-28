import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as {
    title?: string
    body?: string
    type?: string
    target?: string
    target_org_ids?: string[]
    status?: string
    scheduled_at?: string | null
  }

  const admin = createAdminSupabase()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.body !== undefined) updates.body = body.body.trim()
  if (body.type !== undefined) updates.type = body.type
  if (body.target !== undefined) updates.target = body.target
  if (body.target_org_ids !== undefined) {
    updates.target_org_ids = body.target === 'specific' ? body.target_org_ids : null
  }
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'sent') updates.sent_at = new Date().toISOString()
    if (body.status === 'scheduled') updates.scheduled_at = body.scheduled_at ?? null
  }

  const { data, error } = await admin
    .from('global_notifications')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { id } = await params
  const admin = createAdminSupabase()
  const { error } = await admin.from('global_notifications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { z } from 'zod'

const syncSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  email: z.string().trim().max(254).optional().or(z.literal('')),
})

async function handler(request: NextRequest, userId: string) {
  const body = await request.json().catch(() => null)
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { name, phone, address, email } = parsed.data
  const admin = createAdminSupabase()

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const orgId = membership?.organization_id
  if (!orgId) {
    return NextResponse.json({ error: 'No se encontró organización activa' }, { status: 404 })
  }

  const { data: defaultBranch } = await admin
    .from('branches')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()

  await Promise.all([
    admin.from('organizations').update({ name }).eq('id', orgId),
    admin.from('organization_settings').update({ display_name: name }).eq('organization_id', orgId),
    defaultBranch?.id
      ? admin.from('branches').update({
          phone: phone || null,
          address: address || null,
          email: email || null,
        }).eq('id', defaultBranch.id)
      : Promise.resolve(),
  ])

  return NextResponse.json({ success: true })
}

export function PUT(request: NextRequest) {
  return withAdminAuth(async (req, ctx) => handler(req, ctx.user.id))(request)
}

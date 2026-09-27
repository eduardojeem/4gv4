import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { promoCodeUpdateSchema } from '@/lib/superadmin/promo-codes'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const json = await request.json().catch(() => null)
  if (!json || typeof json !== 'object') {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 })
  }

  const parsed = promoCodeUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: previous } = await admin.from('subscription_promo_codes').select('*').eq('id', id).maybeSingle()
  if (!previous) return NextResponse.json({ error: 'Código no encontrado.' }, { status: 404 })

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
  if (parsed.data.maxRedemptions !== undefined) updateData.max_redemptions = parsed.data.maxRedemptions ?? null
  if (parsed.data.expiresAt !== undefined) updateData.expires_at = parsed.data.expiresAt ?? null

  const { data: code, error } = await admin
    .from('subscription_promo_codes')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = parsed.data.isActive !== undefined && Object.keys(updateData).length === 2
    ? (parsed.data.isActive ? 'promo_code.activated' : 'promo_code.deactivated')
    : 'promo_code.updated'

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action,
    resource: 'subscription_promo_codes',
    resourceId: id,
    oldValues: previous,
    newValues: code,
    request,
  })

  return NextResponse.json({ code })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const admin = createAdminSupabase()

  // Prevenir borrado si ya existen canjes asociados por integridad referencial
  const { count: redemptionsCount } = await admin
    .from('subscription_promo_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promo_code_id', id)

  if ((redemptionsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: este código ya cuenta con ${redemptionsCount} canje(s) registrado(s). Desactívalo en su lugar para pausar su uso.` },
      { status: 409 }
    )
  }

  const { data: previous } = await admin
    .from('subscription_promo_codes')
    .select('id, code, name')
    .eq('id', id)
    .maybeSingle()

  if (!previous) return NextResponse.json({ error: 'Código no encontrado.' }, { status: 404 })

  const { error: deleteError } = await admin
    .from('subscription_promo_codes')
    .delete()
    .eq('id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'promo_code.deleted',
    resource: 'subscription_promo_codes',
    resourceId: id,
    oldValues: previous,
    request,
    severity: 'high',
  })

  return NextResponse.json({ success: true })
}

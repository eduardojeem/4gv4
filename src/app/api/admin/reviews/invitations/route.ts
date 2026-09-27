import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const sourceTypeSchema = z.enum(['purchase', 'repair'])
const createInvitationSchema = z.object({
  verification_type: sourceTypeSchema,
  source_id: z.uuid(),
})

async function listHandler(request: NextRequest, context: AdminAuthContext) {
  const orgId = context.organizationId
  if (!orgId) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })

  const verificationType = sourceTypeSchema.catch('purchase').parse(request.nextUrl.searchParams.get('type') || 'purchase')
  const supabase = createAdminSupabase()
  const query = verificationType === 'purchase'
    ? supabase
        .from('sales')
        .select('id, code, created_at, customer_id, customers(name, email, phone)')
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .not('customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(25)
    : supabase
        .from('repairs')
        .select('id, ticket_number, device_brand, device_model, delivered_at, customer_id, customers(name, email, phone)')
        .eq('organization_id', orgId)
        .eq('status', 'entregado')
        .order('delivered_at', { ascending: false })
        .limit(25)

  const { data, error } = await query
  if (error) {
    logger.error('[admin/reviews/invitations] List error', { error, verificationType })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar las experiencias.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data ?? [] })
}

async function createHandler(request: NextRequest, context: AdminAuthContext) {
  try {
    const orgId = context.organizationId
    if (!orgId) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })

    const parsed = createInvitationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Selecciona una experiencia válida.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const { verification_type, source_id } = parsed.data
    const sourceResult = verification_type === 'purchase'
      ? await supabase
          .from('sales')
          .select('id, customer_id')
          .eq('id', source_id)
          .eq('organization_id', orgId)
          .eq('status', 'completed')
          .maybeSingle()
      : await supabase
          .from('repairs')
          .select('id, customer_id')
          .eq('id', source_id)
          .eq('organization_id', orgId)
          .eq('status', 'entregado')
          .maybeSingle()

    if (sourceResult.error || !sourceResult.data?.customer_id) {
      return NextResponse.json(
        { success: false, error: 'La venta o reparación no está finalizada o no tiene un cliente asociado.' },
        { status: 404 },
      )
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', sourceResult.data.customer_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!customer) {
      return NextResponse.json({ success: false, error: 'El cliente no pertenece a esta organización.' }, { status: 404 })
    }

    const sourceColumn = verification_type === 'purchase' ? 'sale_id' : 'repair_id'
    const now = new Date()
    await supabase
      .from('organization_review_invites')
      .update({ used_at: now.toISOString() })
      .eq('organization_id', orgId)
      .eq(sourceColumn, source_id)
      .is('used_at', null)
      .lt('expires_at', now.toISOString())

    const { data: activeInvite } = await supabase
      .from('organization_review_invites')
      .select('id')
      .eq('organization_id', orgId)
      .eq(sourceColumn, source_id)
      .is('used_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle()
    if (activeInvite) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un enlace activo para esta experiencia. Espera a que venza o sea utilizado.' },
        { status: 409 },
      )
    }

    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const { error: insertError } = await supabase.from('organization_review_invites').insert({
      organization_id: orgId,
      customer_id: customer.id,
      verification_type,
      sale_id: verification_type === 'purchase' ? source_id : null,
      repair_id: verification_type === 'repair' ? source_id : null,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_by: context.user.id,
    })
    if (insertError) {
      logger.error('[admin/reviews/invitations] Insert error', { error: insertError })
      return NextResponse.json({ success: false, error: 'No se pudo crear el enlace verificado.' }, { status: 500 })
    }

    const { data: organization } = await supabase.from('organizations').select('slug').eq('id', orgId).single()
    const origin = new URL(request.url).origin
    const url = `${origin}/${organization?.slug || ''}/inicio?review=${encodeURIComponent(token)}#resenas`
    return NextResponse.json({
      success: true,
      data: { url, expires_at: expiresAt.toISOString(), verification_type },
    }, { status: 201 })
  } catch (error) {
    logger.error('[admin/reviews/invitations] Unexpected error', { error })
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withAdminAuth(listHandler)
export const POST = withAdminAuth(createHandler)

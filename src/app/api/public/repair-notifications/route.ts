import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganization } from '@/lib/saas/public-tenant'
import { logger } from '@/lib/logger'

const NOTIFICATION_STATUSES = ['listo', 'entregado'] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminSupabase()
    const organization = await resolvePublicStorefrontOrganization(request, admin)
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const [{ data: membership, error: membershipError }, { data: customer, error: customerError }] = await Promise.all([
      admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin
        .from('customers')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('profile_id', user.id)
        .maybeSingle(),
    ])

    if (membershipError || customerError) {
      logger.warn('Could not resolve public repair notification scope', {
        organizationId: organization.id,
        userId: user.id,
        membershipError: membershipError?.message,
        customerError: customerError?.message,
      })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el acceso de cliente.' },
        { status: 500 }
      )
    }

    if (!membership || !customer) {
      return NextResponse.json(
        { success: true, data: { notifications: [] } },
        { headers: { 'Cache-Control': 'private, no-store' } }
      )
    }

    const { data: repairs, error: repairsError } = await admin
      .from('repairs')
      .select('id, ticket_number, device_brand, device_model, updated_at, created_at, status')
      .eq('organization_id', organization.id)
      .eq('customer_id', customer.id)
      .in('status', [...NOTIFICATION_STATUSES])
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (repairsError) throw repairsError

    const notifications = (repairs ?? []).map((repair) => {
      const brand = String(repair.device_brand || '').trim()
      const model = String(repair.device_model || '').trim()
      const status = String(repair.status || '').toLowerCase()

      return {
        id: String(repair.id),
        ticketNumber: repair.ticket_number ? String(repair.ticket_number) : null,
        deviceLabel: [brand, model].filter(Boolean).join(' ') || 'Equipo',
        updatedAt: String(repair.updated_at || repair.created_at || new Date().toISOString()),
        status,
        eventKey: `${String(repair.id)}:${status}`,
      }
    })

    return NextResponse.json(
      { success: true, data: { notifications } },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    logger.error('Public repair notifications API error', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudieron cargar las notificaciones.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolvePublicStorefrontOrganization } from '@/lib/saas/public-tenant'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Iniciá sesión para consultar tu saldo a favor.' },
        { status: 401 }
      )
    }

    const supabase = createAdminSupabase()
    const organization = await resolvePublicStorefrontOrganization(request, supabase)
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (customerError) throw customerError
    if (!customer) {
      return NextResponse.json({
        success: true,
        data: {
          customerId: null,
          ledgerBalance: 0,
          reservedBalance: 0,
          availableBalance: 0,
          movements: [],
          reservations: [],
        },
      })
    }

    const [balanceResult, movementsResult, reservationsResult] = await Promise.all([
      supabase
        .from('customer_store_credits')
        .select('amount')
        .eq('organization_id', organization.id)
        .eq('customer_id', customer.id),
      supabase
        .from('customer_store_credits')
        .select('id, amount, reason, source_type, source_id, created_at')
        .eq('organization_id', organization.id)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('customer_store_credit_reservations')
        .select('id, order_id, amount, status, reserved_at, consumed_at, released_at, order:customer_orders(order_number, status)')
        .eq('organization_id', organization.id)
        .eq('customer_id', customer.id)
        .order('reserved_at', { ascending: false })
        .limit(50),
    ])

    if (balanceResult.error) throw balanceResult.error
    if (movementsResult.error) throw movementsResult.error
    if (reservationsResult.error) throw reservationsResult.error

    const movements = movementsResult.data ?? []
    const reservations = reservationsResult.data ?? []
    const ledgerBalance = (balanceResult.data ?? []).reduce((sum, movement) => sum + Number(movement.amount || 0), 0)
    const reservedBalance = reservations
      .filter((reservation) => reservation.status === 'reserved')
      .reduce((sum, reservation) => sum + Number(reservation.amount || 0), 0)
    const availableBalance = Math.max(0, ledgerBalance - reservedBalance)

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.id,
        ledgerBalance,
        reservedBalance,
        availableBalance,
        movements,
        reservations,
      },
    })
  } catch (error) {
    logger.error('Public store credit query failed', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudo consultar el saldo a favor.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

/**
 * GET /api/customers/[id]/sales
 * Devuelve las últimas compras/ventas y estadísticas de un cliente específico.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 403 })
    }

    const { id: customerId } = await context.params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50)

    const supabase = createAdminSupabase()

    // 1. Obtener ventas recientes con sus items
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        code,
        status,
        payment_method,
        payment_status,
        total_amount,
        subtotal,
        discount_amount,
        created_at,
        sale_items (
          id,
          quantity,
          unit_price,
          total_price,
          product_name
        )
      `)
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. Calcular estadísticas reales de compras del cliente
    const { count: totalPurchases } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    const { data: totalsData } = await supabase
      .from('sales')
      .select('total_amount, status')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)
      .not('status', 'eq', 'cancelado')

    const totalSpent = (totalsData ?? []).reduce((sum, s) => sum + Number(s.total_amount || 0), 0)

    return NextResponse.json({
      success: true,
      sales: sales ?? [],
      stats: {
        totalPurchases: totalPurchases ?? 0,
        totalSpent,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

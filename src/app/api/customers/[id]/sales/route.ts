import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { isCancelledSaleStatus } from '@/lib/sales-status'
import { isCountableOrder } from '@/lib/customers/customer-spend'

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
    const requestedLimit = Number(searchParams.get('limit') || 10)
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.trunc(requestedLimit), 50))
      : 10

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

    // La ficha debe coincidir con el historial comercial completo: POS y
    // pedidos de la tienda publica. Se filtra en TypeScript para aceptar los
    // estados canonicos y los historicos en espanol sin dejar cancelados dentro.
    const [posTotalsResult, orderTotalsResult] = await Promise.all([
      supabase
        .from('sales')
        .select('total_amount, status')
        .eq('customer_id', customerId)
        .eq('organization_id', organization.id),
      supabase
        .from('customer_orders')
        .select('total, status')
        .eq('customer_id', customerId)
        .eq('organization_id', organization.id),
    ])

    if (posTotalsResult.error || orderTotalsResult.error) {
      return NextResponse.json({ error: 'No se pudieron calcular las compras del cliente' }, { status: 500 })
    }

    const validSales = (posTotalsResult.data ?? []).filter((sale) => {
      const status = String(sale.status ?? '').trim().toLowerCase()
      return !isCancelledSaleStatus(status) && status !== 'cancelado'
    })
    const validOrders = (orderTotalsResult.data ?? []).filter((order) => isCountableOrder(order.status))
    const posSpent = validSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.total_amount) || 0), 0)
    const ordersSpent = validOrders.reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0)
    const totalPurchases = validSales.length + validOrders.length
    const totalSpent = posSpent + ordersSpent

    return NextResponse.json({
      success: true,
      sales: sales ?? [],
      stats: {
        totalPurchases: totalPurchases ?? 0,
        totalSpent,
        posPurchases: validSales.length,
        webPurchases: validOrders.length,
        posSpent,
        ordersSpent,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

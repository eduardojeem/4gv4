import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { buildCustomerHistory } from '@/lib/customers/customer-history'
import { logger } from '@/lib/logger'

/**
 * GET /api/customers/[id]/history
 *
 * Ventas y reparaciones del cliente con su estado de pago real: pagado, parcial,
 * con deuda, a crédito o anulado. La ficha lo armaba en el navegador con campos
 * que no existían y mostraba toda venta como pendiente y las reparaciones
 * financiadas como pagadas.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tope por tipo: una ficha con más operaciones avisa que el historial está recortado. */
const HISTORY_LIMIT = 300

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

type Rows = Record<string, unknown>[]

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (_request, { organization }, routeContext) => {
    try {
      const customerId = await getRouteId(routeContext)
      if (!customerId || !UUID_PATTERN.test(customerId)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      // El cliente de servicio se salta RLS: todo se acota a la organización.
      const supabase = createAdminSupabase()
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (customerError) {
        return NextResponse.json({ success: false, error: 'No se pudo leer la ficha del cliente.' }, { status: 500 })
      }
      if (!customer) {
        return NextResponse.json({ success: false, error: 'El cliente no pertenece a la organización activa.' }, { status: 404 })
      }

      const [salesResult, repairsResult, creditsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('id, code, status, payment_method, payment_status, total_amount, created_at, sale_items(quantity, product:products(name))')
          .eq('customer_id', customerId)
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
        supabase
          .from('repairs')
          .select('id, ticket_number, device_brand, device_model, problem_description, status, pricing_mode, labor_cost, final_cost, estimated_cost, discount_amount, paid_amount, delivered_at, created_at, parts:repair_parts(unit_price, unit_cost, quantity)')
          .eq('customer_id', customerId)
          .eq('organization_id', organization.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
        supabase
          .from('customer_credits')
          .select('id, sale_id, status, metadata')
          .eq('customer_id', customerId)
          .eq('organization_id', organization.id),
      ])

      if (salesResult.error || repairsResult.error || creditsResult.error) {
        logger.error('[GET customer history] query error', {
          sales: salesResult.error?.message,
          repairs: repairsResult.error?.message,
          credits: creditsResult.error?.message,
        })
        return NextResponse.json({ success: false, error: 'No se pudo cargar el historial del cliente.' }, { status: 500 })
      }

      const credits = (creditsResult.data ?? []) as Rows
      let installments: Rows = []
      if (credits.length > 0) {
        const installmentsResult = await supabase
          .from('credit_installments')
          .select('id, credit_id, sale_id, due_date, amount, amount_paid, status')
          .in('credit_id', credits.map((c) => c.id))
        if (installmentsResult.error) {
          logger.error('[GET customer history] installments error', { error: installmentsResult.error.message })
          return NextResponse.json({ success: false, error: 'No se pudieron leer las cuotas del cliente.' }, { status: 500 })
        }
        installments = (installmentsResult.data ?? []) as Rows
      }

      const sales = (salesResult.data ?? []) as Rows
      const repairs = (repairsResult.data ?? []) as Rows
      const { items, summary } = buildCustomerHistory({ sales, repairs, credits, installments })

      return NextResponse.json({
        success: true,
        items,
        summary,
        truncated: sales.length >= HISTORY_LIMIT || repairs.length >= HISTORY_LIMIT,
      })
    } catch (error) {
      logger.error('[GET customer history] error', { error })
      return NextResponse.json({ success: false, error: 'No se pudo cargar el historial del cliente.' }, { status: 500 })
    }
  }
)

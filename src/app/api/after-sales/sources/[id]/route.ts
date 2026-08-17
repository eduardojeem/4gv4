import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import type { StoredSale } from '@/lib/after-sales/sale-receipt'

/**
 * Detalle completo de una venta o reparacion, para verla o reimprimirla.
 *
 * El listado (`/sources`) devuelve lo justo para elegir un origen. Reimprimir
 * necesita mas: impuesto, descuento, cajero y el desglose de pagos, que viven
 * en `sales` y `sale_payments`.
 */

interface SaleItemRow {
  id: string
  product_id: string | null
  quantity: number | null
  unit_price: number | null
  discount_amount?: number | null
  products?: { name: string | null; sku: string | null } | { name: string | null; sku: string | null }[] | null
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

/** El nombre del cajero vive en profiles, fuera del alcance del cliente tenant. */
async function resolveCashierName(userId: string | null) {
  if (!userId) return null
  const admin = createAdminSupabase()
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  if (!data) return null
  return (data.full_name as string | null)?.trim() || (data.email as string | null) || null
}

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (request, { organization }, routeContext) => {
    try {
      const id = await getRouteId(routeContext)
      if (!id) return NextResponse.json({ success: false, error: 'Falta el identificador.' }, { status: 400 })

      const { searchParams } = new URL(request.url)
      const type = searchParams.get('type') === 'repair' ? 'repair' : 'sale'
      const supabase = await createClient()

      if (type === 'repair') {
        const { data, error } = await supabase
          .from('repairs')
          .select(
            `id, ticket_number, device_type, device_brand, device_model, problem_description,
             status, final_cost, estimated_cost, paid_amount, payment_status,
             warranty_months, warranty_type, warranty_expires_at, delivered_at, created_at,
             customers:customers!customer_id(name, phone, email)`
          )
          .eq('id', id)
          .eq('organization_id', organization.id)
          .maybeSingle()

        if (error) throw error
        if (!data) return NextResponse.json({ success: false, error: 'Reparación no encontrada.' }, { status: 404 })

        const row = data as Record<string, unknown>
        const customer = firstOf(row.customers as { name: string | null; phone: string | null; email: string | null } | null)

        return NextResponse.json({
          success: true,
          data: {
            type: 'repair' as const,
            id: String(row.id),
            label: (row.ticket_number as string | null) || String(row.id).slice(0, 8),
            status: row.status ?? null,
            device: [row.device_brand, row.device_model].filter(Boolean).join(' '),
            deviceType: row.device_type ?? null,
            problem: row.problem_description ?? null,
            total: Number(row.final_cost ?? row.estimated_cost ?? 0),
            paidAmount: Number(row.paid_amount ?? 0),
            paymentStatus: row.payment_status ?? null,
            warrantyMonths: row.warranty_months ?? null,
            warrantyType: row.warranty_type ?? null,
            warrantyExpiresAt: row.warranty_expires_at ?? null,
            deliveredAt: row.delivered_at ?? null,
            createdAt: row.created_at ?? null,
            customer: customer
              ? { name: customer.name, phone: customer.phone, email: customer.email }
              : null,
          },
        })
      }

      const { data, error } = await supabase
        .from('sales')
        .select(
          `id, code, total_amount, subtotal_amount, tax_amount, discount_amount,
           payment_method, payment_status, created_at, created_by,
           customers:customers!customer_id(name, phone, email),
           sale_items(id, product_id, quantity, unit_price, discount_amount, products(name, sku))`
        )
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ success: false, error: 'Venta no encontrada.' }, { status: 404 })

      const row = data as Record<string, unknown>

      const { data: paymentRows, error: paymentsError } = await supabase
        .from('sale_payments')
        .select('id, payment_method, amount, reference, payment_index')
        .eq('organization_id', organization.id)
        .eq('sale_id', id)
        .order('payment_index', { ascending: true })

      if (paymentsError) throw paymentsError

      const customer = firstOf(row.customers as { name: string | null; phone: string | null; email: string | null } | null)
      const cashierName = await resolveCashierName((row.created_by as string | null) ?? null)

      const sale: StoredSale = {
        id: String(row.id),
        code: (row.code as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        subtotal: Number(row.subtotal_amount ?? 0),
        tax: Number(row.tax_amount ?? 0),
        discount: Number(row.discount_amount ?? 0),
        total: Number(row.total_amount ?? 0),
        paymentMethod: (row.payment_method as string | null) ?? null,
        cashierName,
        customer: customer
          ? { name: customer.name, phone: customer.phone, email: customer.email }
          : null,
        items: ((row.sale_items ?? []) as SaleItemRow[]).map((item) => {
          const product = firstOf(item.products)
          return {
            id: item.id,
            product_id: item.product_id,
            name: product?.name || 'Producto',
            sku: product?.sku ?? null,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unit_price) || 0,
            discount: item.discount_amount == null ? null : Number(item.discount_amount),
          }
        }),
        payments: (paymentRows ?? []).map((payment) => ({
          id: String(payment.id),
          method: payment.payment_method as string | null,
          amount: Number(payment.amount) || 0,
          reference: (payment.reference as string | null) ?? null,
        })),
      }

      return NextResponse.json({
        success: true,
        data: {
          type: 'sale' as const,
          paymentStatus: row.payment_status ?? null,
          sale,
        },
      })
    } catch (error) {
      logger.error('After-sales source detail API error', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudo cargar el detalle.' },
        { status: 500 }
      )
    }
  }
)

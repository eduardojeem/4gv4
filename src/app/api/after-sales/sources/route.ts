import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { sanitizeSearchTerm } from '@/lib/api/sanitize-search'
import { logger } from '@/lib/logger'

/**
 * Busca ventas o reparaciones para abrir un reclamo contra ellas.
 *
 * Existe porque el boton "Nuevo reclamo" de Posventa no tiene un origen: el
 * cliente llega al mostrador con un comprobante y hay que encontrarlo. Sin
 * esto, un caso solo se podia abrir navegando primero hasta la venta o la
 * reparacion.
 *
 * Devuelve una forma normalizada para que el dialogo no tenga que conocer el
 * esquema de cada tabla.
 */

interface SaleRow {
  id: string
  code: string | null
  total_amount: number | null
  created_at: string | null
  customers?: { name: string | null } | { name: string | null }[] | null
  sale_items?: Array<{
    id: string
    product_id: string | null
    quantity: number | null
    products?: { name: string | null } | { name: string | null }[] | null
  }> | null
}

interface RepairRow {
  id: string
  ticket_number: string | null
  device_brand: string | null
  device_model: string | null
  status: string | null
  warranty_months: number | null
  warranty_type: string | null
  warranty_expires_at: string | null
  delivered_at: string | null
  customers?: { name: string | null } | { name: string | null }[] | null
}

/** PostgREST devuelve el embed como objeto o array segun la cardinalidad. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (request, { organization }) => {
    try {
      const { searchParams } = new URL(request.url)
      const type = searchParams.get('type') === 'repair' ? 'repair' : 'sale'
      const term = sanitizeSearchTerm(searchParams.get('q'))
      const limit = Math.min(25, Math.max(1, Number(searchParams.get('limit') || 10)))

      const supabase = await createClient()

      if (type === 'sale') {
        let query = supabase
          .from('sales')
          .select(
            `id, code, total_amount, created_at,
             customers:customers!customer_id(name),
             sale_items(id, product_id, quantity, products(name))`
          )
          .eq('organization_id', organization.id)

        if (term) query = query.ilike('code', `%${term}%`)

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) throw error

        const results = ((data ?? []) as unknown as SaleRow[]).map((sale) => ({
          id: sale.id,
          label: sale.code || sale.id.slice(0, 8),
          subtitle: firstOf(sale.customers)?.name || 'Sin cliente',
          amount: Number(sale.total_amount || 0),
          date: sale.created_at,
          items: (sale.sale_items ?? []).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            name: firstOf(item.products)?.name || 'Producto',
            quantity: Number(item.quantity) || 1,
          })),
        }))

        return NextResponse.json({ success: true, data: results })
      }

      // Solo reparaciones entregadas: la garantia empieza a correr con la
      // entrega, asi que antes de eso no hay nada que reclamar.
      let query = supabase
        .from('repairs')
        .select(
          `id, ticket_number, device_brand, device_model, status,
           warranty_months, warranty_type, warranty_expires_at, delivered_at,
           customers:customers!customer_id(name)`
        )
        .eq('organization_id', organization.id)
        .eq('status', 'entregado')
        .gt('warranty_months', 0)

      if (term) query = query.ilike('ticket_number', `%${term}%`)

      const { data, error } = await query
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .limit(limit)

      if (error) throw error

      const now = Date.now()
      const results = ((data ?? []) as unknown as RepairRow[]).map((repair) => {
        const expiresAt = repair.warranty_expires_at ? new Date(repair.warranty_expires_at).getTime() : null
        return {
          id: repair.id,
          label: repair.ticket_number || repair.id.slice(0, 8),
          subtitle: firstOf(repair.customers)?.name || 'Sin cliente',
          device: [repair.device_brand, repair.device_model].filter(Boolean).join(' '),
          warrantyMonths: repair.warranty_months,
          warrantyType: repair.warranty_type,
          warrantyExpiresAt: repair.warranty_expires_at,
          warrantyExpired: expiresAt != null ? expiresAt < now : false,
          date: repair.delivered_at,
        }
      })

      return NextResponse.json({ success: true, data: results })
    } catch (error) {
      logger.error('After-sales sources API error', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudieron buscar las ventas o reparaciones.' },
        { status: 500 }
      )
    }
  }
)

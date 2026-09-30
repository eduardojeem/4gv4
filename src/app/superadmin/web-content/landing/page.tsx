import { createAdminSupabase } from '@/lib/supabase/admin'
import { LandingContentDashboard } from '@/components/superadmin/LandingContentDashboard'
import { getLandingRows } from '@/lib/superadmin/landing-rows'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import { normalizeOrderStatus } from '@/lib/orders/flow'
import {
  summarizeCommerce,
  type CommerceItem,
  type CommerceOrder,
  type CommerceSale,
  type CommerceSummary,
  type CommerceVisit,
} from '@/lib/superadmin/landing-commerce'
import { addDays, resolveCommerceRange, type CommerceRange } from '@/lib/superadmin/commerce-range'
import { parseLandingFilters } from '@/lib/superadmin/landing-filters'

export const revalidate = 60

/**
 * Ventas, pedidos, visitas y lo más vendido del período y del anterior.
 * `null` cuando las ventas o los pedidos no se pudieron leer: sin eso las
 * cifras serían menores a las reales.
 */
async function getCommerce(range: CommerceRange): Promise<CommerceSummary | null> {
  const admin = createAdminSupabase()
  // Un día de margen a cada lado: el período se corta por día de Paraguay, no
  // por UTC. Se trae desde el período anterior, para comparar.
  const previousStart = `${addDays(range.previous.from, -1)}T00:00:00Z`
  const currentStart = `${addDays(range.from, -1)}T00:00:00Z`
  const end = `${addDays(range.to, 1)}T23:59:59Z`

  try {
    const [sales, orders, saleItems, orderItems, visits] = await Promise.all([
      fetchAllRows<CommerceSale>((from, to) =>
        admin.from('sales').select('organization_id, total_amount, status, created_at')
          .gte('created_at', previousStart).lte('created_at', end).order('created_at').range(from, to)),
      fetchAllRows<CommerceOrder>((from, to) =>
        admin.from('customer_orders').select('organization_id, total, status, payment_status, created_at')
          .gte('created_at', previousStart).lte('created_at', end).order('created_at').range(from, to)),
      fetchAllRows<{ product_id: string | null; quantity: number | null; total_price: number | null; subtotal: number | null; sales: { organization_id: string; status: string | null; created_at: string | null } }>((from, to) =>
        admin.from('sale_items').select('product_id, quantity, total_price, subtotal, sales!inner(organization_id, status, created_at)')
          .gte('sales.created_at', currentStart).lte('sales.created_at', end).range(from, to) as never),
      fetchAllRows<{ product_id: string | null; product_name: string | null; quantity: number | null; subtotal: number | null; customer_orders: { organization_id: string; status: string | null; created_at: string | null } }>((from, to) =>
        admin.from('customer_order_items').select('product_id, product_name, quantity, subtotal, customer_orders!inner(organization_id, status, created_at)')
          .gte('customer_orders.created_at', currentStart).lte('customer_orders.created_at', end).range(from, to) as never),
      // Sin la migración la función no existe: se muestra que falta, no ceros.
      fetchAllRows<CommerceVisit>((from, to) =>
        admin.rpc('get_storefront_daily_visits', { p_from: range.previous.from, p_to: range.to })
          .order('day').order('organization_id').order('page')
          .range(from, to)).catch(() => null),
    ])

    const productIds = [...new Set(saleItems.map((item) => item.product_id).filter(Boolean))] as string[]
    const names = new Map<string, string>()
    for (let index = 0; index < productIds.length; index += 200) {
      const { data } = await admin.from('products').select('id, name').in('id', productIds.slice(index, index + 200))
      for (const product of (data ?? []) as Array<{ id: string; name: string }>) names.set(product.id, product.name)
    }

    const items: CommerceItem[] = [
      ...saleItems.map((item) => ({
        organization_id: item.sales.organization_id,
        product_key: item.product_id ?? 'sin-producto',
        product_name: (item.product_id && names.get(item.product_id)) || 'Producto eliminado',
        quantity: item.quantity,
        total: item.total_price ?? item.subtotal,
        created_at: item.sales.created_at,
        countable: isCompletedSaleStatus(item.sales.status),
      })),
      ...orderItems.map((item) => ({
        organization_id: item.customer_orders.organization_id,
        product_key: item.product_id ?? `nombre:${item.product_name ?? ''}`,
        product_name: item.product_name || (item.product_id && names.get(item.product_id)) || 'Producto',
        quantity: item.quantity,
        total: item.subtotal,
        created_at: item.customer_orders.created_at,
        countable: normalizeOrderStatus(item.customer_orders.status) !== 'CANCELLED',
      })),
    ]

    return summarizeCommerce({ range, sales, orders, visits, items })
  } catch {
    return null
  }
}

/** El año de la primera organización: antes no hay ventas que mirar. */
async function getFirstYear(fallback: number): Promise<number> {
  const { data } = await createAdminSupabase()
    .from('organizations')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const year = Number(String((data as { created_at?: string } | null)?.created_at ?? '').slice(0, 4))
  return Number.isFinite(year) && year > 2000 ? year : fallback
}

/** Lo que necesita la pantalla, leído en un mismo instante. */
async function loadLandingPage(params: Record<string, string | undefined>) {
  const now = Date.now()
  const firstYear = await getFirstYear(new Date(now).getFullYear())
  const range = resolveCommerceRange(params, now, firstYear)
  const [{ rows, failed }, commerce] = await Promise.all([getLandingRows(), getCommerce(range)])
  return { rows, failed, commerce, range, firstYear, referenceTime: new Date(now).toISOString() }
}

export default async function SuperAdminLandingContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const { rows, failed, commerce, range, firstYear, referenceTime } = await loadLandingPage(params)
  return (
    <LandingContentDashboard
      rows={rows}
      failed={failed}
      referenceTime={referenceTime}
      commerce={commerce}
      range={range}
      firstYear={firstYear}
      initialFilters={parseLandingFilters(params)}
    />
  )
}

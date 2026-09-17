import { isCompletedSaleStatus } from '@/lib/sales-status'
import { normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizePaymentStatus } from '@/lib/orders/payment-flow'
import type { StorefrontPage } from '@/lib/public/storefront-visits'
import { bucketOf, bucketsInRange, localDay, type CommerceGranularity, type CommerceRange } from '@/lib/superadmin/commerce-range'

export { localDay } from '@/lib/superadmin/commerce-range'

/**
 * Cómo le va comercialmente a las tiendas: cuánto venden y cuánta gente las
 * visita, en un período y contra el período anterior.
 *
 * Las reglas son las mismas del resto del panel: una venta anulada no suma, un
 * pedido online suma plata solo cuando está pagado, y un pedido cancelado no
 * cuenta como pedido.
 */

const amount = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export type CommerceSale = { organization_id: string; total_amount: number | null; status: string | null; created_at: string | null }
export type CommerceOrder = { organization_id: string; total: number | null; status: string | null; payment_status: string | null; created_at: string | null }
export type CommerceVisit = { organization_id: string; day: string; page: string; views: number | null; visitors: number | null }
export type CommerceItem = {
  organization_id: string
  product_key: string
  product_name: string
  quantity: number | null
  total: number | null
  created_at: string | null
  /** `false` cuando la venta se anuló o el pedido se canceló. */
  countable: boolean
}

export type StoreCommerce = {
  sold: number
  previousSold: number
  counterSales: number
  counterRevenue: number
  onlineOrders: number
  onlineRevenue: number
  /** `null` cuando no hay registro de visitas. */
  visitors: number | null
  views: number | null
  /** Pedidos online por cada 100 visitantes. `null` sin visitas. */
  conversion: number | null
}

export type CommerceSummary = {
  range: CommerceRange
  totals: StoreCommerce & {
    /** Variación de lo vendido contra el período anterior, en %. `null` si antes no hubo ventas. */
    deltaPercent: number | null
    averageTicket: number | null
    storesSelling: number
  }
  byStore: Record<string, StoreCommerce>
  /** Una barra por día, semana o mes según el largo del período. */
  series: Array<{ bucket: string; sold: number; visitors: number | null }>
  granularity: CommerceGranularity
  topProducts: Array<{ key: string; name: string; organizationId: string; units: number; revenue: number }>
  viewsByPage: Partial<Record<StorefrontPage, number>>
  /** `false` cuando la tabla de visitas todavía no existe. */
  visitsAvailable: boolean
}

const emptyStore = (visitsAvailable: boolean): StoreCommerce => ({
  sold: 0,
  previousSold: 0,
  counterSales: 0,
  counterRevenue: 0,
  onlineOrders: 0,
  onlineRevenue: 0,
  visitors: visitsAvailable ? 0 : null,
  views: visitsAvailable ? 0 : null,
  conversion: null,
})

const conversionOf = (orders: number, visitors: number | null) =>
  visitors && visitors > 0 ? Math.round((orders / visitors) * 1000) / 10 : null

export function summarizeCommerce(input: {
  range: CommerceRange
  sales: CommerceSale[]
  orders: CommerceOrder[]
  /** `null` cuando no se pudieron leer las visitas (por ejemplo, sin la migración). */
  visits: CommerceVisit[] | null
  items: CommerceItem[]
}): CommerceSummary {
  const { range } = input
  const visitsAvailable = input.visits !== null
  const { from, to, granularity } = range

  const inPeriod = (day: string) => day >= from && day <= to
  const inPrevious = (day: string) => day >= range.previous.from && day <= range.previous.to

  const byStore: Record<string, StoreCommerce> = {}
  const store = (id: string) => (byStore[id] ??= emptyStore(visitsAvailable))
  const buckets = bucketsInRange(from, to, granularity)
  const soldByBucket = new Map<string, number>(buckets.map((bucket) => [bucket, 0]))
  const visitorsByBucket = new Map<string, number>(buckets.map((bucket) => [bucket, 0]))
  const addTo = (map: Map<string, number>, day: string, value: number) => {
    const bucket = bucketOf(day, granularity)
    map.set(bucket, (map.get(bucket) ?? 0) + value)
  }

  for (const sale of input.sales) {
    if (!sale.created_at || !isCompletedSaleStatus(sale.status)) continue
    const day = localDay(sale.created_at)
    const value = amount(sale.total_amount)
    if (inPeriod(day)) {
      const s = store(sale.organization_id)
      s.counterSales += 1
      s.counterRevenue += value
      s.sold += value
      addTo(soldByBucket, day, value)
    } else if (inPrevious(day)) {
      store(sale.organization_id).previousSold += value
    }
  }

  for (const order of input.orders) {
    if (!order.created_at || normalizeOrderStatus(order.status) === 'CANCELLED') continue
    const day = localDay(order.created_at)
    const paid = normalizePaymentStatus(order.payment_status) === 'PAID'
    // Un pedido cobrado a medias no facturó su total.
    const value = paid ? amount(order.total) : 0
    if (inPeriod(day)) {
      const s = store(order.organization_id)
      s.onlineOrders += 1
      s.onlineRevenue += value
      s.sold += value
      addTo(soldByBucket, day, value)
    } else if (inPrevious(day)) {
      store(order.organization_id).previousSold += value
    }
  }

  const viewsByPage: Partial<Record<StorefrontPage, number>> = {}
  for (const visit of input.visits ?? []) {
    if (!inPeriod(visit.day)) continue
    const s = store(visit.organization_id)
    s.visitors = (s.visitors ?? 0) + amount(visit.visitors)
    s.views = (s.views ?? 0) + amount(visit.views)
    addTo(visitorsByBucket, visit.day, amount(visit.visitors))
    const page = visit.page as StorefrontPage
    viewsByPage[page] = (viewsByPage[page] ?? 0) + amount(visit.views)
  }

  for (const s of Object.values(byStore)) s.conversion = conversionOf(s.onlineOrders, s.visitors)

  const stores = Object.values(byStore)
  const sum = (pick: (s: StoreCommerce) => number | null) => stores.reduce((total, s) => total + (pick(s) ?? 0), 0)
  const sold = sum((s) => s.sold)
  const previousSold = sum((s) => s.previousSold)
  const counterSales = sum((s) => s.counterSales)
  const onlineOrders = sum((s) => s.onlineOrders)
  const visitors = visitsAvailable ? sum((s) => s.visitors) : null
  const paidOrders = input.orders.filter((order) =>
    order.created_at && inPeriod(localDay(order.created_at)) &&
    normalizeOrderStatus(order.status) !== 'CANCELLED' &&
    normalizePaymentStatus(order.payment_status) === 'PAID').length
  const tickets = counterSales + paidOrders

  const products = new Map<string, { key: string; name: string; organizationId: string; units: number; revenue: number }>()
  for (const item of input.items) {
    if (!item.countable || !item.created_at || !inPeriod(localDay(item.created_at))) continue
    const key = `${item.organization_id}:${item.product_key}`
    const current = products.get(key) ?? { key, name: item.product_name, organizationId: item.organization_id, units: 0, revenue: 0 }
    current.units += amount(item.quantity)
    current.revenue += amount(item.total)
    products.set(key, current)
  }

  return {
    range,
    totals: {
      sold,
      previousSold,
      counterSales,
      counterRevenue: sum((s) => s.counterRevenue),
      onlineOrders,
      onlineRevenue: sum((s) => s.onlineRevenue),
      visitors,
      views: visitsAvailable ? sum((s) => s.views) : null,
      conversion: conversionOf(onlineOrders, visitors),
      deltaPercent: previousSold > 0 ? Math.round(((sold - previousSold) / previousSold) * 100) : null,
      averageTicket: tickets > 0 ? Math.round(sold / tickets) : null,
      storesSelling: stores.filter((s) => s.sold > 0 || s.counterSales > 0 || s.onlineOrders > 0).length,
    },
    byStore,
    series: buckets.map((bucket) => ({
      bucket,
      sold: soldByBucket.get(bucket) ?? 0,
      visitors: visitsAvailable ? visitorsByBucket.get(bucket) ?? 0 : null,
    })),
    granularity,
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units).slice(0, 8),
    viewsByPage,
    visitsAvailable,
  }
}

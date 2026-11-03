import { DEFAULT_TIME_ZONE, startOfDayInTimeZone } from '@/lib/date/timezone'
import { COMPLETED_SALE_STATUSES } from '@/lib/sales-status'

/**
 * Lo que un administrador necesita ver de una sucursal para saber cómo anda:
 * ventas (hoy, 7 días, mes contra mes anterior, ticket promedio, medios de
 * pago y productos que más salen), cajas, stock en alerta, reparaciones y
 * pedidos pendientes.
 *
 * Las ventas anuladas no cuentan: el listado de sucursales las sumaba y el
 * total del mes salía inflado. El agregado es en memoria sobre lecturas
 * paginadas, así una sucursal con más de 1000 ventas no queda cortada.
 */

export const ACTIVE_REPAIR_STATUSES = ['recibido', 'diagnostico', 'reparacion', 'pausado'] as const
export const OPEN_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type SaleRow = { id: string; total_amount: number | null; payment_method: string | null; created_at: string; status: string | null }
export type SaleItemRow = { sale_id: string; product_id: string | null; quantity: number | null; total_price: number | null; subtotal: number | null }
export type InventoryRow = { product_id: string; stock_quantity: number | null; min_stock: number | null }
export type RegisterRow = { id: string; name: string | null; is_open: boolean | null; balance: number | null; is_active: boolean | null }
export type RepairRow = { status: string | null; delivered_at: string | null; is_deleted: boolean | null }
export type OrderRow = { status: string | null; total: number | null }

export type BranchInsights = {
  generatedAt: string
  timeZone: string
  sales: {
    today: { count: number; total: number }
    last7Days: { count: number; total: number; daily: { date: string; total: number }[] }
    month: { count: number; total: number }
    previousMonth: { total: number }
    /** Variación del mes contra el mismo tramo del mes anterior, en %. null si no hay base. */
    monthChangePct: number | null
    averageTicket: number
    lastSaleAt: string | null
    paymentMix: { method: string; total: number; count: number }[]
    topProducts: { productId: string; name: string; quantity: number; total: number }[]
  }
  cash: { registers: { id: string; name: string; isOpen: boolean; balance: number }[]; openCount: number }
  inventory: {
    trackedProducts: number
    units: number
    lowStock: number
    outOfStock: number
    alerts: { productId: string; name: string; stock: number; minStock: number }[]
  }
  repairs: { active: number; ready: number; deliveredThisMonth: number }
  orders: { open: number; openTotal: number }
}

const num = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function localDateKey(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** Inicio del mes en la zona del comercio (no la del servidor). */
export function monthStartInTimeZone(timeZone: string, now: Date = new Date()) {
  const today = startOfDayInTimeZone(timeZone, now)
  const day = Number(new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(today))
  return startOfDayInTimeZone(timeZone, new Date(today.getTime() - (day - 1) * DAY_MS + 12 * 60 * 60 * 1000))
}

export function insightWindows(timeZone: string, now: Date = new Date()) {
  const today = startOfDayInTimeZone(timeZone, now)
  const monthStart = monthStartInTimeZone(timeZone, now)
  const previousMonthStart = monthStartInTimeZone(timeZone, new Date(monthStart.getTime() - DAY_MS))
  // Mismo tramo del mes anterior: si hoy es día 10, se compara con el 1–10 del mes pasado.
  const elapsed = now.getTime() - monthStart.getTime()
  const previousMonthSameSpanEnd = new Date(Math.min(previousMonthStart.getTime() + elapsed, monthStart.getTime()))
  const sevenDaysStart = new Date(today.getTime() - 6 * DAY_MS)
  return { today, monthStart, previousMonthStart, previousMonthSameSpanEnd, sevenDaysStart }
}

const countsAsRevenue = (sale: Pick<SaleRow, 'status'>) =>
  (COMPLETED_SALE_STATUSES as readonly string[]).includes(String(sale.status ?? ''))

export function buildBranchInsights(input: {
  timeZone?: string | null
  now?: Date
  /** Ventas desde el inicio del mes anterior. */
  sales: SaleRow[]
  saleItems: SaleItemRow[]
  productNames: Map<string, string>
  inventory: InventoryRow[]
  registers: RegisterRow[]
  repairs: RepairRow[]
  orders: OrderRow[]
}): BranchInsights {
  const timeZone = input.timeZone?.trim() || DEFAULT_TIME_ZONE
  const now = input.now ?? new Date()
  const windows = insightWindows(timeZone, now)
  const at = (iso: string) => new Date(iso).getTime()

  const valid = input.sales.filter(countsAsRevenue)
  const month = valid.filter((sale) => at(sale.created_at) >= windows.monthStart.getTime())
  const previous = valid.filter((sale) => at(sale.created_at) >= windows.previousMonthStart.getTime() && at(sale.created_at) < windows.previousMonthSameSpanEnd.getTime())
  const today = month.filter((sale) => at(sale.created_at) >= windows.today.getTime())
  const week = valid.filter((sale) => at(sale.created_at) >= windows.sevenDaysStart.getTime())
  const sum = (rows: SaleRow[]) => rows.reduce((total, sale) => total + num(sale.total_amount), 0)

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = localDateKey(new Date(windows.sevenDaysStart.getTime() + index * DAY_MS + 12 * 60 * 60 * 1000), timeZone)
    return { date, total: 0 }
  })
  for (const sale of week) {
    const slot = daily.find((entry) => entry.date === localDateKey(sale.created_at, timeZone))
    if (slot) slot.total += num(sale.total_amount)
  }

  const mix = new Map<string, { total: number; count: number }>()
  for (const sale of month) {
    const key = sale.payment_method || 'otro'
    const entry = mix.get(key) ?? { total: 0, count: 0 }
    entry.total += num(sale.total_amount)
    entry.count += 1
    mix.set(key, entry)
  }

  const monthIds = new Set(month.map((sale) => sale.id))
  const products = new Map<string, { quantity: number; total: number }>()
  for (const item of input.saleItems) {
    if (!item.product_id || !monthIds.has(item.sale_id)) continue
    const entry = products.get(item.product_id) ?? { quantity: 0, total: 0 }
    entry.quantity += num(item.quantity)
    entry.total += num(item.total_price ?? item.subtotal)
    products.set(item.product_id, entry)
  }

  const monthTotal = sum(month)
  const previousTotal = sum(previous)
  const lastSale = valid.reduce<string | null>((latest, sale) => (!latest || at(sale.created_at) > at(latest) ? sale.created_at : latest), null)

  const alerts: BranchInsights['inventory']['alerts'] = []
  let units = 0
  let lowStock = 0
  let outOfStock = 0
  for (const row of input.inventory) {
    const stock = num(row.stock_quantity)
    const minStock = num(row.min_stock)
    units += Math.max(0, stock)
    if (stock <= 0) outOfStock += 1
    else if (minStock > 0 && stock <= minStock) lowStock += 1
    if (stock <= 0 || (minStock > 0 && stock <= minStock)) {
      alerts.push({ productId: row.product_id, name: input.productNames.get(row.product_id) ?? 'Producto', stock, minStock })
    }
  }
  alerts.sort((a, b) => a.stock - b.stock)

  const activeRegisters = input.registers.filter((register) => register.is_active !== false)
  const repairs = input.repairs.filter((repair) => !repair.is_deleted)

  return {
    generatedAt: now.toISOString(),
    timeZone,
    sales: {
      today: { count: today.length, total: sum(today) },
      last7Days: { count: week.length, total: sum(week), daily },
      month: { count: month.length, total: monthTotal },
      previousMonth: { total: previousTotal },
      monthChangePct: previousTotal > 0 ? Math.round(((monthTotal - previousTotal) / previousTotal) * 1000) / 10 : null,
      averageTicket: month.length ? Math.round(monthTotal / month.length) : 0,
      lastSaleAt: lastSale,
      paymentMix: [...mix.entries()].map(([method, value]) => ({ method, ...value })).sort((a, b) => b.total - a.total),
      topProducts: [...products.entries()]
        .map(([productId, value]) => ({ productId, name: input.productNames.get(productId) ?? 'Producto', ...value }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    },
    cash: {
      registers: activeRegisters.map((register) => ({ id: register.id, name: register.name || 'Caja', isOpen: register.is_open === true, balance: num(register.balance) })),
      openCount: activeRegisters.filter((register) => register.is_open === true).length,
    },
    inventory: { trackedProducts: input.inventory.length, units, lowStock, outOfStock, alerts: alerts.slice(0, 8) },
    repairs: {
      active: repairs.filter((repair) => (ACTIVE_REPAIR_STATUSES as readonly string[]).includes(String(repair.status))).length,
      ready: repairs.filter((repair) => repair.status === 'listo').length,
      deliveredThisMonth: repairs.filter((repair) => repair.delivered_at && at(repair.delivered_at) >= windows.monthStart.getTime()).length,
    },
    orders: {
      open: input.orders.filter((order) => (OPEN_ORDER_STATUSES as readonly string[]).includes(String(order.status ?? '').toUpperCase())).length,
      openTotal: input.orders
        .filter((order) => (OPEN_ORDER_STATUSES as readonly string[]).includes(String(order.status ?? '').toUpperCase()))
        .reduce((total, order) => total + num(order.total), 0),
    },
  }
}

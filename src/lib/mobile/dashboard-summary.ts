import type { DashboardHomeSummary } from '@/lib/dashboard/home-summary'
import { isCancelledSaleStatus, isCompletedSaleStatus, isPendingSaleStatus } from '@/lib/sales-status'

export type MobileDashboardActivity = {
  id: string
  type: 'sale' | 'repair' | 'customer'
  description: string
  amount?: number
  createdAt: string
}

type SaleActivityRow = { id: string; status: string | null; total_amount: number | null; created_at: string }
type RepairActivityRow = { id: string; status: string | null; created_at: string }
type CustomerActivityRow = { id: string; created_at: string }

export function buildMobileDashboardSummary(home: DashboardHomeSummary, visibleSections: ReadonlySet<string>) {
  const canSeeSales = visibleSections.has('pos')
  const canSeeOrders = visibleSections.has('orders')
  const canSeeCustomers = visibleSections.has('customers')
  const canSeeProducts = visibleSections.has('products')
  const canSeeRepairs = visibleSections.has('repairs')

  return {
    timeZone: home.timeZone,
    today: home.today,
    generatedAt: home.generatedAt,
    salesToday: canSeeSales
      ? { count: home.sales.todayCount, amount: home.sales.todayAmount, trend: home.sales.daily }
      : { count: 0, amount: 0, trend: home.sales.daily.map(() => 0) },
    activeOrders: canSeeOrders ? home.orders.activeCount : 0,
    customersNew: { count: canSeeCustomers ? home.customers.newCount : 0 },
    catalog: canSeeProducts
      ? { total: home.catalog.physicalCount + home.catalog.servicesCount, lowStock: home.catalog.lowStockCount }
      : { total: 0, lowStock: 0 },
    repairs: canSeeRepairs
      ? { active: home.repairs.activeCount, ready: { count: home.repairs.readyCount } }
      : { active: 0, ready: { count: 0 } },
  }
}

export function mergeDashboardActivity(input: {
  sales: SaleActivityRow[]
  repairs: RepairActivityRow[]
  customers: CustomerActivityRow[]
}): MobileDashboardActivity[] {
  const sales = input.sales.map((sale) => {
    const completed = isCompletedSaleStatus(sale.status)
    const description = completed
      ? 'Venta cobrada'
      : isCancelledSaleStatus(sale.status)
        ? 'Venta anulada'
        : isPendingSaleStatus(sale.status)
          ? 'Venta pendiente'
          : 'Venta actualizada'

    return {
      id: `sale:${sale.id}`,
      type: 'sale' as const,
      description,
      ...(completed ? { amount: Number(sale.total_amount ?? 0) } : {}),
      createdAt: sale.created_at,
    }
  })

  const repairs = input.repairs.map((repair) => ({
    id: `repair:${repair.id}`,
    type: 'repair' as const,
    description: repair.status === 'listo' ? 'Reparación lista' : repair.status === 'entregado' ? 'Reparación entregada' : 'Reparación actualizada',
    createdAt: repair.created_at,
  }))

  const customers = input.customers.map((customer) => ({
    id: `customer:${customer.id}`,
    type: 'customer' as const,
    description: 'Nuevo cliente',
    createdAt: customer.created_at,
  }))

  return [...sales, ...repairs, ...customers]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 10)
}

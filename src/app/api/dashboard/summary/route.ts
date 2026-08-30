import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveBranchScopeForUser } from '@/lib/branches/server'
import { ACTIVE_REPAIR_STATUSES } from '@/lib/constants/repair-status'
import { isCompletedSaleStatus } from '@/lib/sales-status'

type SaleRow = { id: string; total_amount: number | null; status: string; created_at: string }
type CustomerRow = { id: string; first_name: string | null; last_name: string | null; created_at: string }
type ProductRow = { id: string; stock_quantity: number | null; min_stock: number | null; unit_measure: string | null; category_id: string | null }
type CategoryRow = { id: string; name: string }
type RepairRow = { id: string; device_brand: string | null; device_model: string | null; status: string; created_at: string; delivered_at: string | null; final_cost: number | null; estimated_cost: number | null; paid_amount: number | null }

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export async function GET(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization) {
    return NextResponse.json({ error: 'Organización activa no disponible' }, { status: 403 })
  }

  const requestedBranch = request.nextUrl.searchParams.get('branch')
  let branchId: string | null = null
  if (requestedBranch && requestedBranch !== 'all') {
    try {
      const scope = await resolveBranchScopeForUser({
        userId: auth.user.id,
        role: auth.role,
        requestedBranchId: requestedBranch,
        organizationId: organization.id,
        strict: true,
      })
      branchId = scope.branchId
    } catch {
      return NextResponse.json({ error: 'Sucursal no autorizada' }, { status: 403 })
    }
  }

  const now = new Date()
  const dayStart = startOfLocalDay(now)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const weekStart = new Date(dayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  const recentHours = Math.min(72, Math.max(1, Number(request.nextUrl.searchParams.get('recentHours')) || 72))
  const recentSince = new Date(now.getTime() - recentHours * 60 * 60 * 1000)
  const admin = createAdminSupabase()

  let salesQuery = admin
    .from('sales')
    .select('id,total_amount,status,created_at')
    .eq('organization_id', organization.id)
    .gte('created_at', weekStart.toISOString())
  let ordersQuery = admin
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organization.id)
    .in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'])
  const customersQuery = admin
    .from('customers')
    .select('id,first_name,last_name,created_at')
    .eq('organization_id', organization.id)
    .gte('created_at', weekStart.toISOString())
  const productsQuery = admin
    .from('products')
    .select('id,stock_quantity,min_stock,unit_measure,category_id')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
  const categoriesQuery = admin
    .from('categories')
    .select('id,name')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
  let repairsQuery = admin
    .from('repairs')
    .select('id,device_brand,device_model,status,created_at,delivered_at,final_cost,estimated_cost,paid_amount')
    .eq('organization_id', organization.id)

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
    ordersQuery = ordersQuery.eq('branch_id', branchId)
    repairsQuery = repairsQuery.eq('branch_id', branchId)
  }

  const [salesResult, ordersResult, customersResult, productsResult, categoriesResult, repairsResult] = await Promise.all([
    salesQuery,
    ordersQuery,
    customersQuery,
    productsQuery,
    categoriesQuery,
    repairsQuery,
  ])

  const firstError = [salesResult, ordersResult, customersResult, productsResult, categoriesResult, repairsResult]
    .find((result) => result.error)?.error
  if (firstError) {
    console.error('[dashboard-summary] tenant query failed:', firstError.message)
    return NextResponse.json({ error: 'No se pudo cargar el resumen', retryable: true }, { status: 503 })
  }

  const sales = (salesResult.data ?? []) as SaleRow[]
  const customers = (customersResult.data ?? []) as CustomerRow[]
  const products = (productsResult.data ?? []) as ProductRow[]
  const categories = (categoriesResult.data ?? []) as CategoryRow[]
  const repairs = (repairsResult.data ?? []) as RepairRow[]
  const serviceCategoryIds = new Set(categories.filter((item) => item.name.toLowerCase().includes('servicio')).map((item) => item.id))
  const services = products.filter((item) => item.unit_measure?.toLowerCase() === 'servicio' || Boolean(item.category_id && serviceCategoryIds.has(item.category_id)))
  const physicalProducts = products.filter((item) => !services.includes(item))
  const todaySales = sales.filter((item) => new Date(item.created_at) >= dayStart && new Date(item.created_at) < dayEnd && isCompletedSaleStatus(item.status))
  const dayStarts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + index)
    return date
  })
  const trendFor = <T extends { created_at: string }>(rows: T[], value: (row: T) => number) => dayStarts.map((start) => {
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return rows.filter((row) => new Date(row.created_at) >= start && new Date(row.created_at) < end).reduce((sum, row) => sum + value(row), 0)
  })
  const repairAmount = (repair: RepairRow) => Number(repair.final_cost ?? repair.estimated_cost ?? repair.paid_amount ?? 0) || 0
  const repairsToday = repairs.filter((item) => new Date(item.created_at) >= dayStart && new Date(item.created_at) < dayEnd)
  const repairsDelivered = repairs.filter((item) => item.delivered_at && new Date(item.delivered_at) >= dayStart && new Date(item.delivered_at) < dayEnd)
  const repairsReady = repairs.filter((item) => item.status === 'listo')

  const activity = [
    ...sales.filter((item) => new Date(item.created_at) >= recentSince).map((item) => ({ id: `sale:${item.id}`, type: 'sale', description: 'Venta', amount: Number(item.total_amount ?? 0), status: isCompletedSaleStatus(item.status) ? 'completed' : 'updated', createdAt: item.created_at })),
    ...repairs.filter((item) => new Date(item.created_at) >= recentSince).map((item) => ({ id: `repair:${item.id}`, type: 'repair', description: `Reparación${[item.device_brand, item.device_model].filter(Boolean).length ? ` - ${[item.device_brand, item.device_model].filter(Boolean).join(' ')}` : ''}`, amount: repairAmount(item), status: item.status === 'listo' || item.status === 'entregado' ? 'completed' : 'in_progress', createdAt: item.created_at })),
    ...customers.filter((item) => new Date(item.created_at) >= recentSince).map((item) => ({ id: `customer:${item.id}`, type: 'customer', description: `Nuevo cliente${[item.first_name, item.last_name].filter(Boolean).length ? ` - ${[item.first_name, item.last_name].filter(Boolean).join(' ')}` : ''}`, status: 'new', createdAt: item.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)

  return NextResponse.json({
    organization: { id: organization.id, slug: organization.slug },
    branchId,
    salesToday: { count: todaySales.length, amount: todaySales.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0), trend: trendFor(sales.filter((item) => isCompletedSaleStatus(item.status)), (item) => Number(item.total_amount ?? 0)) },
    activeOrders: ordersResult.count ?? 0,
    customersNew: { count: customers.length, trend: trendFor(customers, () => 1) },
    catalog: { total: products.length, products: physicalProducts.length, services: services.length, lowStock: physicalProducts.filter((item) => Number(item.stock_quantity ?? 0) <= Number(item.min_stock ?? 5)).length },
    repairs: {
      active: repairs.filter((item) => ACTIVE_REPAIR_STATUSES.includes(item.status as never)).length,
      today: { count: repairsToday.length, amount: repairsToday.reduce((sum, item) => sum + repairAmount(item), 0) },
      delivered: { count: repairsDelivered.length, amount: repairsDelivered.reduce((sum, item) => sum + repairAmount(item), 0) },
      ready: { count: repairsReady.length, amount: repairsReady.reduce((sum, item) => sum + repairAmount(item), 0) },
    },
    recentActivity: activity,
  })
}

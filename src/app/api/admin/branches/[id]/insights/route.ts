import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import {
  ACTIVE_REPAIR_STATUSES,
  buildBranchInsights,
  insightWindows,
  OPEN_ORDER_STATUSES,
  type InventoryRow,
  type OrderRow,
  type RegisterRow,
  type RepairRow,
  type SaleItemRow,
  type SaleRow,
} from '@/lib/admin/branch-insights'
import { DEFAULT_TIME_ZONE } from '@/lib/date/timezone'

const PAGE = 1000
/** Tope de filas por consulta: una sucursal con más ventas que esto en dos meses ya necesita un agregado en base. */
const MAX_ROWS = 20000
const ID_CHUNK = 200

type Page<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>

/** Lee de a 1000 (el tope de PostgREST) hasta terminar: el listado de sucursales se cortaba ahí. */
async function readAll<T>(load: (from: number, to: number) => Page<T>) {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1)
    if (error) throw new Error(error.message || 'consulta fallida')
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return rows
}

async function inChunks<T>(ids: string[], load: (chunk: string[]) => Promise<T[]>) {
  const out: T[] = []
  for (let index = 0; index < ids.length; index += ID_CHUNK) out.push(...(await load(ids.slice(index, index + ID_CHUNK))))
  return out
}

async function handler(_request: NextRequest, ctx: AdminAuthContext & { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Sucursal inválida.' }, { status: 400 })

  const db = createAdminSupabase()
  let branchQuery = db.from('branches').select('id, organization_id').eq('id', id)
  if (ctx.organizationId) branchQuery = branchQuery.eq('organization_id', ctx.organizationId)
  const { data: branch, error: branchError } = await branchQuery.maybeSingle()
  if (branchError) return NextResponse.json({ error: 'No se pudo cargar la sucursal.' }, { status: 500 })
  if (!branch?.organization_id) return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })

  try {
    const { data: settings } = await db
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', branch.organization_id)
      .maybeSingle()
    const timeZone = (settings?.timezone as string | null) || DEFAULT_TIME_ZONE
    const windows = insightWindows(timeZone)

    const [sales, inventory, registers, repairs, orders] = await Promise.all([
      readAll<SaleRow>((from, to) => db
        .from('sales')
        .select('id, total_amount, payment_method, created_at, status')
        .eq('branch_id', id)
        .gte('created_at', windows.previousMonthStart.toISOString())
        .order('created_at', { ascending: true })
        .range(from, to)),
      readAll<InventoryRow>((from, to) => db
        .from('branch_inventory')
        .select('product_id, stock_quantity, min_stock')
        .eq('branch_id', id)
        .range(from, to)),
      readAll<RegisterRow>((from, to) => db
        .from('cash_registers')
        .select('id, name, is_open, balance, is_active')
        .eq('branch_id', id)
        .order('name', { ascending: true })
        .range(from, to)),
      readAll<RepairRow>((from, to) => db
        .from('repairs')
        .select('status, delivered_at, is_deleted')
        .eq('branch_id', id)
        .or(`status.in.(${[...ACTIVE_REPAIR_STATUSES, 'listo'].join(',')}),delivered_at.gte.${windows.monthStart.toISOString()}`)
        .range(from, to)),
      readAll<OrderRow>((from, to) => db
        .from('customer_orders')
        .select('status, total')
        .eq('branch_id', id)
        .in('status', [...OPEN_ORDER_STATUSES])
        .range(from, to)),
    ])

    const monthSaleIds = sales.filter((sale) => new Date(sale.created_at) >= windows.monthStart).map((sale) => sale.id)
    const saleItems = await inChunks(monthSaleIds, async (chunk) => {
      const { data, error } = await db.from('sale_items').select('sale_id, product_id, quantity, total_price, subtotal').in('sale_id', chunk)
      if (error) throw new Error(error.message)
      return (data ?? []) as SaleItemRow[]
    })

    const productIds = [...new Set([
      ...saleItems.map((item) => item.product_id),
      ...inventory.filter((row) => Number(row.stock_quantity) <= 0 || (Number(row.min_stock) > 0 && Number(row.stock_quantity) <= Number(row.min_stock))).map((row) => row.product_id),
    ].filter((value): value is string => Boolean(value)))]
    const products = await inChunks(productIds, async (chunk) => {
      const { data } = await db.from('products').select('id, name').in('id', chunk)
      return (data ?? []) as Array<{ id: string; name: string | null }>
    })

    const insights = buildBranchInsights({
      timeZone,
      sales,
      saleItems,
      productNames: new Map(products.map((product) => [product.id, product.name || 'Producto'])),
      inventory,
      registers,
      repairs,
      orders,
    })
    return NextResponse.json({ insights })
  } catch (error) {
    logger.error('[branches/insights] No se pudo armar el detalle', { branchId: id, error })
    return NextResponse.json({ error: 'No se pudo cargar el detalle de la sucursal.' }, { status: 500 })
  }
}

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAdminAuth((req, authCtx) => handler(req, { ...authCtx, params: context.params }))(request)
}

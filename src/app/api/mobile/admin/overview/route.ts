import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import { logger } from '@/lib/logger'

/** Medianoche de hoy y día 1 del mes en Paraguay (UTC−3), como instantes ISO. */
function businessBoundaries(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
  return {
    today: new Date(`${local}T00:00:00-03:00`).toISOString(),
    month: new Date(`${local.slice(0, 8)}01T00:00:00-03:00`).toISOString(),
  }
}

const SESSION_STATUS: Record<string, 'open' | 'suspended' | 'blocked'> = {
  suspended: 'suspended',
  suspendida: 'suspended',
  blocked: 'blocked',
  bloqueada: 'blocked',
}

/**
 * Resumen de Administración para la app móvil (lo que /admin calcula en el
 * navegador): ventas del día y del mes, cajas abiertas de todas las
 * sucursales con su estado, stock bajo, equipo y pendientes de atención.
 */
export const GET = withAdminAuth(async (_request, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'Elegí una organización para ver su administración.' }, { status: 400 })
  }
  try {
    const admin = createAdminSupabase()
    const { today, month } = businessBoundaries()

    const [sales, sessions, registers, branches, products, members, reviews, cases] = await Promise.all([
      admin.from('sales').select('total_amount, status, created_at').eq('organization_id', organizationId).gte('created_at', month).limit(20000),
      admin
        .from('cash_closures')
        .select('id, register_id, branch_id, opening_balance, created_at, last_activity_at, status, opened_by')
        .eq('organization_id', organizationId)
        .is('date', null)
        .order('created_at', { ascending: false })
        .limit(50),
      admin.from('cash_registers').select('id, name').eq('organization_id', organizationId),
      admin.from('branches').select('id, name').eq('organization_id', organizationId),
      admin.from('products').select('id, name, stock_quantity, min_stock').eq('organization_id', organizationId).eq('is_active', true).limit(5000),
      admin.from('organization_members').select('user_id, role, status').eq('organization_id', organizationId),
      admin.from('organization_reviews').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('moderation_status', 'pending'),
      admin.from('after_sales_cases').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('status', ['open', 'abierto', 'pending']),
    ])
    if (sales.error) throw sales.error
    if (sessions.error) throw sessions.error

    const done = (sales.data ?? []).filter((sale) => isCompletedSaleStatus(sale.status))
    const sum = (rows: typeof done) => rows.reduce((total, sale) => total + (Number(sale.total_amount) || 0), 0)
    const todayRows = done.filter((sale) => String(sale.created_at) >= today)

    const registerNames = new Map((registers.data ?? []).map((row) => [String(row.id), String(row.name)]))
    const branchNames = new Map((branches.data ?? []).map((row) => [String(row.id), String(row.name)]))

    // Cajas abiertas: lo vendido en el turno sale de sus movimientos de venta.
    const sessionIds = (sessions.data ?? []).map((row) => String(row.id))
    const salesBySession = new Map<string, { total: number; count: number }>()
    if (sessionIds.length) {
      const { data: movements } = await admin
        .from('cash_movements')
        .select('session_id, type, amount')
        .eq('organization_id', organizationId)
        .in('session_id', sessionIds)
        .in('type', ['sale', 'venta'])
        .limit(20000)
      for (const row of movements ?? []) {
        const entry = salesBySession.get(String(row.session_id)) ?? { total: 0, count: 0 }
        entry.total += Number(row.amount) || 0
        entry.count += 1
        salesBySession.set(String(row.session_id), entry)
      }
    }

    const lowStock = (products.data ?? [])
      .filter((product) => Number(product.stock_quantity ?? 0) <= Math.max(0, Number(product.min_stock ?? 0)))
      .sort((a, b) => Number(a.stock_quantity ?? 0) - Number(b.stock_quantity ?? 0))

    const team = (members.data ?? []).filter((member) => member.role !== 'customer')

    return NextResponse.json({
      success: true,
      data: {
        sales: {
          todayTotal: sum(todayRows),
          todayCount: todayRows.length,
          monthTotal: sum(done),
          monthCount: done.length,
        },
        cash: (sessions.data ?? []).map((row) => ({
          id: row.id,
          registerName: registerNames.get(String(row.register_id)) ?? 'Caja principal',
          branchName: branchNames.get(String(row.branch_id)) ?? 'Sucursal',
          openingBalance: Number(row.opening_balance) || 0,
          openedAt: row.created_at,
          lastActivityAt: row.last_activity_at ?? null,
          status: SESSION_STATUS[String(row.status)] ?? 'open',
          salesTotal: salesBySession.get(String(row.id))?.total ?? 0,
          salesCount: salesBySession.get(String(row.id))?.count ?? 0,
        })),
        lowStock: {
          count: lowStock.length,
          outOfStock: lowStock.filter((product) => Number(product.stock_quantity ?? 0) <= 0).length,
          items: lowStock.slice(0, 8).map((product) => ({ id: product.id, name: product.name, stock: Number(product.stock_quantity ?? 0), min: Number(product.min_stock ?? 0) })),
        },
        team: {
          active: team.filter((member) => member.status === 'active').length,
          total: team.length,
        },
        pending: {
          reviews: reviews.count ?? 0,
          afterSales: cases.count ?? 0,
        },
        branches: (branches.data ?? []).length,
      },
    })
  } catch (error) {
    logger.error('[mobile-admin-overview] No se pudo armar el resumen', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar el resumen de administración.' }, { status: 500 })
  }
})

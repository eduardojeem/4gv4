import { completeDashboardQuery } from '@/lib/dashboard/complete-query'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'
import { logger } from '@/lib/logger'
import { config } from '@/lib/config'
import { calculateExpectedCashBalance } from '@/app/dashboard/pos/lib/cash-balance'
import { normalizeCashMovementType } from '@/app/dashboard/pos/types'

/**
 * Estado del POS para la app móvil, en un solo pedido: la sucursal en la que
 * vende el usuario (la misma regla que usa /api/pos/process-sale), sus cajas y
 * la sesión de caja abierta. La web arma esto con varias consultas desde el
 * navegador; la app lo pide acá para que la venta caiga siempre en la misma
 * caja y sucursal.
 */
export const GET = withTenantAuth({ permission: 'pos.sales.create', module: 'pos' }, async (request, { organization, user }) => {
  try {
    const scope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
      requestedBranchId: getRequestedBranchId(request),
      organizationId: organization.id,
      strict: false,
    })
    if (!scope.branchId) {
      return NextResponse.json({ success: false, error: 'No tenés una sucursal asignada para vender.' }, { status: 403 })
    }

    const admin = createAdminSupabase()
    const [registersResult, sessionResult] = await Promise.all([
      admin.from('cash_registers').select('id, name, is_active').eq('organization_id', organization.id).eq('branch_id', scope.branchId).order('name'),
      admin
        .from('cash_closures')
        .select('id, register_id, opening_balance, created_at, opened_by, status')
        .eq('organization_id', organization.id)
        .eq('branch_id', scope.branchId)
        .is('date', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (registersResult.error) throw registersResult.error
    if (sessionResult.error) throw sessionResult.error

    const registers = (registersResult.data ?? []).filter((register) => register.is_active !== false)
    const session = sessionResult.data

    // Resumen del turno con la misma cuenta que la web (cash-balance.ts): lo que
    // tiene que haber en el cajón al cerrar.
    let summary = null
    if (session) {
      const { data: movements, error: movementsError } = await completeDashboardQuery(admin
        .from('cash_movements')
        .select('id, type, amount, payment_method, reason, note, created_at, sale_id', { count: 'exact' })
        .eq('organization_id', organization.id)
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        )
      if (movementsError) throw movementsError
      const rows = (movements ?? []).map((row) => ({ ...row, amount: Number(row.amount || 0) }))
      const sales = rows.filter((row) => normalizeCashMovementType(row.type) === 'sale')
      const byMethod = (method: string) =>
        sales
          .filter((row) => (row.payment_method || 'cash') === method || (method === 'cash' && row.payment_method === 'efectivo'))
          .reduce((sum, row) => sum + row.amount, 0)
      const manual = (type: 'cash_in' | 'cash_out') =>
        rows.filter((row) => normalizeCashMovementType(row.type) === type).reduce((sum, row) => sum + row.amount, 0)
      const hasOpening = rows.some((row) => normalizeCashMovementType(row.type) === 'opening')
      summary = {
        expectedCash: calculateExpectedCashBalance(rows) + (hasOpening ? 0 : Number(session.opening_balance ?? 0)),
        salesCount: new Set(sales.map((row) => row.sale_id ?? row.id)).size,
        salesTotal: sales.reduce((sum, row) => sum + row.amount, 0),
        cash: byMethod('cash'),
        card: byMethod('card'),
        transfer: byMethod('transfer'),
        cashIn: manual('cash_in'),
        cashOut: manual('cash_out'),
        movements: rows.slice(0, 30).map((row) => ({
          id: row.id,
          type: normalizeCashMovementType(row.type),
          amount: row.amount,
          method: row.payment_method,
          reason: row.reason || row.note || null,
          at: row.created_at,
        })),
      }
    }
    const role = organization.role as OrganizationRole
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

    // Misma tasa que usa process-sale: con precios sin IVA, el total lo suma, y la
    // app tiene que cobrar exactamente ese total (la venta rechaza diferencias).
    const [{ data: globalSettings }, { data: organizationSettings }] = await Promise.all([
      admin.from('system_settings').select('tax_rate').eq('id', 'system').maybeSingle(),
      admin.from('organization_settings').select('modules').eq('organization_id', organization.id).maybeSingle(),
    ])
    const modules = organizationSettings?.modules as Record<string, unknown> | null
    const adminSettings = modules && typeof modules === 'object' ? (modules.admin_settings as Record<string, unknown> | undefined) : undefined
    const tenantRate = Number(adminSettings?.taxRate ?? adminSettings?.tax_rate)
    const globalRate = Number(globalSettings?.tax_rate)
    const taxRate = Math.min(100, Math.max(0, Number.isFinite(tenantRate) ? tenantRate : Number.isFinite(globalRate) ? globalRate : config.taxRate * 100))

    return NextResponse.json({
      success: true,
      data: {
        branch: { id: scope.branchId, name: (scope.branch as { name?: string } | null)?.name ?? 'Sucursal' },
        registers: registers.map((register) => ({ id: register.id, name: register.name })),
        session: session
          ? {
              id: session.id,
              registerId: session.register_id,
              registerName: registers.find((register) => register.id === session.register_id)?.name ?? 'Caja principal',
              openingBalance: Number(session.opening_balance ?? 0),
              openedAt: session.created_at,
              suspended: session.status === 'suspended',
            }
          : null,
        summary,
        pricing: { taxRate, pricesIncludeTax: config.pricesIncludeTax },
        // Encabezado del ticket, los mismos datos que imprime el POS web.
        business: {
          name: text(adminSettings?.companyName) || organization.name || config.company.name,
          ruc: text(adminSettings?.companyRuc),
          phone: text(adminSettings?.companyPhone),
          address: [text(adminSettings?.companyAddress), text(adminSettings?.city)].filter(Boolean).join(', '),
          email: text(adminSettings?.companyEmail),
        },
        permissions: {
          sell: roleHasPermission(role, 'pos.sales.create'),
          manageCash: roleHasPermission(role, 'pos.cash.manage'),
        },
      },
    })
  } catch (error) {
    logger.error('[mobile-pos-session] No se pudo leer el estado de la caja', error)
    return NextResponse.json({ success: false, error: 'No se pudo leer el estado de la caja.' }, { status: 500 })
  }
})

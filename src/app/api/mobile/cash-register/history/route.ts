import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { summarizeCashMovements, type CashMovementRow } from '@/lib/cash/movement-totals'

/**
 * Cierres de caja de la sucursal para la app móvil (el historial de
 * /dashboard/pos/caja). La web los lee directo desde el navegador; la app los
 * pide acá, acotados a la organización y a la sucursal del usuario.
 */
export const GET = withTenantAuth({ permission: 'pos.cash.manage', module: 'pos' }, async (request, { organization, user }) => {
  try {
    const scope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
      requestedBranchId: getRequestedBranchId(request),
      organizationId: organization.id,
      strict: false,
    })
    if (!scope.branchId) {
      return NextResponse.json({ success: false, error: 'No tenés una sucursal asignada.' }, { status: 403 })
    }

    const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 40)))
    const admin = createAdminSupabase()
    const [closures, registers] = await Promise.all([
      admin
        .from('cash_closures')
        .select('id, register_id, date, created_at, opening_balance, closing_balance, expected_balance, discrepancy, income_total, expense_total, sales_total_cash, sales_total_card, sales_total_transfer, sales_total_mixed, movements_count, notes, status')
        .eq('organization_id', organization.id)
        .eq('branch_id', scope.branchId)
        .not('date', 'is', null)
        .order('date', { ascending: false })
        .limit(limit),
      admin.from('cash_registers').select('id, name').eq('organization_id', organization.id).eq('branch_id', scope.branchId),
    ])
    if (closures.error) throw closures.error
    if (registers.error) throw registers.error

    const names = new Map((registers.data ?? []).map((register) => [String(register.id), String(register.name)]))
    const money = (value: unknown) => Number(value) || 0

    // Las columnas de totales del cierre tienen DEFAULT 0 y nadie las escribe:
    // el historial mostraba «Ventas 0» en todos los cierres. Se suman los
    // movimientos de cada turno.
    const closureIds = (closures.data ?? []).map((row) => String(row.id))
    const movementsBySession = new Map<string, CashMovementRow[]>()
    for (let offset = 0; offset < closureIds.length; offset += 50) {
      const ids = closureIds.slice(offset, offset + 50)
      for (let from = 0; ; from += 1000) {
        const page = await admin
          .from('cash_movements')
          .select('id, session_id, type, amount, payment_method, sale_id')
          .eq('organization_id', organization.id)
          .in('session_id', ids)
          .order('id')
          .range(from, from + 999)
        if (page.error) throw page.error
        for (const movement of page.data ?? []) {
          const key = String(movement.session_id)
          movementsBySession.set(key, [...(movementsBySession.get(key) ?? []), movement])
        }
        if ((page.data ?? []).length < 1000) break
      }
    }

    return NextResponse.json({
      success: true,
      data: (closures.data ?? []).map((row) => {
        const movements = movementsBySession.get(String(row.id)) ?? []
        const totals = summarizeCashMovements(movements)
        const fromMovements = totals.total > 0
        const cash = fromMovements ? totals.salesCash : money(row.sales_total_cash)
        const card = fromMovements ? totals.salesCard : money(row.sales_total_card)
        const transfer = fromMovements ? totals.salesTransfer : money(row.sales_total_transfer)
        const mixed = fromMovements ? totals.salesMixed : money(row.sales_total_mixed)
        return {
          id: row.id,
          registerName: names.get(String(row.register_id)) ?? 'Caja principal',
          openedAt: row.created_at,
          closedAt: row.date,
          openingBalance: money(row.opening_balance),
          countedCash: money(row.closing_balance),
          expectedCash: money(row.expected_balance),
          difference: money(row.discrepancy),
          salesTotal: cash + card + transfer + mixed,
          cash,
          card,
          transfer,
          mixed,
          cashIn: fromMovements ? totals.cashIn : money(row.income_total),
          cashOut: fromMovements ? totals.cashOut : money(row.expense_total),
          movements: fromMovements ? totals.total : Number(row.movements_count) || 0,
          notes: row.notes ?? null,
        }
      }),
    })
  } catch (error) {
    logger.error('[mobile-cash-history] No se pudo leer el historial de cierres', error)
    return NextResponse.json({ success: false, error: 'No se pudo leer el historial de cierres.' }, { status: 500 })
  }
})

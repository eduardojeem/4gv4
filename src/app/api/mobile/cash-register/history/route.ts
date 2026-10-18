import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

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

    return NextResponse.json({
      success: true,
      data: (closures.data ?? []).map((row) => {
        const cash = money(row.sales_total_cash)
        const card = money(row.sales_total_card)
        const transfer = money(row.sales_total_transfer)
        const mixed = money(row.sales_total_mixed)
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
          cashIn: money(row.income_total),
          cashOut: money(row.expense_total),
          movements: Number(row.movements_count) || 0,
          notes: row.notes ?? null,
        }
      }),
    })
  } catch (error) {
    logger.error('[mobile-cash-history] No se pudo leer el historial de cierres', error)
    return NextResponse.json({ success: false, error: 'No se pudo leer el historial de cierres.' }, { status: 500 })
  }
})

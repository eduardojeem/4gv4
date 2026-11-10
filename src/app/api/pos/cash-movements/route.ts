import { NextResponse, type NextRequest } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { resolveOrganizationToday } from '@/lib/finance/server'

type MovementBody = {
  sessionId?: unknown
  type?: unknown
  amount?: unknown
  reason?: unknown
  branchId?: unknown
  /** Si viene, el egreso es un gasto de esa categoría de Finanzas. */
  expenseCategoryId?: unknown
  idempotencyKey?: unknown
}

/**
 * Categorías de gasto para elegir al sacar plata de la caja. Vacío si la
 * organización no tiene Finanzas: el egreso se registra solo en la caja.
 */
export const GET = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (_request: NextRequest, { organization }) => {
    const planInfo = await getOrganizationPlanInfo(organization.id).catch(() => null)
    if (!planInfo?.modules.includes('finances')) {
      return NextResponse.json({ success: true, data: { financesEnabled: false, categories: [] } })
    }
    const { data, error } = await createAdminSupabase()
      .from('finance_categories')
      .select('id, code, name, category_type')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('name')
    if (error) {
      return NextResponse.json({ success: false, error: 'No se pudieron leer las categorías de gasto.' }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      data: {
        financesEnabled: true,
        categories: (data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name, type: row.category_type })),
      },
    })
  }
)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const POST = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request: NextRequest, { organization, user }) => {
    let body: MovementBody
    try {
      body = await request.json() as MovementBody
    } catch {
      return NextResponse.json({ success: false, error: 'La solicitud no es valida.' }, { status: 400 })
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const type = body.type === 'cash_in' || body.type === 'cash_out' ? body.type : null
    const amount = Number(body.amount)
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    const expenseCategoryId = typeof body.expenseCategoryId === 'string' && UUID_PATTERN.test(body.expenseCategoryId)
      ? body.expenseCategoryId
      : null
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 100) : ''
    if (expenseCategoryId && (type !== 'cash_out' || idempotencyKey.length < 8)) {
      return NextResponse.json({ success: false, error: 'El gasto no es válido.' }, { status: 400 })
    }

    if (!UUID_PATTERN.test(sessionId) || !type) {
      return NextResponse.json({ success: false, error: 'La sesion o el tipo de movimiento no es valido.' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor que cero.' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: 'Indica el motivo del movimiento.' }, { status: 400 })
    }

    try {
      const branch = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
        requestedBranchId: getRequestedBranchId(request, body.branchId),
        organizationId: organization.id,
        strict: true,
      })
      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal.' }, { status: 400 })
      }

      const supabase = createAdminSupabase()

      // Un egreso que es un gasto del negocio: se registra el gasto pagado con
      // la plata de la caja, y el movimiento de caja sale de ese pago. Así
      // Finanzas lo ve (antes la caja cuadraba pero la ganancia salía inflada).
      if (expenseCategoryId) {
        const today = await resolveOrganizationToday(organization.id)
        const { data: expense, error: expenseError } = await supabase.rpc('server_record_cash_expense_atomic', {
          p_actor_user_id: user.id,
          p_organization_id: organization.id,
          p_branch_id: branch.branchId,
          p_session_id: sessionId,
          p_amount: amount,
          p_category_id: expenseCategoryId,
          p_concept: reason,
          p_accounting_date: today,
          p_idempotency_key: idempotencyKey,
        })
        if (expenseError) {
          const message = expenseError.message ?? ''
          if (message.includes('OPEN_CASH_SESSION_NOT_FOUND')) {
            return NextResponse.json({ success: false, error: 'La caja ya no está abierta.' }, { status: 409 })
          }
          if (message.includes('FINANCE_CATEGORY_NOT_FOUND')) {
            return NextResponse.json({ success: false, error: 'La categoría de gasto ya no existe.' }, { status: 422 })
          }
          if (expenseError.code === '42883' || message.includes('server_record_cash_expense_atomic')) {
            return NextResponse.json({ success: false, error: 'Falta aplicar la migración de gastos desde caja.' }, { status: 503 })
          }
          return NextResponse.json({ success: false, error: 'No se pudo registrar el gasto.' }, { status: 400 })
        }
        // El RPC devuelve el movimiento que creó el pago, para la pantalla de caja.
        const movement = (expense as { movement?: unknown } | null)?.movement ?? null
        return NextResponse.json({ success: true, data: movement, expense })
      }

      const { data, error } = await supabase.rpc('server_record_cash_movement_atomic', {
        p_actor_user_id: user.id,
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_session_id: sessionId,
        p_type: type,
        p_amount: amount,
        p_reason: reason,
      })

      if (error) {
        const sessionClosed = error.message.includes('OPEN_CASH_SESSION_NOT_FOUND')
        return NextResponse.json(
          {
            success: false,
            error: sessionClosed ? 'La caja ya no está abierta.' : error.message,
          },
          { status: sessionClosed ? 409 : 400 },
        )
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el movimiento.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)

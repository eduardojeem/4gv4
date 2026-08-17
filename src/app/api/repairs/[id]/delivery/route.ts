import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { parseRepairDeliveryRequest } from '@/lib/repairs/financial-closure'
import {
  closeRepairAndRegisterPayment,
  FinancialClosureRpcError,
} from '@/lib/repairs/financial-closure-rpc'
import { parseUnrepairedCloseoutRequest } from '@/lib/repairs/unrepaired-closeout'
import {
  closeUnrepairedRepair,
  UnrepairedCloseoutRpcError,
} from '@/lib/repairs/unrepaired-closeout-rpc'

type RouteParams = { params: Promise<{ id: string }> }

async function resolveCashSessionId(ctx: Awaited<ReturnType<typeof resolveRepairRouteContext>>) {
  if (isNextResponse(ctx)) return null
  const { data, error } = await ctx.supabase
    .from('cash_closures')
    .select('id, register_id')
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .is('date', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  const sessions = (data ?? []) as Array<{ id: string; register_id?: string | null }>
  return sessions.find((session) => (session.register_id ?? '').toLowerCase() === 'principal')?.id
    ?? sessions[0]?.id
    ?? null
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const body = await request.json().catch(() => ({}))
    const outcome = typeof body === 'object' && body !== null && 'outcome' in body
      ? (body as { outcome?: unknown }).outcome
      : null
    const unrepaired = outcome === 'withdrawn' || outcome === 'unrepairable'
    const { id } = await context.params
    if (unrepaired) {
      const parsed = parseUnrepairedCloseoutRequest(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Revisá el cargo, los repuestos y la forma de resolver el saldo.', code: 'INVALID_DELIVERY_REQUEST' },
          { status: 400 },
        )
      }
      const closeoutRequest = parsed.data
      const needsCashSession = closeoutRequest.settlement.kind === 'payment'
        ? closeoutRequest.settlement.method !== 'transfer'
        : closeoutRequest.settlement.kind === 'refund' && closeoutRequest.settlement.method === 'cash'
      const cashSessionId = needsCashSession ? await resolveCashSessionId(ctx) : null
      if (needsCashSession && !cashSessionId) {
        return NextResponse.json(
          { error: 'No hay una caja abierta en esta sucursal. Abrí caja para continuar.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' },
          { status: 409 },
        )
      }
      const operation = await closeUnrepairedRepair(ctx.supabase, {
        repairId: id,
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        actorId: ctx.userId,
        request: closeoutRequest,
        cashSessionId,
      })
      const { data: repair, error } = await fetchRepairById(ctx, id)
      if (error) throw error
      if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
      return NextResponse.json({
        repair,
        closeout: { id: operation.closeout_id },
        payment: operation.payment_id ? { id: operation.payment_id } : null,
        idempotent: operation.idempotent,
      })
    }
    const parsed = parseRepairDeliveryRequest(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisá el resultado, la confirmación de saldo y los datos de cobro.', code: 'INVALID_DELIVERY_REQUEST' },
        { status: 400 },
      )
    }
    const resolvedInput = parsed.data
    const isCredit = resolvedInput.payment?.method === 'credit'
    if (isCredit && (ctx.role === 'tecnico' || ctx.role === 'technician')) {
      return NextResponse.json(
        { error: 'Permisos insuficientes para registrar una entrega a crédito.', code: 'REPAIR_CREDIT_UNAUTHORIZED' },
        { status: 403 },
      )
    }

    const needsCashSession = Boolean(resolvedInput.payment && !isCredit)
    const cashSessionId = needsCashSession ? await resolveCashSessionId(ctx) : null
    if (needsCashSession && !cashSessionId) {
      return NextResponse.json(
        { error: 'No hay una caja abierta en esta sucursal. Abrí caja antes de cobrar la reparación.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' },
        { status: 409 },
      )
    }

    const operation = await closeRepairAndRegisterPayment(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
      deliver: true,
      outcome: resolvedInput.outcome,
      note: resolvedInput.note,
      allowOutstandingBalance: resolvedInput.allowOutstandingBalance,
      payment: resolvedInput.payment,
      cashSessionId,
      idempotencyKey: resolvedInput.idempotencyKey,
      source: 'delivery',
    })

    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({
      repair,
      payment: operation.payment_id ? { id: operation.payment_id } : null,
      idempotent: operation.idempotent,
    })
  } catch (error) {
    if (error instanceof UnrepairedCloseoutRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof FinancialClosureRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

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

    const parsed = parseRepairDeliveryRequest(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisa el resultado, la confirmacion de saldo y los datos de cobro.', code: 'INVALID_DELIVERY_REQUEST' },
        { status: 400 },
      )
    }

    const { id } = await context.params
    const input = parsed.data
    if (input.payment?.method === 'credit') {
      return NextResponse.json(
        { error: 'El credito debe registrarse desde Cobrar saldo antes de entregar.', code: 'DELIVERY_CREDIT_USE_PAYMENT' },
        { status: 422 },
      )
    }

    const cashSessionId = input.payment ? await resolveCashSessionId(ctx) : null
    if (input.payment && !cashSessionId) {
      return NextResponse.json(
        { error: 'No hay una caja abierta en esta sucursal. Abri caja antes de cobrar la reparacion.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' },
        { status: 409 },
      )
    }

    const operation = await closeRepairAndRegisterPayment(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
      deliver: true,
      outcome: input.outcome,
      note: input.note,
      allowOutstandingBalance: input.allowOutstandingBalance,
      payment: input.payment,
      cashSessionId,
      idempotencyKey: input.idempotencyKey,
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
    if (error instanceof FinancialClosureRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

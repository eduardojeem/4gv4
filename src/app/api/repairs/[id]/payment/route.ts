import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { parseRepairPaymentRequest } from '@/lib/repairs/financial-closure'
import { resolveRepairCollectionPricing } from '@/lib/repairs/collection-pricing'
import {
  closeRepairAndRegisterPayment,
  FinancialClosureRpcError,
} from '@/lib/repairs/financial-closure-rpc'
import { registerUnpricedRepairDeposit } from '@/lib/repairs/unpriced-deposit-rpc'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const parsed = parseRepairPaymentRequest(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisa el metodo, monto y datos del pago.', code: 'INVALID_PAYMENT_REQUEST' },
        { status: 400 },
      )
    }

    const { id } = await context.params
    const input = parsed.data
    const isCredit = input.method === 'credit'
    const isUnpricedDeposit = input.purpose === 'deposit'

    const { data: financialRepair, error: financialRepairError } = await ctx.supabase
      .from('repairs')
      .select('id, pricing_mode, labor_cost, final_cost, estimated_cost, discount_amount, paid_amount, parts:repair_parts(unit_price, unit_cost, quantity)')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (financialRepairError) throw financialRepairError
    if (!financialRepair) {
      return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })
    }

    const { pricing } = resolveRepairCollectionPricing({
      mode: financialRepair.pricing_mode,
      laborCost: financialRepair.labor_cost,
      finalCost: financialRepair.final_cost,
      estimatedCost: financialRepair.estimated_cost,
      discountAmount: financialRepair.discount_amount,
      paidAmount: financialRepair.paid_amount,
      parts: financialRepair.parts?.map((part: { unit_price?: number | null; unit_cost?: number | null; quantity?: number | null }) => ({
        cost: part.unit_price ?? part.unit_cost,
        internalCost: part.unit_cost,
        quantity: part.quantity,
      })) ?? [],
    })
    const currentTotal = pricing.customerTotal
    const currentPaid = pricing.paidAmount
    const currentBalance = pricing.balance
    const priceDefined = financialRepair.final_cost !== null
      || Number(financialRepair.estimated_cost) > 0
      || currentTotal > 0

    if (isUnpricedDeposit && priceDefined) {
      return NextResponse.json({
        error: 'La reparación ya tiene precio. Registrá el importe como pago del saldo.',
        code: 'REPAIR_PRICE_ALREADY_DEFINED',
        currentTotal,
        currentPaid,
        currentBalance,
      }, { status: 422 })
    }

    if (!isUnpricedDeposit && currentBalance <= 0) {
      return NextResponse.json({
        error: 'La reparación ya no tiene saldo pendiente para cobrar.',
        code: 'REPAIR_HAS_NO_BALANCE',
        currentTotal,
        currentPaid,
        currentBalance: 0,
      }, { status: 422 })
    }

    if (!isUnpricedDeposit && input.amount > currentBalance) {
      return NextResponse.json({
        error: `El saldo pendiente cambió. El monto máximo actual es ${currentBalance}.`,
        code: 'REPAIR_PAYMENT_EXCEEDS_BALANCE',
        currentTotal,
        currentPaid,
        currentBalance,
      }, { status: 422 })
    }

    if (isCredit && input.amount !== currentBalance) {
      return NextResponse.json({
        error: `El crédito debe cubrir el saldo pendiente actual de ${currentBalance}.`,
        code: 'REPAIR_CREDIT_MUST_COVER_BALANCE',
        currentTotal,
        currentPaid,
        currentBalance,
      }, { status: 422 })
    }

    if (isCredit && ctx.role === 'tecnico') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para cobrar a credito.' },
        { status: 403 },
      )
    }

    let cashSessionId: string | null = null
    if (!isCredit) {
      const { data, error } = await ctx.supabase
        .from('cash_closures')
        .select('id, register_id')
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .is('date', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      const sessions = (data ?? []) as Array<{ id: string; register_id?: string | null }>
      cashSessionId = sessions.find((session) => (session.register_id ?? '').toLowerCase() === 'principal')?.id
        ?? sessions[0]?.id
        ?? null

      if (!cashSessionId) {
        return NextResponse.json(
          { error: 'No hay una caja abierta en esta sucursal. Abri caja antes de cobrar la reparacion.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' },
          { status: 409 },
        )
      }
    }

    const operation = isUnpricedDeposit
      ? await registerUnpricedRepairDeposit(ctx.supabase, {
          repairId: id,
          organizationId: ctx.organizationId,
          branchId: ctx.branchId,
          actorId: ctx.userId,
          method: input.method as 'cash' | 'card' | 'transfer',
          amount: input.amount,
          reference: input.reference,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
          cashSessionId: cashSessionId!,
        })
      : await closeRepairAndRegisterPayment(ctx.supabase, {
          repairId: id,
          organizationId: ctx.organizationId,
          branchId: ctx.branchId,
          actorId: ctx.userId,
          deliver: false,
          allowOutstandingBalance: false,
          payment: input,
          cashSessionId,
          creditId: null,
          source: 'repairs',
        })

    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const creditId = 'credit_id' in operation ? operation.credit_id : null
    const creditTotal = 'credit_total' in operation ? operation.credit_total : null

    return NextResponse.json({
      repair,
      payment: operation.payment_id ? { id: operation.payment_id } : null,
      credit: creditId ? {
        creditId,
        financedTotal: Number(creditTotal ?? input.amount),
      } : null,
      idempotent: operation.idempotent,
    })
  } catch (error) {
    if (error instanceof FinancialClosureRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[repair-payment] Unexpected payment failure', error)
    return NextResponse.json(
      { error: 'No se pudo registrar el pago de la reparación.' },
      { status: 500 },
    )
  }
}

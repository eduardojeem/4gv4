import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { createCreditAccount, CreditAccountError } from '@/lib/credits/create-credit-account'
import { normalizeCreditFrequency, normalizeInstallmentCount } from '@/lib/credits/installments'
import { parseRepairPaymentRequest } from '@/lib/repairs/financial-closure'
import { calculateRepairPricing } from '@/lib/repairs/pricing'
import {
  closeRepairAndRegisterPayment,
  FinancialClosureRpcError,
} from '@/lib/repairs/financial-closure-rpc'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  let rollbackCredit: (() => Promise<void>) | null = null

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

    const pricing = calculateRepairPricing({
      mode: financialRepair.pricing_mode,
      laborCost: financialRepair.labor_cost,
      finalCost: financialRepair.final_cost ?? financialRepair.estimated_cost,
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

    if (input.amount > currentBalance) {
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

    if (isCredit && (ctx.role === 'tecnico' || ctx.role === 'technician')) {
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

    let creditInfo: { creditId: string; financedTotal: number } | null = null
    if (isCredit) {
      const { data: repair, error: repairError } = await ctx.supabase
        .from('repairs')
        .select('id, ticket_number, customer_id')
        .eq('id', id)
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .maybeSingle()

      if (repairError) throw repairError
      if (!repair?.customer_id) {
        return NextResponse.json(
          { error: 'La reparacion no tiene un cliente asociado para cobrar a credito.' },
          { status: 400 },
        )
      }

      const { data: customer, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id, credit_limit')
        .eq('id', repair.customer_id)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle()

      if (customerError) throw customerError
      const creditLimit = Math.max(0, Number(customer?.credit_limit) || 0)
      if (!customer || creditLimit <= 0) {
        return NextResponse.json(
          { error: 'El cliente no tiene limite de credito habilitado.' },
          { status: 400 },
        )
      }

      const created = await createCreditAccount({
        supabase: ctx.supabase,
        organizationId: ctx.organizationId,
        customerId: repair.customer_id,
        creditLimit,
        amount: input.amount,
        interestRate: input.interestRate ?? 0,
        installmentCount: normalizeInstallmentCount(input.installments?.count),
        frequency: normalizeCreditFrequency(input.installments?.frequency),
        saleId: null,
        label: `Reparacion ${repair.ticket_number || id.slice(0, 8).toUpperCase()}`,
        creditType: 'repair_financing',
        originType: 'repair',
      })
      creditInfo = { creditId: created.creditId, financedTotal: created.financedTotal }
      rollbackCredit = async () => {
        await ctx.supabase.from('credit_installments').delete().eq('credit_id', created.creditId)
        await ctx.supabase.from('customer_credits').delete()
          .eq('id', created.creditId)
          .eq('organization_id', ctx.organizationId)
      }
    }

    const operation = await closeRepairAndRegisterPayment(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
      deliver: false,
      allowOutstandingBalance: false,
      payment: input,
      cashSessionId,
      creditId: creditInfo?.creditId ?? null,
      source: 'repairs',
    })

    rollbackCredit = null
    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({
      repair,
      payment: operation.payment_id ? { id: operation.payment_id } : null,
      credit: creditInfo,
      idempotent: operation.idempotent,
    })
  } catch (error) {
    if (rollbackCredit) await rollbackCredit()
    if (error instanceof FinancialClosureRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof CreditAccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { fetchRepairById, isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { createObligation, FinanceApiError, payObligation, resolveOrganizationToday } from '@/lib/finance/server'
import { RepairCostRpcError, saveRepairCostRevision } from '@/lib/repairs/save-cost-revision'
import { canTransition } from '@/lib/repairs/state-machine'
import {
  costIntentWithPurchase,
  partPurchaseSchema,
  purchaseConcept,
  purchaseExpenseMarker,
  readWaitingPart,
  type WaitingPart,
} from '@/lib/repairs/part-purchase'
import type { RepairStatus } from '@/types/repairs'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }
type RouteContext = Exclude<Awaited<ReturnType<typeof resolveRepairRouteContext>>, NextResponse>

async function openCashSessionId(ctx: RouteContext) {
  const { data, error } = await ctx.supabase
    .from('cash_closures')
    .select('id, register_id')
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .is('date', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  const sessions = (data ?? []) as Array<{ id: string; register_id?: string | null }>
  return sessions.find((session) => (session.register_id ?? '').toLowerCase() === 'principal')?.id ?? sessions[0]?.id ?? null
}

/** Pausa la reparación mientras espera el repuesto, si el estado lo permite, con su historial. */
async function markWaiting(ctx: RouteContext, repair: Record<string, unknown>, waiting: WaitingPart | null) {
  const metadata = (repair.metadata && typeof repair.metadata === 'object' ? repair.metadata : {}) as Record<string, unknown>
  const nextMetadata = { ...metadata }
  if (waiting) nextMetadata.waiting_part = waiting
  else delete nextMetadata.waiting_part

  const current = repair.status as RepairStatus
  // Mismas reglas que el cambio de estado manual (p. ej. «en reparación» pide técnico).
  const rules = { technician_id: (repair.technician_id as string | null) ?? null, quality_check_result: null }
  const target: RepairStatus | null = waiting
    ? (current !== 'pausado' && canTransition(current, 'pausado', rules).allowed ? 'pausado' : null)
    : (current === 'pausado' && canTransition(current, 'reparacion', rules).allowed ? 'reparacion' : null)

  const update: Record<string, unknown> = { metadata: nextMetadata, updated_at: new Date().toISOString() }
  if (target) update.status = target
  const { error } = await ctx.supabase
    .from('repairs')
    .update(update)
    .eq('id', repair.id as string)
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
  if (error) throw error
  if (target) {
    await ctx.supabase.from('repair_status_history').insert({
      repair_id: repair.id,
      organization_id: ctx.organizationId,
      old_status: current,
      new_status: target,
      changed_by: ctx.userId,
      notes: waiting ? `Esperando repuesto: ${waiting.name}` : 'Llegó el repuesto',
    })
  }
}

/**
 * POST /api/repairs/:id/part-purchase — «No lo tengo, lo compro».
 * Agrega el repuesto comprado a la reparación (revisión de costos), registra la
 * compra como gasto en Finanzas (pagado de caja, por transferencia o a pagar
 * al proveedor) y, si todavía no llegó, deja la reparación esperando repuesto.
 * Cada paso tiene su propia clave derivada: reintentar no duplica nada.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    const parsed = partPurchaseSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      const message = parsed.error.issues.find((issue) => issue.path[0] === 'unitPrice')?.message
      return NextResponse.json({ error: message ?? 'Revisá el repuesto, la cantidad y los importes.', code: 'INVALID_PART_PURCHASE' }, { status: 400 })
    }
    const input = parsed.data
    const { id } = await context.params
    const { data: repair, error: repairError } = await fetchRepairById(ctx, id)
    if (repairError) throw repairError
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
    if (repair.status === 'entregado' || repair.status === 'cancelado') {
      return NextResponse.json({ error: 'La reparación ya está cerrada.', code: 'REPAIR_CLOSED' }, { status: 409 })
    }

    // Antes de escribir nada: lo que el gasto necesita para poder registrarse.
    const total = Math.round(input.unitCost * input.quantity * 100) / 100
    const planInfo = await getOrganizationPlanInfo(ctx.organizationId).catch(() => null)
    const financesOn = Boolean(planInfo?.modules.includes('finances')) && total > 0
    const admin = createAdminSupabase()
    const { data: category } = financesOn
      ? await admin.from('finance_categories').select('id').eq('organization_id', ctx.organizationId).eq('code', 'suppliers_purchases').eq('is_active', true).maybeSingle()
      : { data: null }
    const cashSessionId = financesOn && category && input.payment === 'cash' ? await openCashSessionId(ctx) : null
    if (financesOn && category && input.payment === 'cash' && !cashSessionId) {
      return NextResponse.json({ error: 'No hay una caja abierta en esta sucursal. Abrí caja o elegí otra forma de pago.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' }, { status: 409 })
    }
    const today = await resolveOrganizationToday(ctx.organizationId)
    if (input.expectedOn && input.expectedOn < today) {
      return NextResponse.json({ error: 'La fecha de llegada no puede ser anterior a hoy.', code: 'INVALID_PART_PURCHASE' }, { status: 400 })
    }

    // 1. El repuesto entra a la reparación con su costo (misma operación que el editor de costos).
    await saveRepairCostRevision(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
    }, costIntentWithPurchase(repair, input))

    // 2. La compra, como gasto en Finanzas.
    let expense: { recorded: boolean; status?: string; warning?: string } = {
      recorded: false,
      warning: !financesOn
        ? (total > 0 ? 'Finanzas no está activo: la compra no se registró como gasto.' : undefined)
        : !category ? 'Falta la categoría «Proveedores y compras» en Finanzas: la compra no se registró como gasto.' : undefined,
    }
    if (financesOn && category) {
      const marker = purchaseExpenseMarker(input.idempotencyKey)
      const { data: existing } = await admin
        .from('finance_obligations')
        .select('id, amount, paid_amount, status')
        .eq('organization_id', ctx.organizationId)
        .eq('notes', marker)
        .maybeSingle()
      const obligation = (existing ?? await createObligation({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        input: {
          branchId: ctx.branchId,
          categoryId: (category as { id: string }).id,
          amount: total,
          concept: purchaseConcept(input, (repair.ticket_number as string | null) ?? null),
          accountingDate: today,
          dueDate: input.payment === 'owed' && input.expectedOn ? input.expectedOn : undefined,
          vendor: input.supplier ?? undefined,
          notes: marker,
        },
      })) as { id: string; amount: number | string; paid_amount?: number | string | null; status?: string }
      expense = { recorded: true, status: obligation.status }

      if (input.payment !== 'owed' && Number(obligation.paid_amount ?? 0) < Number(obligation.amount)) {
        try {
          await payObligation({
            rpcName: 'pay_finance_obligation_atomic',
            rpcArgs: {
              p_organization_id: ctx.organizationId,
              p_branch_id: ctx.branchId,
              p_obligation_id: obligation.id,
              p_amount: Number(obligation.amount) - Number(obligation.paid_amount ?? 0),
              p_payment_method: input.payment,
              p_payment_date: today,
              p_idempotency_key: `${input.idempotencyKey}:pay`,
              p_cash_session_id: input.payment === 'cash' ? cashSessionId : null,
              p_reference: null,
              p_notes: `Repuesto para la reparación ${repair.ticket_number ?? ''}`.trim(),
            },
          })
          expense = { recorded: true, status: 'paid' }
        } catch (error) {
          // El repuesto y el gasto ya quedaron: el pago se puede registrar después en Finanzas.
          const reason = error instanceof FinanceApiError && error.status === 403
            ? 'no tenés permiso para registrar pagos'
            : 'no se pudo registrar el pago'
          expense = { recorded: true, status: 'pending', warning: `El gasto quedó a pagar: ${reason}. Registralo en Finanzas.` }
          logger.warn('[part-purchase] pago no registrado', { repairId: id, error: error instanceof Error ? error.message : error })
        }
      }
    }

    // 3. Si todavía no llegó, la reparación espera el repuesto.
    if (!input.arrived) {
      await markWaiting(ctx, repair as Record<string, unknown>, {
        name: input.name,
        supplier: input.supplier,
        expected_on: input.expectedOn ?? null,
        ordered_at: new Date().toISOString(),
      })
    }

    const { data: updated } = await fetchRepairById(ctx, id)
    return NextResponse.json({ repair: updated, expense })
  } catch (error) {
    if (error instanceof RepairCostRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof FinanceApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    logger.error('[part-purchase] POST', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'No se pudo registrar la compra del repuesto.' }, { status: 500 })
  }
}

/** DELETE /api/repairs/:id/part-purchase — «Llegó el repuesto»: deja de esperar y vuelve a reparación. */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    const { id } = await context.params
    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
    if (readWaitingPart(repair.metadata)) await markWaiting(ctx, repair as Record<string, unknown>, null)
    const { data: updated } = await fetchRepairById(ctx, id)
    return NextResponse.json({ repair: updated })
  } catch (error) {
    logger.error('[part-purchase] DELETE', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'No se pudo marcar la llegada del repuesto.' }, { status: 500 })
  }
}

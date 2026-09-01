import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchRepairById, isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  newFinalTotal: z.coerce.number().finite().positive().max(999_999_999_999),
  reason: z.string().trim().min(10).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
})

const ERROR_MAP: Record<string, { status: number; message: string; code: string }> = {
  REPAIR_FINAL_PRICE_CORRECTION_REQUIRES_DELIVERED: { status: 422, code: 'REPAIR_FINAL_PRICE_CORRECTION_REQUIRES_DELIVERED', message: 'Esta corrección solo está disponible para reparaciones entregadas.' },
  REPAIR_FINAL_PRICE_CORRECTION_FORBIDDEN: { status: 403, code: 'REPAIR_FINAL_PRICE_CORRECTION_FORBIDDEN', message: 'Solo un administrador puede corregir el precio final histórico.' },
  REPAIR_FINAL_PRICE_CORRECTION_REASON_REQUIRED: { status: 422, code: 'REPAIR_FINAL_PRICE_CORRECTION_REASON_REQUIRED', message: 'Explicá el motivo con al menos 10 caracteres.' },
  REPAIR_FINAL_PRICE_UNCHANGED: { status: 422, code: 'REPAIR_FINAL_PRICE_UNCHANGED', message: 'El precio corregido es igual al precio actual.' },
  REPAIR_COST_IDEMPOTENCY_CONFLICT: { status: 409, code: 'REPAIR_COST_IDEMPOTENCY_CONFLICT', message: 'Esta confirmación ya fue utilizada con valores diferentes.' },
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    if (!['owner', 'admin'].includes(ctx.organizationRole) && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Solo un administrador puede corregir el precio final histórico.' }, { status: 403 })
    }
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Revisá el nuevo precio y explicá el motivo de la corrección.' }, { status: 400 })
    const { id } = await context.params
    const { data, error } = await ctx.supabase.rpc('correct_delivered_repair_final_price', {
      p_repair_id: id, p_organization_id: ctx.organizationId, p_branch_id: ctx.branchId, p_actor_id: ctx.userId,
      p_new_final_total: parsed.data.newFinalTotal, p_reason: parsed.data.reason, p_idempotency_key: parsed.data.idempotencyKey,
    })
    if (error) {
      const overpayment = error.message?.match(/REPAIR_FINAL_PRICE_BELOW_PAID\|([\d.]+)/)
      if (overpayment) return NextResponse.json({
        error: 'El nuevo precio es menor que lo pagado. Resolvé primero el excedente mediante devolución o saldo a favor en Posventa.',
        code: 'REPAIR_FINAL_PRICE_BELOW_PAID', overpaymentAmount: Number(overpayment[1]),
      }, { status: 409 })
      const mapped = Object.entries(ERROR_MAP).find(([code]) => error.message?.includes(code))?.[1]
      return NextResponse.json({ error: mapped?.message || 'No se pudo corregir el precio final.', code: mapped?.code }, { status: mapped?.status || 500 })
    }
    const { data: repair, error: repairError } = await fetchRepairById(ctx, id)
    if (repairError) throw repairError
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
    return NextResponse.json({ success: true, correction: data, repair })
  } catch (error) {
    console.error('[repair-final-price-correction] Unexpected failure', error)
    return NextResponse.json({ error: 'No se pudo corregir el precio final.' }, { status: 500 })
  }
}

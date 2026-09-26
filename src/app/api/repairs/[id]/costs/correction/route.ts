import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchRepairById, isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

const correctionSchema = z.object({
  corrections: z.array(z.object({
    partId: z.string().uuid(),
    unitCost: z.coerce.number().finite().nonnegative().max(999_999_999_999),
  })).min(1).max(100),
  reason: z.string().trim().min(10).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
})

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  REPAIR_COST_CORRECTION_REQUIRES_DELIVERED: { status: 422, message: 'Esta corrección solo está disponible para reparaciones entregadas.' },
  REPAIR_COST_CORRECTION_FORBIDDEN: { status: 403, message: 'Solo un administrador puede corregir costos históricos.' },
  REPAIR_COST_CORRECTION_REASON_REQUIRED: { status: 422, message: 'Explicá el motivo de la corrección con al menos 10 caracteres.' },
  REPAIR_COST_IDEMPOTENCY_CONFLICT: { status: 409, message: 'Esta confirmación ya fue utilizada con valores diferentes.' },
  REPAIR_PART_NOT_FOUND: { status: 404, message: 'Uno de los repuestos ya no pertenece a esta reparación.' },
  DUPLICATE_REPAIR_PART_CORRECTION: { status: 400, message: 'No se puede corregir el mismo repuesto dos veces.' },
  INVALID_REPAIR_INTERNAL_COST_CORRECTION: { status: 400, message: 'Revisá los costos internos ingresados.' },
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    if (!['owner', 'admin'].includes(ctx.organizationRole) && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Solo un administrador puede corregir costos históricos.' }, { status: 403 })
    }

    const parsed = correctionSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisá los costos internos y explicá el motivo de la corrección.' },
        { status: 400 },
      )
    }
    const { id } = await context.params
    const { data, error } = await ctx.supabase.rpc('correct_delivered_repair_internal_cost', {
      p_repair_id: id,
      p_organization_id: ctx.organizationId,
      p_branch_id: ctx.branchId,
      p_actor_id: ctx.userId,
      p_corrections: parsed.data.corrections.map((item) => ({ part_id: item.partId, unit_cost: item.unitCost })),
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
    })
    if (error) {
      const mapped = Object.entries(ERROR_MAP).find(([code]) => error.message?.includes(code))?.[1]
      return NextResponse.json(
        { error: mapped?.message || 'No se pudo corregir el costo interno.' },
        { status: mapped?.status || 500 },
      )
    }

    const { data: repair, error: repairError } = await fetchRepairById(ctx, id)
    if (repairError) throw repairError
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
    return NextResponse.json({ success: true, correction: data, repair })
  } catch (error) {
    console.error('[repair-cost-correction] Unexpected failure', error)
    return NextResponse.json({ error: 'No se pudo corregir el costo interno.' }, { status: 500 })
  }
}

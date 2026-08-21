import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  assertRepairExists,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { RepairCostRpcError, saveRepairCostRevision } from '@/lib/repairs/save-cost-revision'

type RouteParams = { params: Promise<{ id: string }> }

const partSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  partNumber: z.string().trim().max(100).nullable().optional(),
  supplier: z.string().trim().max(200).nullable().optional(),
  quantity: z.coerce.number().int().positive().max(10_000),
  unitPrice: z.coerce.number().finite().nonnegative(),
  unitCost: z.coerce.number().finite().nonnegative().optional(),
  discountAmount: z.coerce.number().finite().nonnegative().default(0),
  taxRate: z.union([z.literal(0), z.literal(5), z.literal(10)]).optional(),
  lineType: z.enum(['service', 'included_material', 'charged_part']).default('charged_part'),
})

const saveSchema = z.object({
  laborAmount: z.coerce.number().finite().nonnegative(),
  parts: z.array(partSchema).max(100),
  additionalCharges: z.coerce.number().finite().nonnegative().default(0),
  deductions: z.coerce.number().finite().nonnegative().default(0),
  discountAmount: z.coerce.number().finite().nonnegative().default(0),
  overrideReason: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
})

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    const parsed = saveSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisá los importes y repuestos antes de confirmar.', code: 'INVALID_REPAIR_COST_REQUEST' },
        { status: 400 },
      )
    }

    const { id } = await context.params
    const operation = await saveRepairCostRevision(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
    }, parsed.data)
    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })

    return NextResponse.json({
      success: true,
      repair,
      revision: { id: operation.revisionId, number: operation.revisionNumber },
      summary: operation.summary,
      parts: operation.parts,
    })
  } catch (error) {
    if (error instanceof RepairCostRpcError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status },
      )
    }
    console.error('[repair-costs] Unexpected save failure', error)
    return NextResponse.json({ error: 'No se pudieron guardar los costos de la reparación.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.read')
    if (isNextResponse(ctx)) return ctx
    const { id } = await context.params
    if (!await assertRepairExists(ctx, id)) {
      return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
    }
    const { data, error } = await ctx.supabase
      .from('repair_cost_revisions')
      .select('*, parts:repair_cost_revision_parts(*)')
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .eq('repair_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ success: true, revisions: data ?? [] })
  } catch (error) {
    console.error('[repair-costs] Unexpected history failure', error)
    return NextResponse.json({ error: 'No se pudo cargar el historial de costos.' }, { status: 500 })
  }
}

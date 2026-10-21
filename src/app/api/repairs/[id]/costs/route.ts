import { resolveOrganizationProductCostAccess } from '@/lib/products/cost-access'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  assertRepairExists,
  prepareRepairResponse,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { RepairCostRpcError, saveRepairCostRevision } from '@/lib/repairs/save-cost-revision'
import { resolveIncludedMaterialCosts } from '@/lib/repairs/included-material-cost'

type RouteParams = { params: Promise<{ id: string }> }

const partSchema = z.object({
  key: z.string().max(200).optional(),
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
  /** Material incluido: el servicio del que sale. Su costo lo lee el servidor. */
  sourceProductId: z.string().uuid().nullable().optional(),
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
    const access = await resolveOrganizationProductCostAccess(ctx.supabase, {userId:ctx.userId,organizationId:ctx.organizationId})
    if (!access.canWriteCost && parsed.data.parts.some(part => part.unitCost !== undefined)) {
      return NextResponse.json({error:'No tenés permiso para modificar costos internos.',code:'PRODUCT_COST_FORBIDDEN'}, {status:403})
    }
    if (!(await assertRepairExists(ctx, id))) return NextResponse.json({error:'Reparación no encontrada.'},{status:404})
    // Omitted costs of existing manual lines are preserved server-side, never copied from sale prices.
    const manual = parsed.data.parts.filter(part=>!part.productId && part.unitCost === undefined && part.key)
    if (manual.length) {
      const previous = await ctx.supabase.from('repair_parts').select('id,unit_cost').eq('repair_id',id)
      if (previous.error) throw previous.error
      const costs = new Map((previous.data ?? []).map(row=>[String(row.id),row.unit_cost]))
      for (const part of manual) if (costs.has(part.key!)) part.unitCost = costs.get(part.key!) ?? undefined
    }
    if (!access.canWriteCost && parsed.data.parts.some(part => !part.productId && part.lineType === 'charged_part' && part.unitCost === undefined)) {
      return NextResponse.json({error:'El costo de una pieza manual requiere autorización.',code:'PRODUCT_COST_FORBIDDEN'},{status:403})
    }
    const parts = await resolveIncludedMaterialCosts(parsed.data.parts, ctx.organizationId)
    if (!parts) {
      return NextResponse.json(
        { error: 'Uno de los servicios no pertenece a este comercio.', code: 'INVALID_REPAIR_MATERIAL_SOURCE' },
        { status: 400 },
      )
    }
    const operation = await saveRepairCostRevision(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
    }, { ...parsed.data, parts })
    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })

    return NextResponse.json({
      success: true,
      repair,
      revision: { id: operation.revisionId, number: operation.revisionNumber },
      summary: await prepareRepairResponse(ctx, operation.summary),
      parts: await prepareRepairResponse(ctx, operation.parts),
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
    const access = await resolveOrganizationProductCostAccess(ctx.supabase,{userId:ctx.userId,organizationId:ctx.organizationId})
    if (!access.canReadCost) return NextResponse.json({success:true,revisions:[],costHidden:true})
    const { data, error } = await ctx.supabase
      .from('repair_cost_revisions')
      .select('*, parts:repair_cost_revision_parts(*)')
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .eq('repair_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const revisions = data ?? []
    const actorIds = [...new Set(revisions.map((revision) => revision.actor_id).filter(Boolean))]
    const { data: actors } = actorIds.length > 0
      ? await ctx.supabase.from('profiles').select('id, full_name').in('id', actorIds)
      : { data: [] }
    const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]))
    return NextResponse.json({
      success: true,
      revisions: revisions.map((revision) => ({
        ...revision,
        actor_name: revision.actor_id ? actorNames.get(revision.actor_id) || null : null,
      })),
    })
  } catch (error) {
    console.error('[repair-costs] Unexpected history failure', error)
    return NextResponse.json({ error: 'No se pudo cargar el historial de costos.' }, { status: 500 })
  }
}

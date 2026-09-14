import { NextRequest, NextResponse } from 'next/server'
import { fetchRepairById, isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'
import { parseRepairQualityCheckRequest } from '@/lib/repairs/quality-check'
import { recordRepairQualityCheck, RepairQualityCheckRpcError } from '@/lib/repairs/quality-check-rpc'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    if (!['owner', 'admin', 'manager', 'technician'].includes(ctx.organizationRole)) {
      return NextResponse.json({ error: 'Solo el equipo técnico o un responsable puede verificar el funcionamiento.' }, { status: 403 })
    }

    const parsed = parseRepairQualityCheckRequest(await request.json().catch(() => null))
    if ('error' in parsed) {
      return NextResponse.json(
        { error: 'Revisá el resultado, el checklist y la observación.', code: parsed.error },
        { status: 400 },
      )
    }

    const { id } = await context.params
    const operation = await recordRepairQualityCheck(ctx.supabase, {
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
      request: parsed.data,
    })
    const { data: repair, error } = await fetchRepairById(ctx, id)
    if (error) throw error
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })

    return NextResponse.json({ repair, qualityCheck: operation })
  } catch (error) {
    if (error instanceof RepairQualityCheckRpcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('POST /api/repairs/[id]/quality-check error:', error)
    return NextResponse.json({ error: 'No se pudo guardar la verificación técnica.' }, { status: 500 })
  }
}

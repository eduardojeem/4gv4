import { NextRequest, NextResponse } from 'next/server'
import { resolveWarrantyExpiration } from '@/lib/warranty-utils'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

const VALID_OUTCOMES = new Set(['repaired', 'withdrawn', 'unrepairable'])

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as {
      outcome?: unknown
      note?: unknown
    }

    const outcome = typeof body.outcome === 'string' && VALID_OUTCOMES.has(body.outcome)
      ? body.outcome
      : null

    if (!outcome) {
      return NextResponse.json({ error: 'Resultado de entrega invalido.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const updateData: Record<string, unknown> = {
      status: 'entregado',
      picked_up_at: now,
      delivered_at: now,
      completed_at: now,
      delivery_outcome: outcome,
      updated_at: now,
    }

    if (note) {
      updateData.solution = note
    }

    // La entrega es el momento en que la garantia empieza a correr de verdad,
    // asi que la fecha de vencimiento se fija aca a partir de los meses
    // configurados. Sin esto el cliente perdia los dias entre que se cargaba la
    // garantia y el retiro del equipo.
    const { data: currentRepair } = await ctx.supabase
      .from('repairs')
      .select('warranty_months')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    const warrantyMonths = Number(currentRepair?.warranty_months || 0)
    if (warrantyMonths > 0) {
      updateData.warranty_expires_at = resolveWarrantyExpiration(warrantyMonths, { deliveredAt: now })
    }

    const { data, error } = await ctx.supabase
      .from('repairs')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

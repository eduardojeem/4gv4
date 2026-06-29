import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

const VALID_OUTCOMES = new Set(['repaired', 'withdrawn', 'unrepairable'])

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request)
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


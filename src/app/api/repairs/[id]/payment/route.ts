import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

const VALID_METHODS = new Set(['cash', 'card', 'transfer'])
const VALID_OUTCOMES = new Set(['repaired', 'withdrawn', 'unrepairable'])

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request)
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as {
      method?: unknown
      amount?: unknown
      reference?: unknown
      markDelivered?: unknown
      outcome?: unknown
      note?: unknown
    }

    const amount = Number(body.amount)
    const method = typeof body.method === 'string' && VALID_METHODS.has(body.method)
      ? body.method
      : null
    const markDelivered = Boolean(body.markDelivered)
    const outcome = typeof body.outcome === 'string' && VALID_OUTCOMES.has(body.outcome)
      ? body.outcome
      : 'repaired'

    if (!method) {
      return NextResponse.json({ error: 'Metodo de pago invalido.' }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Monto de pago invalido.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      payment_status: 'pagado',
      paid_amount: amount,
      updated_at: now,
    }

    const noteParts = [
      `Pago registrado: ${amount}`,
      `Metodo: ${method}`,
    ]

    if (typeof body.reference === 'string' && body.reference.trim()) {
      noteParts.push(`Referencia: ${body.reference.trim()}`)
    }

    if (typeof body.note === 'string' && body.note.trim()) {
      noteParts.push(`Nota: ${body.note.trim()}`)
    }

    if (markDelivered) {
      updateData.status = 'entregado'
      updateData.picked_up_at = now
      updateData.delivered_at = now
      updateData.completed_at = now
      updateData.delivery_outcome = outcome
      if (typeof body.note === 'string' && body.note.trim()) {
        updateData.solution = body.note.trim()
      }
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

    const { error: noteError } = await ctx.supabase
      .from('repair_notes')
      .insert({
        repair_id: id,
        author_id: ctx.userId,
        author_name: 'Sistema',
        note_text: noteParts.join(' | '),
        is_internal: true,
      })

    if (noteError) throw noteError

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


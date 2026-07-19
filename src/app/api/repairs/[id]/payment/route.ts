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

    // Estado actual del cobro: los pagos se ACUMULAN (antes `paid_amount` se
    // sobreescribía, así que un segundo pago parcial borraba el primero) y se
    // bloquea el cobro de una reparación ya saldada para evitar duplicados en
    // caja (p.ej. cobrada por POS y de nuevo desde esta pantalla).
    const { data: current, error: currentError } = await ctx.supabase
      .from('repairs')
      .select('id, ticket_number, paid_amount, payment_status, final_cost, estimated_cost')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const currentRepair = current as {
      ticket_number?: string | null
      paid_amount?: number | null
      payment_status?: string | null
      final_cost?: number | null
      estimated_cost?: number | null
    }

    if (currentRepair.payment_status === 'pagado') {
      return NextResponse.json(
        { error: 'Esta reparacion ya figura como pagada.' },
        { status: 409 }
      )
    }

    const previouslyPaid = Number(currentRepair.paid_amount) || 0
    const totalPaid = previouslyPaid + amount
    // El total a cobrar es el costo final si está definido; si no, el estimado.
    const totalDue = Number(currentRepair.final_cost ?? currentRepair.estimated_cost) || 0
    // Sin total de referencia se considera saldada con el pago recibido.
    const isSettled = totalDue <= 0 || totalPaid >= totalDue

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      payment_status: isSettled ? 'pagado' : 'parcial',
      paid_amount: totalPaid,
      updated_at: now,
    }

    const noteParts = [
      `Pago registrado: ${amount}`,
      `Metodo: ${method}`,
    ]

    if (previouslyPaid > 0) {
      noteParts.push(`Acumulado: ${totalPaid}${totalDue > 0 ? ` de ${totalDue}` : ''}`)
    }

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

    // Guard anti doble cobro: solo actualiza si el estado de pago sigue siendo
    // el que leímos. Si otra pantalla (p.ej. el POS) cobró en el intervalo, la
    // condición no matchea y se aborta en vez de duplicar el movimiento.
    let updateQuery = ctx.supabase
      .from('repairs')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)

    updateQuery = currentRepair.payment_status
      ? updateQuery.eq('payment_status', currentRepair.payment_status)
      : updateQuery.is('payment_status', null)

    const { data, error } = await updateQuery.select('id').maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { error: 'El estado de pago cambio mientras se registraba. Refresca e intenta de nuevo.' },
        { status: 409 }
      )
    }

    // Reflejar el cobro en la caja abierta de la organización (misma convención
    // que el POS: se registran todos los métodos, etiquetados con
    // payment_method). Sin esto, los cobros hechos desde la sección de
    // reparaciones no aparecían en el arqueo ni en el cierre Z — solo los
    // cobrados vía POS quedaban en caja. Best-effort: si no hay caja abierta,
    // el pago queda registrado en la reparación igual.
    try {
      const { data: openSessions } = await ctx.supabase
        .from('cash_closures')
        .select('id, register_id, branch_id')
        .eq('organization_id', ctx.organizationId)
        .is('date', null)
        .order('created_at', { ascending: false })

      const sessions = (openSessions ?? []) as Array<{
        id: string
        register_id: string | null
        branch_id: string | null
      }>
      const targetSession =
        sessions.find((session) => session.branch_id === ctx.branchId) ??
        sessions.find((session) => (session.register_id ?? '').toLowerCase() === 'principal') ??
        sessions[0] ??
        null

      if (targetSession) {
        const ticketLabel = currentRepair.ticket_number || id.slice(0, 8).toUpperCase()
        const { error: cashMovementError } = await ctx.supabase
          .from('cash_movements')
          .insert({
            session_id: targetSession.id,
            type: 'cash_in',
            amount,
            reason: `Cobro reparación ${ticketLabel}`,
            payment_method: method,
            created_by: ctx.userId,
            created_at: now,
            organization_id: ctx.organizationId,
            branch_id: ctx.branchId,
          })

        if (cashMovementError) throw cashMovementError
      } else {
        console.warn('[repairs/payment] Cobro sin caja abierta; no se registró movimiento', {
          repairId: id,
          organizationId: ctx.organizationId,
        })
      }
    } catch (cashError) {
      console.warn('[repairs/payment] No se pudo registrar el cobro en caja:', cashError)
    }

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


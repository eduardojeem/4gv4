import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { createCreditAccount, CreditAccountError } from '@/lib/credits/create-credit-account'
import { normalizeCreditFrequency, normalizeInstallmentCount } from '@/lib/credits/installments'

type RouteParams = { params: Promise<{ id: string }> }

// 'credit' financia el cobro creando una cuenta de crédito en vez de mover caja.
const VALID_METHODS = new Set(['cash', 'card', 'transfer', 'credit'])
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
      interestRate?: unknown
      installments?: { count?: unknown; frequency?: unknown }
    }

    const amount = Number(body.amount)
    const method = typeof body.method === 'string' && VALID_METHODS.has(body.method)
      ? body.method
      : null
    const markDelivered = Boolean(body.markDelivered)
    const outcome = typeof body.outcome === 'string' && VALID_OUTCOMES.has(body.outcome)
      ? body.outcome
      : 'repaired'
    const isCredit = method === 'credit'

    if (!method) {
      return NextResponse.json({ error: 'Metodo de pago invalido.' }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Monto de pago invalido.' }, { status: 400 })
    }

    // El cobro a crédito es una operación financiera: los técnicos no pueden
    // originarla (mismo criterio que la venta a crédito del POS).
    if (isCredit && ctx.role === 'tecnico') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para cobrar a crédito.' },
        { status: 403 }
      )
    }

    // Estado actual del cobro: los pagos se ACUMULAN (antes `paid_amount` se
    // sobreescribía, así que un segundo pago parcial borraba el primero) y se
    // bloquea el cobro de una reparación ya saldada para evitar duplicados en
    // caja (p.ej. cobrada por POS y de nuevo desde esta pantalla).
    const { data: current, error: currentError } = await ctx.supabase
      .from('repairs')
      .select('id, ticket_number, customer_id, paid_amount, payment_status, final_cost, estimated_cost')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const currentRepair = current as {
      ticket_number?: string | null
      customer_id?: string | null
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

    const ticketLabel = currentRepair.ticket_number || id.slice(0, 8).toUpperCase()

    // Cobro a crédito: se financia el monto creando una cuenta de crédito
    // (deuda en cuotas) atada al cliente, en vez de mover caja. La reparación
    // queda saldada desde su propio ledger; la deuda vive en el módulo de
    // créditos. No hay `repair_id` en customer_credits, así que el vínculo se
    // deja en el `label`.
    let creditInfo: { creditId: string; financedTotal: number } | null = null
    if (isCredit) {
      if (!currentRepair.customer_id) {
        return NextResponse.json(
          { error: 'La reparación no tiene un cliente asociado para cobrar a crédito.' },
          { status: 400 }
        )
      }

      const { data: customerRow, error: customerError } = await ctx.supabase
        .from('customers')
        .select('id, credit_limit')
        .eq('id', currentRepair.customer_id)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle()

      if (customerError) throw customerError
      const creditLimit = Math.max(0, Number((customerRow as { credit_limit?: number | string | null } | null)?.credit_limit || 0))
      if (!customerRow || creditLimit <= 0) {
        return NextResponse.json(
          { error: 'El cliente no tiene límite de crédito habilitado.' },
          { status: 400 }
        )
      }

      const result = await createCreditAccount({
        supabase: ctx.supabase,
        organizationId: ctx.organizationId,
        customerId: currentRepair.customer_id,
        creditLimit,
        amount,
        interestRate: Number.isFinite(Number(body.interestRate)) ? Number(body.interestRate) : 0,
        installmentCount: normalizeInstallmentCount(body.installments?.count),
        frequency: normalizeCreditFrequency(body.installments?.frequency),
        saleId: null,
        label: `Reparación ${ticketLabel}`,
        creditType: 'repair_financing',
        originType: 'repair',
      })
      creditInfo = { creditId: result.creditId, financedTotal: result.financedTotal }
    }

    const previouslyPaid = Number(currentRepair.paid_amount) || 0
    // A crédito, el monto financiado salda la reparación por completo (la deuda
    // pasa al crédito). En efectivo/tarjeta/transferencia, se acumula.
    const totalPaid = isCredit ? (currentRepair.final_cost ?? currentRepair.estimated_cost ?? amount) : previouslyPaid + amount
    // El total a cobrar es el costo final si está definido; si no, el estimado.
    const totalDue = Number(currentRepair.final_cost ?? currentRepair.estimated_cost) || 0
    // A crédito queda saldada; si no, según lo acumulado vs total.
    const isSettled = isCredit || totalDue <= 0 || totalPaid >= totalDue

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      payment_status: isSettled ? 'pagado' : 'parcial',
      paid_amount: totalPaid,
      updated_at: now,
    }

    const noteParts = [
      isCredit ? `Cobro a crédito: ${amount}` : `Pago registrado: ${amount}`,
      `Metodo: ${method}`,
    ]

    if (creditInfo) {
      noteParts.push(`Crédito ${creditInfo.creditId} (total financiado: ${creditInfo.financedTotal})`)
    }

    if (!isCredit && previouslyPaid > 0) {
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

    // Rollback del crédito recién creado si la reparación no pudo actualizarse
    // (p.ej. otro cobro concurrente): evita dejar una deuda huérfana sin que la
    // reparación quede saldada.
    const rollbackCredit = async () => {
      if (!creditInfo) return
      await ctx.supabase.from('credit_installments').delete().eq('credit_id', creditInfo.creditId)
      await ctx.supabase.from('customer_credits').delete()
        .eq('id', creditInfo.creditId).eq('organization_id', ctx.organizationId)
    }

    if (error) {
      await rollbackCredit()
      throw error
    }
    if (!data) {
      await rollbackCredit()
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
    // A crédito NO se toca caja: no entra efectivo, la deuda vive en créditos.
    if (!isCredit) {
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
    if (error instanceof CreditAccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


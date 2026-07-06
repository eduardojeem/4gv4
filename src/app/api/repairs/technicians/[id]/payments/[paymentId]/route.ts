import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string; paymentId: string }> }

const patchSchema = z.object({
  action: z.enum(['confirmar', 'confirmar_recibo', 'anular']),
})

// PATCH: admin confirma/anula; el técnico (o admin) acusa recibo.
export async function PATCH(req: NextRequest, context: RouteParams) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>

    const organization = await getCurrentOrganizationContext(staffAuth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'organization_required' }, { status: 403 })
    }

    const { paymentId } = await context.params
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation_failed' }, { status: 400 })
    }
    const { action } = parsed.data

    const supabase = createAdminSupabase()

    const { data: payment, error: fetchError } = await supabase
      .from('technician_payments')
      .select('id, technician_id, status, amount, method, cash_movement_id')
      .eq('id', paymentId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!payment) return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })

    const isAdmin = staffAuth.role === 'admin' || staffAuth.role === 'super_admin'
    const isOwner = payment.technician_id === staffAuth.user.id

    const invalidTransition = () =>
      NextResponse.json(
        { error: 'invalid_transition', message: `No se puede aplicar "${action}" a un pago en estado "${payment.status}".` },
        { status: 409 },
      )

    let update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (action === 'confirmar') {
      if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      // Solo un pago pendiente se puede confirmar como pagado.
      if (payment.status !== 'pendiente') return invalidTransition()
      update = {
        ...update,
        status: 'pagado',
        approved_by: staffAuth.user.id,
        approved_at: new Date().toISOString(),
      }
    } else if (action === 'anular') {
      if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      // No se anula un pago ya confirmado por el técnico ni uno ya anulado.
      if (payment.status === 'anulado' || payment.status === 'confirmado') return invalidTransition()

      // Revertir el egreso de caja (best-effort): compensamos con un ingreso.
      if (payment.cash_movement_id && payment.method === 'efectivo') {
        try {
          const { data: openSessions } = await supabase
            .from('cash_closures')
            .select('id, register_id')
            .eq('organization_id', organization.id)
            .is('date', null)
            .order('created_at', { ascending: false })

          const targetSession =
            (openSessions ?? []).find((s) => s.register_id?.toLowerCase() === 'principal') ??
            (openSessions ?? [])[0]

          if (targetSession) {
            await supabase.from('cash_movements').insert({
              organization_id: organization.id,
              session_id: targetSession.id,
              type: 'cash_in',
              amount: Number(payment.amount) || 0,
              reason: 'Reversa de pago a técnico anulado',
              payment_method: 'efectivo',
              created_by: staffAuth.user.id,
              created_at: new Date().toISOString(),
            })
          }
        } catch (cashError) {
          console.warn('[technician-payments] cash reversal skipped:', cashError)
        }
      }

      update = { ...update, status: 'anulado' }
    } else if (action === 'confirmar_recibo') {
      // El técnico dueño (o un admin) acusa recibo — solo sobre un pago ya pagado.
      if (!isAdmin && !isOwner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      if (payment.status !== 'pagado') return invalidTransition()
      update = {
        ...update,
        status: 'confirmado',
        confirmed_by: staffAuth.user.id,
        confirmed_at: new Date().toISOString(),
      }
    }

    const { data, error } = await supabase
      .from('technician_payments')
      .update(update)
      .eq('id', paymentId)
      .eq('organization_id', organization.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ payment: data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar el pago'
    console.error('[technician-payments PATCH]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { APPOINTMENT_COLUMNS, appointmentErrorMessage, loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { bookingWriteError } from '@/lib/agenda/booking-writes'
import { appointmentInputSchema, appointmentRow, assertAppointmentRefs, type AppointmentStatus } from '@/lib/agenda/agenda-api'

export const dynamic = 'force-dynamic'

const guard = { permission: 'pos.sales.read', module: 'services' } as const

async function appointmentId(routeContext: unknown) {
  const { id } = await (routeContext as { params: Promise<{ id: string }> }).params
  return z.string().uuid().safeParse(id).success ? id : null
}

export const GET = withTenantAuth(guard, async (_request, { organization }, routeContext) => {
  const id = await appointmentId(routeContext)
  if (!id) return NextResponse.json({ error: 'Turno inválido' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient
  const config = await loadAgendaConfig(supabase, organization.id)
  const ready = Boolean(config?.capabilities.professionalBooking)
  const { data, error } = await supabase.from('appointments').select(ready ? `${APPOINTMENT_COLUMNS},buffer_minutes,occupied_until` : APPOINTMENT_COLUMNS).eq('id', id).eq('organization_id', organization.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo consultar el turno' }, { status: 503 })
  if (!data) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  return NextResponse.json({ appointment: data, professionalBookingAvailable: ready, publicUrl: siteUrl(`/turno/${(data as unknown as { public_token: string }).public_token}`) })
})

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('no_show') }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('reminder_sent') }),
  z.object({ action: z.literal('link_sale'), sale_id: z.string().uuid() }),
  z.object({ action: z.literal('update'), appointment: appointmentInputSchema }),
])

const ACTIVE: AppointmentStatus[] = ['pending', 'confirmed']

const TRANSITIONS: Record<string, { to?: AppointmentStatus; from: AppointmentStatus[] }> = {
  confirm: { to: 'confirmed', from: ['pending'] },
  complete: { to: 'completed', from: ACTIVE },
  no_show: { to: 'no_show', from: ACTIVE },
  cancel: { to: 'cancelled', from: ACTIVE },
  reopen: { to: 'confirmed', from: ['cancelled', 'no_show', 'completed'] },
  reminder_sent: { from: ACTIVE },
  link_sale: { to: 'completed', from: ['pending', 'confirmed', 'completed'] },
  update: { from: ACTIVE },
}

export const PATCH = withTenantAuth(guard, async (request, { organization, user }, routeContext) => {
  const id = await appointmentId(routeContext)
  if (!id) return NextResponse.json({ error: 'Turno inválido' }, { status: 400 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Acción inválida' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient

  const { data: current } = await supabase.from('appointments').select('id, status, sale_id').eq('id', id).eq('organization_id', organization.id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if ((current as {sale_id:string|null}).sale_id) return NextResponse.json({error:'El turno ya está cobrado; no se puede reabrir ni editar.'},{status:409})
  const status = (current as { status: AppointmentStatus }).status
  const transition = TRANSITIONS[parsed.data.action]
  if (!transition.from.includes(status)) return NextResponse.json({ error: 'El turno ya cambió de estado. Actualizá la agenda.' }, { status: 409 })
  if (parsed.data.action === 'update') {
    const config = await loadAgendaConfig(supabase, organization.id)
    if (config?.capabilities.professionalBooking) {
      const { data, error } = await createAdminSupabase().rpc('save_agenda_appointment', {
        p_org: organization.id, p_id: id, p_input: parsed.data.appointment, p_actor: user.id,
      })
      if (error || !data) {
        const failure = bookingWriteError(error)
        return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status })
      }
      return NextResponse.json({ appointment: data })
    }
  }

  const now = new Date().toISOString()
  let update: Record<string, unknown> = transition.to ? { status: transition.to } : {}
  switch (parsed.data.action) {
    case 'confirm':
      update.confirmed_at = now
      break
    case 'cancel':
      update.cancel_reason = parsed.data.reason || null
      break
    case 'reopen':
      update.cancel_reason = null
      break
    case 'reminder_sent':
      update.reminder_sent_at = now
      break
    case 'link_sale': {
      const config = await loadAgendaConfig(supabase, organization.id)
      if (config?.capabilities.professionalBooking) return NextResponse.json({ error: 'Cobrá el turno desde el POS: la venta y su vínculo se guardan juntos.' }, { status: 409 })
      const { data: sale } = await supabase.from('sales').select('id').eq('id', parsed.data.sale_id).eq('organization_id', organization.id).maybeSingle()
      if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 400 })
      update.sale_id = parsed.data.sale_id
      break
    }
    case 'update': {
      const refError = await assertAppointmentRefs(supabase, organization.id, parsed.data.appointment)
      if (refError) return NextResponse.json({ error: refError }, { status: 400 })
      update = { ...appointmentRow(parsed.data.appointment) }
      break
    }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(update)
    .eq('id', id)
    .eq('organization_id', organization.id)
    .eq('status', status)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle()
  if (error || !data) {
    if (error && !error.message.includes('APPOINTMENT_OVERLAP')) logger.error('No se pudo actualizar el turno', { error: error.message })
    return NextResponse.json(
      { error: appointmentErrorMessage(error, 'No se pudo actualizar el turno. Actualizá la agenda.') },
      { status: 409 },
    )
  }
  return NextResponse.json({ appointment: data })
})

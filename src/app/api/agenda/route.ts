import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'
import { APPOINTMENT_COLUMNS, appointmentErrorMessage, loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { appointmentInputSchema, appointmentRow, assertAppointmentRefs } from '@/lib/agenda/agenda-api'
import { addDays, dayRangeUtc, todayIn } from '@/lib/agenda/time'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { bookingWriteError } from '@/lib/agenda/booking-writes'

export const dynamic = 'force-dynamic'

const guard = { permission: 'pos.sales.read', module: 'services' } as const

/** Turnos de un rango de días (en la zona de la empresa) y todo lo que hace falta para cargarlos. */
export const GET = withTenantAuth(guard, async (request, { organization }) => {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const config = await loadAgendaConfig(supabase, organization.id)
  if (!config) return NextResponse.json({ available: false })

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('date')
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayIn(config.timeZone)
  const days = Math.min(31, Math.max(1, Number(searchParams.get('days')) || 1))
  const from = dayRangeUtc(date, config.timeZone).start
  const to = dayRangeUtc(addDays(date, days - 1), config.timeZone).end

  const { data, error } = await supabase
    .from('appointments')
    .select(config.capabilities.professionalBooking ? `${APPOINTMENT_COLUMNS}, buffer_minutes, occupied_until` : APPOINTMENT_COLUMNS)
    .eq('organization_id', organization.id)
    .gte('starts_at', new Date(from).toISOString())
    .lt('starts_at', new Date(to).toISOString())
    .order('starts_at')
    .limit(2000)
  if (error) {
    logger.error('No se pudo leer la agenda', { error: error.message })
    return NextResponse.json({ error: 'No se pudo leer la agenda' }, { status: 500 })
  }

  // Lo que espera respuesta, aunque sea de otro día.
  const { count: pendingCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organization.id)
    .eq('status', 'pending')
    .gte('starts_at', new Date().toISOString())

  return NextResponse.json({
    available: true,
    date,
    days,
    appointments: data ?? [],
    pendingCount: pendingCount ?? 0,
    ...config,
    storeName: organization.name,
    storeSlug: organization.slug,
    canConfigure: roleHasPermission(organization.role as OrganizationRole, 'settings.manage'),
  })
})

export const POST = withTenantAuth(guard, async (request, { organization, user }) => {
  const parsed = appointmentInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos del turno' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient

  const config = await loadAgendaConfig(supabase, organization.id)
  if (config?.capabilities.professionalBooking) {
    const { data, error } = await createAdminSupabase().rpc('save_agenda_appointment', {
      p_org: organization.id, p_id: null, p_input: parsed.data, p_actor: user.id,
    })
    if (error || !data) {
      const failure = bookingWriteError(error)
      return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status })
    }
    return NextResponse.json({ appointment: data }, { status: 201 })
  }

  const refError = await assertAppointmentRefs(supabase, organization.id, parsed.data)
  if (refError) return NextResponse.json({ error: refError }, { status: 400 })

  const status = parsed.data.status ?? 'confirmed'
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      ...appointmentRow(parsed.data),
      organization_id: organization.id,
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      source: 'dashboard',
      created_by: user.id,
    })
    .select(APPOINTMENT_COLUMNS)
    .single()
  if (error || !data) {
    const message = appointmentErrorMessage(error, 'No se pudo guardar el turno')
    if (message === 'No se pudo guardar el turno') logger.error('No se pudo crear el turno', { error: error?.message })
    return NextResponse.json({ error: message }, { status: error?.message?.includes('APPOINTMENT_OVERLAP') ? 409 : 500 })
  }
  return NextResponse.json({ appointment: data }, { status: 201 })
})

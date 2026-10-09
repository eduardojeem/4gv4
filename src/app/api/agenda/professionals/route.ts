import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { PROFESSIONAL_COLUMNS } from '@/lib/agenda/agenda-server'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { bookingWriteError } from '@/lib/agenda/booking-writes'
import { openingHoursSchema } from '@/lib/agenda/booking-config'

export const dynamic = 'force-dynamic'

const guard = { permission: 'settings.manage', module: 'services' } as const

const professionalSchema = z.object({
  name: z.string().trim().min(1, 'Poné el nombre').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  phone: z.string().trim().max(40).nullable().optional(),
  is_active: z.boolean().optional(),
  online_visible: z.boolean().optional(),
  opening_hours: openingHoursSchema.nullable().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
  // Se muestran en la tienda: foto (URL https o ruta propia) y especialidad.
  photo_url: z.string().trim().max(500).refine((value) => value === '' || value.startsWith('https://') || value.startsWith('/'), 'La foto no es válida').nullable().optional(),
  specialty: z.string().trim().max(80).nullable().optional(),
})

const COLUMNS = PROFESSIONAL_COLUMNS

export const POST = withTenantAuth(guard, async (request, { organization }) => {
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()
  const advanced = parsed.data.online_visible !== undefined || parsed.data.opening_hours !== undefined
  if (advanced && !(await loadAgendaConfig(supabase, organization.id))?.capabilities.professionalBooking) return NextResponse.json({ error: 'Falta aplicar la migración transaccional de reservas.' }, { status: 503 })
  const { data, error } = await supabase
    .from('agenda_professionals')
    .insert({ ...parsed.data, phone: parsed.data.phone || null, organization_id: organization.id })
    .select(advanced ? `${COLUMNS}, online_visible, opening_hours` : COLUMNS)
    .single()
  if (error) {
    logger.error('No se pudo crear el profesional', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ professional: data }, { status: 201 })
})

/** Editar o dar de baja. No se borra: los turnos viejos siguen mostrando quién atendió. */
export const PATCH = withTenantAuth(guard, async (request, { organization }) => {
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  const id = z.string().uuid().safeParse(body?.id)
  const parsed = professionalSchema.partial().safeParse(body)
  if (!id.success || !parsed.success) return NextResponse.json({ error: 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()
  const advanced = parsed.data.online_visible !== undefined || parsed.data.opening_hours !== undefined
  if (advanced && !(await loadAgendaConfig(supabase, organization.id))?.capabilities.professionalBooking) return NextResponse.json({ error: 'Falta aplicar la migración transaccional de reservas.' }, { status: 503 })
  const { data, error } = await supabase
    .from('agenda_professionals')
    .update({
      ...parsed.data,
      ...('phone' in parsed.data ? { phone: parsed.data.phone || null } : {}),
      ...('photo_url' in parsed.data ? { photo_url: parsed.data.photo_url || null } : {}),
      ...('specialty' in parsed.data ? { specialty: parsed.data.specialty || null } : {}),
    })
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .select(advanced ? `${COLUMNS}, online_visible, opening_hours` : COLUMNS)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ professional: data })
})

const servicesSchema = z.object({
  id: z.string().uuid(),
  // Vacío = hace todos los servicios.
  service_ids: z.array(z.string().uuid()).max(500),
})

/** Qué servicios hace un profesional: se reemplaza la lista entera. */
export const PUT = withTenantAuth(guard, async (request, { organization, user }) => {
  const parsed = servicesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()
  const { id, service_ids } = parsed.data
  const config = await loadAgendaConfig(supabase, organization.id)
  if (config?.capabilities.professionalBooking) {
    const { data, error } = await createAdminSupabase().rpc('replace_agenda_professional_services', {
      p_org: organization.id, p_prof: id, p_services: [...new Set(service_ids)], p_actor: user.id,
    })
    if (error) {
      const failure = bookingWriteError(error)
      return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status })
    }
    return NextResponse.json({ professional: data })
  }

  const { data: professional } = await supabase
    .from('agenda_professionals')
    .select('id')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!professional) return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 })

  const { error: deleteError } = await supabase
    .from('agenda_professional_services')
    .delete()
    .eq('professional_id', id)
    .eq('organization_id', organization.id)
  if (deleteError) {
    logger.error('No se pudieron actualizar los servicios del profesional', { error: deleteError.message })
    const missing = /does not exist|schema cache/i.test(deleteError.message)
    return NextResponse.json({ error: missing ? 'Falta aplicar la migración de servicios por profesional.' : 'No se pudo guardar' }, { status: 500 })
  }

  const unique = Array.from(new Set(service_ids))
  if (unique.length) {
    const { error } = await supabase
      .from('agenda_professional_services')
      .insert(unique.map((productId) => ({ organization_id: organization.id, professional_id: id, product_id: productId })))
    if (error) {
      logger.error('No se pudieron guardar los servicios del profesional', { error: error.message })
      return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    }
  }
  return NextResponse.json({ professional: { id, service_ids: unique } })
})

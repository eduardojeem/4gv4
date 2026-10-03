import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_OPENING_HOURS, normalizeOpeningHours, type BusyInterval, type OpeningHours } from '@/lib/agenda/slots'
import { DEFAULT_TIMEZONE } from '@/lib/agenda/time'

export type AgendaSettings = {
  slot_minutes: number
  opening_hours: OpeningHours
  online_booking: boolean
  require_confirmation: boolean
  min_notice_minutes: number
  max_days_ahead: number
  booking_message: string | null
  /** Avisar por email al contacto de la tienda cuando un cliente reserva, cambia o cancela. */
  notify_email: boolean
}

export type AgendaProfessional = {
  id: string
  name: string
  color: string
  phone: string | null
  is_active: boolean
  sort_order: number
  /** Foto y especialidad para mostrar al equipo en la tienda. */
  photo_url?: string | null
  specialty?: string | null
  /** Servicios que hace. Vacío = todos (así quedan las agendas de antes). */
  service_ids?: string[]
}

/** Si el profesional hace el servicio: sin servicios asignados, hace todos. */
export function professionalDoesService(professional: Pick<AgendaProfessional, 'service_ids'>, serviceId: string): boolean {
  return !professional.service_ids?.length || professional.service_ids.includes(serviceId)
}

/** Los profesionales que pueden atender un servicio. */
export function professionalsForService<T extends Pick<AgendaProfessional, 'service_ids'>>(professionals: T[], serviceId: string): T[] {
  return professionals.filter((professional) => professionalDoesService(professional, serviceId))
}

export type AgendaService = {
  product_id: string
  name: string
  price: number
  hide_price: boolean
  duration_minutes: number
  online: boolean
  /** Sin configurar todavía: dura lo que dice el largo del turno. */
  configured: boolean
}

export const DEFAULT_AGENDA_SETTINGS: AgendaSettings = {
  slot_minutes: 30,
  opening_hours: DEFAULT_OPENING_HOURS,
  online_booking: false,
  require_confirmation: true,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  booking_message: null,
  notify_email: true,
}

export const APPOINTMENT_COLUMNS = 'id, number, professional_id, customer_id, customer_name, customer_phone, service_product_id, service_name, price, starts_at, ends_at, status, source, notes, cancel_reason, public_token, sale_id, confirmed_at, reminder_sent_at, created_at'

const MISSING_TABLE = /does not exist|could not find|schema cache/i

export function isMissingTable(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && MISSING_TABLE.test(error.message))
}

export const PROFESSIONAL_COLUMNS = 'id, name, color, phone, is_active, sort_order, photo_url, specialty'
const LEGACY_PROFESSIONAL_COLUMNS = 'id, name, color, phone, is_active, sort_order'

/**
 * Los profesionales con foto y especialidad. Sin la migración de esas
 * columnas, se leen sin ellas: si no, el error («column does not exist»)
 * se confundía con «falta la tabla» y la agenda entera desaparecía.
 */
async function loadProfessionals(client: SupabaseClient, organizationId: string) {
  const query = (columns: string) =>
    client.from('agenda_professionals').select(columns).eq('organization_id', organizationId).order('sort_order').order('name')
  const result = await query(PROFESSIONAL_COLUMNS)
  if (result.error && /photo_url|specialty/.test(result.error.message ?? '')) return query(LEGACY_PROFESSIONAL_COLUMNS)
  return result
}

/** Configuración, profesionales y servicios de la empresa. */
export async function loadAgendaConfig(client: SupabaseClient, organizationId: string, options: { onlyActive?: boolean } = {}) {
  const [settings, professionals, durations, products, orgSettings, assignments] = await Promise.all([
    client.from('agenda_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
    loadProfessionals(client, organizationId),
    client.from('agenda_services').select('product_id, duration_minutes, online').eq('organization_id', organizationId),
    client
      .from('products')
      .select('id, name, sale_price, hide_price, is_active, visibility')
      .eq('organization_id', organizationId)
      .eq('unit_measure', 'servicio')
      .eq('is_active', true)
      .order('name')
      .limit(500),
    client.from('organization_settings').select('timezone, currency').eq('organization_id', organizationId).maybeSingle(),
    // Sin la tabla todavía (migración sin correr), cada profesional hace todo.
    client.from('agenda_professional_services').select('professional_id, product_id').eq('organization_id', organizationId),
  ])

  if (isMissingTable(settings.error) || isMissingTable(professionals.error)) return null

  const stored = (settings.data ?? {}) as Partial<AgendaSettings>
  const config: AgendaSettings = {
    ...DEFAULT_AGENDA_SETTINGS,
    ...Object.fromEntries(Object.entries(stored).filter(([key]) => key in DEFAULT_AGENDA_SETTINGS)),
    opening_hours: stored.opening_hours ? normalizeOpeningHours(stored.opening_hours) : DEFAULT_OPENING_HOURS,
  }

  const durationById = new Map(((durations.data ?? []) as Array<{ product_id: string; duration_minutes: number; online: boolean }>).map((row) => [row.product_id, row]))
  const services: AgendaService[] = ((products.data ?? []) as Array<{ id: string; name: string; sale_price: number; hide_price?: boolean | null; visibility?: string | null }>)
    .map((product) => {
      const row = durationById.get(product.id)
      return {
        product_id: product.id,
        name: product.name,
        price: Number(product.sale_price) || 0,
        hide_price: product.hide_price === true,
        duration_minutes: row?.duration_minutes ?? config.slot_minutes,
        // Lo oculto en la tienda tampoco se reserva online.
        online: (row?.online ?? true) && (product.visibility ?? 'public') === 'public',
        configured: Boolean(row),
      }
    })

  const servicesByProfessional = new Map<string, string[]>()
  for (const row of (assignments.error ? [] : assignments.data ?? []) as Array<{ professional_id: string; product_id: string }>) {
    servicesByProfessional.set(row.professional_id, [...(servicesByProfessional.get(row.professional_id) ?? []), row.product_id])
  }
  const allProfessionals = ((professionals.data ?? []) as unknown as AgendaProfessional[]).map((professional) => ({
    ...professional,
    service_ids: servicesByProfessional.get(professional.id) ?? [],
  }))
  const org = (orgSettings.data ?? {}) as { timezone?: string | null; currency?: string | null }
  return {
    settings: config,
    professionals: options.onlyActive ? allProfessionals.filter((professional) => professional.is_active) : allProfessionals,
    services,
    timeZone: org.timezone || DEFAULT_TIMEZONE,
    currency: org.currency || 'PYG',
  }
}

/** Turnos que ocupan agenda (pendientes o confirmados) entre dos instantes. `excludeId`: el turno que se está moviendo no se cuenta a sí mismo. */
export async function busyIntervals(client: SupabaseClient, organizationId: string, from: number, to: number, excludeId?: string): Promise<BusyInterval[]> {
  let query = client
    .from('appointments')
    .select('id, starts_at, ends_at, professional_id')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'confirmed'])
    .lt('starts_at', new Date(to).toISOString())
    .gt('ends_at', new Date(from).toISOString())
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return ((data ?? []) as Array<{ starts_at: string; ends_at: string; professional_id: string | null }>).map((row) => ({
    start: Date.parse(row.starts_at),
    end: Date.parse(row.ends_at),
    professionalId: row.professional_id,
  }))
}

export function appointmentErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  if (error?.message?.includes('APPOINTMENT_OVERLAP')) return 'Ese horario ya está ocupado para ese profesional. Elegí otro.'
  return fallback
}

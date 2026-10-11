import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentStatus } from '@/lib/agenda/agenda-api'

export type CustomerAppointment = {
  id: string
  serviceName: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  price: number | null
  professionalName: string | null
  /** Enlace propio del turno (/turno/[token]) para cambiarlo o cancelarlo. */
  token: string | null
}

export type CustomerAppointments = {
  upcoming: CustomerAppointment[]
  past: CustomerAppointment[]
  timeZone: string
}

export const EMPTY_CUSTOMER_APPOINTMENTS: CustomerAppointments = { upcoming: [], past: [], timeZone: 'America/Asuncion' }

type Row = {
  id: string
  service_name: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  price: number | string | null
  public_token: string | null
  agenda_professionals?: { name?: string | null } | Array<{ name?: string | null }> | null
}

const ACTIVE = new Set<AppointmentStatus>(['pending', 'confirmed'])

/** Próximos (por confirmar o confirmados, todavía no empezados) primero; el resto es historial. */
export function splitCustomerAppointments(rows: CustomerAppointment[], now: Date = new Date()) {
  const upcoming = rows
    .filter((row) => ACTIVE.has(row.status) && Date.parse(row.endsAt) > now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const upcomingIds = new Set(upcoming.map((row) => row.id))
  const past = rows
    .filter((row) => !upcomingIds.has(row.id))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .slice(0, 5)
  return { upcoming, past }
}

/**
 * Los turnos del cliente en esta tienda. Se reconocen por su ficha de cliente
 * (la reserva la enlaza por teléfono aunque haya reservado sin ingresar).
 * Si la agenda no está instalada o algo falla, el perfil sigue sin la sección.
 */
export async function loadCustomerAppointments(admin: SupabaseClient, organizationId: string, userId: string): Promise<CustomerAppointments> {
  try {
    const { data: customer } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('profile_id', userId)
      .maybeSingle()
    if (!customer) return EMPTY_CUSTOMER_APPOINTMENTS

    const [{ data, error }, { data: settings }] = await Promise.all([
      admin
        .from('appointments')
        .select('id, service_name, starts_at, ends_at, status, price, public_token, agenda_professionals(name)')
        .eq('organization_id', organizationId)
        .eq('customer_id', (customer as { id: string }).id)
        .order('starts_at', { ascending: false })
        .limit(30),
      admin.from('organization_settings').select('timezone').eq('organization_id', organizationId).maybeSingle(),
    ])
    if (error || !data) return EMPTY_CUSTOMER_APPOINTMENTS

    const rows = (data as Row[]).map((row): CustomerAppointment => {
      const professional = Array.isArray(row.agenda_professionals) ? row.agenda_professionals[0] : row.agenda_professionals
      return {
        id: row.id,
        serviceName: row.service_name,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        price: row.price == null ? null : Number(row.price),
        professionalName: professional?.name ?? null,
        token: row.public_token,
      }
    })
    return {
      ...splitCustomerAppointments(rows),
      timeZone: (settings as { timezone?: string | null } | null)?.timezone || 'America/Asuncion',
    }
  } catch {
    return EMPTY_CUSTOMER_APPOINTMENTS
  }
}

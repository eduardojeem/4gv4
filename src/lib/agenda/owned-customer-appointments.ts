import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { MFA_REQUIRED_CODE } from '@/lib/auth/mfa'
import type { CustomerBookingItem, CustomerBookingStatus } from './customer-booking-contract'
export const APPOINTMENT_OWNER_SELECT =
  'id, organization_id, service_name, starts_at, ends_at, status, customer:customers!inner(profile_id, organization_id), professional:agenda_professionals(name)'
export type OwnedAppointmentRow = {
  id: string
  organization_id: string
  service_name: string
  starts_at: string
  ends_at: string
  status: CustomerBookingStatus
  customer:
    | { profile_id: string; organization_id: string }
    | { profile_id: string; organization_id: string }[]
  professional: { name: string | null } | { name: string | null }[] | null
  price?: number | null
  public_token?: string | null
  sale_id?: string | null
  service_product_id?: string | null
  attention_mode?: string
  service_address?: string | null
}
export function appointmentsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
export async function appointmentReader() {
  const auth = await resolveRequestAuthUser()
  if (!('reason' in auth)) return { userId: auth.user.id, response: null }
  return {
    userId: null,
    response: appointmentsResponse(
      {
        error:
          auth.reason === 'inactive'
            ? 'Tu cuenta no está habilitada.'
            : auth.reason === 'mfa_required'
              ? 'Confirmá la verificación en dos pasos para ver tus turnos.'
              : 'Iniciá sesión para ver tus turnos.',
        code:
          auth.reason === 'mfa_required'
            ? MFA_REQUIRED_CODE
            : auth.reason === 'inactive'
              ? 'ACCOUNT_INACTIVE'
              : 'AUTH_REQUIRED',
      },
      auth.reason === 'inactive' ? 403 : 401,
    ),
  }
}
export function appointmentsFailure(error: { code?: string } | null) {
  const missing = ['42P01', 'PGRST205', 'PGRST200'].includes(error?.code ?? '')
  return appointmentsResponse(
    {
      error: missing
        ? 'La consulta de turnos todavía no está disponible en este servidor.'
        : 'No se pudieron cargar tus turnos. Intentá de nuevo.',
      code: missing ? 'APPOINTMENTS_UNAVAILABLE' : 'APPOINTMENTS_LOAD_FAILED',
    },
    missing ? 503 : 500,
  )
}
export async function mapOwnedAppointments(
  db: SupabaseClient,
  rows: OwnedAppointmentRow[],
  userId: string,
): Promise<CustomerBookingItem[]> {
  for (const row of rows) {
    const owner = Array.isArray(row.customer) ? row.customer[0] : row.customer
    if (!owner || owner.profile_id !== userId || owner.organization_id !== row.organization_id)
      throw new Error('Appointment ownership mismatch')
    if (
      !['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(row.status) ||
      !Number.isFinite(Date.parse(row.starts_at)) ||
      !Number.isFinite(Date.parse(row.ends_at))
    )
      throw new Error('Invalid appointment record')
  }
  if (!rows.length) return []
  const ids = [...new Set(rows.map((row) => row.organization_id))]
  const [organizations, settings] = await Promise.all([
    db.from('organizations').select('id, name, slug').in('id', ids),
    db
      .from('organization_settings')
      .select('organization_id, timezone, currency')
      .in('organization_id', ids),
  ])
  if (organizations.error || settings.error)
    throw new Error('Appointment store metadata unavailable')
  const stores = new Map((organizations.data ?? []).map((org) => [org.id, org]))
  const preferences = new Map((settings.data ?? []).map((row) => [row.organization_id, row]))
  return rows.map((row) => {
    const org = stores.get(row.organization_id)
    if (!org?.name || !org.slug) throw new Error('Appointment store not found')
    const config = preferences.get(row.organization_id)
    const timeZone = config?.timezone || 'America/Asuncion'
    new Intl.DateTimeFormat('es-PY', { timeZone }).format(new Date(row.starts_at))
    const professional = Array.isArray(row.professional) ? row.professional[0] : row.professional
    return {
      id: row.id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      professionalName: professional?.name ?? null,
      store: { name: org.name, slug: org.slug, timeZone, currency: config?.currency || 'PYG' },
    }
  })
}

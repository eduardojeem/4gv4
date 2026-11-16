import { apiFetch, ApiError } from './api'
import type {
  CustomerBookingItem,
  CustomerBookingPage,
  CustomerBookingDetail,
} from '../../../src/lib/agenda/customer-booking-contract'
export type {
  CustomerBookingItem,
  CustomerBookingPage,
  CustomerBookingDetail,
} from '../../../src/lib/agenda/customer-booking-contract'
function validBooking(value: unknown): value is CustomerBookingItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<CustomerBookingItem>
  return (
    typeof row.id === 'string' &&
    typeof row.serviceName === 'string' &&
    typeof row.startsAt === 'string' &&
    Number.isFinite(Date.parse(row.startsAt)) &&
    typeof row.endsAt === 'string' &&
    Number.isFinite(Date.parse(row.endsAt)) &&
    ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(String(row.status)) &&
    (row.professionalName === null || typeof row.professionalName === 'string') &&
    !!row.store &&
    typeof row.store.name === 'string' &&
    typeof row.store.slug === 'string' &&
    typeof row.store.timeZone === 'string' &&
    typeof row.store.currency === 'string'
  )
}
const invalidResponse = () =>
  new Error('La respuesta de turnos no está completa. Actualizá la app o intentá de nuevo.')
export async function fetchMyAppointments(kind: 'upcoming' | 'past', cursor?: string | null) {
  const page = await apiFetch<CustomerBookingPage>(
    '/api/marketplace/profile/appointments?kind=' +
      kind +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
  )
  if (
    !page ||
    !Array.isArray(page.items) ||
    page.kind !== kind ||
    !(page.nextCursor === null || typeof page.nextCursor === 'string') ||
    !page.items.every(validBooking)
  )
    throw invalidResponse()
  return page
}
export async function fetchMyAppointment(id: string) {
  const result = await apiFetch<{ appointment: CustomerBookingDetail }>(
    '/api/marketplace/profile/appointments/' + encodeURIComponent(id),
  )
  const row = result?.appointment
  if (
    !validBooking(row) ||
    row.id.toLowerCase() !== id.toLowerCase() ||
    !(
      row.price === null ||
      (typeof row.price === 'number' && Number.isFinite(row.price) && row.price >= 0)
    ) ||
    !(row.managePath === null || typeof row.managePath === 'string')
  )
    throw invalidResponse()
  return result
}
export function myAppointmentError(error: unknown) {
  if (error instanceof ApiError && error.status === 404)
    return 'No encontramos el turno o este servidor todavía no tiene habilitada la consulta. Volvé a cargar tus turnos.'
  return error instanceof Error
    ? error.message
    : 'No se pudieron cargar tus turnos. Intentá de nuevo.'
}

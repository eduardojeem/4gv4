import type { CustomerBookingStatus } from '../../../src/lib/agenda/customer-booking-contract'
const labels: Record<CustomerBookingStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmado',
  completed: 'Atendido',
  cancelled: 'Cancelado',
  no_show: 'No asististe',
}
export const appointmentStatusLabel = (status: CustomerBookingStatus) =>
  labels[status] ?? 'Estado no disponible'
export function appointmentManagementPath(value: string | null | undefined) {
  return value &&
    /^\/turno\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}
export function formatAppointmentWhen(value: string, timeZone: string) {
  try {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'Fecha no disponible'
    return new Intl.DateTimeFormat('es-PY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(date)
  } catch {
    return 'Fecha no disponible'
  }
}
export function formatAppointmentPrice(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(value)) return 'Consultá el precio con la tienda'
  if (value === 0) return 'Sin cargo'
  try {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'PYG' ? 0 : 2,
    }).format(value)
  } catch {
    return value.toLocaleString('es-PY') + ' ' + currency
  }
}

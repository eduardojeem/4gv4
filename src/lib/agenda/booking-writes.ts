import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type BookingQuote = {
  id: string; organization_id: string; professional_id: string | null
  starts_at: string; ends_at: string; expires_at: string
  price: number; hide_price: boolean; duration_minutes: number
}
export function publicQuoteSummary(quote: BookingQuote, professionalName: string | null) {
  return { quoteId: quote.id, expiresAt: quote.expires_at, startsAt: quote.starts_at,
    endsAt: quote.ends_at, professionalId: quote.professional_id, professionalName,
    duration: quote.duration_minutes, price: quote.hide_price ? null : Number(quote.price) }
}
export const quoteInputSchema = z.object({ service_id: z.string().uuid(), professional_id: z.string().uuid().nullable().optional(), starts_at: z.string().datetime({ offset: true }) })
export const quoteReservationSchema = z.object({
  quote_id: z.string().uuid(), idempotency_key: z.string().uuid(),
  name: z.string().trim().min(2).max(120), phone: z.string().trim().min(6).max(40),
  notes: z.string().trim().max(500).nullable().optional(), website: z.string().max(0).optional(),
})
export const BOOKING_ERRORS: Record<string, string> = {
  QUOTE_EXPIRED: 'La cotización venció. Revisá el horario y confirmá nuevamente.',
  QUOTE_CHANGED: 'Cambió la disponibilidad o la tarifa. Revisá una nueva cotización.',
  QUOTE_UNAVAILABLE: 'La cotización ya no está disponible. Solicitá una nueva.',
  SERVICE_UNAVAILABLE: 'Este servicio ya no está disponible.',
  NEW_TERMS_ACCEPTANCE_REQUIRED: 'Cambiaste el servicio o el profesional. Aceptá la nueva tarifa y duración para guardar.',
  ACCEPTED_TERMS_CHANGED: 'La tarifa o duración cambió mientras editabas. Cerrá el diálogo, actualizá la agenda y revisá las nuevas condiciones.',
  ACTOR_NOT_AUTHORIZED: 'No tenés permiso para realizar este cambio.',
  APPOINTMENT_OVERLAP: 'Ese horario ya está ocupado. Elegí otro.',
  TIME_OFF_CONFLICT: 'El horario coincide con una pausa o ausencia. Revisá los turnos afectados.',
  IDEMPOTENCY_CONFLICT: 'Este intento ya se usó con otros datos. Revisá tu reserva antes de repetirla.',
  PROFESSIONAL_REQUIRED: 'Elegí con quién querés atenderte.',
  PROFESSIONAL_SELECTION_DISABLED: 'Esta tienda asigna el profesional automáticamente.',
  NO_ELIGIBLE_PROFESSIONAL: 'No hay profesionales disponibles para este servicio.',
  SLOT_UNAVAILABLE: 'Ese horario no está disponible.',
  APPOINTMENT_ALREADY_PAID: 'El turno ya está cobrado; no se puede cambiar el importe acordado.',
  APPOINTMENT_NOT_CHANGEABLE: 'Este turno ya no se puede cambiar.',
}
export function bookingWriteError(error: { message?: string; code?: string } | null) {
  const code = Object.keys(BOOKING_ERRORS).find(key => error?.message?.includes(key))
  const missing = ['PGRST202','42883','42P01','42703'].includes(error?.code ?? '')
  return { error: code ? BOOKING_ERRORS[code] : missing ? 'Falta aplicar la migración de reservas por profesional.' : 'No se pudo guardar. Revisá los datos e intentá nuevamente.', code: code ?? (missing ? 'BOOKING_MIGRATION_REQUIRED' : 'BOOKING_WRITE_FAILED'), status: missing ? 503 : 409 }
}
export async function reserveQuote(client: SupabaseClient, organizationId: string, input: z.infer<typeof quoteReservationSchema>) {
  const scoped = await client.from('agenda_booking_quotes').select('id').eq('id', input.quote_id).eq('organization_id', organizationId).maybeSingle()
  if (scoped.error || !scoped.data) return { data: null, error: scoped.error ?? { message: 'QUOTE_CHANGED' } }
  return client.rpc('reserve_agenda_quote', { p_quote_id: input.quote_id, p_idempotency_key: input.idempotency_key,
    p_customer: { name: input.name, phone: input.phone, notes: input.notes ?? null } })
}

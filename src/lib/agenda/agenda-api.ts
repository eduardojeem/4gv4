import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmado',
  completed: 'Atendido',
  cancelled: 'Cancelado',
  no_show: 'No vino',
}

/** Lo que manda el panel al crear o editar un turno. */
export const appointmentInputSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().trim().min(1, 'Poné el nombre del cliente').max(160),
  customer_phone: z.string().trim().max(40).nullable().optional(),
  service_product_id: z.string().uuid().nullable().optional(),
  service_name: z.string().trim().min(1, 'Elegí o escribí el servicio').max(200),
  professional_id: z.string().uuid().nullable().optional(),
  price: z.number().min(0).max(10_000_000_000).default(0),
  starts_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().min(5).max(720),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['pending', 'confirmed']).optional(),
})

export type AppointmentInput = z.infer<typeof appointmentInputSchema>

export function appointmentRow(input: AppointmentInput) {
  const start = Date.parse(input.starts_at)
  return {
    customer_id: input.customer_id ?? null,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone || null,
    service_product_id: input.service_product_id ?? null,
    service_name: input.service_name,
    professional_id: input.professional_id ?? null,
    price: input.price,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + input.duration_minutes * 60_000).toISOString(),
    notes: input.notes || null,
  }
}

/**
 * El profesional, el cliente y el servicio tienen que ser de la empresa: los
 * ids llegan del navegador y las claves foráneas no miran la organización.
 */
export async function assertAppointmentRefs(
  client: SupabaseClient,
  organizationId: string,
  input: Pick<AppointmentInput, 'professional_id' | 'customer_id' | 'service_product_id'>,
): Promise<string | null> {
  const checks: Array<Promise<string | null>> = []
  const owned = (table: string, id: string, message: string) =>
    Promise.resolve(client.from(table).select('id').eq('id', id).eq('organization_id', organizationId).maybeSingle())
      .then(({ data }) => (data ? null : message))
  if (input.professional_id) checks.push(owned('agenda_professionals', input.professional_id, 'El profesional no es de tu empresa'))
  if (input.customer_id) checks.push(owned('customers', input.customer_id, 'El cliente no es de tu empresa'))
  if (input.service_product_id) checks.push(owned('products', input.service_product_id, 'El servicio no es de tu empresa'))
  return (await Promise.all(checks)).find(Boolean) ?? null
}

export function appointmentCode(number: number) {
  return `T-${String(number).padStart(5, '0')}`
}

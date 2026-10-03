import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { busyIntervals, loadAgendaConfig, professionalsForService } from '@/lib/agenda/agenda-server'
import { availableSlots } from '@/lib/agenda/slots'
import { addDays, dayRangeUtc, todayIn } from '@/lib/agenda/time'

/**
 * La agenda que ve un cliente desde afuera (reserva online y «Mi turno»).
 * Solo si la tienda es pública, tiene el módulo de servicios y acepta
 * reservas online.
 */
export async function resolvePublicAgenda(slug: string) {
  const admin = createAdminSupabase() as unknown as SupabaseClient
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) return null
  const config = await loadAgendaConfig(admin, organization.id, { onlyActive: true })
  if (!config?.settings.online_booking) return null
  return { admin, organization, config }
}

export type PublicAgenda = NonNullable<Awaited<ReturnType<typeof resolvePublicAgenda>>>

/**
 * Horarios libres de un día para un servicio. `excludeAppointmentId` es el
 * turno que se está moviendo: su horario actual no cuenta como ocupado.
 */
export async function publicSlotsFor(
  agenda: PublicAgenda,
  date: string,
  serviceId: string,
  professionalId: string | null,
  excludeAppointmentId?: string,
) {
  const { admin, organization, config } = agenda
  const service = config.services.find((item) => item.product_id === serviceId && item.online)
  if (!service) return null
  const today = todayIn(config.timeZone)
  if (date < today || date > addDays(today, config.settings.max_days_ahead)) return { service, slots: [] }
  // Solo quien hace el servicio. Sin profesionales cargados, la agenda es una sola.
  const eligible = professionalsForService(config.professionals, serviceId)
  if (config.professionals.length > 0 && eligible.length === 0) return { service, slots: [] }
  const professionalIds = professionalId
    ? eligible.filter((professional) => professional.id === professionalId).map((professional) => professional.id)
    : eligible.map((professional) => professional.id)
  if (professionalId && professionalIds.length === 0) return null
  const range = dayRangeUtc(date, config.timeZone)
  const busy = await busyIntervals(admin, organization.id, range.start, range.end, excludeAppointmentId)
  return {
    service,
    slots: availableSlots({
      date,
      timeZone: config.timeZone,
      openingHours: config.settings.opening_hours,
      slotMinutes: config.settings.slot_minutes,
      durationMinutes: service.duration_minutes,
      busy,
      professionalIds,
      now: Date.now(),
      minNoticeMinutes: config.settings.min_notice_minutes,
    }),
  }
}

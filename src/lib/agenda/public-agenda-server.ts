import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { busyIntervals, loadAgendaConfig, professionalsForService } from '@/lib/agenda/agenda-server'
import { availableSlots, type Slot } from '@/lib/agenda/slots'
import { quotedSlotsFor } from '@/lib/agenda/availability'
import { resolveServiceTerms, type ServiceTerms } from '@/lib/agenda/service-terms'
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
  snapshot?: ServiceTerms,
) {
  const { admin, organization, config } = agenda
  const service = config.services.find((item) => item.product_id === serviceId && item.online)
  if (!service) return null
  const today = todayIn(config.timeZone)
  if (date < today || date > addDays(today, config.settings.max_days_ahead)) return { service, slots: [] }
  if (config.capabilities?.professionalBooking) {
    const eligible = professionalsForService(config.professionals, serviceId)
      .filter(p => p.is_active && p.online_visible !== false && (!professionalId || p.id === professionalId))
      .sort((a,b) => a.sort_order-b.sort_order || a.id.localeCompare(b.id))
    const resources = eligible.map(p => {
      const rate = config.professionalRates.find(r => r.professional_id === p.id && r.product_id === serviceId)
      return { id: p.id as string | null, openingHours: p.opening_hours ?? null, online: true,
        terms: snapshot ?? resolveServiceTerms({ price: service.price, durationMinutes: service.duration_minutes, bufferMinutes: service.buffer_minutes ?? 0 },
          rate ? { price: rate.price, durationMinutes: rate.duration_minutes, bufferMinutes: rate.buffer_minutes } : null) }
    })
    if (!professionalId && config.professionalCount === 0 && config.settings.professional_selection !== 'required') {
      resources.push({ id: null, openingHours: null, online: true, terms: snapshot ?? {
        price: service.price, durationMinutes: service.duration_minutes, bufferMinutes: service.buffer_minutes ?? 0,
      } })
    }
    if (professionalId && !resources.length) return null
    const range = dayRangeUtc(date, config.timeZone)
    const busy = await busyIntervals(admin, organization.id, range.start, range.end, excludeAppointmentId, true)
    const quotedSlots = quotedSlotsFor({ date, timeZone: config.timeZone, openingHours: config.settings.opening_hours,
      slotMinutes: config.settings.slot_minutes, now: Date.now(), minNoticeMinutes: config.settings.min_notice_minutes,
      professionals: resources, busy })
    const byStart = new Map<string, Slot>()
    for (const quote of quotedSlots) {
      const existing = byStart.get(quote.startsAt)
      if (existing) existing.professionalIds.push(quote.professionalId)
      else byStart.set(quote.startsAt, { startsAt: quote.startsAt, endsAt: quote.endsAt, professionalIds: [quote.professionalId] })
    }
    return { service, slots: [...byStart.values()], quotedSlots }
  }
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
      durationMinutes: snapshot?.durationMinutes ?? service.duration_minutes,
      busy,
      professionalIds,
      now: Date.now(),
      minNoticeMinutes: config.settings.min_notice_minutes,
    }),
  }
}

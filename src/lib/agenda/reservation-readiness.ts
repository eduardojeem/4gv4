import type { AgendaProfessional, AgendaService, AgendaSettings } from './agenda-server'
import { professionalDoesService } from './agenda-server'

const hasHours = (hours: AgendaSettings['opening_hours']) => Object.values(hours).some(periods => periods.length > 0)

/** Configuration prerequisites, not a promise that a future slot is free. */
export function reservationReadiness({ settings, services, professionals, professionalCount = professionals.length, storefrontPublic }: {
  settings: AgendaSettings
  services: AgendaService[]
  professionals: AgendaProfessional[]
  professionalCount?: number
  storefrontPublic: boolean
}) {
  const online = services.filter(service => service.online)
  const singleStoreAgenda = Math.max(professionalCount, professionals.length) === 0 && settings.professional_selection !== 'required'
  const eligible = professionals.filter(pro => pro.is_active && pro.online_visible !== false && (pro.opening_hours == null || hasHours(pro.opening_hours)))
  const uncovered = online.filter(service => !singleStoreAgenda && !eligible.some(pro => professionalDoesService(pro, service.product_id))).map(service => service.name)
  const checks = [
    { label: 'Tienda publicada', ok: storefrontPublic },
    { label: 'Servicios visibles y reservables', ok: online.length > 0 },
    { label: 'Horario de atención configurado', ok: hasHours(settings.opening_hours) },
    { label: 'Personal disponible para los servicios', ok: (singleStoreAgenda || eligible.length > 0) && uncovered.length === 0 },
  ]
  return { ready: settings.online_booking && checks.every(check => check.ok), checks, uncovered }
}

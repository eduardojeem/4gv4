import type { CompanyInfo, Service } from '@/types/website-settings'

export function getActivePublicServices(
  services: Service[] | null | undefined
): Service[] {
  return Array.isArray(services)
    ? services.filter((service) => service.active !== false)
    : []
}

export function isPublicServicesPageAvailable(
  servicesPageEnabled: boolean | undefined,
  services: Service[] | null | undefined
): boolean {
  if (servicesPageEnabled === false) return false
  const activeServices = getActivePublicServices(services)
  return activeServices.length > 0
}

export function isPublicRepairsAvailable(
  companyInfo?: CompanyInfo | null,
  services?: Service[] | null | undefined
): boolean {
  if (!companyInfo) return false
  if (companyInfo.repairTrackingEnabled === false) return false
  if (companyInfo.repairTrackingEnabled === true) return true

  // Si tiene servicios activos relacionados con reparación o taller técnico
  const activeServices = getActivePublicServices(services)
  const hasRepairServices = activeServices.some((s) => {
    const title = (s.title || '').toLowerCase()
    const desc = (s.description || '').toLowerCase()
    return (
      title.includes('reparaci') ||
      title.includes('tecnic') ||
      title.includes('taller') ||
      title.includes('mantenimiento') ||
      desc.includes('reparaci') ||
      desc.includes('tecnic')
    )
  })

  return hasRepairServices
}

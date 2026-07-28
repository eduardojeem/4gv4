import type { Service } from '@/types/website-settings'

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
  return (
    servicesPageEnabled !== false &&
    getActivePublicServices(services).length > 0
  )
}

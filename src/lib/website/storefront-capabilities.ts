import type {
  BusinessVertical,
  OperatingModel,
  OrganizationModule,
} from '@/lib/organization/business-profile'
import type { CompanyInfo, Service } from '@/types/website-settings'
import {
  isPublicRepairsAvailable,
  isPublicServicesPageAvailable,
} from '@/lib/website/services'

export type HeroPresetId = 'tech' | 'fashion' | 'cosmetics' | 'services' | 'repairs' | 'electro' | 'general'
export type StorefrontPrimaryAction = {
  kind: 'products' | 'services'
  href: '/productos' | '/servicios'
}
export type StorefrontTracking = {
  kind: 'repairs' | 'orders' | 'none'
  href: '/mis-reparaciones' | '/track' | null
}
export type PublishedHeroAction =
  | StorefrontPrimaryAction
  | { kind: 'contact'; href: null }

export interface StorefrontCapabilities {
  businessVertical: BusinessVertical
  operatingModel: OperatingModel
  businessLabel: string
  hasCatalog: boolean
  hasServices: boolean
  hasRepairs: boolean
  hasOrderTracking: boolean
  primaryAction: StorefrontPrimaryAction
  tracking: StorefrontTracking
  metricLabels: [string, string, string]
}

const BUSINESS_LABELS: Record<BusinessVertical, string> = {
  general: 'Comercio general',
  clothing: 'Moda e indumentaria',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Tecnología y electrónica',
  food: 'Alimentos y gastronomía',
  hardware: 'Ferretería y herramientas',
  other: 'Otro rubro',
}

export function resolveStorefrontCapabilities(input: {
  businessVertical: BusinessVertical
  operatingModel: OperatingModel
  effectiveModules: readonly OrganizationModule[]
}): StorefrontCapabilities {
  const modules = new Set(input.effectiveModules)
  const hasCatalog = ['inventory', 'ecommerce', 'orders'].some((module) => modules.has(module as OrganizationModule))
  const hasServices = modules.has('services')
  const hasRepairs = modules.has('repairs')
  const hasOrderTracking = modules.has('orders') || modules.has('delivery')
  const serviceFirst = hasServices && !modules.has('ecommerce') && (
    input.operatingModel === 'service' || input.operatingModel === 'repair'
  )

  const metricLabels: [string, string, string] = hasRepairs
    ? ['Reparaciones', 'Satisfacción', 'Tiempo prom.']
    : hasServices && input.operatingModel === 'service'
      ? ['Servicios', 'Satisfacción', 'Respuesta']
      : ['Clientes', 'Valoración', 'Entrega']

  return {
    businessVertical: input.businessVertical,
    operatingModel: input.operatingModel,
    businessLabel: BUSINESS_LABELS[input.businessVertical],
    hasCatalog,
    hasServices,
    hasRepairs,
    hasOrderTracking,
    primaryAction: serviceFirst
      ? { kind: 'services', href: '/servicios' }
      : { kind: 'products', href: '/productos' },
    tracking: hasRepairs
      ? { kind: 'repairs', href: '/mis-reparaciones' }
      : hasOrderTracking
        ? { kind: 'orders', href: '/track' }
        : { kind: 'none', href: null },
    metricLabels,
  }
}

export function getCompatibleHeroPresetIds(capabilities: StorefrontCapabilities): HeroPresetId[] {
  if (capabilities.hasRepairs) {
    return ['repairs', 'tech', 'services', 'general']
  }
  if (capabilities.operatingModel === 'service' && capabilities.hasServices) {
    return ['services', 'general']
  }

  const verticalPreset: Partial<Record<BusinessVertical, HeroPresetId>> = {
    clothing: 'fashion',
    cosmetics: 'cosmetics',
    electronics: 'tech',
    hardware: 'electro',
  }
  const preset = verticalPreset[capabilities.businessVertical]
  return preset ? [preset, 'general'] : ['general']
}

export function canPublishServices(
  capabilities: StorefrontCapabilities,
  servicesPageEnabled: boolean | undefined,
  services: Array<Pick<Service, 'active'>> | null | undefined,
): boolean {
  return capabilities.hasServices && isPublicServicesPageAvailable(servicesPageEnabled, services as Service[] | undefined)
}

export function canPublishRepairs(
  capabilities: StorefrontCapabilities,
  repairTrackingEnabled: boolean | undefined,
  services: Array<Partial<Pick<Service, 'active' | 'title' | 'description'>>> | null | undefined,
): boolean {
  if (!capabilities.hasRepairs) return false
  return isPublicRepairsAvailable(
    { repairTrackingEnabled } as CompanyInfo,
    services as Service[] | undefined,
  )
}

export function resolvePublishedHeroActions(
  capabilities: StorefrontCapabilities,
  visibility: { servicesVisible: boolean; repairsVisible: boolean },
): { primary: PublishedHeroAction; tracking: StorefrontTracking } {
  const primary: PublishedHeroAction =
    capabilities.primaryAction.kind === 'services'
      ? visibility.servicesVisible
        ? capabilities.primaryAction
        : capabilities.hasCatalog
          ? { kind: 'products', href: '/productos' }
          : { kind: 'contact', href: null }
      : capabilities.primaryAction

  const tracking: StorefrontTracking = visibility.repairsVisible
    ? { kind: 'repairs', href: '/mis-reparaciones' }
    : capabilities.hasOrderTracking
      ? { kind: 'orders', href: '/track' }
      : { kind: 'none', href: null }

  return { primary, tracking }
}

import { z } from 'zod'

export const BUSINESS_VERTICALS = [
  'general',
  'clothing',
  'cosmetics',
  'electronics',
  'food',
  'hardware',
  'other',
] as const

export const OPERATING_MODELS = ['retail', 'wholesale', 'service', 'repair', 'mixed'] as const

export const ORGANIZATION_MODULES = [
  'inventory',
  'inventory_admin',
  'pos',
  'crm',
  'orders',
  'ecommerce',
  'repairs',
  'services',
  'credits',
  'delivery',
  'analytics',
  'promotions',
  'security',
] as const

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number]
export type OperatingModel = (typeof OPERATING_MODELS)[number]
export type OrganizationModule = (typeof ORGANIZATION_MODULES)[number]
export type ModulePlanAvailability = {
  name: string
  isActive: boolean
}

export const BusinessProfileInputSchema = z.object({
  businessVertical: z.enum(BUSINESS_VERTICALS),
  operatingModel: z.enum(OPERATING_MODELS),
  enabledModules: z.array(z.enum(ORGANIZATION_MODULES)).nullable(),
})

export type OrganizationBusinessProfileInput = z.infer<typeof BusinessProfileInputSchema>

export interface OrganizationBusinessProfile extends OrganizationBusinessProfileInput {
  effectiveModules: OrganizationModule[]
}

const RETAIL_MODULES: OrganizationModule[] = [
  'inventory', 'pos', 'crm', 'orders', 'ecommerce', 'promotions',
]

const MODULE_PRESETS: Record<OperatingModel, OrganizationModule[]> = {
  retail: RETAIL_MODULES,
  wholesale: ['inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'credits', 'analytics'],
  service: ['crm', 'services', 'pos'],
  repair: ['inventory', 'pos', 'crm', 'repairs', 'services'],
  mixed: ['inventory', 'pos', 'crm', 'orders', 'repairs', 'services'],
}

const VERTICAL_RECOMMENDATIONS: Record<BusinessVertical, OrganizationModule[]> = {
  general: [],
  clothing: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions'],
  cosmetics: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions', 'credits'],
  electronics: ['inventory', 'pos', 'crm', 'repairs', 'services', 'orders', 'delivery', 'credits'],
  food: ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'delivery', 'promotions'],
  hardware: ['inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'delivery', 'credits', 'analytics'],
  other: [],
}

export function getSuggestedModules(
  vertical: BusinessVertical,
  operatingModel: OperatingModel,
): OrganizationModule[] {
  return Array.from(new Set([
    ...MODULE_PRESETS[operatingModel],
    ...VERTICAL_RECOMMENDATIONS[vertical],
  ]))
}

type LegacyProfileInput = {
  businessVertical?: unknown
  operatingModel?: unknown
  enabledModules?: unknown
  legacyBusinessType?: unknown
}

export function normalizeBusinessProfile(input: LegacyProfileInput): OrganizationBusinessProfileInput {
  const legacy = typeof input.legacyBusinessType === 'string'
    ? input.legacyBusinessType.trim().toLowerCase()
    : ''

  const inferredVertical: BusinessVertical = legacy === 'repair' ? 'electronics' : 'general'
  const inferredModel: OperatingModel = OPERATING_MODELS.includes(legacy as OperatingModel)
    ? legacy as OperatingModel
    : 'retail'

  const candidate = {
    businessVertical: input.businessVertical ?? inferredVertical,
    operatingModel: input.operatingModel ?? inferredModel,
    enabledModules: input.enabledModules ?? null,
  }
  const parsed = BusinessProfileInputSchema.safeParse(candidate)

  return parsed.success
    ? parsed.data
    : { businessVertical: inferredVertical, operatingModel: inferredModel, enabledModules: null }
}

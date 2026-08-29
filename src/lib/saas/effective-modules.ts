import {
  ORGANIZATION_MODULES,
  normalizeBusinessProfile,
  type OrganizationBusinessProfile,
  type OrganizationModule,
} from '@/lib/organization/business-profile'

export type ModuleAvailability = 'available' | 'disabled_by_org' | 'not_in_plan'

export type EffectiveModuleInput = {
  entitledModules: readonly string[]
  trialModules: readonly string[]
  enabledModules: readonly string[] | null
}

const supportedModules = new Set<string>(ORGANIZATION_MODULES)

function uniqueSupported(values: readonly string[]): OrganizationModule[] {
  return Array.from(new Set(values.filter((value): value is OrganizationModule => supportedModules.has(value))))
}

export function resolveEffectiveModules(input: EffectiveModuleInput): OrganizationModule[] {
  const entitled = uniqueSupported([...input.entitledModules, ...input.trialModules])
  if (input.enabledModules === null) return entitled

  const enabled = new Set(uniqueSupported(input.enabledModules))
  return entitled.filter(module => enabled.has(module))
}

export function getModuleAvailability(
  module: string,
  input: EffectiveModuleInput,
): ModuleAvailability {
  const entitled = new Set(uniqueSupported([...input.entitledModules, ...input.trialModules]))
  if (!entitled.has(module as OrganizationModule)) return 'not_in_plan'
  if (input.enabledModules !== null && !uniqueSupported(input.enabledModules).includes(module as OrganizationModule)) {
    return 'disabled_by_org'
  }
  return 'available'
}

export function buildOrganizationBusinessProfile(input: {
  persisted: Parameters<typeof normalizeBusinessProfile>[0]
  entitledModules: readonly string[]
  trialModules: readonly string[]
}): OrganizationBusinessProfile {
  const normalized = normalizeBusinessProfile(input.persisted)
  return {
    ...normalized,
    effectiveModules: resolveEffectiveModules({
      entitledModules: input.entitledModules,
      trialModules: input.trialModules,
      enabledModules: normalized.enabledModules,
    }),
  }
}

export function validateEnabledModules(
  enabledModules: readonly string[],
  entitledModules: readonly string[],
  trialModules: readonly string[],
): { valid: boolean; unavailableModules: OrganizationModule[] } {
  const available = new Set(uniqueSupported([...entitledModules, ...trialModules]))
  const unavailableModules = uniqueSupported(enabledModules).filter(module => !available.has(module))
  return { valid: unavailableModules.length === 0, unavailableModules }
}

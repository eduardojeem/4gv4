import {
  getRegionalDefaults,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeLocaleCode,
  normalizeTimeZone,
} from '../regional/contract'
import {
  BUSINESS_VERTICALS,
  defaultOperatingModelFor,
  getSuggestedModules,
  type BusinessVertical,
  type OrganizationModule,
} from '../organization/business-profile'

export type OnboardingStepKey = 'plan' | 'business' | 'branch' | 'modules' | 'ready'

export type SharedOnboardingData = {
  plan: string | null
  businessName: string
  countryCode: string | null
  businessCategory: BusinessVertical | null
  currency: string | null
  timezone: string | null
  locale: string | null
  regionalConfirmed: boolean
  primaryBranch: { id: string | null; name: string; city: string; address: string; phone: string; hours: string }
  selectedModules: string[] | null
}

export type SharedOnboardingState = {
  version: 1
  currentStep: 1 | 2 | 3 | 4 | 5
  completedSteps: OnboardingStepKey[]
  completed: boolean
  completedAt: string | null
  data: SharedOnboardingData
}

export type OnboardingChecklistInput = {
  countryCode: string | null | undefined
  businessName: string | null | undefined
  branchExists: boolean
  logoExists: boolean
  productsCount: number
  memberCount: number
  paymentConfigured: boolean
  billingConfigured: boolean
  storefrontConfigured: boolean
  marketplaceConfigured: boolean
}

/** Preferencias del inicio. Solo las que tienen entitlement pueden activar módulos técnicos. */
export const ONBOARDING_MODULE_PREFERENCES = [
  { key: 'pos', label: 'Ventas / POS', entitlement: 'pos', module: 'pos' },
  { key: 'inventory', label: 'Inventario', entitlement: 'inventory', module: 'inventory' },
  { key: 'repairs', label: 'Reparaciones', entitlement: 'repairs', module: 'repairs' },
  { key: 'suppliers', label: 'Proveedores', entitlement: 'inventory_admin', module: 'inventory_admin' },
  { key: 'credits', label: 'Créditos', entitlement: 'credits', module: 'credits' },
  { key: 'marketplace', label: 'Marketplace', entitlement: 'ecommerce', module: 'ecommerce' },
  // These are saved as intent only. They never grant plan capabilities.
  { key: 'billing', label: 'Facturación', entitlement: null, module: null },
  { key: 'employees', label: 'Empleados', entitlement: null, module: null },
] as const

const preferenceByKey = new Map<string, (typeof ONBOARDING_MODULE_PREFERENCES)[number]>(ONBOARDING_MODULE_PREFERENCES.map((preference) => [preference.key, preference]))

export function createInitialOnboardingState(input: {
  plan: string | null
  businessName: string
  businessCategory?: BusinessVertical | null
}): SharedOnboardingState {
  return {
    version: 1,
    currentStep: input.plan ? 2 : 1,
    completedSteps: input.plan ? ['plan'] : [],
    completed: false,
    completedAt: null,
    data: {
      plan: input.plan,
      businessName: input.businessName.trim(),
      countryCode: null,
      businessCategory: input.businessCategory ?? null,
      currency: null,
      timezone: null,
      locale: null,
      regionalConfirmed: false,
      primaryBranch: { id: null, name: '', city: '', address: '', phone: '', hours: '' },
      selectedModules: null,
    },
  }
}

function isVertical(value: unknown): value is BusinessVertical {
  return typeof value === 'string' && (BUSINESS_VERTICALS as readonly string[]).includes(value)
}

function normalizeStep(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed as 1 | 2 | 3 | 4 | 5 : 1
}

export function normalizeOnboardingState(raw: unknown): SharedOnboardingState {
  const state = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const data = state.data && typeof state.data === 'object' && !Array.isArray(state.data) ? state.data as Record<string, unknown> : {}
  const branch = data.primaryBranch && typeof data.primaryBranch === 'object' && !Array.isArray(data.primaryBranch)
    ? data.primaryBranch as Record<string, unknown>
    : {}
  const completedSteps = Array.isArray(state.completedSteps)
    ? [...new Set(state.completedSteps.filter((step): step is OnboardingStepKey => ['plan', 'business', 'branch', 'modules', 'ready'].includes(String(step))))]
    : []
  const countryCode = normalizeCountryCode(data.countryCode)
  return {
    version: 1,
    currentStep: normalizeStep(state.currentStep),
    completedSteps,
    completed: state.completed === true,
    completedAt: typeof state.completedAt === 'string' ? state.completedAt : null,
    data: {
      plan: typeof data.plan === 'string' && data.plan ? data.plan : null,
      businessName: typeof data.businessName === 'string' ? data.businessName : '',
      countryCode,
      businessCategory: isVertical(data.businessCategory) ? data.businessCategory : null,
      currency: normalizeCurrencyCode(data.currency),
      timezone: normalizeTimeZone(data.timezone),
      locale: normalizeLocaleCode(data.locale),
      regionalConfirmed: data.regionalConfirmed === true,
      primaryBranch: {
        id: typeof branch.id === 'string' ? branch.id : null,
        name: typeof branch.name === 'string' ? branch.name : '',
        city: typeof branch.city === 'string' ? branch.city : '',
        address: typeof branch.address === 'string' ? branch.address : '',
        phone: typeof branch.phone === 'string' ? branch.phone : '',
        hours: typeof branch.hours === 'string' ? branch.hours : '',
      },
      selectedModules: Array.isArray(data.selectedModules)
        ? [...new Set(data.selectedModules.filter((module): module is string => typeof module === 'string' && preferenceByKey.has(module)))]
        : null,
    },
  }
}

export function mergeCanonicalOnboardingData(state: SharedOnboardingState, current: {
  plan?: string | null
  businessName?: string | null
  countryCode?: string | null
  currency?: string | null
  timezone?: string | null
  locale?: string | null
  businessCategory?: string | null
  branch?: { id: string; name: string; city: string | null; address: string | null; phone: string | null } | null
}): SharedOnboardingState {
  return normalizeOnboardingState({
    ...state,
    data: {
      ...state.data,
      plan: state.data.plan ?? current.plan ?? null,
      businessName: state.data.businessName || current.businessName || '',
      countryCode: state.data.countryCode ?? current.countryCode ?? null,
      currency: state.data.currency ?? current.currency ?? null,
      timezone: state.data.timezone ?? current.timezone ?? null,
      locale: state.data.locale ?? current.locale ?? null,
      businessCategory: state.data.businessCategory ?? current.businessCategory ?? null,
      primaryBranch: {
        ...state.data.primaryBranch,
        id: state.data.primaryBranch.id ?? current.branch?.id ?? null,
        name: state.data.primaryBranch.name || current.branch?.name || '',
        city: state.data.primaryBranch.city || current.branch?.city || '',
        address: state.data.primaryBranch.address || current.branch?.address || '',
        phone: state.data.primaryBranch.phone || current.branch?.phone || '',
      },
    },
  })
}

export function getRegionalSelection(countryCode: string) {
  const country = normalizeCountryCode(countryCode)
  return country ? getRegionalDefaults(country) : null
}

export function validateBusinessStep(input: {
  businessName?: string | null
  countryCode?: string | null
  businessCategory?: string | null
  currency?: string | null
  timezone?: string | null
  locale?: string | null
  regionalConfirmed?: boolean
}): { valid: boolean; fields: string[] } {
  const fields: string[] = []
  const country = normalizeCountryCode(input.countryCode)
  if ((input.businessName?.trim().length ?? 0) < 2) fields.push('businessName')
  if (!country) fields.push('countryCode')
  if (!isVertical(input.businessCategory)) fields.push('businessCategory')
  const defaults = country ? getRegionalDefaults(country) : null
  if (!normalizeCurrencyCode(input.currency) || !defaults) fields.push('currency')
  if (!normalizeLocaleCode(input.locale) || !defaults) fields.push('locale')
  if (!normalizeTimeZone(input.timezone)) fields.push('timezone')
  if (input.regionalConfirmed !== true) fields.push('regionalConfirmed')
  return { valid: fields.length === 0, fields }
}

export function validateBranchStep(input: { name?: string; city?: string }) {
  const fields: string[] = []
  if ((input.name?.trim().length ?? 0) < 2) fields.push('branchName')
  if ((input.city?.trim().length ?? 0) < 2) fields.push('city')
  return { valid: fields.length === 0, fields }
}

export function visibleEntitledModules(selected: readonly string[], entitled: readonly string[]): OrganizationModule[] {
  const allowed = new Set(entitled)
  return [...new Set(selected.flatMap((key) => {
    const preference = preferenceByKey.get(key)
    return preference?.module && preference.entitlement && allowed.has(preference.entitlement)
      ? [preference.module as OrganizationModule]
      : []
  }))]
}

export function filterOnboardingPreferences(selected: readonly string[], entitled: readonly string[]): string[] {
  const allowed = new Set(entitled)
  return [...new Set(selected.filter((key) => {
    const preference = preferenceByKey.get(key)
    return Boolean(preference && (!preference.entitlement || allowed.has(preference.entitlement)))
  }))]
}

export function suggestOnboardingPreferences(businessCategory: BusinessVertical | null, entitled: readonly string[]): string[] {
  if (!businessCategory) return []
  const suggestedModules = new Set(getSuggestedModules(businessCategory, defaultOperatingModelFor(businessCategory)))
  const allowed = new Set(entitled)
  return ONBOARDING_MODULE_PREFERENCES
    .filter((preference) => preference.module && suggestedModules.has(preference.module as OrganizationModule) && preference.entitlement && allowed.has(preference.entitlement))
    .map((preference) => preference.key)
}

export function getFirstIncompleteStep(state: SharedOnboardingState): 1 | 2 | 3 | 4 | 5 | null {
  if (state.completed) return null
  if (!state.data.plan) return 1
  if (!state.completedSteps.includes('business') || !validateBusinessStep(state.data).valid) return 2
  if (!state.completedSteps.includes('branch') || !validateBranchStep({ name: state.data.primaryBranch.name, city: state.data.primaryBranch.city }).valid) return 3
  if (!state.completedSteps.includes('modules') || state.data.selectedModules === null) return 4
  return 5
}

export function mergeOnboardingProgress(modules: unknown, state: SharedOnboardingState, currentStep: number): Record<string, unknown> {
  const source = modules && typeof modules === 'object' && !Array.isArray(modules) ? modules as Record<string, unknown> : {}
  const previous = source.onboarding && typeof source.onboarding === 'object' && !Array.isArray(source.onboarding)
    ? source.onboarding as Record<string, unknown>
    : {}
  const next = normalizeOnboardingState({ ...state, currentStep })
  return { ...source, onboarding: { ...previous, shared: next, status: next.completed ? 'completed' : 'in_progress' } }
}

export function deriveOnboardingChecklist(input: OnboardingChecklistInput) {
  const items = [
    { key: 'country', label: 'Confirmar país del negocio', done: Boolean(normalizeCountryCode(input.countryCode)), required: false, href: '/admin/settings#operacion' },
    { key: 'company', label: 'Completar datos del negocio', done: Boolean(input.businessName?.trim()), required: false, href: '/admin/settings/company' },
    { key: 'branch', label: 'Configurar sucursal principal', done: input.branchExists, required: false, href: '/admin/branches' },
    { key: 'logo', label: 'Agregar logo', done: input.logoExists, required: false, href: '/admin/settings/company' },
    { key: 'product', label: 'Agregar primer producto', done: input.productsCount > 0, required: false, href: '/dashboard/products' },
    { key: 'team', label: 'Invitar empleado', done: input.memberCount > 1, required: false, href: '/admin/users' },
    { key: 'payments', label: 'Configurar medios de pago', done: input.paymentConfigured, required: false, href: '/admin/website?section=checkout' },
    { key: 'billing', label: 'Configurar facturación', done: input.billingConfigured, required: false, href: '/admin/settings/company' },
    { key: 'storefront', label: 'Publicar tienda online', done: input.storefrontConfigured, required: false, href: '/admin/website' },
    { key: 'marketplace', label: 'Configurar marketplace', done: input.marketplaceConfigured, required: false, href: '/admin/website' },
  ]
  const progressItems = items.filter((item) => item.key !== 'country')
  return {
    items,
    percent: progressItems.length ? Math.round(progressItems.filter((item) => item.done).length / progressItems.length * 100) : 100,
    needsCountryConfirmation: !normalizeCountryCode(input.countryCode),
    blocked: false as const,
  }
}

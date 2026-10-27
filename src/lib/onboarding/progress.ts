import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'
import { isServiceFocused } from '@/lib/onboarding/onboarding-view'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { loadOrganizationSetupChecklist } from './setup-checklist-server'

/**
 * Los pasos del onboarding («Primeros pasos»): los mismos en /admin/onboarding
 * y en la app. El cálculo vive acá para que las dos digan lo mismo.
 */
export type OnboardingStepProgress = {
  hasCompanyInfo: boolean
  hasProducts: boolean
  hasPublicStore: boolean
  hasTeam: boolean
  hasAgenda: boolean
}

export type OnboardingProgressInput = {
  displayName: string | null | undefined
  organizationName: string | null | undefined
  /** organization_settings.modules (de ahí salen los datos de contacto guardados). */
  modules: unknown
  branch: { phone?: string | null; address?: string | null; city?: string | null } | null | undefined
  companyInfo: { phone?: string | null; address?: string | null } | null | undefined
  storefrontPublic: boolean
  productsCount: number
  membersCount: number
  agendaProfessionals: number
  hasAgendaSettings: boolean
}

export function onboardingStepProgress(input: OnboardingProgressInput): OnboardingStepProgress {
  const admin = getTenantAdminSettings(input.modules)
  const companyInfo = input.companyInfo ?? {}
  return {
    hasCompanyInfo: Boolean(
      (input.displayName || input.organizationName)
      && (admin.companyPhone ?? input.branch?.phone ?? companyInfo.phone)
      && (admin.companyAddress ?? input.branch?.address ?? companyInfo.address)
      && (admin.city ?? input.branch?.city),
    ),
    hasProducts: input.productsCount > 0,
    // Una tienda nueva arranca sin publicar: el paso vale solo si está publicada.
    hasPublicStore: input.storefrontPublic === true,
    hasTeam: input.membersCount > 1,
    // La agenda cuenta como configurada si cargó profesionales o su horario.
    hasAgenda: input.agendaProfessionals > 0 || input.hasAgendaSettings,
  }
}

export type OnboardingProgress = {
  steps: OnboardingStepProgress
  completedAt: string | null
  /** La agenda es un paso solo si el plan incluye servicios. */
  servicesEnabled: boolean
  /** Barbería o servicios: el paso de productos se llama «Servicios y precios». */
  serviceFocused: boolean
  slug: string | null
  setupChecklist: Awaited<ReturnType<typeof loadOrganizationSetupChecklist>>
}

/** Lo que necesita la app para mostrar los primeros pasos del comercio. */
export async function loadOnboardingProgress(admin: SupabaseClient, organizationId: string): Promise<OnboardingProgress> {
  const count = (result: { count: number | null }) => result.count ?? 0
  const [settings, organization, branch, companyInfo, products, members, professionals, agendaSettings, planInfo, setupChecklist] = await Promise.all([
    admin.from('organization_settings').select('display_name, modules').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organizations').select('name, slug, business_vertical, operating_model, storefront_public').eq('id', organizationId).maybeSingle(),
    admin.from('branches').select('phone, address, city').eq('organization_id', organizationId).eq('is_default', true).maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', organizationId).eq('key', 'company_info').maybeSingle(),
    admin.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
    admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active'),
    admin.from('agenda_professionals').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    admin.from('agenda_settings').select('organization_id').eq('organization_id', organizationId).maybeSingle(),
    getOrganizationPlanInfo(organizationId).catch(() => null),
    loadOrganizationSetupChecklist(admin, organizationId),
  ])
  const failed = [settings, organization, branch, companyInfo, products, members].find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)

  const org = organization.data as { name?: string; slug?: string; business_vertical?: string | null; operating_model?: string | null; storefront_public?: boolean } | null
  const modules = (settings.data as { modules?: Record<string, unknown> } | null)?.modules ?? {}
  const onboarding = (modules.onboarding ?? {}) as { completed_at?: string | null }
  const companyValue = (companyInfo.data as { value?: { phone?: string; address?: string; businessType?: string } } | null)?.value ?? {}

  return {
    steps: onboardingStepProgress({
      displayName: (settings.data as { display_name?: string } | null)?.display_name,
      organizationName: org?.name,
      modules,
      branch: branch.data as OnboardingProgressInput['branch'],
      companyInfo: companyValue,
      storefrontPublic: org?.storefront_public === true,
      productsCount: count(products),
      membersCount: count(members),
      // Sin las tablas de agenda (migración sin correr) no cuentan.
      agendaProfessionals: professionals.error ? 0 : count(professionals),
      hasAgendaSettings: !agendaSettings.error && Boolean(agendaSettings.data),
    }),
    completedAt: onboarding.completed_at ?? null,
    servicesEnabled: Boolean(planInfo?.effectiveModules.includes('services')),
    serviceFocused: isServiceFocused(org?.business_vertical ?? null, org?.operating_model || companyValue.businessType || 'retail'),
    slug: org?.slug ?? null,
    setupChecklist,
  }
}

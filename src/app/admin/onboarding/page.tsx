import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from '@/components/dashboard/onboarding/OnboardingClient'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { choicesFromCheckout } from '@/lib/onboarding/checkout-choices'
import { onboardingStepProgress } from '@/lib/onboarding/progress'
import { SharedOnboardingWizard } from '@/components/dashboard/onboarding/SharedOnboardingWizard'
import { mergeCanonicalOnboardingData, normalizeOnboardingState } from '@/lib/onboarding/shared-setup'

type SettingsModules = {
  onboarding?: {
    status?: string
    completed_at?: string | null
    shared?: unknown
  }
}

export default async function DashboardOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/admin/onboarding')
  }

  const admin = createAdminSupabase()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  const organization = await getCurrentOrganizationContext(user.id)
  const role = typeof profile?.role === 'string' ? profile.role : null
  const status = typeof profile?.status === 'string' ? profile.status : null
  const isActiveUser = status !== 'inactive' && status !== 'suspended'
  const canAccessOnboarding = Boolean(
    isActiveUser
    && organization
    && (role === 'super_admin' || organization.role === 'owner' || organization.role === 'admin')
  )

  if (!canAccessOnboarding) {
    redirect('/dashboard')
  }

  if (!organization) {
    redirect('/dashboard')
  }

  const [{ data: subscription }, { data: settings }, { data: businessProfile }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('plan, status, trial_ends_at, current_period_ends_at')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('display_name, currency, timezone, country_code, locale, modules, onboarding_revision')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('business_vertical, operating_model, storefront_public')
      .eq('id', organization.id)
      .maybeSingle(),
  ])

  const [
    { data: branch },
    { data: companyInfoSetting },
    { count: productsCount },
    { count: membersCount },
    { count: salesCount },
    { count: agendaProfessionals },
    { data: agendaSettingsRow },
    planInfo,
    { data: checkoutSetting },
  ] = await Promise.all([
    admin
      .from('branches')
      .select('id, name, address, city, phone, email')
      .eq('organization_id', organization.id)
      .eq('is_default', true)
      .maybeSingle(),
    admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', organization.id)
      .eq('key', 'company_info')
      .maybeSingle(),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('status', 'active'),
    // Con ventas o productos, cambiar la moneda afecta importes que ya existen.
    admin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id),
    // La agenda cuenta como configurada si cargó profesionales o su horario.
    admin
      .from('agenda_professionals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id),
    admin
      .from('agenda_settings')
      .select('organization_id')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    getOrganizationPlanInfo(organization.id).catch(() => null),
    admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', organization.id)
      .eq('key', 'checkout')
      .maybeSingle(),
  ])

  const modules = (settings?.modules ?? {}) as SettingsModules
  if (modules.onboarding?.shared && modules.onboarding.status !== 'completed') {
    const state = mergeCanonicalOnboardingData(normalizeOnboardingState(modules.onboarding.shared), {
      plan: planInfo?.plan ?? organization.plan ?? null,
      businessName: organization.name,
      countryCode: settings?.country_code ?? null,
      currency: settings?.currency ?? null,
      timezone: settings?.timezone ?? null,
      locale: settings?.locale ?? null,
      businessCategory: businessProfile?.business_vertical ?? null,
      branch: branch ?? null,
    })
    return <SharedOnboardingWizard initialState={state} initialRevision={settings?.onboarding_revision ?? 0} planName={planInfo?.name ?? organization.plan ?? 'Free'} entitledModules={planInfo ? [...planInfo.entitledModules, ...planInfo.moduleTrials.map((trial) => trial.module)] : []} />
  }
  const adminSettings = getTenantAdminSettings(settings?.modules)
  const companyInfo = (companyInfoSetting?.value ?? {}) as {
    phone?: string
    email?: string
    address?: string
    hours?: {
      weekdays?: string
      saturday?: string
      sunday?: string
    }
    logoUrl?: string
    ruc?: string
    whatsapp?: string
    businessType?: string
    brandColor?: string
    instagram?: string
    facebook?: string
    tiktok?: string
  }

  // La tienda de una organizacion nueva arranca con `storefront_public = false`
  // y el onboarding nunca la publica. El paso se marcaba listo con la sola
  // existencia de la fila `company_info` —que crea el propio onboarding—, asi
  // que decia «Listo» y su enlace llevaba a una tienda sin publicar.
  const storefrontPublic = businessProfile?.storefront_public === true

  // El mismo cálculo que usa la app (/api/mobile/onboarding).
  const stepProgress = onboardingStepProgress({
    displayName: settings?.display_name,
    organizationName: organization.name,
    modules: settings?.modules,
    branch,
    companyInfo,
    storefrontPublic,
    productsCount: productsCount ?? 0,
    membersCount: membersCount ?? 0,
    agendaProfessionals: agendaProfessionals ?? 0,
    hasAgendaSettings: Boolean(agendaSettingsRow),
  })

  return (
    <OnboardingClient
      organization={organization}
      subscription={
        subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              trialEndsAt: subscription.trial_ends_at,
              currentPeriodEndsAt: subscription.current_period_ends_at ?? null,
            }
          : null
      }
      planName={planInfo?.name ?? null}
      entitledModules={planInfo ? [...planInfo.entitledModules, ...planInfo.moduleTrials.map((trial) => trial.module)] : null}
      servicesEnabled={Boolean(planInfo?.effectiveModules.includes('services'))}
      hasBusinessData={(productsCount ?? 0) > 0 || (salesCount ?? 0) > 0}
      completedAt={modules.onboarding?.completed_at ?? null}
      stepProgress={stepProgress}
      initialCompanyInfo={{
        displayName: settings?.display_name || organization.name,
        currency: settings?.currency || 'PYG',
        timezone: settings?.timezone || 'America/Asuncion',
        language: adminSettings.language || 'es',
        phone: adminSettings.companyPhone ?? branch?.phone ?? companyInfo.phone ?? '',
        email: adminSettings.companyEmail ?? branch?.email ?? companyInfo.email ?? '',
        address: adminSettings.companyAddress ?? branch?.address ?? companyInfo.address ?? '',
        city: adminSettings.city ?? branch?.city ?? '',
        // Vacío si la tienda no lo cargó: un horario de ejemplo precargado se
        // guardaba tal cual y la tienda mostraba horarios que no eran los suyos.
        // El campo ya tiene el ejemplo como texto de ayuda.
        weekdays: companyInfo.hours?.weekdays || '',
        saturday: companyInfo.hours?.saturday || '',
        logoUrl: organization.logoUrl || companyInfo.logoUrl || '',
        ruc: adminSettings.companyRuc ?? companyInfo.ruc ?? '',
        whatsapp: companyInfo.whatsapp || '',
        businessType: companyInfo.businessType || '',
        brandColor: typeof companyInfo.brandColor === 'string' && companyInfo.brandColor
          ? companyInfo.brandColor
          : 'blue',
        storefrontPublic,
        businessVertical: businessProfile?.business_vertical || 'general',
        serviceSpecialties: planInfo?.serviceSpecialties ?? [],
        attentionMode: planInfo?.attentionMode ?? 'local',
        appointmentMode: planInfo?.appointmentMode ?? 'booking',
        operatingModel: businessProfile?.operating_model || companyInfo.businessType || 'retail',
        instagram: companyInfo.instagram || '',
        facebook: companyInfo.facebook || '',
        tiktok: companyInfo.tiktok || '',
        // Cómo cobra y entrega hoy (o lo inicial: efectivo y retiro en el local).
        checkout: choicesFromCheckout(checkoutSetting?.value as Parameters<typeof choicesFromCheckout>[0]),
      }}
      serverIsAdmin={canAccessOnboarding}
    />
  )
}


import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from '@/components/dashboard/onboarding/OnboardingClient'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'

type SettingsModules = {
  onboarding?: {
    status?: string
    completed_at?: string | null
  }
}

export default async function DashboardOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard/onboarding')
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
      .select('plan, status, trial_ends_at')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('display_name, currency, timezone, modules')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('business_vertical, operating_model')
      .eq('id', organization.id)
      .maybeSingle(),
  ])

  const [
    { data: branch },
    { data: companyInfoSetting },
    { count: productsCount },
    { count: membersCount },
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
  ])

  const modules = (settings?.modules ?? {}) as SettingsModules
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
    instagram?: string
    facebook?: string
    tiktok?: string
  }

  const hasCompanyInfo = Boolean(
    (settings?.display_name || organization.name) &&
    (adminSettings.companyPhone ?? branch?.phone ?? companyInfo.phone) &&
    (adminSettings.companyAddress ?? branch?.address ?? companyInfo.address) &&
    (adminSettings.city ?? branch?.city)
  )

  return (
    <OnboardingClient
      organization={organization}
      subscription={
        subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              trialEndsAt: subscription.trial_ends_at,
            }
          : null
      }
      completedAt={modules.onboarding?.completed_at ?? null}
      stepProgress={{
        hasCompanyInfo,
        hasProducts: (productsCount ?? 0) > 0,
        hasPublicStore: Boolean(companyInfoSetting?.value),
        hasTeam: (membersCount ?? 0) > 1,
      }}
      initialCompanyInfo={{
        displayName: settings?.display_name || organization.name,
        currency: settings?.currency || 'PYG',
        timezone: settings?.timezone || 'America/Asuncion',
        language: adminSettings.language || 'es',
        phone: adminSettings.companyPhone ?? branch?.phone ?? companyInfo.phone ?? '',
        email: adminSettings.companyEmail ?? branch?.email ?? companyInfo.email ?? '',
        address: adminSettings.companyAddress ?? branch?.address ?? companyInfo.address ?? '',
        city: adminSettings.city ?? branch?.city ?? '',
        weekdays: companyInfo.hours?.weekdays || 'Lunes a viernes, 08:00 a 18:00',
        saturday: companyInfo.hours?.saturday || 'Sabado, 08:00 a 12:00',
        logoUrl: organization.logoUrl || companyInfo.logoUrl || '',
        ruc: adminSettings.companyRuc ?? companyInfo.ruc ?? '',
        whatsapp: companyInfo.whatsapp || '',
        businessType: companyInfo.businessType || '',
        businessVertical: businessProfile?.business_vertical || 'general',
        operatingModel: businessProfile?.operating_model || companyInfo.businessType || 'retail',
        instagram: companyInfo.instagram || '',
        facebook: companyInfo.facebook || '',
        tiktok: companyInfo.tiktok || '',
      }}
      serverIsAdmin={canAccessOnboarding}
    />
  )
}

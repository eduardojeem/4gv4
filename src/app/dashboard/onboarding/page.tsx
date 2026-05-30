import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from '@/components/dashboard/onboarding/OnboardingClient'

type MembershipRow = {
  organization_id: string
  role: string
  organizations:
    | {
        id: string
        name: string
        slug: string
        plan: string
      }
    | Array<{
        id: string
        name: string
        slug: string
        plan: string
      }>
    | null
}

type SettingsModules = {
  onboarding?: {
    status?: string
    completed_at?: string | null
  }
}

function getOrganization(row: MembershipRow) {
  return Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
}

export default async function DashboardOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard/onboarding')
  }

  const admin = createAdminSupabase()

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id, role, organizations!inner(id, name, slug, plan)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const organization = membership ? getOrganization(membership as unknown as MembershipRow) : null

  if (!organization) {
    redirect('/dashboard')
  }

  const [{ data: subscription }, { data: settings }] = await Promise.all([
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
    (branch?.phone || companyInfo.phone) &&
    (branch?.address || companyInfo.address) &&
    (branch?.city)
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
        phone: branch?.phone || companyInfo.phone || '',
        email: branch?.email || companyInfo.email || '',
        address: branch?.address || companyInfo.address || '',
        city: branch?.city || '',
        weekdays: companyInfo.hours?.weekdays || 'Lunes a viernes, 08:00 a 18:00',
        saturday: companyInfo.hours?.saturday || 'Sabado, 08:00 a 12:00',
        logoUrl: companyInfo.logoUrl || '',
        ruc: companyInfo.ruc || '',
        whatsapp: companyInfo.whatsapp || '',
        businessType: companyInfo.businessType || '',
        instagram: companyInfo.instagram || '',
        facebook: companyInfo.facebook || '',
        tiktok: companyInfo.tiktok || '',
      }}
    />
  )
}

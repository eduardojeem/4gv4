import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'

type SettingsModules = {
  onboarding?: {
    status?: string
    completed_at?: string | null
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()

  const organization = await getCurrentOrganizationContext(user.id)

  if (!organization) {
    return NextResponse.json({
      needsOnboarding: false,
      organization: null,
      reason: 'no_organization',
    })
  }

  const [{ data: settings, error: settingsError }, { data: branch, error: branchError }, { data: companyInfoSetting, error: companyInfoError }] = await Promise.all([
    admin
      .from('organization_settings')
      .select('display_name, currency, timezone, modules')
      .eq('organization_id', organization.id)
      .maybeSingle(),
    admin
      .from('branches')
      .select('address, city, phone')
      .eq('organization_id', organization.id)
      .eq('is_default', true)
      .maybeSingle(),
    admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', organization.id)
      .eq('key', 'company_info')
      .maybeSingle(),
  ])

  if (settingsError || branchError || companyInfoError) {
    logger.error('Failed to load onboarding status settings', {
      error: settingsError?.message ?? branchError?.message ?? companyInfoError?.message,
      organizationId: organization.id,
    })
    return NextResponse.json({ error: 'No se pudo cargar la configuracion.' }, { status: 500 })
  }

  const modules = (settings?.modules ?? {}) as SettingsModules
  const adminSettings = getTenantAdminSettings(settings?.modules)
  const companyInfo = (companyInfoSetting?.value ?? {}) as { phone?: string; address?: string }
  const isCompleted = modules.onboarding?.status === 'completed'
  const hasCompanyBasics = Boolean((settings?.display_name || organization.name) && settings?.currency && settings?.timezone)
  const hasContactBasics = Boolean(
    (adminSettings.companyPhone ?? branch?.phone ?? companyInfo.phone)
    && (adminSettings.companyAddress ?? branch?.address ?? companyInfo.address)
    && (adminSettings.city ?? branch?.city)
  )

  // Una vez que el admin completa explícitamente el onboarding, NO se lo fuerza
  // de vuelta. Los heurísticos de datos solo sirven para auto-saltar/mostrar el
  // onboarding en organizaciones que nunca lo completaron (evita el loop por el
  // que cada navegación reabría el onboarding y re-ejecutaba sus efectos).
  const needsOnboarding = !isCompleted && (!hasCompanyBasics || !hasContactBasics)

  return NextResponse.json({
    needsOnboarding,
    completed: isCompleted,
    hasCompanyBasics,
    hasContactBasics,
    organization,
  })
}

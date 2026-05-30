import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type MembershipRow = {
  organization_id: string
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

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('organization_id, organizations!inner(id, name, slug, plan)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    logger.error('Failed to load onboarding status organization', {
      error: membershipError.message,
      userId: user.id,
    })
    return NextResponse.json({ error: 'No se pudo cargar la empresa.' }, { status: 500 })
  }

  const organization = membership ? getOrganization(membership as unknown as MembershipRow) : null

  if (!organization) {
    return NextResponse.json({
      needsOnboarding: false,
      organization: null,
      reason: 'no_organization',
    })
  }

  const [{ data: settings, error: settingsError }, { data: branch, error: branchError }] = await Promise.all([
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
  ])

  if (settingsError || branchError) {
    logger.error('Failed to load onboarding status settings', {
      error: settingsError?.message ?? branchError?.message,
      organizationId: organization.id,
    })
    return NextResponse.json({ error: 'No se pudo cargar la configuracion.' }, { status: 500 })
  }

  const modules = (settings?.modules ?? {}) as SettingsModules
  const isCompleted = modules.onboarding?.status === 'completed'
  const hasCompanyBasics = Boolean(settings?.display_name && settings.currency && settings.timezone)
  const hasContactBasics = Boolean(branch?.phone && branch.address && branch.city)

  return NextResponse.json({
    needsOnboarding: !isCompleted || !hasCompanyBasics || !hasContactBasics,
    completed: isCompleted,
    hasCompanyBasics,
    hasContactBasics,
    organization,
  })
}

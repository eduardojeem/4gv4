import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { OrganizationRole } from './permissions'
import type { SaaSPlan } from './plans'

export interface OrganizationContext {
  id: string
  name: string
  slug: string
  plan: SaaSPlan
  logoUrl: string | null
  role: OrganizationRole
}

export async function getCurrentOrganizationContext(userId: string): Promise<OrganizationContext | null> {
  const headerStore = await headers()
  const requestedSlug = headerStore.get('x-tenant-slug')
  const activeOrganizationId = headerStore.get('x-organization-id')
  const supabase = await createClient()

  let query = supabase
    .from('organization_members')
    .select('role, organizations!inner(id, name, slug, plan, logo_url)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)

  if (requestedSlug) {
    query = query.eq('organizations.slug', requestedSlug)
  } else if (activeOrganizationId) {
    query = query.eq('organization_id', activeOrganizationId)
  }

  let { data, error } = await query.maybeSingle()

  if (error || !data) {
    const admin = createAdminSupabase()
    let fallbackQuery = admin
      .from('organization_members')
      .select('role, organizations!inner(id, name, slug, plan, logo_url)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)

    if (requestedSlug) {
      fallbackQuery = fallbackQuery.eq('organizations.slug', requestedSlug)
    } else if (activeOrganizationId) {
      fallbackQuery = fallbackQuery.eq('organization_id', activeOrganizationId)
    }

    const fallback = await fallbackQuery.maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) {
    return null
  }

  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations

  if (!organization) {
    return null
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan as SaaSPlan,
    logoUrl: organization.logo_url,
    role: data.role as OrganizationRole,
  }
}

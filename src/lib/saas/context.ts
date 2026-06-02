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

  // Build the query — if no org hint from headers, fetch the first active membership
  const buildQuery = (client: ReturnType<typeof createClient> | ReturnType<typeof createAdminSupabase>) => {
    let q = (client as ReturnType<typeof createAdminSupabase>)
      .from('organization_members')
      .select('role, organizations!inner(id, name, slug, plan, logo_url)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)

    if (requestedSlug) {
      q = q.eq('organizations.slug', requestedSlug)
    } else if (activeOrganizationId) {
      q = q.eq('organization_id', activeOrganizationId)
    }
    // No filter = first active org (correct for single-tenant users)
    return q
  }

  let { data, error } = await buildQuery(supabase).maybeSingle()

  // If auth client fails (e.g. no cookie session on API routes), retry with admin client
  if (error || !data) {
    const admin = createAdminSupabase()
    const fallback = await buildQuery(admin).maybeSingle()
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

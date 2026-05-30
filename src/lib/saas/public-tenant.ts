import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getTenantSlugFromRequest } from '@/lib/saas/tenant'

export type PublicOrganization = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
}

const FALLBACK_PUBLIC_ORG_SLUG = process.env.DEFAULT_PUBLIC_ORG_SLUG || 'default'
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/

export function toPublicOrganizationPayload(organization: PublicOrganization) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo_url: organization.logo_url,
  }
}

export async function resolvePublicOrganization(
  request: NextRequest,
  supabase: SupabaseClient = createAdminSupabase()
) {
  return resolvePublicOrganizationBySlug(getTenantSlugFromRequest(request), supabase)
}

export async function resolvePublicOrganizationBySlug(
  requestedSlug: string | null | undefined,
  supabase: SupabaseClient = createAdminSupabase()
) {
  const slug = requestedSlug || FALLBACK_PUBLIC_ORG_SLUG

  if (!SAFE_SLUG_RE.test(slug)) {
    return null
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as PublicOrganization | null) ?? null
}

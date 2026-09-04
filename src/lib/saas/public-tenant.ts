import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getTenantSlugFromRequest, normalizeDefaultPublicOrgSlug } from '@/lib/saas/tenant'

export type PublicOrganization = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  marketplace_public: boolean | null
  storefront_public: boolean
}

const FALLBACK_PUBLIC_ORG_SLUG = normalizeDefaultPublicOrgSlug(process.env.DEFAULT_PUBLIC_ORG_SLUG)
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

export function isPublicStorefrontEnabled(organization: Pick<PublicOrganization, 'storefront_public'> | null | undefined) {
  return organization?.storefront_public === true
}

export async function resolvePublicStorefrontOrganization(
  request: NextRequest,
  supabase: SupabaseClient = createAdminSupabase()
) {
  const organization = await resolvePublicOrganization(request, supabase)
  return isPublicStorefrontEnabled(organization) ? organization : null
}

export async function resolvePublicStorefrontOrganizationBySlug(
  requestedSlug: string | null | undefined,
  supabase: SupabaseClient = createAdminSupabase()
) {
  const organization = await resolvePublicOrganizationBySlug(requestedSlug, supabase)
  return isPublicStorefrontEnabled(organization) ? organization : null
}

export async function resolvePublicOrganizationBySlug(
  requestedSlug: string | null | undefined,
  supabase: SupabaseClient = createAdminSupabase()
) {
  const slug = requestedSlug || FALLBACK_PUBLIC_ORG_SLUG

  if (!slug || !SAFE_SLUG_RE.test(slug)) {
    return null
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, marketplace_public, storefront_public')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    return isPublicStorefrontEnabled(data) ? data as PublicOrganization : null
  }

  const { data: aliasRow, error: aliasError } = await supabase
    .from('organization_slug_aliases')
    .select('organization:organizations(id, name, slug, plan, logo_url, marketplace_public, storefront_public)')
    .eq('old_slug', slug)
    .maybeSingle()

  if (aliasError) {
    return null
  }

  const organization = Array.isArray(aliasRow?.organization)
    ? aliasRow?.organization[0]
    : aliasRow?.organization

  return isPublicStorefrontEnabled(organization) ? organization as PublicOrganization : null
}

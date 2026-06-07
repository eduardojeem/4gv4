import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'
import { headers } from 'next/headers'

/**
 * Fetch website settings from Supabase server-side.
 * Returns full settings with defaults applied, or null on error.
 * Intended for use in Server Components and generateMetadata.
 */
export async function fetchWebsiteSettings(): Promise<WebsiteSettings | null> {
  try {
    const headerStore = await headers()
    const tenantSlug =
      headerStore.get('x-tenant-slug') ||
      getTenantSlugFromHost(headerStore.get('host') ?? '')

    const supabase = tenantSlug ? createAdminSupabase() : await createClient()
    const organization = tenantSlug
      ? await resolvePublicOrganizationBySlug(tenantSlug, supabase)
      : null

    // A tenant slug was requested but no org matched. We're on the admin client
    // (RLS bypassed), so running an unfiltered query would leak another tenant's
    // settings. Return null instead — the caller renders safe defaults.
    if (tenantSlug && !organization) {
      return null
    }

    let query = supabase
      .from('website_settings')
      .select('key, value')

    if (organization) {
      query = query.eq('organization_id', organization.id)
    }

    const { data: rows, error } = await query

    if (error) return null

    const partial: Partial<WebsiteSettings> = {}
    rows?.forEach((row) => {
      partial[row.key as keyof WebsiteSettings] = row.value
    })

    const normalized = applyWebsiteSettingsDefaults(partial)

    // When the tenant hasn't customized its public name, fall back to the
    // organization's real name (never a hardcoded brand).
    if (organization && !normalized.company_info.name?.trim()) {
      normalized.company_info.name = organization.name
    }

    return normalized
  } catch {
    return null
  }
}

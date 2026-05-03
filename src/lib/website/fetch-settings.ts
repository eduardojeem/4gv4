import { createClient } from '@/lib/supabase/server'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

/**
 * Fetch website settings from Supabase server-side.
 * Returns full settings with defaults applied, or null on error.
 * Intended for use in Server Components and generateMetadata.
 */
export async function fetchWebsiteSettings(): Promise<WebsiteSettings | null> {
  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('website_settings')
      .select('key, value')

    if (error) return null

    const partial: Partial<WebsiteSettings> = {}
    rows?.forEach((row) => {
      partial[row.key as keyof WebsiteSettings] = row.value
    })

    return applyWebsiteSettingsDefaults(partial)
  } catch {
    return null
  }
}

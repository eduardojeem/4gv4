import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebsiteSettings } from '@/types/website-settings'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'

/**
 * GET /api/public/website/settings
 * Obtener configuraciones del sitio web (público)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: settings, error } = await supabase
      .from('website_settings')
      .select('key, value')

    if (error) {
      throw error
    }

    // Transformar array a objeto
    const settingsObj: Partial<WebsiteSettings> = {}
    settings?.forEach((setting) => {
      settingsObj[setting.key as keyof WebsiteSettings] = setting.value
    })

    const normalized = applyWebsiteSettingsDefaults(settingsObj)

    const response = NextResponse.json({
      success: true,
      data: normalized
    })
    response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60')
    return response
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch website settings' },
      { status: 500 }
    )
  }
}

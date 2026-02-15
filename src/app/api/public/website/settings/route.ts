import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebsiteSettings } from '@/types/website-settings'

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

    // Asegurar que maintenance_mode tenga valores por defecto
    if (!settingsObj.maintenance_mode) {
      settingsObj.maintenance_mode = {
        enabled: false,
        title: 'Sitio en Mantenimiento',
        message: 'Estamos realizando mejoras en nuestro sitio. Volveremos pronto.',
        estimatedEnd: ''
      }
    }

    return NextResponse.json({
      success: true,
      data: settingsObj
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch website settings' },
      { status: 500 }
    )
  }
}

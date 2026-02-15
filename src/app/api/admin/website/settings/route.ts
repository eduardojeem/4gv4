import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { WebsiteSettings } from '@/types/website-settings'

/**
 * GET /api/admin/website/settings
 * Obtener todas las configuraciones del sitio web
 */
async function handler(
  _request: NextRequest,
  context: { user: { id: string; email?: string; role: string } }
) {
  try {
    console.log('Fetching website settings', { requestedBy: context.user.id })

    const supabase = await createClient()

    const { data: settings, error } = await supabase
      .from('website_settings')
      .select('key, value')

    if (error) {
      console.error('Failed to fetch website settings', { error: error.message })
      throw error
    }

    // Transformar array a objeto
    const settingsObj: Partial<WebsiteSettings> = {}
    settings?.forEach((setting) => {
      settingsObj[setting.key as keyof WebsiteSettings] = setting.value
    })

    return NextResponse.json({
      success: true,
      data: settingsObj
    })
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error

    console.error('Website settings API error', errorDetails)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch website settings',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    )
  }
}

export const GET = withAdminAuth(handler)

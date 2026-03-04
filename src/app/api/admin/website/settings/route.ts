import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { WebsiteSettings } from '@/types/website-settings'
import { applyWebsiteSettingsDefaults, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

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

    const normalized = applyWebsiteSettingsDefaults(settingsObj)

    return NextResponse.json({
      success: true,
      data: normalized
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

/**
 * POST /api/admin/website/settings
 * Inicializa claves faltantes en website_settings sin sobrescribir existentes
 */
async function initHandler(
  _request: NextRequest,
  context: { user: { id: string; email?: string; role: string } }
) {
  try {
    const supabase = await createClient()
    const defaults = getWebsiteSettingsDefaults()
    const allKeys = Object.keys(defaults) as Array<keyof WebsiteSettings>

    const { data: existingRows, error: existingError } = await supabase
      .from('website_settings')
      .select('key')

    if (existingError) {
      throw existingError
    }

    const existingKeys = new Set((existingRows || []).map((row) => row.key))
    const missingKeys = allKeys.filter((key) => !existingKeys.has(key))

    if (missingKeys.length === 0) {
      return NextResponse.json({
        success: true,
        insertedCount: 0,
        insertedKeys: [] as string[]
      })
    }

    const rowsToInsert = missingKeys.map((key) => ({
      key,
      value: defaults[key],
      updated_by: context.user.id,
      updated_at: new Date().toISOString()
    }))

    const { error: upsertError } = await supabase
      .from('website_settings')
      .upsert(rowsToInsert, { onConflict: 'key' })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({
      success: true,
      insertedCount: missingKeys.length,
      insertedKeys: missingKeys
    })
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error

    console.error('Website settings init API error', errorDetails)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize missing website settings',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    )
  }
}

export const POST = withAdminAuth(initHandler)

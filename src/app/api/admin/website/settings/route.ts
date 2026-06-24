import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { WebsiteSettings } from '@/types/website-settings'
import { applyWebsiteSettingsDefaults, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'

/**
 * GET /api/admin/website/settings
 * Obtener todas las configuraciones del sitio web
 */
async function handler(
  _request: NextRequest,
  context: AdminAuthContext
) {
  try {
    console.log('Fetching website settings', { requestedBy: context.user.id })

    // Use admin client so RLS doesn't block reading settings that still have
    // organization_id = 'default' (common before the org backfill migration runs).
    const adminSupabase = createAdminSupabase()
    const userSupabase  = await createClient()

    // Resolve the org_id so we can filter correctly
    const orgId = await resolveWebsiteAdminOrganizationId(context)
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'No active organization found for website settings' },
        { status: 403 }
      )
    }

    // Load website_settings + org data in parallel for fallback hydration
    const settingsQuery = adminSupabase
      .from('website_settings')
      .select('organization_id, key, value')
      .eq('organization_id', orgId)

    const [
      { data: settings, error },
      { data: orgSettings },
      { data: organization },
      { data: branch },
    ] = await Promise.all([
      settingsQuery,
      userSupabase.from('organization_settings').select('display_name').maybeSingle(),
      orgId
        ? adminSupabase.from('organizations').select('name, marketplace_public, slug').eq('id', orgId).maybeSingle()
        : Promise.resolve({ data: null }),
      userSupabase.from('branches').select('phone, email, address, city').eq('is_default', true).maybeSingle(),
    ])

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

    // Hydrate company_info with real org/branch data for any fields that are still empty
    const ci = normalized.company_info
    normalized.company_info = {
      ...ci,
      name:    ci.name    || orgSettings?.display_name || organization?.name || '',
      phone:   ci.phone   || branch?.phone   || '',
      email:   ci.email   || branch?.email   || '',
      address: ci.address || branch?.address || '',
      marketplacePublic: organization?.marketplace_public !== false,
      slug: organization?.slug || ci.slug || '',
    }

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
  context: AdminAuthContext
) {
  try {
    const adminSupabase = createAdminSupabase()
    const orgId = await resolveWebsiteAdminOrganizationId(context)
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'No active organization found for website settings' },
        { status: 403 }
      )
    }

    const defaults = getWebsiteSettingsDefaults()
    const allKeys = Object.keys(defaults) as Array<keyof WebsiteSettings>

    const { data: existingRows, error: existingError } = await adminSupabase
      .from('website_settings')
      .select('key')
      .eq('organization_id', orgId)

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
      organization_id: orgId,
      key,
      value: defaults[key],
      updated_by: context.user.id,
      updated_at: new Date().toISOString()
    }))

    const { error: upsertError } = await adminSupabase
      .from('website_settings')
      .upsert(rowsToInsert, { onConflict: 'organization_id,key' })

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

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { WebsiteSettings } from '@/types/website-settings'
import { applyWebsiteSettingsDefaults, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import { sanitizeWebsiteSettings } from '@/lib/sanitization/html'
import { isWebsiteSettingKey, validateSetting } from '@/lib/validation/website-settings'

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
      { data: orgSettings, error: orgSettingsError },
      { data: organization },
      { data: branch, error: branchError },
    ] = await Promise.all([
      settingsQuery,
      userSupabase.from('organization_settings').select('display_name').eq('organization_id', orgId).maybeSingle(),
      orgId
        ? adminSupabase.from('organizations').select('name, marketplace_public, slug').eq('id', orgId).maybeSingle()
        : Promise.resolve({ data: null }),
      userSupabase.from('branches').select('phone, email, address, city').eq('organization_id', orgId).eq('is_default', true).maybeSingle(),
    ])

    if (error) {
      console.error('Failed to fetch website settings', { error: error.message })
      throw error
    }
    if (orgSettingsError || branchError) {
      throw orgSettingsError || branchError
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

async function updateHandler(
  request: NextRequest,
  context: AdminAuthContext
) {
  try {
    const body = await request.json().catch(() => null)
    const values = body?.values
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return NextResponse.json({ success: false, error: 'Configuraciones invalidas' }, { status: 400 })
    }

    const entries = Object.entries(values)
    if (entries.length === 0 || entries.length > 10) {
      return NextResponse.json({ success: false, error: 'Envia entre 1 y 10 configuraciones' }, { status: 400 })
    }

    const orgId = await resolveWebsiteAdminOrganizationId(context)
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'No se encontro una organizacion activa' }, { status: 403 })
    }

    const validatedEntries: Array<{ key: string; value: unknown }> = []
    for (const [key, rawValue] of entries) {
      if (!isWebsiteSettingKey(key) || rawValue === undefined) {
        return NextResponse.json({ success: false, error: `Configuracion no permitida: ${key}` }, { status: 400 })
      }

      const validation = validateSetting(key, sanitizeWebsiteSettings(rawValue))
      if (!validation.success) {
        return NextResponse.json({ success: false, error: validation.error, key }, { status: 400 })
      }
      validatedEntries.push({ key, value: validation.data })
    }

    const adminSupabase = createAdminSupabase()
    const now = new Date().toISOString()
    const { data: persistedRows, error: updateError } = await adminSupabase
      .from('website_settings')
      .upsert(
        validatedEntries.map(({ key, value }) => ({
          organization_id: orgId,
          key,
          value,
          updated_by: context.user.id,
          updated_at: now,
        })),
        { onConflict: 'organization_id,key' }
      )
      .select('key, value')

    if (updateError) throw updateError

    const data = Object.fromEntries((persistedRows || []).map((row) => [row.key, row.value]))
    const userSupabase = await createClient()
    await userSupabase.from('audit_log').insert({
      organization_id: orgId,
      user_id: context.user.id,
      action: 'update_website_settings_batch',
      resource: 'website_settings',
      new_values: { organization_id: orgId, keys: validatedEntries.map(({ key }) => key) },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Website settings batch update error', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudieron guardar las configuraciones' },
      { status: 500 }
    )
  }
}

export const PUT = withAdminAuth(updateHandler)

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

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { rateLimiter } from '@/lib/rate-limiter'
import {
  SystemSettingsPartialSchema,
  mapDBToSettings,
  mapSettingsToDB,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'

const RATE_LIMIT = 20
const RATE_LIMIT_WINDOW = 60 * 1000
const TENANT_SETTINGS_KEY = 'admin_settings'

const PLATFORM_ONLY_KEYS: ReadonlyArray<keyof SystemSettingsPartial> = [
  'maintenanceMode',
  'allowRegistration',
  'requireEmailVerification',
  'maxLoginAttempts',
  'passwordMinLength',
  'requireTwoFactor',
]

function withoutPlatformSettings(settings: SystemSettingsPartial): SystemSettingsPartial {
  const tenantSettings = { ...settings }
  for (const key of PLATFORM_ONLY_KEYS) {
    delete tenantSettings[key]
  }
  return tenantSettings
}

function toFrontendSettings(row: Record<string, unknown>): SystemSettingsPartial {
  return mapDBToSettings(row as Parameters<typeof mapDBToSettings>[0])
}

function toResponseRow(
  globalRow: Record<string, unknown>,
  effectiveSettings: SystemSettingsPartial
) {
  return {
    ...globalRow,
    ...mapSettingsToDB(effectiveSettings),
  }
}

async function handleTenantUpdate(
  context: AdminAuthContext,
  settings: SystemSettingsPartial
) {
  const organizationId = context.organizationId
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: 'No active organization found for this administrator' },
      { status: 403 }
    )
  }

  const supabase = createAdminSupabase()
  const [{ data: globalRow, error: globalError }, { data: orgSettings, error: orgError }, { data: branch, error: branchError }] =
    await Promise.all([
      supabase.from('system_settings').select('*').eq('id', 'system').single(),
      supabase
        .from('organization_settings')
        .select('modules')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase
        .from('branches')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .maybeSingle(),
    ])

  if (globalError || orgError || branchError || !globalRow) {
    console.error('Failed to load tenant settings context', { globalError, orgError, branchError })
    return NextResponse.json(
      { success: false, error: 'No se pudo cargar la configuración actual' },
      { status: 500 }
    )
  }

  const existingModules =
    orgSettings?.modules && typeof orgSettings.modules === 'object' && !Array.isArray(orgSettings.modules)
      ? orgSettings.modules
      : {}
  const existingTenantSettings = SystemSettingsPartialSchema.safeParse(
    (existingModules as Record<string, unknown>)[TENANT_SETTINGS_KEY]
  )
  const tenantSettings = {
    ...(existingTenantSettings.success ? existingTenantSettings.data : {}),
    ...withoutPlatformSettings(settings),
  }
  const effectiveSettings = {
    ...toFrontendSettings(globalRow as Record<string, unknown>),
    ...tenantSettings,
  }

  const organizationUpdate = {
    organization_id: organizationId,
    display_name: effectiveSettings.companyName,
    currency: effectiveSettings.currency,
    timezone: effectiveSettings.timeZone,
    modules: {
      ...existingModules,
      [TENANT_SETTINGS_KEY]: tenantSettings,
    },
    updated_at: new Date().toISOString(),
  }

  const branchChanges = {
    ...(settings.companyPhone !== undefined ? { phone: settings.companyPhone || null } : {}),
    ...(settings.companyAddress !== undefined ? { address: settings.companyAddress || null } : {}),
    ...(settings.companyEmail !== undefined ? { email: settings.companyEmail || null } : {}),
    ...(settings.city !== undefined ? { city: settings.city || null } : {}),
  }
  const branchUpdate = branch?.id && Object.keys(branchChanges).length > 0
    ? supabase
        .from('branches')
        .update(branchChanges)
        .eq('id', branch.id)
        .eq('organization_id', organizationId)
    : Promise.resolve({ error: null })

  const companyUpdate = settings.companyName !== undefined
    ? supabase.from('organizations').update({ name: settings.companyName }).eq('id', organizationId)
    : Promise.resolve({ error: null })

  const [{ error: organizationError }, { error: companyError }, { error: defaultBranchError }] =
    await Promise.all([
      supabase.from('organization_settings').upsert(organizationUpdate, { onConflict: 'organization_id' }),
      companyUpdate,
      branchUpdate,
    ])

  if (organizationError || companyError || defaultBranchError) {
    console.error('Failed to update tenant settings', {
      organizationError,
      companyError,
      defaultBranchError,
    })
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar toda la configuración de la organización' },
      { status: 500 }
    )
  }

  await supabase.from('audit_log').insert({
    user_id: context.user.id,
    action: 'update_organization_settings',
    resource: 'organization_settings',
    resource_id: organizationId,
    new_values: tenantSettings,
  })

  return NextResponse.json({
    success: true,
    data: toResponseRow(globalRow as Record<string, unknown>, effectiveSettings),
  })
}

async function handler(request: NextRequest, context: AdminAuthContext) {
  try {
    const allowed = await rateLimiter.check(
      `admin-system-settings:${context.user.id}`,
      RATE_LIMIT,
      RATE_LIMIT_WINDOW
    )
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = SystemSettingsPartialSchema.safeParse(body?.settings)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'Configuración inválida' },
        { status: 400 }
      )
    }

    if (context.user.role !== 'super_admin') {
      return handleTenantUpdate(context, validation.data)
    }

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          id: 'system',
          ...mapSettingsToDB(validation.data),
          updated_by: context.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single()

    if (error) {
      console.error('Failed to update global system settings', error)
      return NextResponse.json(
        { success: false, error: 'No se pudo actualizar la configuración global' },
        { status: 500 }
      )
    }

    await supabase.from('audit_log').insert({
      user_id: context.user.id,
      action: 'update_system_settings',
      resource: 'system_settings',
      resource_id: 'system',
      new_values: validation.data,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('System settings API error:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo actualizar la configuración' },
      { status: 500 }
    )
  }
}

export const PUT = withAdminAuth(handler)

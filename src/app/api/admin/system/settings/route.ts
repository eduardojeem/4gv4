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
import {
  getTenantAdminSettings,
  mergeTenantAdminSettings,
  normalizeOrganizationModules,
} from '@/lib/organization/admin-settings'

const RATE_LIMIT = 20
const RATE_LIMIT_WINDOW = 60 * 1000
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
  settings: SystemSettingsPartial,
  confirmCurrencyChange: boolean
) {
  const organizationId = context.organizationId
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: 'No active organization found for this administrator' },
      { status: 403 }
    )
  }

  const supabase = createAdminSupabase()
  const [{ data: globalRow, error: globalError }, { data: orgSettings, error: orgError }, { data: organization, error: organizationReadError }] =
    await Promise.all([
      supabase.from('system_settings').select('*').eq('id', 'system').single(),
      supabase
        .from('organization_settings')
        .select('modules, currency, repair_max_discount_percent, repair_labor_tax_rate')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
    ])

  if (globalError || orgError || organizationReadError || !globalRow || !organization) {
    console.error('Failed to load tenant settings context', { globalError, orgError, organizationReadError })
    return NextResponse.json(
      { success: false, error: 'No se pudo cargar la configuración actual' },
      { status: 500 }
    )
  }

  const existingModules = normalizeOrganizationModules(orgSettings?.modules)
  const existingTenantSettings = getTenantAdminSettings(existingModules)
  const currentEffectiveSettings = {
    ...toFrontendSettings(globalRow as Record<string, unknown>),
    ...existingTenantSettings,
    ...(orgSettings?.currency ? { currency: orgSettings.currency } : {}),
    repairMaxDiscountPercent: Number(orgSettings?.repair_max_discount_percent ?? 20),
    repairLaborTaxRate: (orgSettings?.repair_labor_tax_rate ?? 10) as 0 | 5 | 10,
  }
  if (
    settings.currency !== undefined
    && settings.currency !== currentEffectiveSettings.currency
    && !confirmCurrencyChange
  ) {
    return NextResponse.json(
      {
        success: false,
        code: 'CURRENCY_CHANGE_CONFIRMATION_REQUIRED',
        error: 'Confirma que el cambio de moneda no convierte precios, saldos ni operaciones existentes.',
      },
      { status: 409 }
    )
  }
  const tenantSettings = {
    ...existingTenantSettings,
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
    modules: mergeTenantAdminSettings(existingModules, tenantSettings),
    repair_max_discount_percent: effectiveSettings.repairMaxDiscountPercent,
    repair_labor_tax_rate: effectiveSettings.repairLaborTaxRate,
    updated_at: new Date().toISOString(),
  }

  const companyNameChanged = settings.companyName !== undefined && settings.companyName !== organization.name
  if (companyNameChanged) {
    const { error: companyError } = await supabase
      .from('organizations')
      .update({ name: settings.companyName })
      .eq('id', organizationId)
    if (companyError) {
      console.error('Failed to update organization name', { companyError, organizationId })
      return NextResponse.json(
        { success: false, error: 'No se pudo actualizar el nombre de la organización' },
        { status: 500 }
      )
    }
  }

  const { error: organizationError } = await supabase
    .from('organization_settings')
    .upsert(organizationUpdate, { onConflict: 'organization_id' })

  if (organizationError) {
    if (companyNameChanged) {
      const { error: rollbackError } = await supabase
        .from('organizations')
        .update({ name: organization.name })
        .eq('id', organizationId)
      if (rollbackError) console.error('Failed to roll back organization name', { rollbackError, organizationId })
    }
    console.error('Failed to update tenant settings', { organizationError })
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar la configuración de la organización' },
      { status: 500 }
    )
  }

  const { error: auditError } = await supabase.from('audit_log').insert({
    user_id: context.user.id,
    action: 'update_organization_settings',
    resource: 'organization_settings',
    // El id de la tienda ya estaba a mano en `resource_id`, pero la pantalla de
    // seguridad filtra por la columna propia y el evento no llegaba.
    resource_id: organizationId,
    organization_id: organizationId,
    severity: 'medium',
    new_values: withoutPlatformSettings(settings),
  })
  if (auditError) console.error('Failed to audit organization settings update', { auditError, organizationId })

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
      return handleTenantUpdate(context, validation.data, body?.confirmCurrencyChange === true)
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

    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: context.user.id,
      action: 'update_system_settings',
      resource: 'system_settings',
      resource_id: 'system',
      // Sin organizacion a proposito: son los ajustes globales de la
      // plataforma, no los de un comercio. El otro insert de este archivo, que
      // si es por tienda, la escribe.
      severity: 'high',
      new_values: validation.data,
    })
    if (auditError) console.error('Failed to audit global settings update', { auditError })

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

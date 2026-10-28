import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { rateLimiter } from '@/lib/rate-limiter'
import {
  SystemSettingsPartialSchema,
  mapSettingsToDB,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'
import {
  getTenantAdminSettings,
  mergeTenantAdminSettings,
  normalizeOrganizationModules,
} from '@/lib/organization/admin-settings'
import { resolveSettingsOrganizationId } from '@/lib/organization/resolve-settings-organization'
import {
  branchContactPatch,
  companyInfoContactPatch,
  resolveTenantEffectiveSettings,
} from '@/lib/organization/tenant-effective-settings'
import { normalizeRegionalSettingsPatch, type RegionalSettingsPatch } from '@/lib/regional/settings'

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

function toResponseRow(
  globalRow: Record<string, unknown>,
  effectiveSettings: SystemSettingsPartial,
  regionalSettings: { countryCode: string | null; locale: string | null }
) {
  return {
    ...globalRow,
    ...mapSettingsToDB(effectiveSettings),
    country_code: regionalSettings.countryCode,
    locale: regionalSettings.locale,
    needs_country_confirmation: regionalSettings.countryCode === null,
  }
}

async function handleTenantUpdate(
  context: AdminAuthContext,
  settings: SystemSettingsPartial,
  confirmCurrencyChange: boolean,
  regionalPatch: RegionalSettingsPatch
) {
  const organizationId = context.organizationId
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: 'No active organization found for this administrator' },
      { status: 403 }
    )
  }

  const supabase = createAdminSupabase()
  const [
    { data: globalRow, error: globalError },
    { data: orgSettings, error: orgError },
    { data: organization, error: organizationReadError },
    { data: defaultBranch, error: branchError },
    { data: companyInfoRow, error: companyInfoError },
  ] = await Promise.all([
      supabase.from('system_settings').select('*').eq('id', 'system').single(),
      supabase
        .from('organization_settings')
        .select('display_name, timezone, modules, currency, country_code, locale, repair_max_discount_percent, repair_labor_tax_rate')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
      supabase
        .from('branches')
        .select('id, phone, email, address, city')
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .maybeSingle(),
      supabase
        .from('website_settings')
        .select('value')
        .eq('organization_id', organizationId)
        .eq('key', 'company_info')
        .maybeSingle(),
    ])

  if (globalError || orgError || organizationReadError || branchError || companyInfoError || !globalRow || !organization) {
    console.error('Failed to load tenant settings context', { globalError, orgError, organizationReadError, branchError, companyInfoError })
    return NextResponse.json(
      { success: false, error: 'No se pudo cargar la configuración actual' },
      { status: 500 }
    )
  }

  const existingModules = normalizeOrganizationModules(orgSettings?.modules)
  const existingTenantSettings = getTenantAdminSettings(existingModules)
  // Lo propio del comercio gana sobre la fila global, en el mismo orden que al
  // cargar (/api/settings/shared): la misma función arma las dos respuestas.
  const currentEffectiveSettings = resolveTenantEffectiveSettings({
    globalRow: globalRow as Record<string, unknown>,
    orgSettings,
    organizationName: organization.name,
    defaultBranch,
  })
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
    ...currentEffectiveSettings,
    ...withoutPlatformSettings(settings),
  }

  const organizationUpdate = {
    organization_id: organizationId,
    display_name: effectiveSettings.companyName,
    currency: effectiveSettings.currency,
    timezone: effectiveSettings.timeZone,
    country_code: regionalPatch.countryCode !== undefined ? regionalPatch.countryCode : orgSettings?.country_code ?? null,
    locale: regionalPatch.locale !== undefined ? regionalPatch.locale : orgSettings?.locale ?? null,
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
    new_values: { ...withoutPlatformSettings(settings), ...regionalPatch },
  })
  if (auditError) console.error('Failed to audit organization settings update', { auditError, organizationId })

  // El mismo contacto vive también en la sucursal principal y en la ficha de la
  // tienda: se actualizan para que la web, los tickets y la lista de pendientes
  // digan lo mismo. Un fallo acá no deshace lo guardado; se registra.
  const tenantChanges = withoutPlatformSettings(settings)
  const branchPatch = branchContactPatch(tenantChanges, currentEffectiveSettings, defaultBranch)
  if (defaultBranch?.id && Object.keys(branchPatch).length > 0) {
    const { error: branchSyncError } = await supabase
      .from('branches')
      .update({ ...branchPatch, updated_at: new Date().toISOString() })
      .eq('id', defaultBranch.id)
      .eq('organization_id', organizationId)
    if (branchSyncError) console.error('Failed to sync default branch contact', { branchSyncError, organizationId })
  }
  const companyInfo = companyInfoRow?.value && typeof companyInfoRow.value === 'object' && !Array.isArray(companyInfoRow.value)
    ? companyInfoRow.value as Record<string, unknown>
    : null
  const companyInfoPatch = companyInfoContactPatch(tenantChanges, currentEffectiveSettings, companyInfo)
  if (companyInfo && Object.keys(companyInfoPatch).length > 0) {
    const { error: companyInfoSyncError } = await supabase
      .from('website_settings')
      .update({ value: { ...companyInfo, ...companyInfoPatch }, updated_by: context.user.id, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('key', 'company_info')
    if (companyInfoSyncError) {
      console.error('Failed to sync storefront company info', { companyInfoSyncError, organizationId })
    } else {
      const slug = typeof companyInfo.slug === 'string' ? companyInfo.slug : null
      try {
        if (slug) revalidatePath(`/${slug}`, 'layout')
      } catch (cacheError) {
        console.warn('Could not revalidate storefront after settings update', cacheError)
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: toResponseRow(globalRow as Record<string, unknown>, effectiveSettings, {
      countryCode: organizationUpdate.country_code,
      locale: organizationUpdate.locale,
    }),
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
    const rawSettings = body?.settings
    const regionalInput: Record<string, unknown> = {}
    if (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
      if (Object.prototype.hasOwnProperty.call(rawSettings, 'countryCode')) regionalInput.countryCode = rawSettings.countryCode
      if (Object.prototype.hasOwnProperty.call(rawSettings, 'locale')) regionalInput.locale = rawSettings.locale
    }
    const regionalValidation = normalizeRegionalSettingsPatch(regionalInput)
    if (regionalValidation.success === false) {
      return NextResponse.json(
        { success: false, error: regionalValidation.field === 'countryCode' ? 'País inválido' : 'Idioma regional inválido' },
        { status: 400 }
      )
    }

    const settingsInput = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
      ? { ...rawSettings }
      : rawSettings
    if (settingsInput && typeof settingsInput === 'object' && !Array.isArray(settingsInput)) {
      delete settingsInput.countryCode
      delete settingsInput.locale
    }
    const validation = SystemSettingsPartialSchema.safeParse(settingsInput)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'Configuración inválida' },
        { status: 400 }
      )
    }

    if (context.user.role !== 'super_admin') {
      return handleTenantUpdate(context, validation.data, body?.confirmCurrencyChange === true, regionalValidation.data)
    }

    // Un superadmin guardando la configuracion de SU organizacion. Sin este
    // alcance explicito, todo lo que guardaba desde /admin/settings —nombre,
    // RUC, IVA, moneda de su empresa— se escribia en la fila global de la
    // plataforma. La pantalla global (/superadmin/settings) no manda `scope` y
    // sigue escribiendo en `system_settings` como antes.
    if (body?.scope === 'organization') {
      const organizationId = await resolveSettingsOrganizationId(createAdminSupabase(), context.user.id, {
        requireStaff: true,
      })
      if (!organizationId) {
        return NextResponse.json(
          {
            success: false,
            code: 'NO_ORGANIZATION',
            error: 'No estás dentro de ninguna organización. La configuración de la plataforma está en Super Admin.',
          },
          { status: 403 }
        )
      }
      return handleTenantUpdate(
        { ...context, organizationId },
        validation.data,
        body?.confirmCurrencyChange === true,
        regionalValidation.data
      )
    }

    if (Object.keys(regionalValidation.data).length > 0) {
      return NextResponse.json(
        { success: false, error: 'La identidad regional solo puede guardarse en una organización' },
        { status: 400 }
      )
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

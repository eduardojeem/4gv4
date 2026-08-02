import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  mapDBToSettings,
  mapSettingsToDB,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'

// Columnas de `system_settings` que son política de plataforma (super_admin) y
// no deben viajar a los tenants en el endpoint compartido.
const PLATFORM_ONLY_DB_COLUMNS = [
  'maintenance_mode',
  'allow_registration',
  'require_email_verification',
  'max_login_attempts',
  'password_min_length',
  'require_two_factor',
] as const

function toFrontendSettings(row: Record<string, unknown>): SystemSettingsPartial {
  return mapDBToSettings(row as Parameters<typeof mapDBToSettings>[0])
}

export async function GET() {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) {
    return NextResponse.json(
      { success: false, error: auth.reason === 'unauthenticated' ? 'Authentication required' : 'User is inactive' },
      { status: auth.reason === 'unauthenticated' ? 401 : 403 }
    )
  }

  const admin = createAdminSupabase()
  const { data: globalRow, error: globalError } = await admin
    .from('system_settings')
    .select('*')
    .eq('id', 'system')
    .single()

  if (globalError || !globalRow) {
    console.error('Failed to load global settings defaults', globalError)
    return NextResponse.json(
      { success: false, error: 'No se pudo cargar la configuración' },
      { status: 500 }
    )
  }

  if (auth.user.role === 'super_admin') {
    return NextResponse.json({ success: true, data: globalRow })
  }

  let organizationId = (await getCurrentOrganizationContext(auth.user.id))?.id ?? null
  if (!organizationId) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    organizationId = membership?.organization_id ?? null
  }

  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: 'No active organization found' },
      { status: 403 }
    )
  }

  const [
    { data: orgSettings, error: orgError },
    { data: legacyBranchFallback, error: branchError },
    { data: organization },
  ] = await Promise.all([
      admin
        .from('organization_settings')
        .select('display_name, currency, timezone, modules')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      admin
        .from('branches')
        .select('phone, email, address, city')
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .maybeSingle(),
      // El logo de la organización: sin esto los recibos caían al logo/nombre
      // de la plataforma (NEXT_PUBLIC_COMPANY_*), que es marca del SaaS.
      admin
        .from('organizations')
        .select('logo_url')
        .eq('id', organizationId)
        .maybeSingle(),
    ])

  if (orgError || branchError) {
    console.error('Failed to load organization settings', { orgError, branchError, organizationId })
    return NextResponse.json(
      { success: false, error: 'No se pudo cargar la configuración de la organización' },
      { status: 500 }
    )
  }

  const effectiveSettings = toFrontendSettings(globalRow as Record<string, unknown>)
  const tenantOverrides = getTenantAdminSettings(orgSettings?.modules)
  Object.assign(effectiveSettings, tenantOverrides)

  if (orgSettings?.display_name) effectiveSettings.companyName = orgSettings.display_name
  if (orgSettings?.currency) effectiveSettings.currency = orgSettings.currency
  if (orgSettings?.timezone) effectiveSettings.timeZone = orgSettings.timezone
  // Compatibilidad con organizaciones creadas antes de que el contacto de
  // empresa se guardara en admin_settings. Una vez configurado, la sucursal ya
  // no vuelve a sobrescribir estos datos.
  if (tenantOverrides.companyEmail === undefined && legacyBranchFallback?.email) effectiveSettings.companyEmail = legacyBranchFallback.email
  if (tenantOverrides.companyPhone === undefined && legacyBranchFallback?.phone) effectiveSettings.companyPhone = legacyBranchFallback.phone
  if (tenantOverrides.companyAddress === undefined && legacyBranchFallback?.address) effectiveSettings.companyAddress = legacyBranchFallback.address
  if (tenantOverrides.city === undefined && legacyBranchFallback?.city) effectiveSettings.city = legacyBranchFallback.city

  // No exponer la política de seguridad de la PLATAFORMA a los tenants: estos
  // campos son globales (los administra el super_admin) y no tienen por qué
  // filtrarse a cada organización vía el endpoint compartido.
  const responseRow: Record<string, unknown> = {
    ...globalRow,
    ...mapSettingsToDB(effectiveSettings),
    company_logo: organization?.logo_url ?? null,
  }
  for (const col of PLATFORM_ONLY_DB_COLUMNS) {
    delete responseRow[col]
  }

  return NextResponse.json({
    success: true,
    data: responseRow,
  })
}

import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { resolveSettingsOrganizationId } from '@/lib/organization/resolve-settings-organization'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { mapSettingsToDB } from '@/lib/validations/system-settings'
import { resolveTenantEffectiveSettings } from '@/lib/organization/tenant-effective-settings'
import { needsCountryConfirmation } from '@/lib/regional/settings'

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

export async function GET() {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) {
    return NextResponse.json(
      { success: false, error: auth.reason !== 'inactive' ? 'Authentication required' : 'User is inactive' },
      { status: auth.reason !== 'inactive' ? 401 : 403 }
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

  // Un superadmin recibia siempre la fila global, aunque estuviera dentro de su
  // organizacion: la pantalla de configuracion, el POS y los tickets mostraban
  // los datos de la plataforma. Ahora se resuelve la organizacion para todos, y
  // solo sin organizacion se devuelve la global, marcada como tal.
  const isSuperAdmin = auth.user.role === 'super_admin'
  const organizationId = await resolveSettingsOrganizationId(admin, auth.user.id, {
    requireStaff: isSuperAdmin,
  })

  if (!organizationId) {
    if (isSuperAdmin) {
      return NextResponse.json({ success: true, scope: 'platform', data: globalRow })
    }
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
        .select('display_name, currency, timezone, country_code, locale, modules, repair_max_discount_percent, repair_labor_tax_rate')
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
        .select('name, logo_url')
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

  // Los datos de la empresa (nombre, email, RUC, contacto) nunca salen de la
  // fila global: antes un comercio sin email veía el de la plataforma.
  const effectiveSettings = resolveTenantEffectiveSettings({
    globalRow: globalRow as Record<string, unknown>,
    orgSettings,
    organizationName: organization?.name ?? null,
    defaultBranch: legacyBranchFallback,
  })

  // No exponer la política de seguridad de la PLATAFORMA a los tenants: estos
  // campos son globales (los administra el super_admin) y no tienen por qué
  // filtrarse a cada organización vía el endpoint compartido.
  const responseRow: Record<string, unknown> = {
    ...globalRow,
    ...mapSettingsToDB(effectiveSettings),
    company_logo: organization?.logo_url ?? null,
    country_code: orgSettings?.country_code ?? null,
    locale: orgSettings?.locale ?? null,
    needs_country_confirmation: needsCountryConfirmation(orgSettings?.country_code),
  }
  for (const col of PLATFORM_ONLY_DB_COLUMNS) {
    delete responseRow[col]
  }

  return NextResponse.json({
    success: true,
    scope: 'organization',
    data: responseRow,
  })
}

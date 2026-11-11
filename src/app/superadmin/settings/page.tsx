import type { Metadata } from 'next'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { SettingsCenter, type PlatformSettingsData } from '@/components/superadmin/settings/SettingsCenter'
import { REGIONAL_CURRENCY_CODES } from '@/lib/regional/contract'
import { SETTINGS_TIMEZONES, toPlatformDefaults } from '@/lib/superadmin/platform-settings'
import { toPlatformPolicies } from '@/lib/platform/policies'

export const metadata: Metadata = { title: 'Configuración | Superadmin' }
export const dynamic = 'force-dynamic'

type CountResult = { count: number | null; error: { message: string } | null }

/**
 * Conteos agregados (`count: 'exact', head: true`): no se traen filas. Antes se
 * leía toda `organization_settings` y la cuenta se cortaba en 1000.
 */
async function getUsage(admin: ReturnType<typeof createAdminSupabase>) {
  const orgSettings = () => admin.from('organization_settings').select('organization_id', { count: 'exact', head: true })

  const [organizations, withCurrency, withTimezone, withOwnTax, ...rest] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    orgSettings().not('currency', 'is', null),
    orgSettings().not('timezone', 'is', null),
    // El IVA propio de una tienda vive en organization_settings.modules.admin_settings
    // (`taxRate`, o `tax_rate` en filas viejas): es lo que lee el POS antes de
    // caer al IVA global (src/app/api/pos/process-sale/route.ts, getTaxRate).
    orgSettings().or('modules->admin_settings->>taxRate.not.is.null,modules->admin_settings->>tax_rate.not.is.null'),
    ...REGIONAL_CURRENCY_CODES.map((code) => orgSettings().eq('currency', code)),
    ...SETTINGS_TIMEZONES.map((tz) => orgSettings().eq('timezone', tz)),
  ]) as CountResult[]

  const currencyCounts = rest.slice(0, REGIONAL_CURRENCY_CODES.length)
  const timezoneCounts = rest.slice(REGIONAL_CURRENCY_CODES.length)
  const all = [organizations, withCurrency, withTimezone, withOwnTax, ...rest]
  const error = all.find((r) => r.error)?.error?.message ?? null

  const n = (r: CountResult) => r.count ?? 0
  const totalOrganizations = n(organizations)
  const distribution = (labels: readonly string[], counts: CountResult[], total: number): Array<[string, number]> => {
    const rows: Array<[string, number]> = labels.map((label, i) => [label, n(counts[i])] as [string, number]).filter(([, c]) => c > 0)
    const others = total - rows.reduce((sum, [, c]) => sum + c, 0)
    if (others > 0) rows.push(['Otras', others])
    return rows.sort((a, b) => b[1] - a[1])
  }

  return {
    error,
    usage: {
      totalOrganizations,
      withoutOwnTaxRate: Math.max(0, totalOrganizations - n(withOwnTax)),
      withoutOwnCurrency: Math.max(0, totalOrganizations - n(withCurrency)),
      withoutOwnTimezone: Math.max(0, totalOrganizations - n(withTimezone)),
      currencies: distribution(REGIONAL_CURRENCY_CODES, currencyCounts, n(withCurrency)),
      timezones: distribution(SETTINGS_TIMEZONES, timezoneCounts, n(withTimezone)),
    },
  }
}

async function getSettingsData(): Promise<PlatformSettingsData> {
  const admin = createAdminSupabase()
  const [systemResult, usageResult] = await Promise.all([
    admin.from('system_settings').select('*').eq('id', 'system').maybeSingle(),
    getUsage(admin),
  ])

  const s = (systemResult.data ?? {}) as Record<string, unknown>

  let updatedByEmail: string | null = null
  if (typeof s.updated_by === 'string') {
    const { data } = await admin.from('profiles').select('email').eq('id', s.updated_by).maybeSingle()
    updatedByEmail = (data as { email?: string } | null)?.email ?? null
  }

  return {
    defaults: toPlatformDefaults(s),
    policies: toPlatformPolicies(s as Parameters<typeof toPlatformPolicies>[0]),
    storedFlags: {
      maintenanceMode: Boolean(s.maintenance_mode),
      allowRegistration: s.allow_registration !== false,
      requireEmailVerification: Boolean(s.require_email_verification),
      requireTwoFactor: Boolean(s.require_two_factor),
      autoBackup: Boolean(s.auto_backup),
      smsNotifications: Boolean(s.sms_notifications),
      maxLoginAttempts: Number(s.max_login_attempts ?? 5),
      passwordMinLength: Number(s.password_min_length ?? 8),
      sessionTimeout: Number(s.session_timeout ?? 60),
      retentionDays: Number(s.retention_days ?? 90),
    },
    usage: usageResult.usage,
    updatedAt: typeof s.updated_at === 'string' ? s.updated_at : null,
    updatedByEmail,
    loadErrors: [systemResult.error?.message, usageResult.error].filter((m): m is string => Boolean(m)),
  }
}

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin()
  return <SettingsCenter data={await getSettingsData()} />
}

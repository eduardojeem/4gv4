import { createAdminSupabase } from '@/lib/supabase/admin'
import { SettingsDashboard, type SettingsData } from '@/components/superadmin/SettingsDashboard'

async function getSettingsData(): Promise<SettingsData> {
  const admin = createAdminSupabase()

  const [{ data: systemData }, { data: orgsSettings }, { count: orgCount }] = await Promise.all([
    admin.from('system_settings').select('*').eq('id', 'system').maybeSingle(),
    admin.from('organization_settings').select('currency, timezone'),
    admin.from('organizations').select('id', { count: 'exact', head: true }),
  ])

  const s = (systemData ?? {}) as Record<string, unknown>

  // Distribución de currency y timezone usadas por orgs
  const currencyMap = new Map<string, number>()
  const tzMap = new Map<string, number>()
  ;(orgsSettings ?? []).forEach((row: { currency?: string; timezone?: string }) => {
    if (row.currency) currencyMap.set(row.currency, (currencyMap.get(row.currency) ?? 0) + 1)
    if (row.timezone) tzMap.set(row.timezone, (tzMap.get(row.timezone) ?? 0) + 1)
  })

  // Env vars check
  const envChecks = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { key: 'NEXT_PUBLIC_SITE_URL', configured: Boolean(process.env.NEXT_PUBLIC_SITE_URL) },
    { key: 'NEXT_PUBLIC_BASE_DOMAIN', configured: Boolean(process.env.NEXT_PUBLIC_BASE_DOMAIN) },
    { key: 'PAGOPAR_PUBLIC_KEY', configured: Boolean(process.env.PAGOPAR_PUBLIC_KEY) },
    { key: 'PAGOPAR_PRIVATE_KEY', configured: Boolean(process.env.PAGOPAR_PRIVATE_KEY) },
  ]

  return {
    system: {
      companyName:              String(s.company_name ?? '—'),
      companyEmail:             String(s.company_email ?? '—'),
      maintenanceMode:          Boolean(s.maintenance_mode),
      allowRegistration:        s.allow_registration !== false,
      requireEmailVerification: Boolean(s.require_email_verification),
      requireTwoFactor:         Boolean(s.require_two_factor),
      autoBackup:               Boolean(s.auto_backup),
      emailNotifications:       Boolean(s.email_notifications),
      smsNotifications:         Boolean(s.sms_notifications),
      maxLoginAttempts:         Number(s.max_login_attempts ?? 5),
      sessionTimeout:           Number(s.session_timeout ?? 60),
      retentionDays:            Number(s.retention_days ?? 90),
      passwordMinLength:        Number(s.password_min_length ?? 8),
      currency:                 String(s.currency ?? 'PYG'),
      taxRate:                  Number(s.tax_rate ?? 10),
      timezone:                 String(s.time_zone ?? 'America/Asuncion'),
      updatedAt:                typeof s.updated_at === 'string' ? s.updated_at : null,
      updatedBy:                typeof s.updated_by === 'string' ? s.updated_by : null,
    },
    platformStats: {
      totalOrgs: orgCount ?? 0,
      topCurrency: [...currencyMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      topTimezone: [...tzMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      currencyDistribution: Array.from(currencyMap.entries()).map(([k, v]) => ({ value: k, count: v })),
    },
    envChecks,
  }
}

export default async function SuperAdminSettingsPage() {
  const data = await getSettingsData()
  return <SettingsDashboard initial={data} />
}

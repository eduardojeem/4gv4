import type { Metadata } from 'next'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { SettingsCenter, type PlatformSettingsData } from '@/components/superadmin/settings/SettingsCenter'

export const metadata: Metadata = { title: 'Configuración | Superadmin' }
export const dynamic = 'force-dynamic'

async function getSettingsData(): Promise<PlatformSettingsData> {
  const admin = createAdminSupabase()
  const [systemResult, orgSettingsResult] = await Promise.all([
    admin.from('system_settings').select('*').eq('id', 'system').maybeSingle(),
    admin.from('organization_settings').select('currency, timezone'),
  ])

  const s = (systemResult.data ?? {}) as Record<string, unknown>
  const str = (key: string, fallback = '') => (typeof s[key] === 'string' ? (s[key] as string) : fallback)

  let updatedByEmail: string | null = null
  if (typeof s.updated_by === 'string') {
    const { data } = await admin.from('profiles').select('email').eq('id', s.updated_by).maybeSingle()
    updatedByEmail = (data as { email?: string } | null)?.email ?? null
  }

  // Cuántas empresas usan su propio valor en vez del de la plataforma.
  const currencyUsage = new Map<string, number>()
  const timezoneUsage = new Map<string, number>()
  for (const row of (orgSettingsResult.data ?? []) as Array<{ currency?: string | null; timezone?: string | null }>) {
    if (row.currency) currencyUsage.set(row.currency, (currencyUsage.get(row.currency) ?? 0) + 1)
    if (row.timezone) timezoneUsage.set(row.timezone, (timezoneUsage.get(row.timezone) ?? 0) + 1)
  }

  return {
    defaults: {
      companyName: str('company_name'),
      companyEmail: str('company_email'),
      companyPhone: str('company_phone'),
      companyRuc: str('company_ruc'),
      companyAddress: str('company_address'),
      currency: str('currency', 'PYG'),
      taxRate: Number(s.tax_rate ?? 10),
      timeZone: str('time_zone', 'America/Asuncion'),
    },
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
    usage: {
      organizationsWithSettings: (orgSettingsResult.data ?? []).length,
      currencies: [...currencyUsage.entries()].sort((a, b) => b[1] - a[1]),
      timezones: [...timezoneUsage.entries()].sort((a, b) => b[1] - a[1]),
    },
    updatedAt: typeof s.updated_at === 'string' ? s.updated_at : null,
    updatedByEmail,
    loadErrors: [systemResult.error?.message, orgSettingsResult.error?.message].filter((m): m is string => Boolean(m)),
  }
}

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin()
  return <SettingsCenter data={await getSettingsData()} />
}

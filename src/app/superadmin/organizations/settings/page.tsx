import Link from 'next/link'
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Cog,
  CreditCard,
  ExternalLink,
  Globe,
  Lock,
  Package,
  Palette,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  XCircle,
} from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getSettingsData() {
  const admin = createAdminSupabase()

  const [{ data: systemSettings }, { data: plans }, { data: orgStats }] = await Promise.all([
    admin
      .from('system_settings')
      .select('*')
      .eq('id', 'system')
      .maybeSingle(),
    admin
      .from('subscription_plans')
      .select('tier, name, price, limits, trial_days, is_active, is_popular')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    admin
      .from('organization_settings')
      .select('currency, timezone'),
  ])

  // Aggregate org settings
  const currencyMap = new Map<string, number>()
  const timezoneMap = new Map<string, number>()
  ;(orgStats ?? []).forEach((row: { currency?: string; timezone?: string }) => {
    if (row.currency) currencyMap.set(row.currency, (currencyMap.get(row.currency) ?? 0) + 1)
    if (row.timezone) timezoneMap.set(row.timezone, (timezoneMap.get(row.timezone) ?? 0) + 1)
  })
  const topCurrency = [...currencyMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topTimezone = [...timezoneMap.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    system: systemSettings as Record<string, unknown> | null,
    plans: (plans ?? []) as Array<Record<string, unknown>>,
    orgCount: orgStats?.length ?? 0,
    topCurrency: topCurrency?.[0] ?? 'PYG',
    topTimezone: topTimezone?.[0] ?? 'America/Asuncion',
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function Toggle({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {active
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        : <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      }
      <span className={cn('text-sm', active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
        {label}
      </span>
    </div>
  )
}

function SettingRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
      <div className="shrink-0">{value}</div>
    </div>
  )
}

function SectionCard({
  title, icon: Icon, iconColor, children, action,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  children: React.ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {action && (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={action.href}>
                <Settings className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

const PLAN_COLORS: Record<string, string> = {
  free: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  basic: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  pro: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  enterprise: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

function money(amount: number) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SuperAdminOrganizationSettingsPage() {
  const { system, plans, orgCount, topCurrency, topTimezone } = await getSettingsData()

  const s = system ?? {}
  const maintenanceMode = Boolean(s.maintenance_mode)
  const allowRegistration = s.allow_registration !== false
  const requireEmailVerification = Boolean(s.require_email_verification)
  const requireTwoFactor = Boolean(s.require_two_factor)
  const emailNotifications = Boolean(s.email_notifications)
  const autoBackup = Boolean(s.auto_backup)
  const maxLoginAttempts = Number(s.max_login_attempts ?? 5)
  const sessionTimeout = Number(s.session_timeout ?? 60)
  const retentionDays = Number(s.retention_days ?? 90)
  const currency = String(s.currency ?? 'PYG')
  const timezone = String(s.time_zone ?? 'America/Asuncion')
  const taxRate = Number(s.tax_rate ?? 10)
  const companyName = String(s.company_name ?? '—')
  const companyEmail = String(s.company_email ?? '—')

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
            Tenants SaaS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Configuración de tenants</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Parámetros globales de la plataforma: acceso, defaults, planes y seguridad para todas las organizaciones.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/admin/settings">
              <ExternalLink className="h-3.5 w-3.5" />
              Editar configuración del sistema
            </Link>
          </Button>
        </div>
      </div>

      {/* Alert if maintenance mode */}
      {maintenanceMode && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Modo mantenimiento ACTIVO</p>
            <p className="text-xs text-orange-700 dark:text-orange-400">La plataforma está en mantenimiento. Los usuarios no pueden acceder.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300">
            <Link href="/admin/settings">Desactivar</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Acceso y registro */}
        <SectionCard
          title="Acceso y registro"
          icon={Globe}
          iconColor="border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400"
          action={{ label: 'Editar', href: '/admin/settings' }}
        >
          <SettingRow
            label="Registro público"
            sub="Permite que cualquiera cree una nueva organización"
            value={<Toggle active={allowRegistration} label={allowRegistration ? 'Habilitado' : 'Deshabilitado'} />}
          />
          <SettingRow
            label="Verificación de email"
            sub="Requiere confirmar email al registrarse"
            value={<Toggle active={requireEmailVerification} label={requireEmailVerification ? 'Requerido' : 'Opcional'} />}
          />
          <SettingRow
            label="Modo mantenimiento"
            sub="Bloquea el acceso a toda la plataforma"
            value={
              <div className="flex items-center gap-2">
                {maintenanceMode
                  ? <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-400">Activo</Badge>
                  : <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-400">Inactivo</Badge>
                }
              </div>
            }
          />
        </SectionCard>

        {/* Seguridad */}
        <SectionCard
          title="Seguridad"
          icon={Shield}
          iconColor="border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"
          action={{ label: 'Editar', href: '/admin/settings' }}
        >
          <SettingRow
            label="Autenticación de dos factores"
            sub="Requerida para todos los administradores"
            value={<Toggle active={requireTwoFactor} label={requireTwoFactor ? 'Requerida' : 'Opcional'} />}
          />
          <SettingRow
            label="Intentos de login"
            sub="Máximo antes de bloquear la cuenta"
            value={
              <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono font-semibold">
                {maxLoginAttempts}
              </span>
            }
          />
          <SettingRow
            label="Timeout de sesión"
            sub="Minutos de inactividad antes de cerrar sesión"
            value={
              <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono font-semibold">
                {sessionTimeout}m
              </span>
            }
          />
          <SettingRow
            label="Retención de logs"
            sub="Días que se conservan los audit logs"
            value={
              <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono font-semibold">
                {retentionDays}d
              </span>
            }
          />
        </SectionCard>

        {/* Defaults del sistema */}
        <SectionCard
          title="Defaults del sistema"
          icon={SlidersHorizontal}
          iconColor="border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400"
          action={{ label: 'Editar', href: '/admin/settings' }}
        >
          <SettingRow
            label="Moneda del sistema"
            sub={`Usada por ${orgCount} organizaciones`}
            value={
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono font-semibold">{currency}</span>
                {topCurrency !== currency && (
                  <span className="text-xs text-slate-400">({topCurrency} más usada por orgs)</span>
                )}
              </div>
            }
          />
          <SettingRow
            label="Zona horaria"
            sub="Zona horaria por defecto del sistema"
            value={
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono text-xs font-semibold">{timezone}</span>
              </div>
            }
          />
          <SettingRow
            label="Tasa de impuesto"
            sub="IVA o impuesto aplicado a ventas"
            value={
              <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm font-mono font-semibold">
                {taxRate}%
              </span>
            }
          />
          <SettingRow
            label="Notificaciones email"
            value={<Toggle active={emailNotifications} label={emailNotifications ? 'Activas' : 'Inactivas'} />}
          />
          <SettingRow
            label="Backup automático"
            value={<Toggle active={autoBackup} label={autoBackup ? 'Activo' : 'Inactivo'} />}
          />
        </SectionCard>

        {/* Información de la empresa */}
        <SectionCard
          title="Información de la plataforma"
          icon={Building2}
          iconColor="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          action={{ label: 'Editar', href: '/admin/settings' }}
        >
          <SettingRow
            label="Nombre"
            value={<span className="text-sm font-semibold">{companyName}</span>}
          />
          <SettingRow
            label="Email de contacto"
            value={<span className="text-sm text-slate-600 dark:text-slate-400">{companyEmail}</span>}
          />
          <SettingRow
            label="Organizaciones activas"
            sub="Total en la plataforma"
            value={
              <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{orgCount}</span>
            }
          />
          <SettingRow
            label="Timezone más usada"
            sub="Por las organizaciones"
            value={<span className="text-xs font-mono text-slate-500">{topTimezone}</span>}
          />
        </SectionCard>

      </div>

      {/* Plans section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Configuración de planes y trials</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href="/superadmin/plans">
                <Settings className="h-3.5 w-3.5" />
                Administrar planes
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">No hay planes configurados.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const tier = String(plan.tier ?? '').toLowerCase()
                const name = String(plan.name ?? tier)
                const price = Number(plan.price ?? 0)
                const trialDays = Number(plan.trial_days ?? 14)
                const limits = plan.limits as Record<string, unknown> ?? {}
                const isPopular = Boolean(plan.is_popular)

                return (
                  <div key={tier} className={cn(
                    'relative rounded-xl border p-4',
                    isPopular ? 'border-violet-300 dark:border-violet-700' : 'border-slate-200 dark:border-slate-700'
                  )}>
                    {isPopular && (
                      <div className="absolute -top-2.5 left-3">
                        <Badge className="rounded-full bg-violet-600 text-white text-[10px] px-2 py-0.5 shadow">
                          Popular
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div>
                        <Badge variant="outline" className={cn('rounded-full text-[11px]', PLAN_COLORS[tier] ?? PLAN_COLORS.free)}>
                          {name}
                        </Badge>
                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-50">
                          {price === 0 ? 'Gratis' : money(price)}
                        </p>
                        {price > 0 && <p className="text-xs text-slate-400">por mes</p>}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" /> Trial</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{trialDays} días</span>
                      </div>
                      {(Object.entries(limits) as [string, unknown][]).slice(0, 4).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 capitalize">{key}</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {val === null || String(val).toLowerCase().includes('ilimit') ? '∞' : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/superadmin/plans', icon: CreditCard, label: 'Administrar planes', sub: 'Precios, límites y features' },
          { href: '/superadmin/subscriptions', icon: BadgeCheck, label: 'Suscripciones', sub: 'Estado por organización' },
          { href: '/superadmin/organizations', icon: Users, label: 'Organizaciones', sub: 'Directorio de tenants' },
          { href: '/admin/settings', icon: Cog, label: 'Settings del sistema', sub: 'Editar configuración global' },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
              <p className="truncate text-xs text-slate-400">{sub}</p>
            </div>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  )
}

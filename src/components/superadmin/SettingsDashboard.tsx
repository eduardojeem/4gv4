'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Key,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingsData = {
  system: {
    companyName: string; companyEmail: string
    maintenanceMode: boolean; allowRegistration: boolean
    requireEmailVerification: boolean; requireTwoFactor: boolean
    autoBackup: boolean; emailNotifications: boolean; smsNotifications: boolean
    maxLoginAttempts: number; sessionTimeout: number; retentionDays: number; passwordMinLength: number
    currency: string; taxRate: number; timezone: string
    updatedAt: string | null; updatedBy: string | null
  }
  platformStats: {
    totalOrgs: number
    topCurrency: string | null
    topTimezone: string | null
    currencyDistribution: Array<{ value: string; count: number }>
  }
  envChecks: Array<{ key: string; configured: boolean }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

// Convierte field UI camelCase a payload del Schema (snake/camel mix usado en validations)
function buildPatch(field: keyof SettingsData['system'], value: boolean | number | string): Record<string, unknown> {
  // El schema usa los nombres camelCase a nivel UI; el endpoint los pasa por mapSettingsToDB
  return { [field]: value }
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
  }
  const iconTones = {
    default: 'text-slate-500', success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400', danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  }
  return (
    <div className={cn('rounded-xl border p-5', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('rounded-lg border bg-background p-2', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------

function ToggleRow({
  label, sub, checked, onChange, loading,
  icon: Icon, dangerWhen, recommendWhen,
}: {
  label: string
  sub: string
  checked: boolean
  onChange: (next: boolean) => void
  loading: boolean
  icon: React.ComponentType<{ className?: string }>
  dangerWhen?: boolean
  recommendWhen?: boolean
}) {
  return (
    <div className={cn(
      'flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors',
      dangerWhen ? 'border-orange-300 bg-orange-50/50 dark:border-orange-900/60 dark:bg-orange-950/20' : 'bg-card'
    )}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
            {recommendWhen && !checked && (
              <Badge variant="outline" className="rounded-full text-[10px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                Recomendado
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
      </div>
      <div className="shrink-0">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Switch checked={checked} onCheckedChange={onChange} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function SettingsDashboard({ initial }: { initial: SettingsData }) {
  const router = useRouter()
  const [system, setSystem] = useState(initial.system)
  const [loadingField, setLoadingField] = useState<keyof SettingsData['system'] | null>(null)

  async function updateField<K extends keyof SettingsData['system']>(field: K, value: SettingsData['system'][K]) {
    setLoadingField(field)
    const prev = system[field]
    setSystem((s) => ({ ...s, [field]: value })) // optimistic

    try {
      const res = await fetch('/api/admin/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: buildPatch(field, value as boolean | number | string) }),
      })
      const payload = await res.json().catch(() => null) as { success?: boolean; error?: string } | null

      if (!res.ok || !payload?.success) {
        setSystem((s) => ({ ...s, [field]: prev })) // rollback
        toast.error(payload?.error || 'No se pudo actualizar la configuración')
        return
      }
      toast.success('Actualizado')
      router.refresh()
    } catch (err) {
      setSystem((s) => ({ ...s, [field]: prev }))
      toast.error(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoadingField(null)
    }
  }

  const missingEnv = initial.envChecks.filter((e) => !e.configured)
  const configuredEnv = initial.envChecks.length - missingEnv.length

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Wrench className="h-3.5 w-3.5" />
            Configuración SaaS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings globales</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Parámetros que afectan a toda la plataforma. Los cambios se aplican inmediatamente y se registran en el audit log.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/admin/settings">
              <ExternalLink className="h-3.5 w-3.5" />
              Editor completo
            </Link>
          </Button>
        </div>
      </header>

      {/* Maintenance alert */}
      {system.maintenanceMode && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Modo mantenimiento ACTIVO</p>
            <p className="text-xs text-orange-700 dark:text-orange-400">
              La plataforma está cerrada para los usuarios. Solo super admins pueden acceder.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
            onClick={() => updateField('maintenanceMode', false)}
            disabled={loadingField === 'maintenanceMode'}
          >
            Desactivar
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizaciones" value={initial.platformStats.totalOrgs} sub="en la plataforma" icon={Building2} />
        <StatCard label="Moneda principal" value={system.currency} sub={initial.platformStats.topCurrency && initial.platformStats.topCurrency !== system.currency ? `Orgs usan: ${initial.platformStats.topCurrency}` : 'Default del sistema'} icon={Banknote} tone="info" />
        <StatCard
          label="Env vars"
          value={`${configuredEnv}/${initial.envChecks.length}`}
          sub={missingEnv.length > 0 ? `${missingEnv.length} faltan` : 'todas configuradas'}
          icon={Key}
          tone={missingEnv.length === 0 ? 'success' : 'warning'}
        />
        <StatCard
          label="Última edición"
          value={system.updatedAt ? formatDate(system.updatedAt).split(',')[0] : 'Nunca'}
          sub={system.updatedAt ? formatDate(system.updatedAt).split(',')[1] ?? '' : 'Sin cambios'}
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* Main toggles column */}
        <div className="space-y-6">

          {/* Acceso */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Acceso y registro</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Cómo los usuarios pueden entrar a la plataforma</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <ToggleRow
                icon={Sparkles}
                label="Registro público de empresas"
                sub="Permite que cualquiera pueda crear una nueva organización"
                checked={system.allowRegistration}
                onChange={(v) => updateField('allowRegistration', v)}
                loading={loadingField === 'allowRegistration'}
              />
              <ToggleRow
                icon={Mail}
                label="Verificación de email obligatoria"
                sub="Usuarios deben confirmar su email antes de acceder"
                checked={system.requireEmailVerification}
                onChange={(v) => updateField('requireEmailVerification', v)}
                loading={loadingField === 'requireEmailVerification'}
                recommendWhen
              />
              <ToggleRow
                icon={AlertTriangle}
                label="Modo mantenimiento"
                sub="Bloquea el acceso a toda la plataforma (excepto super admins)"
                checked={system.maintenanceMode}
                onChange={(v) => updateField('maintenanceMode', v)}
                loading={loadingField === 'maintenanceMode'}
                dangerWhen={system.maintenanceMode}
              />
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Seguridad</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Políticas que afectan a la autenticación</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <ToggleRow
                icon={Lock}
                label="2FA obligatorio"
                sub="Requiere autenticación de dos factores para todos los administradores"
                checked={system.requireTwoFactor}
                onChange={(v) => updateField('requireTwoFactor', v)}
                loading={loadingField === 'requireTwoFactor'}
                recommendWhen
              />

              <div className="grid gap-3 sm:grid-cols-3 rounded-lg border bg-muted/30 p-3">
                <NumberBadge label="Intentos login" value={system.maxLoginAttempts} unit="" />
                <NumberBadge label="Timeout sesión" value={system.sessionTimeout} unit="min" />
                <NumberBadge label="Retención logs" value={system.retentionDays} unit="días" />
              </div>
              <p className="text-[11px] text-slate-400">
                Para editar valores numéricos, usá el editor completo en <Link href="/admin/settings" className="text-indigo-600 hover:underline">/admin/settings</Link>
              </p>
            </CardContent>
          </Card>

          {/* Backups & notificaciones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Operaciones</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Notificaciones automáticas y respaldos</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <ToggleRow
                icon={HardDrive}
                label="Backup automático"
                sub="Respaldos diarios programados de la base de datos"
                checked={system.autoBackup}
                onChange={(v) => updateField('autoBackup', v)}
                loading={loadingField === 'autoBackup'}
                recommendWhen
              />
              <ToggleRow
                icon={Mail}
                label="Notificaciones por email"
                sub="Envío de emails transaccionales (invites, recuperación, etc.)"
                checked={system.emailNotifications}
                onChange={(v) => updateField('emailNotifications', v)}
                loading={loadingField === 'emailNotifications'}
              />
              <ToggleRow
                icon={Mail}
                label="Notificaciones por SMS"
                sub="Mensajes de texto para alertas urgentes (requiere proveedor)"
                checked={system.smsNotifications}
                onChange={(v) => updateField('smsNotifications', v)}
                loading={loadingField === 'smsNotifications'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">

          {/* Env vars */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                  <Key className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <CardTitle className="text-base">Variables de entorno</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {initial.envChecks.map((e) => (
                  <div
                    key={e.key}
                    className={cn(
                      'flex items-center gap-2 rounded-md border p-2 text-xs',
                      e.configured
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                        : 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/10'
                    )}
                  >
                    {e.configured
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    }
                    <code className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">{e.key}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Currency distribution */}
          {initial.platformStats.currencyDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                    <Banknote className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <CardTitle className="text-base">Monedas usadas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {initial.platformStats.currencyDistribution.map((c) => {
                    const max = initial.platformStats.currencyDistribution[0]?.count ?? 1
                    const percent = Math.round((c.count / max) * 100)
                    return (
                      <div key={c.value}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{c.value}</span>
                          <span className="text-slate-500">{c.count} org{c.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enlaces rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { href: '/admin/settings', icon: Wrench, label: 'Editor completo de settings' },
                { href: '/superadmin/organizations/settings', icon: Building2, label: 'Configuración de tenants' },
                { href: '/superadmin/audit-logs', icon: Database, label: 'Audit log' },
                { href: '/superadmin/monitoring', icon: Shield, label: 'Monitoreo del sistema' },
              ].map((l) => {
                const Icon = l.icon
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-2.5 rounded-md p-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1 text-slate-700 dark:text-slate-300">{l.label}</span>
                    <ExternalLink className="h-3 w-3 text-slate-300" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function NumberBadge({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
        {value}<span className="ml-0.5 text-xs font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}

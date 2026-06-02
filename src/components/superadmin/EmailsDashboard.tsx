'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code2,
  ExternalLink,
  Eye,
  Key,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  UserPlus,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailTemplate = {
  id: string
  name: string
  description: string
  category: 'auth' | 'onboarding' | 'security' | 'billing'
  trigger: string
  subject: string
  variables: string[]
  enabled: boolean
  sentFrom: string
}

export type EmailActivity = {
  id: string
  type: 'invite' | 'login' | 'login_failed' | 'role_change' | 'password_change'
  action: string
  createdAt: string | null
  actorName: string | null
  actorEmail: string | null
  target: string | null
}

export type EmailEnvCheck = {
  key: string
  label: string
  configured: boolean
  description: string
}

type Data = {
  templates: EmailTemplate[]
  activity: EmailActivity[]
  envChecks: EmailEnvCheck[]
  stats: {
    totalTemplates: number
    enabledTemplates: number
    invitesLast24h: number
    loginsLast24h: number
    failedLogins24h: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(value: string | null) {
  if (!value) return '—'
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const CATEGORY_META: Record<EmailTemplate['category'], { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  auth:       { label: 'Autenticación', color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',         icon: Key },
  onboarding: { label: 'Onboarding',    color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300', icon: Sparkles },
  security:   { label: 'Seguridad',     color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',                icon: Shield },
  billing:    { label: 'Facturación',   color: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300', icon: Zap },
}

const ACTIVITY_META: Record<EmailActivity['type'], { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  invite:          { label: 'Invitación enviada',  icon: UserPlus,     color: 'text-emerald-600' },
  login:           { label: 'Login exitoso',       icon: LogIn,        color: 'text-blue-600' },
  login_failed:    { label: 'Login fallido',       icon: XCircle,      color: 'text-red-600' },
  role_change:     { label: 'Cambio de rol',       icon: Shield,       color: 'text-amber-600' },
  password_change: { label: 'Cambio contraseña',   icon: Lock,         color: 'text-orange-600' },
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
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
// Template preview drawer
// ---------------------------------------------------------------------------

function TemplatePreviewDrawer({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const catMeta = CATEGORY_META[template.category]
  const CatIcon = catMeta.icon

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <CatIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{template.name}</h2>
              <Badge variant="outline" className={cn('mt-0.5 rounded-full text-[10px]', catMeta.color)}>
                {catMeta.label}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{template.description}</p>

          {/* Subject preview */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Asunto</p>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{template.subject}</p>
          </div>

          {/* Trigger */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Trigger / Origen</p>
            <code className="block rounded bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-100">
              {template.trigger}
            </code>
            <p className="mt-2 text-xs text-slate-500">
              Se envía desde: <Link href={template.sentFrom} className="text-indigo-600 hover:underline">{template.sentFrom}</Link>
            </p>
          </div>

          {/* Variables */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Variables disponibles</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <code key={v} className="rounded-md border bg-muted px-2 py-0.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                  {`{{ ${v} }}`}
                </code>
              ))}
            </div>
          </div>

          {/* Mock preview */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Vista previa</p>
            <div className="rounded-lg border bg-white p-6 dark:bg-slate-900">
              <div className="border-b pb-3">
                <p className="text-xs text-slate-400">De: noreply@miempresa.com</p>
                <p className="text-xs text-slate-400">Para: usuario@ejemplo.com</p>
                <p className="mt-2 text-sm font-semibold">{template.subject.replace(/{{ \.SiteURL }}/g, 'MiPOS')}</p>
              </div>
              <div className="space-y-3 py-4 text-sm">
                <p>Hola,</p>
                {template.id === 'invite' && (
                  <>
                    <p>Te invitaron a unirte a una organización en MiPOS.</p>
                    <a className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Aceptar invitación</a>
                  </>
                )}
                {template.id === 'signup' && (
                  <>
                    <p>Gracias por registrarte. Confirmá tu cuenta haciendo click en el siguiente botón:</p>
                    <a className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Confirmar email</a>
                  </>
                )}
                {template.id === 'magic_link' && (
                  <>
                    <p>Hacé click en el siguiente botón para iniciar sesión:</p>
                    <a className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Iniciar sesión</a>
                    <p className="text-xs text-slate-500">Este link expira en 1 hora.</p>
                  </>
                )}
                {template.id === 'recovery' && (
                  <>
                    <p>Recibimos una solicitud para resetear tu contraseña. Si fuiste vos, hacé click acá:</p>
                    <a className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Resetear contraseña</a>
                  </>
                )}
                {template.id === 'email_change' && (
                  <>
                    <p>Estás cambiando tu email a una nueva dirección. Confirmá la operación:</p>
                    <a className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Confirmar cambio</a>
                  </>
                )}
                <p className="text-xs text-slate-500 pt-3">Si no solicitaste esto, ignorá este email.</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 text-center">
              Mockup aproximado — el contenido real lo define Supabase Auth en tu dashboard
            </p>
          </div>

          {/* Edit instructions */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex gap-3">
              <Settings className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Editar plantilla</p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                  Las plantillas de email se editan en el dashboard de Supabase → <strong>Authentication → Email Templates</strong>.
                </p>
                <a
                  href="https://supabase.com/dashboard/project/_/auth/templates"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >
                  Abrir Supabase Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function EmailsDashboard({ data }: { data: Data }) {
  const router = useRouter()
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | EmailTemplate['category']>('all')

  const filtered = categoryFilter === 'all'
    ? data.templates
    : data.templates.filter((t) => t.category === categoryFilter)

  const missingEnvVars = data.envChecks.filter((c) => !c.configured)

  const categoryPills: Array<{ key: 'all' | EmailTemplate['category']; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'auth', label: 'Auth' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'security', label: 'Seguridad' },
    { key: 'billing', label: 'Facturación' },
  ]

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Mail className="h-3.5 w-3.5" />
            Email & Comunicaciones
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Plantillas de email</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Catálogo de emails transaccionales gestionados por Supabase Auth, con preview y referencias del trigger en el código.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button asChild size="sm" className="gap-2">
            <a href="https://supabase.com/dashboard/project/_/auth/templates" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Editar en Supabase
            </a>
          </Button>
        </div>
      </header>

      {/* Env warning */}
      {missingEnvVars.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Faltan {missingEnvVars.length} variable{missingEnvVars.length !== 1 ? 's' : ''} de entorno
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Sin estas variables, algunos emails podrían no enviarse correctamente:
              {' '}
              {missingEnvVars.map((v) => <code key={v.key} className="mx-1 rounded bg-amber-100 px-1 text-[10px] dark:bg-amber-900/30">{v.key}</code>)}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Plantillas activas"
          value={`${data.stats.enabledTemplates}/${data.stats.totalTemplates}`}
          sub="provistas por Supabase Auth"
          icon={Mail}
          tone={data.stats.enabledTemplates === data.stats.totalTemplates ? 'success' : 'default'}
        />
        <StatCard
          label="Invitaciones 24h"
          value={data.stats.invitesLast24h}
          sub="orgs creadas (con/sin owner)"
          icon={UserPlus}
          tone="success"
        />
        <StatCard
          label="Logins 24h"
          value={data.stats.loginsLast24h}
          sub="incluye magic links"
          icon={LogIn}
          tone="info"
        />
        <StatCard
          label="Logins fallidos"
          value={data.stats.failedLogins24h}
          sub="últimas 24h"
          icon={XCircle}
          tone={data.stats.failedLogins24h > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* Templates */}
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Catálogo de plantillas</CardTitle>
              <Badge variant="outline" className="rounded-full text-xs">
                <Mail className="mr-1 h-3 w-3" />
                {filtered.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1 pt-2">
              {categoryPills.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setCategoryFilter(p.key)}
                  className={cn(
                    'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
                    categoryFilter === p.key
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Sin plantillas en esta categoría</p>
              </div>
            ) : (
              filtered.map((t) => {
                const catMeta = CATEGORY_META[t.category]
                const CatIcon = catMeta.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card">
                      <CatIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</p>
                        <Badge variant="outline" className={cn('rounded-full text-[10px]', catMeta.color)}>
                          {catMeta.label}
                        </Badge>
                        {t.enabled
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <XCircle className="h-3.5 w-3.5 text-slate-300" />
                        }
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <Code2 className="h-3 w-3" />
                        <code className="font-mono">{t.trigger}</code>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Side panel: env + activity */}
        <div className="space-y-4">
          {/* Env config */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                  <Key className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <CardTitle className="text-base">Configuración</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.envChecks.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    'rounded-lg border p-3',
                    c.configured
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                      : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {c.configured
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{c.label}</p>
                      <code className="block truncate text-[10px] font-mono text-slate-500">{c.key}</code>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{c.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Actividad reciente</CardTitle>
                <Badge variant="outline" className="rounded-full text-xs">
                  {data.activity.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Sin actividad reciente</p>
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {data.activity.map((a) => {
                    const meta = ACTIVITY_META[a.type]
                    const Icon = meta.icon
                    return (
                      <div key={a.id} className="flex items-start gap-2 rounded-md border bg-card p-2.5">
                        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', meta.color)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{meta.label}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {a.actorName || a.actorEmail?.split('@')[0] || 'Sistema'}
                            {a.target && <> · <span className="text-indigo-600">{a.target}</span></>}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono" title={formatDate(a.createdAt)}>
                            {relativeTime(a.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drawer */}
      {selected && <TemplatePreviewDrawer template={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Gauge,
  Globe,
  LogIn,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  TrendingUp,
  User,
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

export type MonitoringData = {
  services: Array<{
    id: string; name: string; kind: 'runtime' | 'table' | 'storage' | 'auth'
    status: 'ok' | 'warning' | 'error'; latency: number | null; detail: string
  }>
  overallLatency: number
  activity24h: {
    newOrgs: number; logins: number; errors: number; suspicious: number
  }
  subscriptions: {
    active: number; trialing: number; pastDue: number
  }
  recentEvents: Array<{
    id: string; action: string; severity: string; createdAt: string | null
    userId: string | null; userEmail: string | null; userName: string | null
  }>
  topActions: Array<{ action: string; count: number }>
  fetchedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(value: string | null) {
  if (!value) return 'desconocido'
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function latencyColor(latency: number | null) {
  if (latency === null) return 'text-slate-400'
  if (latency < 100) return 'text-emerald-600 dark:text-emerald-400'
  if (latency < 500) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function statusColor(status: 'ok' | 'warning' | 'error') {
  if (status === 'ok') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'warning') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function statusBg(status: 'ok' | 'warning' | 'error') {
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
  if (status === 'warning') return 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
  return 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
}

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') return <CheckCircle2 className={cn('h-4 w-4', statusColor(status))} />
  if (status === 'warning') return <AlertTriangle className={cn('h-4 w-4', statusColor(status))} />
  return <XCircle className={cn('h-4 w-4', statusColor(status))} />
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  login:        { label: 'Inicio de sesión',  color: 'text-emerald-600', icon: LogIn },
  login_failed: { label: 'Login fallido',     color: 'text-red-600',     icon: XCircle },
  logout:       { label: 'Cierre de sesión',  color: 'text-slate-500',   icon: User },
  create:       { label: 'Creación',          color: 'text-blue-600',    icon: Zap },
  update:       { label: 'Actualización',     color: 'text-cyan-600',    icon: RefreshCw },
  delete:       { label: 'Eliminación',       color: 'text-orange-600',  icon: XCircle },
  role_change:  { label: 'Cambio de rol',     color: 'text-amber-600',   icon: Shield },
  admin_api_access: { label: 'API admin',     color: 'text-violet-600',  icon: Server },
  update_user_status: { label: 'Cambio estado usuario', color: 'text-amber-600', icon: User },
  suspicious_activity: { label: 'Actividad sospechosa', color: 'text-red-600', icon: ShieldAlert },
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  medium:   'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
  high:     'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300',
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',
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
// Auto-refresh hook
// ---------------------------------------------------------------------------

function useAutoRefresh(enabled: boolean, intervalMs: number, onRefresh: () => void) {
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(onRefresh, intervalMs)
    return () => clearInterval(t)
  }, [enabled, intervalMs, onRefresh])
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function MonitoringDashboard({ data }: { data: MonitoringData }) {
  const router = useRouter()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => new Date().toLocaleTimeString('es-PY', { timeStyle: 'medium' }))

  const handleRefresh = () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 500)
  }

  useAutoRefresh(autoRefresh, 15000, handleRefresh)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleTimeString('es-PY', { timeStyle: 'medium' })), 1000)
    return () => clearInterval(t)
  }, [])

  const overallStatus: 'ok' | 'warning' | 'error' =
    data.services.some((s) => s.status === 'error') ? 'error'
    : data.services.some((s) => s.status === 'warning') ? 'warning'
    : 'ok'

  const subsTotal = data.subscriptions.active + data.subscriptions.trialing + data.subscriptions.pastDue
  const healthScore = subsTotal > 0
    ? Math.round(((data.subscriptions.active + data.subscriptions.trialing * 0.5) / subsTotal) * 100)
    : 100

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Activity className="h-3.5 w-3.5" />
            Monitoreo SaaS
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Salud del sistema</h1>
            {/* Live indicator */}
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              overallStatus === 'ok' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
              overallStatus === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
              overallStatus === 'error' && 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                overallStatus === 'ok' && 'bg-emerald-500 animate-pulse',
                overallStatus === 'warning' && 'bg-amber-500',
                overallStatus === 'error' && 'bg-red-500 animate-pulse',
              )} />
              {overallStatus === 'ok' && 'Todos los sistemas operativos'}
              {overallStatus === 'warning' && 'Atención requerida'}
              {overallStatus === 'error' && 'Problemas detectados'}
            </div>
          </div>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Probes en vivo de DB, actividad reciente y eventos de seguridad. Hora del servidor: <span className="font-mono">{now}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <div className={cn('h-1.5 w-1.5 rounded-full', autoRefresh ? 'bg-white animate-pulse' : 'bg-slate-400')} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/database-monitoring">
              <Database className="h-3.5 w-3.5" />
              DB detallada
            </Link>
          </Button>
        </div>
      </header>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latencia DB"
          value={`${data.overallLatency}ms`}
          sub="probes paralelas"
          icon={Gauge}
          tone={data.overallLatency < 500 ? 'success' : data.overallLatency < 1500 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Health score"
          value={`${healthScore}%`}
          sub={`${data.subscriptions.active} activas / ${data.subscriptions.pastDue} vencidas`}
          icon={TrendingUp}
          tone={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Logins 24h"
          value={data.activity24h.logins}
          sub={`${data.activity24h.newOrgs} nuevas organizaciones`}
          icon={LogIn}
          tone="info"
        />
        <StatCard
          label="Eventos críticos"
          value={data.activity24h.errors + data.activity24h.suspicious}
          sub={data.activity24h.suspicious > 0 ? `${data.activity24h.suspicious} sospechosos` : 'últimas 24h'}
          icon={Bell}
          tone={(data.activity24h.errors + data.activity24h.suspicious) > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Services + Top actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Services */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Servicios monitoreados</CardTitle>
              <span className="text-xs text-slate-400">{data.services.filter((s) => s.status === 'ok').length}/{data.services.length} OK</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.services.map((service) => {
                const Icon = service.kind === 'runtime' ? Server : service.kind === 'table' ? Database : service.kind === 'auth' ? Shield : Globe
                return (
                  <div key={service.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', statusBg(service.status))}>
                      <Icon className={cn('h-4 w-4', statusColor(service.status))} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{service.name}</p>
                        <Badge variant="outline" className="rounded-full text-[10px] text-slate-500">
                          {service.kind}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{service.detail}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <StatusIcon status={service.status} />
                        {service.latency !== null && (
                          <span className={cn('font-mono text-xs font-bold tabular-nums', latencyColor(service.latency))}>
                            {service.latency}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acciones frecuentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topActions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin actividad reciente</p>
            ) : (
              <div className="space-y-2.5">
                {data.topActions.map((a) => {
                  const meta = ACTION_META[a.action] ?? { label: a.action, color: 'text-slate-600', icon: Activity }
                  const ActionIcon = meta.icon
                  const max = data.topActions[0]?.count ?? 1
                  const percent = Math.round((a.count / max) * 100)
                  return (
                    <div key={a.action}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <ActionIcon className={cn('h-3 w-3', meta.color)} />
                          <span className="text-slate-700 dark:text-slate-300">{meta.label}</span>
                        </div>
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-slate-50">{a.count}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Eventos recientes</CardTitle>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Últimos 50 eventos del audit log
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href="/superadmin/audit-logs">
                Ver todos
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No hay eventos recientes</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentEvents.slice(0, 30).map((e) => {
                  const meta = ACTION_META[e.action] ?? { label: e.action, color: 'text-slate-600', icon: Activity }
                  const ActionIcon = meta.icon
                  return (
                    <div key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        <ActionIcon className={cn('h-3.5 w-3.5', meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{meta.label}</p>
                          <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', SEVERITY_COLOR[e.severity] ?? SEVERITY_COLOR.low)}>
                            {e.severity}
                          </Badge>
                          {e.userName || e.userEmail ? (
                            <span className="truncate text-xs text-slate-400">
                              {e.userName || e.userEmail?.split('@')[0]}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sistema</span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400 font-mono">
                        {relativeTime(e.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/superadmin/database-monitoring', icon: Database, label: 'DB detallada', sub: 'Queries, índices, growth' },
          { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit logs', sub: 'Historial completo' },
          { href: '/superadmin/storage-cleanup', icon: Server, label: 'Storage', sub: 'Limpieza y cuotas' },
          { href: '/superadmin/diagnostic', icon: Activity, label: 'Diagnóstico', sub: 'Pruebas de APIs' },
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

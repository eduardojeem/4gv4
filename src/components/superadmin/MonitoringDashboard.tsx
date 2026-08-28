'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  Sparkles,
  Search,
  Filter,
  Layers,
  Cpu,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MonitoringRobotMascot, type RobotMood } from './MonitoringRobotMascot'

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
    default: 'bg-white/90 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800',
    success: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/50 dark:bg-cyan-950/20',
  }
  const iconTones = {
    default: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
    danger:  'text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-300',
    info:    'text-cyan-600 bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300',
  }

  return (
    <Card className={cn('rounded-3xl border shadow-xs transition-all duration-200 hover:shadow-md backdrop-blur-md', tones[tone])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
              {value}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs', iconTones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Auto-refresh hook
// ---------------------------------------------------------------------------

/**
 * El reloj de la cabecera actualiza `now` cada segundo y eso re-renderiza todo
 * el dashboard. Si `onRefresh` entrara en las dependencias del efecto tal cual
 * -una funcion nueva en cada render, porque el caller no la memoiza-, el
 * intervalo de 15s se destruiria y se volveria a armar en cada uno de esos
 * renders por segundo, y nunca llegaria a cumplir el plazo para disparar. Por
 * eso la ultima version de `onRefresh` vive en un ref: el efecto que arma el
 * setInterval depende solo de `enabled` e `intervalMs`, y no se reinicia por
 * un simple cambio de identidad de la funcion.
 */
function useAutoRefresh(enabled: boolean, intervalMs: number, onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => onRefreshRef.current(), intervalMs)
    return () => clearInterval(t)
  }, [enabled, intervalMs])
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function MonitoringDashboard({ data }: { data: MonitoringData }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'audit'>('overview')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [eventSearch, setEventSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
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

  // El estado general solo miraba la conectividad de las tablas: la KPI de
  // "Eventos Criticos / Alertas" de mas abajo ya se pinta en rojo cuando hay
  // errores o actividad sospechosa en las ultimas 24h, pero eso no se reflejaba
  // ni en esta insignia ni en el estado de animo del robot. Se podia tener
  // actividad sospechosa activa con el robot sonriendo en verde porque las 4
  // tablas respondian bien.
  const activityAlerts = data.activity24h.errors + data.activity24h.suspicious
  const overallStatus: 'ok' | 'warning' | 'error' =
    data.services.some((s) => s.status === 'error') ? 'error'
    : data.services.some((s) => s.status === 'warning') || activityAlerts > 0 ? 'warning'
    : 'ok'

  const subsTotal = data.subscriptions.active + data.subscriptions.trialing + data.subscriptions.pastDue
  const healthScore = subsTotal > 0
    ? Math.round(((data.subscriptions.active + data.subscriptions.trialing * 0.5) / subsTotal) * 100)
    : 100

  // Robot mood determination
  const robotMood: RobotMood = refreshing
    ? 'scanning'
    : overallStatus === 'error'
    ? 'critical'
    : overallStatus === 'warning'
    ? 'warning'
    : 'healthy'

  const robotMessage = refreshing
    ? 'Ejecutando probes de latencia y verificando tablas...'
    : overallStatus === 'ok'
    ? `¡Todos los ${data.services.length} servicios de la plataforma responden con éxito a ${data.overallLatency}ms!`
    : overallStatus === 'warning'
    ? 'Detecté algunos servicios con tiempo de respuesta alto o advertencias.'
    : '¡Alerta! Uno o más servicios de base de datos reportaron fallas de conexión.'

  // Filtered events
  const filteredEvents = data.recentEvents.filter((e) => {
    const matchesSearch =
      e.action.toLowerCase().includes(eventSearch.toLowerCase()) ||
      (e.userEmail || '').toLowerCase().includes(eventSearch.toLowerCase()) ||
      (e.userName || '').toLowerCase().includes(eventSearch.toLowerCase()) ||
      (ACTION_META[e.action]?.label || '').toLowerCase().includes(eventSearch.toLowerCase())

    if (!matchesSearch) return false
    if (severityFilter === 'all') return true
    return e.severity === severityFilter
  })

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
            Superadmin · Monitoreo y Salud SaaS
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Telemetría y Salud del Sistema
            </h1>
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs',
              overallStatus === 'ok' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
              overallStatus === 'warning' && 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
              overallStatus === 'error' && 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800',
            )}>
              <span className={cn(
                'h-2 w-2 rounded-full',
                overallStatus === 'ok' && 'bg-emerald-500 animate-pulse',
                overallStatus === 'warning' && 'bg-amber-500',
                overallStatus === 'error' && 'bg-red-500 animate-pulse',
              )} />
              {overallStatus === 'ok' && 'Sistemas Operativos'}
              {overallStatus === 'warning' && 'Atención Requerida'}
              {overallStatus === 'error' && 'Problemas Detectados'}
            </div>
          </div>
          <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Diagnóstico en vivo de tablas Supabase, latencia paralela y eventos de seguridad. Hora: <span className="font-mono font-semibold">{now}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className={cn('gap-2 rounded-xl text-xs font-bold cursor-pointer transition-all', autoRefresh ? 'bg-emerald-600 text-white hover:bg-emerald-700' : '')}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <div className={cn('h-2 w-2 rounded-full', autoRefresh ? 'bg-white animate-pulse' : 'bg-slate-400')} />
            {autoRefresh ? 'Auto-refresh ON (15s)' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2 rounded-xl text-xs font-bold border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 cursor-pointer">
            <Link href="/superadmin/database-monitoring">
              <Database className="h-3.5 w-3.5" />
              DB Detallada
            </Link>
          </Button>
        </div>
      </header>

      {/* 🤖 ROBOT MASCOT GUARDIAN */}
      <MonitoringRobotMascot
        mood={robotMood}
        statusText={robotMessage}
        metrics={{
          latency: data.overallLatency,
          healthScore: healthScore,
          activeAlerts: data.activity24h.errors + data.activity24h.suspicious,
        }}
        onQuickAction={handleRefresh}
        actionLabel="Ejecutar Probe Ahora"
      />

      {/* Top metrics KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latencia Global"
          value={`${data.overallLatency} ms`}
          sub="Probes paralelas a la DB"
          icon={Gauge}
          tone={data.overallLatency < 300 ? 'success' : data.overallLatency < 1000 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Score de Salud"
          value={`${healthScore}%`}
          sub={`${data.subscriptions.active} activas · ${data.subscriptions.pastDue} vencidas`}
          icon={TrendingUp}
          tone={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Inicios de Sesión (24h)"
          value={data.activity24h.logins}
          sub={`${data.activity24h.newOrgs} organizaciones creadas`}
          icon={LogIn}
          tone="info"
        />
        <StatCard
          label="Eventos Críticos / Alertas"
          value={data.activity24h.errors + data.activity24h.suspicious}
          sub={data.activity24h.suspicious > 0 ? `${data.activity24h.suspicious} sospechosos` : 'Sin anomalías graves'}
          icon={Bell}
          tone={(data.activity24h.errors + data.activity24h.suspicious) > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Navigation View Tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white/90 p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer',
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-50'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          )}
        >
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          Vista General & Servicios
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer',
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-50'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          )}
        >
          <Shield className="h-3.5 w-3.5 text-violet-400" />
          Auditoría & Eventos ({data.recentEvents.length})
        </button>
      </div>

      {/* Tab: Overview & Services */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monitored Services */}
          <Card className="lg:col-span-2 rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                    Servicios y Tablas Monitoreadas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comprobación de conectividad y conteo de registros en tiempo real.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold border-emerald-200 text-xs">
                  {data.services.filter((s) => s.status === 'ok').length}/{data.services.length} Operativos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {data.services.map((service) => {
                  const Icon = service.kind === 'runtime' ? Server : service.kind === 'table' ? Database : service.kind === 'auth' ? Shield : Globe
                  return (
                    <div
                      key={service.id}
                      className={cn(
                        'flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all duration-200 hover:shadow-xs',
                        statusBg(service.status)
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 shadow-2xs border border-slate-200/60 dark:border-slate-700">
                          <Icon className={cn('h-5 w-5', statusColor(service.status))} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                              {service.name}
                            </p>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold uppercase text-slate-500">
                              {service.kind}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {service.detail}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1">
                          <StatusIcon status={service.status} />
                          {service.latency !== null && (
                            <span className={cn('font-mono text-xs font-black', latencyColor(service.latency))}>
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

          {/* Top Actions Breakdown */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                Acciones más Frecuentes
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución de operaciones registradas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {data.topActions.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-400">Sin actividad registrada</p>
              ) : (
                <div className="space-y-3.5">
                  {data.topActions.map((a) => {
                    const meta = ACTION_META[a.action] ?? { label: a.action, color: 'text-slate-600', icon: Activity }
                    const ActionIcon = meta.icon
                    const max = data.topActions[0]?.count ?? 1
                    const percent = Math.round((a.count / max) * 100)

                    return (
                      <div key={a.action} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <ActionIcon className={cn('h-3.5 w-3.5', meta.color)} />
                            <span className="text-slate-700 dark:text-slate-300">{meta.label}</span>
                          </div>
                          <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-slate-50">
                            {a.count}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Audit & Security Events */}
      {activeTab === 'audit' && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Registro de Eventos y Auditoría
                </CardTitle>
                <CardDescription className="text-xs">
                  Últimos eventos del sistema con nivel de severidad y usuario responsable.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar evento..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
                  {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverityFilter(sev)}
                      className={cn(
                        'rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                        severityFilter === sev
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs rounded-xl">
                  <Link href="/superadmin/audit-logs">
                    Ver todos
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {filteredEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-500">No se encontraron eventos con estos filtros</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto pr-1">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEvents.map((e) => {
                    const meta = ACTION_META[e.action] ?? { label: e.action, color: 'text-slate-600', icon: Activity }
                    const ActionIcon = meta.icon
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                            <ActionIcon className={cn('h-4 w-4', meta.color)} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {meta.label}
                              </p>
                              <Badge variant="outline" className={cn('rounded-full text-[9px] h-4 px-1.5 font-bold', SEVERITY_COLOR[e.severity] ?? SEVERITY_COLOR.low)}>
                                {e.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 truncate">
                              {e.userName || e.userEmail ? (
                                <span>{e.userName || e.userEmail}</span>
                              ) : (
                                <span className="italic">Acción del Sistema</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-xs text-slate-400 font-mono font-semibold">
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
      )}

      {/* Quick Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/superadmin/database-monitoring', icon: Database, label: 'DB Detallada', sub: 'Hit ratio, almacenamiento e índices' },
          { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit Logs', sub: 'Historial completo de auditoría' },
          { href: '/superadmin/storage-cleanup', icon: Server, label: 'Storage & Cuotas', sub: 'Archivos y optimización' },
          { href: '/superadmin/diagnostic', icon: Activity, label: 'Diagnóstico de APIs', sub: 'Pruebas de conectividad y endpoints' },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs transition-all duration-200 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950/40 transition-colors">
              <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{label}</p>
              <p className="truncate text-[11px] text-slate-400">{sub}</p>
            </div>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-cyan-500 transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  )
}

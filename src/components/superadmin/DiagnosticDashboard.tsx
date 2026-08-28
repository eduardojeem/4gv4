'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  Minus,
  Play,
  RefreshCw,
  Shield,
  Wrench,
  XCircle,
  Zap,
  Sparkles,
  Search,
  Download,
  Copy,
  Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { MonitoringRobotMascot, type RobotMood } from './MonitoringRobotMascot'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'
type Category = 'auth' | 'database' | 'env' | 'integration' | 'config'

type CheckResult = {
  id: string
  category: Category
  name: string
  description: string
  status: CheckStatus
  message: string
  latency?: number
  details?: Record<string, unknown>
}

type ApiResponse = {
  checks: CheckResult[]
  counts: { ok: number; warning: number; error: number; skipped: number; total: number }
  totalLatency: number
  runAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  auth:        { label: 'Autenticación', icon: Shield,   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800' },
  database:    { label: 'Base de Datos', icon: Database, color: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800' },
  env:         { label: 'Variables Env', icon: Key,      color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  integration: { label: 'Integraciones', icon: Zap,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  config:      { label: 'Configuración', icon: Wrench,   color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
}

const STATUS_META: Record<CheckStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  ok:      { label: 'Aprobado', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300', icon: CheckCircle2 },
  warning: { label: 'Aviso',    color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',           icon: AlertCircle },
  error:   { label: 'Falla',    color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',                       icon: XCircle },
  skipped: { label: 'Omitido',  color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',                 icon: Minus },
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-PY', { timeStyle: 'medium' }).format(new Date(value))
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
    success: 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200/80 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-cyan-200/80 bg-cyan-50/60 dark:border-cyan-900/50 dark:bg-cyan-950/20',
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
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
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
// Contextual Recommendations & Formatters
// ---------------------------------------------------------------------------

function getCheckAdvice(check: CheckResult): string | null {
  if (check.status === 'ok') return null

  if (check.category === 'env') {
    return 'Definí esta variable en el archivo .env.production o en el panel de tu proveedor de hosting para habilitar esta característica.'
  }

  if (check.id === 'integrity_org_settings') {
    return 'Existen organizaciones creadas sin fila de settings inicializada. Se recomienda ejecutar el script de bootstrap de organizaciones.'
  }

  if (check.id === 'integrity_orphan_subs') {
    return 'Se detectaron suscripciones vinculadas a organization_id inexistentes. Revisá la tabla subscriptions para depurar referencias huérfanas.'
  }

  if (check.id === 'cron_expire_trials') {
    return 'La función expire_trials() requiere la extensión pg_cron en Supabase para ejecutarse automáticamente.'
  }

  if (check.id === 'integration_pagopar') {
    return 'Configurá PAGOPAR_PUBLIC_KEY y PAGOPAR_PRIVATE_KEY para permitir cobros en Guaraníes vía tarjeta o billeteras.'
  }

  if (check.category === 'database') {
    return 'Comprobá los permisos RLS o la existencia de la tabla en tu esquema public de Supabase.'
  }

  return 'Revisá la configuración del servicio o la conexión a la base de datos.'
}

// ---------------------------------------------------------------------------
// Check row
// ---------------------------------------------------------------------------

function CheckRow({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'visual' | 'json'>('visual')
  const [copied, setCopied] = useState(false)
  const catMeta = CATEGORY_META[check.category] || CATEGORY_META.config
  const statusMeta = STATUS_META[check.status]
  const StatusIcon = statusMeta.icon
  const CatIcon = catMeta.icon
  const hasDetails = Boolean((check.details && Object.keys(check.details).length > 0) || check.latency !== undefined || getCheckAdvice(check))
  const advice = getCheckAdvice(check)

  const copyDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    const payload = {
      id: check.id,
      name: check.name,
      category: check.category,
      status: check.status,
      message: check.message,
      latency: check.latency,
      details: check.details,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopied(true)
    toast.success('Detalles copiados al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-white/95 dark:bg-slate-900/90 transition-all duration-200 hover:shadow-xs overflow-hidden',
      check.status === 'error' && 'border-red-200/90 bg-red-50/25 dark:border-red-900/60 dark:bg-red-950/15',
      check.status === 'warning' && 'border-amber-200/90 bg-amber-50/25 dark:border-amber-900/60 dark:bg-amber-950/15',
      check.status === 'ok' && 'border-slate-200/90 dark:border-slate-800'
    )}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        className={cn(
          'flex w-full items-start gap-3.5 p-4 text-left transition-colors',
          hasDetails && 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
        )}
      >
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs', catMeta.bg)}>
          <CatIcon className={cn('h-5 w-5', catMeta.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{check.name}</p>
            <Badge variant="outline" className={cn('rounded-full gap-1 text-[10px] font-bold px-2 py-0.5 shadow-2xs', statusMeta.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusMeta.label}
            </Badge>
            <span className="text-[11px] font-semibold text-slate-400">{catMeta.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">{check.description}</p>
          <p className="mt-1 text-xs">
            <span className={cn(
              'font-mono font-semibold',
              check.status === 'ok' && 'text-emerald-700 dark:text-emerald-300',
              check.status === 'warning' && 'text-amber-700 dark:text-amber-300',
              check.status === 'error' && 'text-red-700 dark:text-red-300',
              check.status === 'skipped' && 'text-slate-500'
            )}>
              → {check.message}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {check.latency !== undefined && (
            <span className={cn(
              'font-mono font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800',
              check.latency < 100 ? 'text-emerald-600 dark:text-emerald-400'
              : check.latency < 500 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
            )}>
              {check.latency}ms
            </span>
          )}
          {hasDetails && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Details Panel */}
      {hasDetails && expanded && (
        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 space-y-3">
          {/* Detail Tabs Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => setActiveDetailTab('visual')}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                  activeDetailTab === 'visual'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Métricas & Diagnóstico
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab('json')}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                  activeDetailTab === 'json'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                )}
              >
                Payload JSON
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={copyDetails}
              className="h-7 text-[11px] font-semibold gap-1.5 rounded-lg border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          {/* Visual Tab */}
          {activeDetailTab === 'visual' && (
            <div className="space-y-3 pt-1">
              {/* Key-Value Chips Grid */}
              {check.details && Object.keys(check.details).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(check.details).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/90 p-2.5 shadow-2xs">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-50 tabular-nums">
                        {val === null ? 'null' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Latency and Status pill if no details */}
              {(!check.details || Object.keys(check.details).length === 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/90 px-3 py-1.5 text-xs">
                    <span className="text-slate-400 font-semibold">Respuesta:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{check.message}</span>
                  </div>
                  {check.latency !== undefined && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/90 px-3 py-1.5 text-xs">
                      <span className="text-slate-400 font-semibold">Latencia:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{check.latency} ms</span>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendation Box if warning or error */}
              {advice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Recomendación Técnica: </span>
                    <span>{advice}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* JSON Tab */}
          {activeDetailTab === 'json' && (
            <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] font-mono text-emerald-300 border border-slate-800 leading-relaxed">
              {JSON.stringify(check.details ?? { message: check.message, latency: check.latency }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type CategoryFilter = 'all' | Category
type StatusFilter = 'all' | CheckStatus
type ViewMode = 'list' | 'grouped'

export function DiagnosticDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  async function runDiagnostic() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/diagnostic', { cache: 'no-store' })
      const payload = await res.json() as ApiResponse | { error?: string }
      if (!res.ok) {
        setError((payload as { error?: string }).error || 'Error al ejecutar diagnóstico')
        return
      }
      setData(payload as ApiResponse)
      toast.success('Diagnóstico completado con éxito')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  // Auto-run on mount
  useEffect(() => {
    runDiagnostic()
  }, [])

  const exportReport = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `diagnostico-sistema-${new Date().toISOString().split('T')[0]}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Informe exportado en formato JSON')
  }

  const filteredChecks = data?.checks.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false

    const matchCat = categoryFilter === 'all' || c.category === categoryFilter
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchCat && matchStatus
  }) ?? []

  const categoryPills: Array<{ key: CategoryFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'database', label: 'Base de Datos' },
    { key: 'auth', label: 'Autenticación' },
    { key: 'env', label: 'Variables Env' },
    { key: 'integration', label: 'Integraciones' },
    { key: 'config', label: 'Configuración' },
  ]

  const statusPills: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'error', label: 'Fallas' },
    { key: 'warning', label: 'Avisos' },
    { key: 'ok', label: 'Aprobados' },
  ]

  // Grouped checks map
  const categoriesList: Category[] = ['database', 'auth', 'env', 'integration', 'config']
  const groupedChecks = categoriesList.reduce((acc, cat) => {
    const checks = filteredChecks.filter((c) => c.category === cat)
    if (checks.length > 0) {
      acc[cat] = checks
    }
    return acc
  }, {} as Record<Category, CheckResult[]>)

  // Overall health & Robot Mood
  const overallStatus = !data
    ? 'loading'
    : data.counts.error > 0
    ? 'error'
    : data.counts.warning > 0
    ? 'warning'
    : 'ok'

  const robotMood: RobotMood = loading
    ? 'scanning'
    : overallStatus === 'error'
    ? 'critical'
    : overallStatus === 'warning'
    ? 'warning'
    : 'healthy'

  const robotMessage = loading
    ? 'Ejecutando suite completa de diagnóstico sobre Auth, DB, Env y APIs...'
    : overallStatus === 'ok'
    ? `¡Diagnóstico 100% Exitoso! Los ${data?.counts.total ?? 0} checks del sistema respondieron sin fallas en ${data?.totalLatency ?? 0}ms.`
    : overallStatus === 'warning'
    ? `Se detectaron ${data?.counts.warning ?? 0} advertencias en variables o integraciones. Todo sigue operativo.`
    : `¡Atención! Se registraron ${data?.counts.error ?? 0} errores que requieren corrección técnica.`

  const healthScore = data && data.counts.total > 0
    ? Math.round(((data.counts.ok + data.counts.warning * 0.5) / data.counts.total) * 100)
    : 100

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            <Bug className="h-3.5 w-3.5 text-cyan-500" />
            Superadmin · Diagnóstico de Sistema
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              Centro de Diagnóstico Técnico
            </h1>
            {data && (
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
                {overallStatus === 'ok' && 'Todo en Orden'}
                {overallStatus === 'warning' && 'Avisos Detectados'}
                {overallStatus === 'error' && 'Errores Detectados'}
              </div>
            )}
          </div>
          <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pruebas en tiempo real de Auth, base de datos, claves de entorno y conectividad de APIs.
            {data && <> Último escaneo: <span className="font-mono font-semibold">{formatTime(data.runAt)}</span> · {data.totalLatency}ms</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <Button variant="outline" size="sm" onClick={exportReport} className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
              <Download className="h-3.5 w-3.5" />
              Exportar Informe
            </Button>
          )}
          <Button
            onClick={runDiagnostic}
            disabled={loading}
            className="gap-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600 shadow-md cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Ejecutando...' : data ? 'Re-ejecutar Diagnóstico' : 'Ejecutar Diagnóstico'}
          </Button>
        </div>
      </header>

      {/* 🤖 ROBOT MASCOT GUARDIAN */}
      <MonitoringRobotMascot
        mood={robotMood}
        statusText={robotMessage}
        metrics={{
          latency: data?.totalLatency,
          healthScore: healthScore,
          activeAlerts: (data?.counts.error ?? 0) + (data?.counts.warning ?? 0),
        }}
        onQuickAction={runDiagnostic}
        actionLabel="Ejecutar Diagnóstico"
      />

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20 shadow-xs">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <span className="text-sm font-bold text-slate-500">Ejecutando pruebas de conectividad y variables...</span>
        </div>
      )}

      {data && (
        <>
          {/* Stats KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Score de Integridad"
              value={`${healthScore}%`}
              sub={`${data.counts.total} pruebas ejecutadas`}
              icon={Sparkles}
              tone={healthScore >= 90 ? 'success' : healthScore >= 70 ? 'warning' : 'danger'}
            />
            <StatCard
              label="Checks Aprobados"
              value={data.counts.ok}
              sub={`${Math.round((data.counts.ok / data.counts.total) * 100)}% del sistema`}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Avisos / Advertencias"
              value={data.counts.warning}
              sub={data.counts.warning > 0 ? 'Requieren revisión' : 'Sin advertencias'}
              icon={AlertCircle}
              tone={data.counts.warning > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Fallas Críticas"
              value={data.counts.error}
              sub={data.counts.error > 0 ? 'Bloquean operaciones' : 'Cero errores'}
              icon={XCircle}
              tone={data.counts.error > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* Results Card */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                      Resultados de Pruebas Unitarias
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                      {filteredChecks.length} de {data.checks.length} checks
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Inspección detallada de tablas, variables, roles y servicios en vivo.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                        viewMode === 'list'
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      )}
                    >
                      Lista Unificada
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grouped')}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                        viewMode === 'grouped'
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      )}
                    >
                      Por Categoría
                    </button>
                  </div>

                  <div className="relative w-full sm:w-52">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Buscar comprobación..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs rounded-xl"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer" onClick={runDiagnostic} disabled={loading}>
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    Re-ejecutar
                  </Button>
                </div>
              </div>

              {/* Status & Category Filters Toolbar */}
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                {/* Status pills */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
                  {statusPills.map((p) => {
                    const count = p.key === 'all'
                      ? data.counts.total
                      : data.counts[p.key as keyof typeof data.counts]
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setStatusFilter(p.key)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                          statusFilter === p.key
                            ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                        )}
                      >
                        <span>{p.label}</span>
                        <span className={cn(
                          'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold',
                          statusFilter === p.key ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        )}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700" />

                {/* Category pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {categoryPills.map((p) => {
                    const count = p.key === 'all'
                      ? data.checks.length
                      : data.checks.filter((c) => c.category === p.key).length
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setCategoryFilter(p.key)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border',
                          categoryFilter === p.key
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                        )}
                      >
                        <span>{p.label}</span>
                        <span className="text-[10px] font-bold text-slate-400">{count}</span>
                      </button>
                    )
                  })}
                </div>

                {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
                    className="text-xs font-bold text-cyan-600 hover:underline cursor-pointer pl-1"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {filteredChecks.length === 0 ? (
                <div className="py-16 text-center">
                  <Minus className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-bold text-slate-500">No se encontraron comprobaciones con estos filtros</p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-3">
                  {filteredChecks.map((c) => <CheckRow key={c.id} check={c} />)}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedChecks).map(([catKey, checks]) => {
                    const cat = catKey as Category
                    const meta = CATEGORY_META[cat]
                    const CatIcon = meta.icon
                    const okCount = checks.filter((c) => c.status === 'ok').length
                    return (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', meta.bg)}>
                              <CatIcon className={cn('h-4 w-4', meta.color)} />
                            </div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                              {meta.label}
                            </h3>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {okCount}/{checks.length} Aprobados
                          </Badge>
                        </div>
                        <div className="space-y-2.5">
                          {checks.map((c) => <CheckRow key={c.id} check={c} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Navigation Footer */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: '/superadmin/monitoring', icon: Globe, label: 'Salud en Vivo', sub: 'Telemetría de servicios' },
              { href: '/superadmin/database-monitoring', icon: Database, label: 'DB Detallada', sub: 'Hit ratio, almacenamiento e índices' },
              { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit Logs', sub: 'Historial completo de auditoría' },
            ].map((l) => {
              const Icon = l.icon
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs transition-all duration-200 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 cursor-pointer group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950/40 transition-colors">
                    <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{l.label}</p>
                    <p className="truncate text-xs text-slate-400">{l.sub}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-cyan-500 transition-colors" />
                </Link>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}

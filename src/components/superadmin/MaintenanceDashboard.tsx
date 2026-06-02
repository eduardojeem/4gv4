'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  FileX,
  HardDrive,
  History,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Shield,
  Trash2,
  TrendingDown,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaintenanceData = {
  audit: {
    total: number
    recent: number
    olderThan30: number
    olderThan60: number
    olderThan90: number
    olderThan180: number
  }
  cleanup: {
    canceledSubscriptions: number
    inactiveOrgs: number
  }
  history: Array<{
    id: string; action: string; createdAt: string | null
    payload: unknown; userId: string | null; severity: string | null
  }>
  fetchedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

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
// Confirm modal
// ---------------------------------------------------------------------------

function ConfirmModal({
  open, onClose, onConfirm, loading, title, description, danger, confirmText,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean
  title: string; description: React.ReactNode; danger?: boolean; confirmText: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              danger ? 'bg-red-100 dark:bg-red-950/40' : 'bg-amber-100 dark:bg-amber-950/40'
            )}>
              <AlertTriangle className={cn('h-5 w-5', danger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {confirmText}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------

function TaskCard({
  icon: Icon, title, description, tone, badge, onRun, disabled, loading, danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  tone: 'blue' | 'orange' | 'red' | 'emerald' | 'violet'
  badge?: string
  onRun: () => void
  disabled?: boolean
  loading?: boolean
  danger?: boolean
}) {
  const tones = {
    blue:    'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400',
    orange:  'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-400',
    red:     'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400',
    violet:  'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-400',
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
              {badge && (
                <Badge variant="outline" className="rounded-full text-[10px]">{badge}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant={danger ? 'destructive' : 'default'}
            className="h-8 gap-1.5 text-xs"
            onClick={onRun}
            disabled={disabled || loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Ejecutar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  rotate_audit_logs: 'Rotación de audit log',
  maintenance_task: 'Tarea de mantenimiento',
  reset_stats: 'Reset de estadísticas DB',
  storage_cleanup: 'Limpieza de storage',
}

export function MaintenanceDashboard({ data }: { data: MaintenanceData }) {
  const router = useRouter()
  const [runningTask, setRunningTask] = useState<string | null>(null)
  const [confirmTask, setConfirmTask] = useState<null | {
    id: string; title: string; description: React.ReactNode
    danger?: boolean; run: () => Promise<void>
  }>(null)

  const [retentionDays, setRetentionDays] = useState<30 | 60 | 90 | 180>(90)

  // ── Tasks ──────────────────────────────────────────────────────────────

  async function executeMaintenanceTask(task: string, params?: Record<string, unknown>) {
    setRunningTask(task)
    try {
      const res = await fetch('/api/superadmin/database/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, params }),
      })
      const payload = await res.json().catch(() => null) as { success?: boolean; message?: string; error?: string; deletedCount?: number } | null

      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || 'No se pudo ejecutar la tarea')
        return
      }
      toast.success(payload.message || 'Tarea ejecutada correctamente')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setRunningTask(null)
      setConfirmTask(null)
    }
  }

  function rotateLogs(days: 30 | 60 | 90 | 180) {
    const count = days === 30 ? data.audit.olderThan30
      : days === 60 ? data.audit.olderThan60
      : days === 90 ? data.audit.olderThan90
      : data.audit.olderThan180

    setConfirmTask({
      id: `rotate_${days}`,
      title: 'Rotar audit log',
      danger: true,
      description: (
        <div className="space-y-2">
          <p>Se eliminarán <strong className="text-red-600 dark:text-red-400">{count.toLocaleString('es-PY')} registros</strong> con más de {days} días.</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ Esta acción es irreversible. Los logs eliminados no pueden recuperarse.
          </p>
        </div>
      ),
      run: () => executeMaintenanceTask('rotate_audit_logs', { days }),
    })
  }

  function resetStats() {
    setConfirmTask({
      id: 'reset_stats',
      title: 'Reset de estadísticas DB',
      description: (
        <div className="space-y-2">
          <p>Resetea las estadísticas internas de PostgreSQL (pg_stat_*).</p>
          <p className="text-xs text-slate-500">
            Útil después de mejoras de performance para obtener métricas limpias. No afecta los datos.
          </p>
        </div>
      ),
      run: () => executeMaintenanceTask('reset_stats'),
    })
  }

  // ── Audit rotation panel ─────────────────────────────────────────────

  const retentionCounts = {
    30: data.audit.olderThan30,
    60: data.audit.olderThan60,
    90: data.audit.olderThan90,
    180: data.audit.olderThan180,
  }
  const candidateCount = retentionCounts[retentionDays]
  const percentToDelete = data.audit.total > 0 ? Math.round((candidateCount / data.audit.total) * 100) : 0

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Wrench className="h-3.5 w-3.5" />
            Mantenimiento
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Operaciones de mantenimiento</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Tareas administrativas reales: rotación de logs, limpieza de storage, optimización de DB. Las acciones quedan en el audit log.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Audit log total"
          value={data.audit.total.toLocaleString('es-PY')}
          sub={`${data.audit.recent.toLocaleString('es-PY')} de los últimos 30 días`}
          icon={Database}
        />
        <StatCard
          label="Logs antiguos"
          value={data.audit.olderThan90.toLocaleString('es-PY')}
          sub="con más de 90 días"
          icon={Clock}
          tone={data.audit.olderThan90 > 1000 ? 'warning' : 'default'}
        />
        <StatCard
          label="Suscripciones canceladas"
          value={data.cleanup.canceledSubscriptions}
          sub="candidatas a archivar"
          icon={FileX}
        />
        <StatCard
          label="Orgs inactivas"
          value={data.cleanup.inactiveOrgs}
          sub="sin actividad >90 días"
          icon={TrendingDown}
          tone={data.cleanup.inactiveOrgs > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">

          {/* Audit rotation - main panel */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-400">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Rotar audit log</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Elimina registros antiguos para liberar espacio en la DB</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Retention selector */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Conservar últimos:</p>
                <div className="flex gap-1.5">
                  {([30, 60, 90, 180] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRetentionDays(d)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2.5 text-center transition-colors',
                        retentionDays === d
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      )}
                    >
                      <p className="text-lg font-bold">{d}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider">días</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className={cn(
                'rounded-lg border p-3',
                candidateCount > 0
                  ? 'border-orange-200 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/10'
                  : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
              )}>
                <div className="flex items-start gap-3">
                  {candidateCount > 0
                    ? <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                    : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  }
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {candidateCount.toLocaleString('es-PY')} registros se eliminarán
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {candidateCount > 0
                        ? `~${percentToDelete}% del total (${data.audit.total.toLocaleString('es-PY')} registros) — se conservarán los últimos ${retentionDays} días`
                        : 'No hay registros más antiguos que el período seleccionado'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 gap-2"
                  onClick={() => rotateLogs(retentionDays)}
                  disabled={candidateCount === 0 || runningTask === 'rotate_audit_logs'}
                >
                  {runningTask === 'rotate_audit_logs'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                  Rotar {candidateCount > 0 && `(${candidateCount.toLocaleString('es-PY')})`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Other tasks */}
          <div className="grid gap-4 sm:grid-cols-2">
            <TaskCard
              icon={Zap}
              title="Reset estadísticas DB"
              description="Resetea pg_stat_* para empezar a medir limpio después de cambios de schema o índices."
              tone="violet"
              badge="Postgres"
              onRun={resetStats}
              loading={runningTask === 'reset_stats'}
            />
            <TaskCard
              icon={HardDrive}
              title="Limpieza de storage"
              description="Eliminar imágenes huérfanas y archivos sin referencia para liberar espacio."
              tone="emerald"
              badge="Storage"
              onRun={() => router.push('/superadmin/storage-cleanup')}
            />
          </div>

          {/* Cleanup recommendations */}
          {(data.cleanup.canceledSubscriptions > 0 || data.cleanup.inactiveOrgs > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recomendaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.cleanup.canceledSubscriptions > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex items-start gap-2">
                      <FileX className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                          {data.cleanup.canceledSubscriptions} suscripcion{data.cleanup.canceledSubscriptions !== 1 ? 'es' : ''} canceladas
                        </p>
                        <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                          Considerá archivar o analizar las causas de churn.
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                        <Link href="/superadmin/subscriptions">Ver</Link>
                      </Button>
                    </div>
                  </div>
                )}
                {data.cleanup.inactiveOrgs > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                      <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          {data.cleanup.inactiveOrgs} organización{data.cleanup.inactiveOrgs !== 1 ? 'es' : ''} inactiva{data.cleanup.inactiveOrgs !== 1 ? 's' : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                          Sin actividad por más de 90 días. Considerá contactar o pausar la suscripción.
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                        <Link href="/superadmin/organizations">Ver</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel: history */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                  <History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <CardTitle className="text-base">Historial</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.history.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Sin tareas ejecutadas todavía</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.history.map((h) => {
                    const payload = h.payload as Record<string, unknown> | null
                    return (
                      <div key={h.id} className="rounded-lg border bg-card p-2.5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {ACTION_LABELS[h.action] ?? h.action}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400" title={formatDate(h.createdAt)}>
                              {relativeTime(h.createdAt)}
                            </p>
                            {typeof payload?.deletedCount === 'number' && (
                              <p className="mt-0.5 text-[11px] text-orange-600 dark:text-orange-400">
                                {payload.deletedCount} eliminados
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enlaces rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { href: '/superadmin/database-monitoring', icon: Database, label: 'DB monitoring' },
                { href: '/superadmin/storage-cleanup', icon: HardDrive, label: 'Storage cleanup' },
                { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit logs' },
                { href: '/superadmin/monitoring', icon: Server, label: 'Health del sistema' },
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
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirmTask}
        onClose={() => setConfirmTask(null)}
        onConfirm={() => confirmTask?.run()}
        loading={runningTask !== null}
        title={confirmTask?.title ?? ''}
        description={confirmTask?.description ?? ''}
        danger={confirmTask?.danger}
        confirmText="Ejecutar"
      />
    </div>
  )
}

"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Download,
  HardDrive,
  History,
  Info,
  PieChart,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie as RechartsPie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  databaseMonitoringService,
  type DatabaseAlert,
  type MaintenanceTask,
  type MonitoringSource,
  isUnusedIndexReviewCandidate,
} from '@/services/database-monitoring-service'
import { useDatabaseMonitoring } from '@/hooks/use-database-monitoring'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const COLORS = ['#0f766e', '#f59e0b', '#2563eb', '#ef4444']

type MaintenanceAction = MaintenanceTask | 'refresh_metrics'

interface MetricCardProps {
  title: string
  value: string | number | null
  unit?: string
  description: string
  icon: React.ReactNode
  status?: 'good' | 'warning' | 'critical'
}

interface AlertCardProps {
  alert: DatabaseAlert
}

interface MaintenanceActivity {
  success: boolean
  task: MaintenanceAction
  title: string
  message: string
  executedAt: string
  retentionDays?: number
  deletedCount?: number
}

const RETENTION_LABELS: Record<string, string> = {
  '30': '30 dias',
  '60': '60 dias',
  '90': '90 dias',
  '180': '180 dias',
}

function getBadgeVariantForStatus(status: 'good' | 'warning' | 'critical') {
  if (status === 'critical') return 'destructive'
  if (status === 'warning') return 'secondary'
  return 'default'
}

function getBadgeVariantForSource(source: MonitoringSource) {
  if (source.status === 'unavailable') return 'destructive'
  if (source.status === 'partial') return 'secondary'
  return 'outline'
}

function MetricCard({ title, value, unit = '', description, icon, status = 'good' }: MetricCardProps) {
  const textClass =
    status === 'critical'
      ? 'text-red-600'
      : status === 'warning'
        ? 'text-amber-600'
        : 'text-green-600'

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-full bg-muted/30 p-2', textClass)}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', textClass)}>
          {value === null ? 'Unavailable' : typeof value === 'number' ? value.toLocaleString() : value}
          {value === null ? '' : unit}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function AlertCard({ alert }: AlertCardProps) {
  const severityClass =
    alert.severity === 'critical'
      ? 'border-red-200 bg-red-50 text-red-900'
      : alert.severity === 'high'
        ? 'border-orange-200 bg-orange-50 text-orange-900'
        : alert.severity === 'medium'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <div className={cn('rounded-lg border p-4', severityClass)}>
      <div className="flex items-start gap-3">
        {alert.severity === 'critical' ? (
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        )}
        <div className="space-y-1">
          <div className="font-medium">{alert.title}</div>
          <div className="text-sm opacity-90">{alert.description}</div>
          <div className="text-xs opacity-75">{new Date(alert.timestamp).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

function SourceCoverageCard({ source }: { source: MonitoringSource }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{source.label}</div>
        <Badge variant={getBadgeVariantForSource(source)}>{source.status}</Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{source.source}</div>
      {source.error && <div className="mt-1 text-xs text-red-600">{source.error}</div>}
    </div>
  )
}

interface MaintenanceTaskItemProps {
  title: string
  description: string
  icon: React.ReactNode
  loading: boolean
  disabled: boolean
  onExecute: () => void
}

function MaintenanceTaskItem({ title, description, icon, loading, disabled, onExecute }: MaintenanceTaskItemProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </div>
        <div className="max-w-[280px] text-xs text-muted-foreground">{description}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onExecute} disabled={disabled}>
        {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Ejecutar'}
      </Button>
    </div>
  )
}

function getMaintenanceActionTitle(task: MaintenanceAction): string {
  switch (task) {
    case 'reset_stats':
      return 'Reseteo de estadisticas'
    case 'rotate_logs':
      return 'Rotacion de logs'
    case 'refresh_metrics':
      return 'Refresco de metricas'
    default:
      return 'Mantenimiento'
  }
}

export default function DatabaseMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [retentionDays, setRetentionDays] = useState('90')
  const [runningTask, setRunningTask] = useState<MaintenanceAction | null>(null)
  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [lastMaintenanceActivity, setLastMaintenanceActivity] = useState<MaintenanceActivity | null>(null)

  const {
    metrics,
    loading,
    error,
    refreshing,
    refresh,
    performMaintenance,
  } = useDatabaseMonitoring({
    autoRefresh,
    refreshIntervalMs: 2 * 60 * 1000,
  })

  const formatBytes = (bytes: number | null) => databaseMonitoringService.formatBytes(bytes)

  const executeMaintenanceTask = async (task: MaintenanceTask, params?: { days?: number }) => {
    setRunningTask(task)

    try {
      const result = await performMaintenance(task, params)

      setLastMaintenanceActivity({
        success: result.success,
        task: result.task,
        title: getMaintenanceActionTitle(result.task),
        message: result.message,
        executedAt: result.executedAt,
        retentionDays: result.retentionDays,
        deletedCount: result.deletedCount,
      })

      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } finally {
      setRunningTask(null)
    }
  }

  const handleRefreshMetrics = async () => {
    setRunningTask('refresh_metrics')

    try {
      await refresh()
      toast.success('Se solicito una actualizacion inmediata de las metricas')
    } finally {
      setRunningTask(null)
    }
  }

  const exportMetrics = () => {
    if (!metrics) return

    const data = {
      exportedAt: new Date().toISOString(),
      collectedAt: metrics.collectedAt,
      overallStatus: metrics.overallStatus,
      missingMetrics: metrics.missingMetrics,
      sources: metrics.sources,
      totalSize: metrics.totalSize,
      tables: metrics.tablesSizes,
      connections: metrics.connectionStats,
      performance: metrics.queryPerformance,
      storageBreakdown: metrics.storageBreakdown,
      indexStats: metrics.indexStats,
      growthHistory: metrics.growthHistory,
      alerts: metrics.alerts.filter((alert) => !alert.resolved),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `database-monitoring-${new Date().toISOString().split('T')[0]}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const recommendations = useMemo(() => {
    if (!metrics) return []
    return databaseMonitoringService.getOptimizationRecommendations(metrics, metrics.indexStats)
  }, [metrics])

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <Database className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="animate-pulse text-muted-foreground">Cargando metricas de base de datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto mt-8 max-w-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error de conexion</AlertTitle>
        <AlertDescription className="mt-2">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            className="mt-4 bg-white/10 hover:bg-white/20"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) return null

  const activeAlerts = metrics.alerts.filter((alert) => !alert.resolved)
  const selectedRetentionLabel = RETENTION_LABELS[retentionDays] ?? `${retentionDays} dias`
  const maintenanceBusy = runningTask !== null || refreshing
  const sourceWarnings = metrics.sources.filter((source) => source.status !== 'ok')
  const storageBreakdownData = metrics.storageBreakdown
    ? [
        { name: 'Relations', value: Math.round(metrics.storageBreakdown.relations / (1024 * 1024)), color: COLORS[0] },
        { name: 'Indexes', value: Math.round(metrics.storageBreakdown.indexes / (1024 * 1024)), color: COLORS[1] },
        { name: 'Unclassified', value: Math.round(metrics.storageBreakdown.unclassified / (1024 * 1024)), color: COLORS[2] },
      ]
    : []
  const tablesSizeData = metrics.tablesSizes.slice(0, 8).map((table) => ({
    name: table.tableName,
    size: Math.round(table.size / (1024 * 1024)),
    percentage: table.percentage,
  }))

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2.5 shadow-sm">
            <Database className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">
              Monitoreo de Base de Datos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Rendimiento, cobertura de telemetria y salud operativa del backend
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              className="data-[state=checked]:bg-green-500"
            />
            <Label htmlFor="auto-refresh" className="cursor-pointer select-none text-xs font-medium">
              Auto (2m)
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={exportMetrics}>
            <Download className="mr-1.5 h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {sourceWarnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Cobertura parcial de telemetria</AlertTitle>
          <AlertDescription className="text-amber-700">
            Este panel ya no rellena huecos con datos simulados. Algunas fuentes siguen sin estar disponibles y deben corregirse en el backend.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Snapshot status</div>
              <div className="mt-2">
                <Badge variant={metrics.overallStatus === 'unavailable' ? 'destructive' : metrics.overallStatus === 'partial' ? 'secondary' : 'default'}>
                  {metrics.overallStatus}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Collected at</div>
              <div className="mt-2 text-sm font-medium">{new Date(metrics.collectedAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Operational alerts</div>
              <div className="mt-2 text-sm font-medium">{activeAlerts.length}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Dedicated actions</div>
              <div className="mt-2 text-sm">
                <Link href="/superadmin/storage-cleanup" className="text-primary underline underline-offset-4">
                  Abrir workspace de storage cleanup
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cobertura por fuente</CardTitle>
            <CardDescription>
              Cada bloque indica si la telemetria esta disponible, parcial o ausente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {metrics.sources.map((source) => (
              <SourceCoverageCard key={source.id} source={source} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioridades rapidas</CardTitle>
            <CardDescription>Lo primero que un admin tecnico deberia mirar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="font-medium">1. Cobertura del dashboard</div>
              <div className="mt-1 text-muted-foreground">
                {metrics.missingMetrics.length > 0
                  ? `Faltan ${metrics.missingMetrics.length} fuentes clave. No tomes decisiones estructurales hasta restaurarlas.`
                  : 'Todas las fuentes configuradas reportaron datos.'}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="font-medium">2. Alertas activas</div>
              <div className="mt-1 text-muted-foreground">
                {activeAlerts.length > 0
                  ? `${activeAlerts.length} alertas activas requieren revision.`
                  : 'No se detectaron alertas activas en esta toma.'}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="font-medium">3. Acciones separadas</div>
              <div className="mt-1 text-muted-foreground">
                Las tareas destructivas quedaron fuera del dashboard principal para reducir errores operativos.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Alertas activas ({activeAlerts.length})
          </h2>
          <div className="grid gap-3">
            {activeAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Tamano total"
          value={formatBytes(metrics.totalSize)}
          description={metrics.totalSize === null ? 'Sin telemetria de tamano real' : 'Medido por RPC del backend'}
          icon={<HardDrive className="h-5 w-5" />}
          status={metrics.totalSize === null ? 'warning' : metrics.totalSize > 1024 * 1024 * 1024 ? 'warning' : 'good'}
        />
        <MetricCard
          title="Conexiones activas"
          value={metrics.connectionStats?.activeConnections ?? null}
          unit={metrics.connectionStats?.maxConnections ? `/${metrics.connectionStats.maxConnections}` : ''}
          description={metrics.connectionStats?.connectionUsage !== null && metrics.connectionStats?.connectionUsage !== undefined
            ? `${metrics.connectionStats.connectionUsage.toFixed(1)}% de las conexiones observadas`
            : 'Sin limite confiable expuesto por backend'}
          icon={<Users className="h-5 w-5" />}
          status={(metrics.connectionStats?.connectionUsage ?? 0) > 80 ? 'warning' : metrics.connectionStats ? 'good' : 'warning'}
        />
        <MetricCard
          title="Avg query time"
          value={metrics.queryPerformance?.avgQueryTime ?? null}
          unit={metrics.queryPerformance?.avgQueryTime !== null && metrics.queryPerformance?.avgQueryTime !== undefined ? 'ms' : ''}
          description={metrics.queryPerformance?.avgQueryTime !== null && metrics.queryPerformance?.avgQueryTime !== undefined
            ? 'Latencia promedio informada por backend'
            : 'La capa actual no expone latencia util'}
          icon={<Clock className="h-5 w-5" />}
          status={(metrics.queryPerformance?.avgQueryTime ?? 0) > 500 ? 'warning' : metrics.queryPerformance?.avgQueryTime !== null && metrics.queryPerformance?.avgQueryTime !== undefined ? 'good' : 'warning'}
        />
        <MetricCard
          title="Cache hit ratio"
          value={metrics.queryPerformance?.cacheHitRatio ?? null}
          unit={metrics.queryPerformance?.cacheHitRatio !== null && metrics.queryPerformance?.cacheHitRatio !== undefined ? '%' : ''}
          description={metrics.queryPerformance?.cacheHitRatio !== null && metrics.queryPerformance?.cacheHitRatio !== undefined
            ? 'Eficiencia de cache reportada por backend'
            : 'Sin telemetria de cache'}
          icon={<Zap className="h-5 w-5" />}
          status={(metrics.queryPerformance?.cacheHitRatio ?? 100) < 80 ? 'warning' : metrics.queryPerformance?.cacheHitRatio !== null && metrics.queryPerformance?.cacheHitRatio !== undefined ? 'good' : 'warning'}
        />
      </div>

      <Tabs defaultValue="tables" className="space-y-6">
        <div className="overflow-x-auto px-1">
          <TabsList className="inline-flex min-w-full w-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:w-full">
            <TabsTrigger value="tables">Tablas</TabsTrigger>
            <TabsTrigger value="indexes">Indices</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
            <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tables" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Tamano por tabla
                </CardTitle>
                <CardDescription>Distribucion del espacio reportado por cada tabla.</CardDescription>
              </CardHeader>
              <CardContent>
                {tablesSizeData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                    No hay telemetria de tablas disponible en este snapshot.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tablesSizeData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={90} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value} MB`, 'Tamano']} />
                      <Bar dataKey="size" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de tablas</CardTitle>
                <CardDescription>Ordenadas por peso relativo dentro del snapshot.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-2">
                  {metrics.tablesSizes.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No table telemetry is currently available.
                    </div>
                  ) : (
                    metrics.tablesSizes.map((table) => (
                      <div key={table.tableName} className="rounded-lg border p-3 transition-colors hover:bg-muted/30">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium">{table.tableName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {table.rowCount.toLocaleString()} filas registradas
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatBytes(table.size)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{table.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, table.percentage)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="indexes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Analisis de indices
              </CardTitle>
              <CardDescription>Indices observados por el backend y su nivel de uso.</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.indexStats.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No existe una fuente RPC funcional para indices en este entorno. Esta vista permanece vacia hasta implementarla.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-2">
                  {metrics.indexStats.map((index) => (
                    <div key={`${index.tableName}-${index.indexName}`} className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{index.indexName}</span>
                          {isUnusedIndexReviewCandidate(index) ? (
                            <Badge variant="destructive">Revisar</Badge>
                          ) : index.isUnused ? (
                            <Badge variant="outline">0 scans</Badge>
                          ) : null}
                          {index.isPrimary && <Badge variant="secondary">PK</Badge>}
                          {!index.isPrimary && index.isUnique && <Badge variant="secondary">Unique</Badge>}
                          {!index.isPrimary && !index.isUnique && index.isConstraintBacked && <Badge variant="secondary">Constraint</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">Tabla: {index.tableName}</div>
                        <div className="text-xs text-muted-foreground">
                          {index.statsResetAt
                            ? `Ventana observada desde ${new Date(index.statsResetAt).toLocaleDateString()}`
                            : 'Sin fecha confiable de reset de estadisticas'}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Escaneos</div>
                          <div className="font-medium">{index.scans.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Lecturas</div>
                          <div className="font-medium">{index.reads.toLocaleString()}</div>
                        </div>
                        <div className="min-w-[96px] text-right">
                          <div className="text-xs text-muted-foreground">Tamano</div>
                          <div className="font-bold">{formatBytes(index.sizeBytes)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Clasificacion de storage
                </CardTitle>
                <CardDescription>
                  Solo se muestran categorias soportadas por telemetria real. Ya no hay estimaciones artificiales de logs o temp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {storageBreakdownData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                    Exact storage classification is unavailable until backend index telemetry is implemented.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <RechartsPie
                        data={storageBreakdownData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => percent && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        labelLine={false}
                      >
                        {storageBreakdownData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </RechartsPie>
                      <Tooltip formatter={(value) => `${value} MB`} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de storage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {storageBreakdownData.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      El dashboard no muestra breakdown inventado. Implementa una fuente real antes de usar este bloque para capacity planning.
                    </AlertDescription>
                  </Alert>
                ) : (
                  storageBreakdownData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold">{item.value} MB</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(item.value / storageBreakdownData.reduce((sum, row) => sum + row.value, 0)) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Salud de conexiones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {metrics.connectionStats ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Uso observado</span>
                        <span className="text-2xl font-bold">
                          {metrics.connectionStats.connectionUsage !== null && metrics.connectionStats.connectionUsage !== undefined
                            ? `${metrics.connectionStats.connectionUsage.toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <Progress value={metrics.connectionStats.connectionUsage ?? 0} className="h-3" />
                      <p className="text-xs text-muted-foreground">
                        {metrics.connectionStats.activeConnections} conexiones activas
                        {metrics.connectionStats.maxConnections ? ` de ${metrics.connectionStats.maxConnections} observadas en la toma` : '. Sin limite confiable.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-muted/30 p-4">
                        <div className="mb-1 text-sm text-muted-foreground">Tiempo de conexion</div>
                        <div className="text-xl font-bold">
                          {metrics.connectionStats.avgConnectionTime !== null && metrics.connectionStats.avgConnectionTime !== undefined
                            ? `${metrics.connectionStats.avgConnectionTime}ms`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-4">
                        <div className="mb-1 text-sm text-muted-foreground">Estado</div>
                        <Badge variant={getBadgeVariantForStatus((metrics.connectionStats.connectionUsage ?? 0) > 80 ? 'warning' : 'good')}>
                          {(metrics.connectionStats.connectionUsage ?? 0) > 80 ? 'Presion alta' : 'Estable'}
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>No hay telemetria de conexiones disponible en este entorno.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Queries lentas
                </CardTitle>
                <CardDescription>Solo se muestran si la fuente del backend las expone de verdad.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[320px] space-y-3 overflow-y-auto">
                  {(metrics.queryPerformance?.slowQueries ?? []).map((query, index) => (
                    <div key={`${query.query}-${index}`} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30">
                      <div className="mb-3 break-all rounded bg-muted p-2.5 font-mono text-xs text-muted-foreground">
                        {query.query}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline">{query.duration}ms</Badge>
                        <span className="text-xs text-muted-foreground">
                          {query.frequency} ejecuciones
                        </span>
                      </div>
                    </div>
                  ))}

                  {(metrics.queryPerformance?.slowQueries ?? []).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="mb-2 h-8 w-8 text-green-500" />
                      <p className="text-sm">
                        {metrics.queryPerformance ? 'No se recibieron slow queries del backend.' : 'No existe telemetria util de performance en este entorno.'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Crecimiento historico
              </CardTitle>
              <CardDescription>
                Requiere una fuente persistente de snapshots; si no existe, este bloque se mantiene vacio de forma honesta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.growthHistory.length === 0 ? (
                <div className="flex h-[400px] items-center justify-center text-center text-sm text-muted-foreground">
                  No hay historial de crecimiento disponible. Implementa snapshots server-side antes de usar esta vista.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={metrics.growthHistory}>
                    <defs>
                      <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} MB`, 'Tamano']} />
                    <Area type="monotone" dataKey="size" stroke={COLORS[0]} fillOpacity={1} fill="url(#colorSize)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Recomendaciones priorizadas
              </CardTitle>
              <CardDescription>
                Estas sugerencias ya consideran cobertura parcial para evitar conclusiones falsas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {recommendations.map((recommendation, index) => (
                  <div key={`${recommendation}-${index}`} className="flex items-start gap-4 rounded-xl border bg-gradient-to-r from-background to-muted/30 p-4">
                    <div className="mt-1 rounded-full bg-green-100 p-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Sugerencia #{index + 1}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Tareas de mantenimiento
                </CardTitle>
                <CardDescription>
                  Las acciones destructivas viven aqui y no en el dashboard operacional primario.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MaintenanceTaskItem
                  title="Resetear estadisticas"
                  description="Limpia acumulados de rendimiento usados por el panel y reinicia la base comparativa."
                  icon={<Activity className="h-4 w-4 text-blue-500" />}
                  onExecute={() => setConfirmResetOpen(true)}
                  loading={runningTask === 'reset_stats'}
                  disabled={maintenanceBusy}
                />
                <MaintenanceTaskItem
                  title="Refrescar metricas"
                  description="Fuerza una nueva toma del dashboard sin recargar toda la pagina."
                  icon={<RefreshCw className="h-4 w-4 text-green-500" />}
                  onExecute={() => void handleRefreshMetrics()}
                  loading={runningTask === 'refresh_metrics'}
                  disabled={maintenanceBusy}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Rotacion de logs
                </CardTitle>
                <CardDescription>
                  Gestiona el crecimiento de <code>audit_log</code> fuera del flujo de observabilidad diaria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-muted/20 p-5">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Politica de retencion</div>
                      <div className="text-xs text-muted-foreground">
                        Define cuantos dias de historial conservar antes de la eliminacion.
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={retentionDays} onValueChange={setRetentionDays} disabled={maintenanceBusy}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="180">180 dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={() => setConfirmRotateOpen(true)} disabled={maintenanceBusy}>
                        {runningTask === 'rotate_logs' ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Ejecutar'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{selectedRetentionLabel}</Badge>
                      <span>90 dias sigue siendo la politica recomendada para operacion diaria.</span>
                    </div>
                  </div>
                </div>

                <Alert className="border-yellow-200 bg-yellow-50/50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800">
                    Esta accion es destructiva. Exporta evidencia relevante antes de rotar si tu equipo la necesita para auditoria.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Estado del mantenimiento
              </CardTitle>
              <CardDescription>
                Resumen del ultimo mantenimiento ejecutado desde este panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Retencion activa</div>
                  <div className="mt-2 text-lg font-semibold">{selectedRetentionLabel}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Se aplicara en la proxima rotacion manual.</div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Ultima accion</div>
                  <div className="mt-2 text-lg font-semibold">
                    {lastMaintenanceActivity ? lastMaintenanceActivity.title : 'Sin ejecuciones'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {lastMaintenanceActivity ? new Date(lastMaintenanceActivity.executedAt).toLocaleString() : 'Aun no se ejecuto mantenimiento en esta sesion.'}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Estado actual</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={lastMaintenanceActivity?.success === false ? 'destructive' : 'secondary'}>
                      {lastMaintenanceActivity ? (lastMaintenanceActivity.success ? 'Correcto' : 'Con error') : 'Pendiente'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {maintenanceBusy ? 'Hay una tarea en ejecucion ahora mismo.' : 'No hay tareas de mantenimiento corriendo.'}
                  </div>
                </div>
              </div>

              {lastMaintenanceActivity && (
                <Alert variant={lastMaintenanceActivity.success ? 'default' : 'destructive'}>
                  {lastMaintenanceActivity.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>{lastMaintenanceActivity.title}</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <p>{lastMaintenanceActivity.message}</p>
                    {lastMaintenanceActivity.retentionDays && <p>Retencion aplicada: {lastMaintenanceActivity.retentionDays} dias.</p>}
                    {typeof lastMaintenanceActivity.deletedCount === 'number' && <p>Registros eliminados: {lastMaintenanceActivity.deletedCount}.</p>}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <ConfirmationDialog
            open={confirmResetOpen}
            onOpenChange={setConfirmResetOpen}
            title="Resetear estadisticas de monitoreo"
            description="Esta accion reinicia los acumulados de rendimiento usados por el panel. No borra datos operativos, pero afecta comparaciones historicas."
            confirmText="Resetear"
            variant="warning"
            isLoading={runningTask === 'reset_stats'}
            onConfirm={async () => {
              await executeMaintenanceTask('reset_stats')
            }}
          />

          <ConfirmationDialog
            open={confirmRotateOpen}
            onOpenChange={setConfirmRotateOpen}
            title="Ejecutar rotacion de logs"
            description={`Se conservaran ${selectedRetentionLabel} de historial en audit_log y se eliminara el resto. Esta accion no se puede deshacer.`}
            confirmText="Rotar logs"
            variant="destructive"
            requireConfirmText="ROTAR"
            isLoading={runningTask === 'rotate_logs'}
            onConfirm={async () => {
              const days = parseInt(retentionDays, 10)
              await executeMaintenanceTask('rotate_logs', { days })
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

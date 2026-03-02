"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Database, 
  HardDrive, 
  Activity, 
  Clock, 
  Users, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
  PieChart,
  Table as TableIcon,
  Settings,
  Wrench,
  Trash2,
  Search,
  FileSearch,
  ShieldCheck,
  Package,
  History,
  Info
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { databaseMonitoringService, DatabaseMetrics, DatabaseAlert, TableSize } from '@/services/database-monitoring-service'
import { useDatabaseMonitoring } from '@/hooks/use-database-monitoring'
import { useStorageCleanup } from '@/hooks/use-storage-cleanup'
import { storageCleanupService } from '@/services/storage-cleanup-service'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Colores para gráficos
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff88', '#ff8042', '#8dd1e1', '#d084d0']

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  status?: 'good' | 'warning' | 'critical'
  description?: string
  isMock?: boolean
}

function MetricCard({ title, value, unit = '', icon, trend, trendValue, status = 'good', description, isMock }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-red-500" />
      case 'down': return <TrendingDown className="h-3 w-3 text-green-500" />
      default: return null
    }
  }

  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-md">
      {isMock && (
        <div className="absolute top-0 right-0 p-1">
          <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground bg-muted/50">Simulado</Badge>
        </div>
      )}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-full bg-muted/30", getStatusColor())}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", getStatusColor())}>
          {typeof value === 'number' ? value.toLocaleString() : value}{unit}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && trendValue !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {getTrendIcon()}
            <span className="ml-1">
              {Math.abs(trendValue).toFixed(1)}% desde ayer
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AlertCardProps {
  alert: DatabaseAlert
  onResolve?: (alertId: string) => void
}

function AlertCard({ alert, onResolve }: AlertCardProps) {
  const getSeverityStyles = (severity: DatabaseAlert['severity']) => {
    switch (severity) {
      case 'low': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' }
      case 'medium': return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-600' }
      case 'high': return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: 'text-orange-600' }
      case 'critical': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-600' }
    }
  }

  const styles = getSeverityStyles(alert.severity)

  const getSeverityIcon = (severity: DatabaseAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className={cn("h-5 w-5", styles.icon)} />
      default: return <AlertTriangle className={cn("h-5 w-5", styles.icon)} />
    }
  }

  return (
    <div className={cn("flex items-start justify-between p-4 rounded-lg border", styles.bg, styles.border)}>
      <div className="flex items-start gap-3">
        {getSeverityIcon(alert.severity)}
        <div>
          <div className={cn("font-medium", styles.text)}>{alert.title}</div>
          <div className={cn("text-sm mt-1 opacity-90", styles.text)}>{alert.description}</div>
          <div className={cn("text-xs mt-2 opacity-75", styles.text)}>
            {alert.timestamp.toLocaleString()}
          </div>
        </div>
      </div>
      {onResolve && !alert.resolved && (
        <Button 
          size="sm" 
          variant="outline"
          className="bg-white/50 hover:bg-white/80 border-transparent shadow-sm"
          onClick={() => onResolve(alert.id)}
        >
          Resolver
        </Button>
      )}
    </div>
  )
}

export default function DatabaseMonitoring() {
  const { 
    metrics, 
    loading, 
    error, 
    refreshing, 
    refresh,
    quickMetrics,
    performMaintenance
  } = useDatabaseMonitoring()
  
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [growthHistory, setGrowthHistory] = useState<{ date: string; size: number }[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])

  // Cargar datos adicionales
  useEffect(() => {
    const loadAdditionalData = async () => {
      try {
        const [historyData, recommendationsData] = await Promise.all([
          databaseMonitoringService.getDatabaseGrowthHistory(30),
          databaseMonitoringService.getOptimizationRecommendations()
        ])

        setGrowthHistory(historyData)
        setRecommendations(recommendationsData)
      } catch (err) {
        console.error('Error cargando datos adicionales:', err)
      }
    }

    if (metrics) {
      loadAdditionalData()
    }
  }, [metrics])

  const handleResolveAlert = (alertId: string) => {
    if (!metrics) return
    // En una implementación real, esto haría una llamada a la API
    refresh()
  }

  const formatBytes = (bytes: number): string => {
    return databaseMonitoringService.formatBytes(bytes)
  }

  const exportMetrics = () => {
    if (!metrics) return
    
    const data = {
      timestamp: new Date().toISOString(),
      totalSize: formatBytes(metrics.totalSize),
      tables: metrics.tablesSizes.map(table => ({
        name: table.tableName,
        size: formatBytes(table.size),
        rows: table.rowCount,
        percentage: table.percentage.toFixed(2) + '%'
      })),
      connections: metrics.connectionStats,
      performance: metrics.queryPerformance,
      alerts: metrics.alerts.filter(alert => !alert.resolved)
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `database-metrics-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground animate-pulse">Cargando métricas de base de datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error de conexión</AlertTitle>
        <AlertDescription className="mt-2">
          <p>{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="mt-4 bg-white/10 hover:bg-white/20 border-white/20"
          >
            Reintentar conexión
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) return null

  // Preparar datos para gráficos
  const tablesSizeData = metrics.tablesSizes.slice(0, 8).map(table => ({
    name: table.tableName,
    size: Math.round(table.size / (1024 * 1024)), // MB
    percentage: table.percentage
  }))

  const storageBreakdownData = [
    { name: 'Tablas', value: Math.round(metrics.storageBreakdown.tables / (1024 * 1024)), color: COLORS[0] },
    { name: 'Índices', value: Math.round(metrics.storageBreakdown.indexes / (1024 * 1024)), color: COLORS[1] },
    { name: 'Logs', value: Math.round(metrics.storageBreakdown.logs / (1024 * 1024)), color: COLORS[2] },
    { name: 'Temporal', value: Math.round(metrics.storageBreakdown.temp / (1024 * 1024)), color: COLORS[3] },
    { name: 'Otros', value: Math.round(metrics.storageBreakdown.other / (1024 * 1024)), color: COLORS[4] }
  ]

  const activeAlerts = metrics.alerts.filter(alert => !alert.resolved)

  return (
    <div className="space-y-6 pb-10">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" />
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm shadow-inner">
                <Database className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Monitoreo de Base de Datos</h1>
                <p className="text-indigo-200 text-sm">Supervisión en tiempo real de rendimiento y almacenamiento</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={exportMetrics}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button 
              onClick={refresh}
              disabled={refreshing}
              className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Warning de Datos Simulados */}
      {metrics.isMockData && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 font-medium">Modo Simulación Activo</AlertTitle>
          <AlertDescription className="text-amber-700">
            Algunas métricas no se pudieron obtener directamente de la base de datos y se están mostrando valores simulados o estimados. 
            Esto puede deberse a falta de permisos o configuración de funciones RPC.
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas activas */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Alertas Activas ({activeAlerts.length})
          </h2>
          <div className="grid gap-3">
            {activeAlerts.map(alert => (
              <AlertCard 
                key={alert.id} 
                alert={alert} 
                onResolve={handleResolveAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tamaño Total"
          value={formatBytes(metrics.totalSize)}
          icon={<HardDrive className="h-5 w-5" />}
          status={metrics.totalSize > 1024 * 1024 * 1024 ? 'warning' : 'good'}
          description="Espacio usado en disco"
          isMock={metrics.isMockData}
        />
        <MetricCard
          title="Conexiones Activas"
          value={metrics.connectionStats.activeConnections}
          unit={`/${metrics.connectionStats.maxConnections}`}
          icon={<Users className="h-5 w-5" />}
          status={metrics.connectionStats.connectionUsage > 70 ? 'warning' : 'good'}
          description={`${metrics.connectionStats.connectionUsage}% de capacidad`}
          isMock={metrics.connectionStats.isMock}
        />
        <MetricCard
          title="Tiempo Promedio Query"
          value={metrics.queryPerformance.avgQueryTime}
          unit="ms"
          icon={<Clock className="h-5 w-5" />}
          status={metrics.queryPerformance.avgQueryTime > 500 ? 'warning' : 'good'}
          description="Latencia media"
          isMock={metrics.queryPerformance.isMock}
        />
        <MetricCard
          title="Cache Hit Ratio"
          value={metrics.queryPerformance.cacheHitRatio}
          unit="%"
          icon={<Zap className="h-5 w-5" />}
          status={metrics.queryPerformance.cacheHitRatio < 80 ? 'warning' : 'good'}
          description="Eficiencia de cache"
          isMock={metrics.queryPerformance.isMock}
        />
      </div>

      {/* Tabs con detalles */}
      <Tabs defaultValue="tables" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="tables" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Tablas</TabsTrigger>
          <TabsTrigger value="storage" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Almacenamiento</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Rendimiento</TabsTrigger>
          <TabsTrigger value="growth" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Crecimiento</TabsTrigger>
          <TabsTrigger value="recommendations" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Recomendaciones</TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Mantenimiento</TabsTrigger>
          <TabsTrigger value="storage-cleanup" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Limpieza</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4 animate-in fade-in-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras de tamaños */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Tamaño por Tabla
                </CardTitle>
                <CardDescription>
                  Distribución del espacio usado por cada tabla
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tablesSizeData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{fontSize: 12}}
                    />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip 
                      formatter={(value) => [`${value} MB`, 'Tamaño']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="size" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lista detallada de tablas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" />
                  Detalles de Tablas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                  {metrics.tablesSizes.map((table, index) => (
                    <div 
                      key={table.tableName} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{table.tableName}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{table.rowCount.toLocaleString()} filas</span>
                          {table.isMock && <Badge variant="secondary" className="text-[10px] h-4 px-1">Simulado</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatBytes(table.size)}</div>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${Math.max(1, table.percentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4 animate-in fade-in-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico circular de distribución */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Distribución de Almacenamiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={storageBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => percent > 0.05 ? `${name} ${((percent || 0) * 100).toFixed(0)}%` : ''}
                      outerRadius={100}
                      innerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {storageBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} MB`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detalles de almacenamiento */}
            <Card>
              <CardHeader>
                <CardTitle>Desglose Detallado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {storageBreakdownData.map((item, index) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold">{item.value} MB</span>
                    </div>
                    <Progress 
                      value={(item.value / storageBreakdownData.reduce((sum, i) => sum + i.value, 0)) * 100} 
                      className="h-2"
                      indicatorColor={item.color}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 animate-in fade-in-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estadísticas de conexiones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Salud de Conexiones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-muted-foreground">Uso de Pool</span>
                    <span className="text-2xl font-bold">{metrics.connectionStats.connectionUsage}%</span>
                  </div>
                  <Progress value={metrics.connectionStats.connectionUsage} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {metrics.connectionStats.activeConnections} conexiones activas de {metrics.connectionStats.maxConnections} permitidas
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Tiempo Conexión</div>
                    <div className="text-xl font-bold">{metrics.connectionStats.avgConnectionTime}ms</div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Estado</div>
                    <Badge variant={metrics.connectionStats.connectionUsage > 80 ? "destructive" : "default"}>
                      {metrics.connectionStats.connectionUsage > 80 ? "Saturado" : "Saludable"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Queries lentas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Queries Más Lentas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {metrics.queryPerformance.slowQueries.map((query, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                      <div className="font-mono text-xs bg-muted p-2.5 rounded mb-3 break-all text-muted-foreground">
                        {query.query}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                          {query.duration}ms
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Ejecutado {query.frequency} veces
                        </span>
                      </div>
                    </div>
                  ))}
                  {metrics.queryPerformance.slowQueries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                      <p>No se detectaron queries lentas</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4 animate-in fade-in-50">
          <Card>
            <CardHeader>
              <CardTitle>Crecimiento de la Base de Datos</CardTitle>
              <CardDescription>
                Evolución del tamaño en los últimos 30 días
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={growthHistory}>
                  <defs>
                    <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value} MB`, 'Tamaño']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="size" 
                    stroke={COLORS[0]} 
                    fillOpacity={1} 
                    fill="url(#colorSize)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 animate-in fade-in-50">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Recomendaciones de Optimización
              </CardTitle>
              <CardDescription>
                Sugerencias inteligentes basadas en el análisis actual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-xl bg-gradient-to-r from-background to-muted/30">
                    <div className="mt-1 p-2 bg-green-100 rounded-full text-green-600">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Sugerencia #{index + 1}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4 animate-in fade-in-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Tareas de Mantenimiento
                </CardTitle>
                <CardDescription>
                  Optimiza el rendimiento de la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MaintenanceTaskItem 
                  title="Resetear Estadísticas"
                  description="Limpia registros de rendimiento acumulados para reiniciar el análisis"
                  icon={<Activity className="h-4 w-4 text-blue-500" />}
                  onExecute={() => performMaintenance('reset_stats')}
                  loading={refreshing}
                />
                <MaintenanceTaskItem 
                  title="Refrescar Métricas"
                  description="Fuerza una actualización inmediata de todos los datos de monitoreo"
                  icon={<RefreshCw className="h-4 w-4 text-green-500" />}
                  onExecute={refresh}
                  loading={refreshing}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Rotación de Logs
                </CardTitle>
                <CardDescription>
                  Gestiona el crecimiento de la tabla audit_log
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-5 border rounded-xl bg-muted/20">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Política de Retención</div>
                      <div className="text-xs text-muted-foreground">
                        Define cuántos días de historial deseas conservar. Los registros más antiguos se eliminarán permanentemente.
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select defaultValue="90" onValueChange={(val) => (window as any)._retentionDays = val}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 días (Más agresivo)</SelectItem>
                          <SelectItem value="60">60 días (Balanceado)</SelectItem>
                          <SelectItem value="90">90 días (Recomendado)</SelectItem>
                          <SelectItem value="180">180 días (Largo plazo)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={async () => {
                          const days = parseInt((window as any)._retentionDays || "90");
                          const result = await performMaintenance('rotate_logs', { days });
                          if (result.success) {
                            toast.success(result.message);
                            refresh();
                          } else {
                            toast.error(result.message);
                          }
                        }}
                        disabled={refreshing}
                      >
                        Ejecutar
                      </Button>
                    </div>
                  </div>
                </div>
                <Alert className="bg-yellow-50/50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800">
                    La rotación de logs es una acción destructiva. Asegúrate de haber exportado datos críticos si los necesitas para auditorías futuras.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage-cleanup" className="space-y-4 animate-in fade-in-50">
          <StorageCleanupSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MaintenanceTaskItem({ title, description, icon, onExecute, loading }: any) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
      <div className="space-y-1">
        <div className="font-medium flex items-center gap-2">
          {icon}
          {title}
        </div>
        <div className="text-xs text-muted-foreground max-w-[250px]">
          {description}
        </div>
      </div>
      <Button 
        variant="outline"
        size="sm"
        onClick={onExecute}
        disabled={loading}
      >
        {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Ejecutar'}
      </Button>
    </div>
  )
}

function StorageCleanupSection() {
  const { 
    orphanedFiles, 
    summary, 
    scanning, 
    deleting, 
    selectedPaths, 
    scan, 
    toggleSelect, 
    selectAll, 
    deleteSelected, 
    deleteAll 
  } = useStorageCleanup()

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)

  const formatBytes = (bytes: number) => storageCleanupService.formatBytes(bytes)

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalFiles ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(summary?.totalSize ?? 0)} en total</p>
          </CardContent>
        </Card>
        <Card className={cn(orphanedFiles.length > 0 && "border-orange-200 bg-orange-50/30")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos Huérfanos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", orphanedFiles.length > 0 && "text-orange-600")}>
              {orphanedFiles.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Imágenes no usadas en productos</p>
          </CardContent>
        </Card>
        <Card className={cn(orphanedFiles.length > 0 && "border-green-200 bg-green-50/30")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Espacio Recuperable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", orphanedFiles.length > 0 && "text-green-600")}>
              {formatBytes(summary?.orphanedSize ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Potencial ahorro de espacio</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <Button onClick={scan} disabled={scanning} variant="default" className="shadow-sm">
            {scanning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Escanear Archivos Huérfanos
          </Button>
          
          {orphanedFiles.length > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={selectAll}
                disabled={deleting}
              >
                {selectedPaths.size === orphanedFiles.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
              
              <Dialog open={confirmDeleteSelected} onOpenChange={setConfirmDeleteSelected}>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={selectedPaths.size === 0 || deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Seleccionados ({selectedPaths.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>¿Confirmar eliminación?</DialogTitle>
                    <DialogDescription>
                      Estás a punto de eliminar {selectedPaths.size} archivos permanentemente. 
                      Esta acción no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={() => setConfirmDeleteSelected(false)}>Cancelar</Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        deleteSelected()
                        setConfirmDeleteSelected(false)
                      }}
                    >
                      Sí, eliminar archivos
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {orphanedFiles.length > 0 && (
          <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
            <DialogTrigger asChild>
              <Button variant="ghost" disabled={deleting} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                Limpieza total
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Limpieza total de Storage?</DialogTitle>
                <DialogDescription>
                  Se eliminarán los {orphanedFiles.length} archivos huérfanos detectados. 
                  Esto liberará {formatBytes(summary?.orphanedSize ?? 0)}.
                </DialogDescription>
              </DialogHeader>
              <Alert className="bg-red-50 border-red-200 mt-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  ¡Atención! Solo las imágenes vinculadas actualmente en la base de datos se conservarán. 
                  Si tienes imágenes guardadas para uso futuro que no están asignadas a un producto, se perderán.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>Descartar</Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteAll()
                    setConfirmDeleteAll(false)
                  }}
                >
                  Confirmar Limpieza Total
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabla de archivos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Resultados del Escaneo
          </CardTitle>
          <CardDescription>
            Archivos encontrados en el bucket 'product-images' que no tienen referencias en la tabla de productos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orphanedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="bg-muted p-4 rounded-full">
                <ShieldCheck className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Storage Optimizado</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  {scanning ? 'Escaneando archivos...' : 'No se encontraron archivos sin uso. Todo parece estar en orden.'}
                </p>
              </div>
              {!scanning && <Button variant="outline" size="sm" onClick={scan}>Volver a escanear</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-sm font-medium border-b text-muted-foreground">
                    <th className="pb-3 pl-2 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 shadow-sm focus:ring-primary accent-primary"
                        checked={selectedPaths.size === orphanedFiles.length}
                        onChange={selectAll}
                      />
                    </th>
                    <th className="pb-3">Vista Previa</th>
                    <th className="pb-3">Ruta del Archivo</th>
                    <th className="pb-3 text-right">Tamaño</th>
                    <th className="pb-3 text-right pr-2">Modificado</th>
                  </tr>
                </thead>
                <tbody>
                  {orphanedFiles.map((file) => (
                    <tr key={file.path} className="border-b hover:bg-muted/50 transition-colors last:border-0">
                      <td className="py-4 pl-2">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 shadow-sm focus:ring-primary accent-primary"
                          checked={selectedPaths.has(file.path)}
                          onChange={() => toggleSelect(file.path)}
                        />
                      </td>
                      <td className="py-4">
                        <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                          <img 
                            src={file.publicUrl} 
                            alt={file.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).src = "https://placehold.co/100x100?text=Err"
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">{file.path}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-sm font-mono">
                        {formatBytes(file.size)}
                      </td>
                      <td className="py-4 text-right text-xs text-muted-foreground pr-2">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Alert className="bg-blue-50 border-blue-200">
        <Package className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Este escaneo analiza los campos `images[]` y `image_url` de todos los productos.
        </AlertDescription>
      </Alert>
    </div>
  )
}
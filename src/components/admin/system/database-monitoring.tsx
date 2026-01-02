"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Table,
  Settings
} from 'lucide-react'
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { PieChart as RechartsPieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { Legend } from 'recharts/es6/component/Legend';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { databaseMonitoringService, DatabaseMetrics, DatabaseAlert, TableSize } from '@/services/database-monitoring-service'
import { useDatabaseMonitoring } from '@/hooks/use-database-monitoring'

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
}

function MetricCard({ title, value, unit = '', icon, trend, trendValue, status = 'good', description }: MetricCardProps) {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getStatusColor()}`}>
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
  const getSeverityColor = (severity: DatabaseAlert['severity']) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const getSeverityIcon = (severity: DatabaseAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Alert className={`${getSeverityColor(alert.severity)} border-l-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {getSeverityIcon(alert.severity)}
          <div>
            <div className="font-medium">{alert.title}</div>
            <div className="text-sm mt-1">{alert.description}</div>
            <div className="text-xs text-muted-foreground mt-2">
              {alert.timestamp.toLocaleString()}
            </div>
          </div>
        </div>
        {onResolve && !alert.resolved && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onResolve(alert.id)}
          >
            Resolver
          </Button>
        )}
      </div>
    </Alert>
  )
}

export default function DatabaseMonitoring() {
  const { 
    metrics, 
    loading, 
    error, 
    refreshing, 
    refresh,
    quickMetrics 
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
    // Por ahora solo actualizamos el estado local
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
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Cargando métricas de base de datos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error cargando métricas: {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="ml-2"
          >
            Reintentar
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoreo de Base de Datos</h1>
          <p className="text-muted-foreground">
            Supervisa el tamaño, rendimiento y salud de tu base de datos Supabase
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 día</SelectItem>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
            </SelectContent>
          </Select>
        <Button variant="outline" onClick={exportMetrics}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
        <Button 
          variant="outline" 
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        </div>
      </div>

      {/* Indicador de estado en tiempo real */}
      {quickMetrics && (
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Estado: Activo</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Última actualización: {new Date().toLocaleTimeString()}
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Tamaño BD: </span>
                <span className="font-medium">{quickMetrics.totalSizeFormatted}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Conexiones: </span>
                <span className="font-medium">{quickMetrics.activeConnections}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas activas */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
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
          icon={<Database className="h-4 w-4 text-blue-500" />}
          status={metrics.totalSize > 1024 * 1024 * 1024 ? 'warning' : 'good'}
          description="Espacio usado en disco"
        />
        <MetricCard
          title="Conexiones Activas"
          value={metrics.connectionStats.activeConnections}
          unit={`/${metrics.connectionStats.maxConnections}`}
          icon={<Users className="h-4 w-4 text-green-500" />}
          status={metrics.connectionStats.connectionUsage > 70 ? 'warning' : 'good'}
          description={`${metrics.connectionStats.connectionUsage}% de uso`}
        />
        <MetricCard
          title="Tiempo Promedio Query"
          value={metrics.queryPerformance.avgQueryTime}
          unit="ms"
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          status={metrics.queryPerformance.avgQueryTime > 500 ? 'warning' : 'good'}
          description="Rendimiento de consultas"
        />
        <MetricCard
          title="Cache Hit Ratio"
          value={metrics.queryPerformance.cacheHitRatio}
          unit="%"
          icon={<Zap className="h-4 w-4 text-purple-500" />}
          status={metrics.queryPerformance.cacheHitRatio < 80 ? 'warning' : 'good'}
          description="Eficiencia de cache"
        />
      </div>

      {/* Tabs con detalles */}
      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables">Tablas</TabsTrigger>
          <TabsTrigger value="storage">Almacenamiento</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="growth">Crecimiento</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras de tamaños */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Tamaño por Tabla
                </CardTitle>
                <CardDescription>
                  Distribución del espacio usado por cada tabla
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tablesSizeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${value} MB`, 'Tamaño']}
                    />
                    <Bar dataKey="size" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lista detallada de tablas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table className="h-5 w-5" />
                  Detalles de Tablas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {metrics.tablesSizes.map((table, index) => (
                    <div key={table.tableName} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{table.tableName}</div>
                        <div className="text-sm text-muted-foreground">
                          {table.rowCount.toLocaleString()} filas
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatBytes(table.size)}</div>
                        <div className="text-sm text-muted-foreground">
                          {table.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico circular de distribución */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
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
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
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
              <CardContent className="space-y-4">
                {storageBreakdownData.map((item, index) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.value} MB</span>
                    </div>
                    <Progress 
                      value={(item.value / storageBreakdownData.reduce((sum, i) => sum + i.value, 0)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estadísticas de conexiones */}
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas de Conexiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Conexiones activas</span>
                    <span className="font-medium">{metrics.connectionStats.activeConnections}</span>
                  </div>
                  <Progress value={metrics.connectionStats.connectionUsage} className="h-2" />
                  <div className="text-sm text-muted-foreground">
                    {metrics.connectionStats.connectionUsage}% de {metrics.connectionStats.maxConnections} máximas
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between">
                    <span>Tiempo promedio de conexión</span>
                    <span className="font-medium">{metrics.connectionStats.avgConnectionTime}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Queries lentas */}
            <Card>
              <CardHeader>
                <CardTitle>Queries Más Lentas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {metrics.queryPerformance.slowQueries.map((query, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="font-mono text-sm bg-muted p-2 rounded mb-2 truncate">
                        {query.query}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Duración: {query.duration}ms</span>
                        <span>Frecuencia: {query.frequency}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value} MB`, 'Tamaño']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="size" 
                    stroke={COLORS[0]} 
                    fill={COLORS[0]} 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Recomendaciones de Optimización
              </CardTitle>
              <CardDescription>
                Sugerencias para mejorar el rendimiento y optimizar el espacio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{recommendation}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
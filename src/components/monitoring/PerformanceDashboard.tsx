'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network, 
  Database, 
  Users, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { LineChart } from 'recharts/es6/chart/LineChart'
import { Line } from 'recharts/es6/cartesian/Line'
import { AreaChart } from 'recharts/es6/chart/AreaChart'
import { Area } from 'recharts/es6/cartesian/Area'
import { BarChart } from 'recharts/es6/chart/BarChart'
import { Bar } from 'recharts/es6/cartesian/Bar'
import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { Legend } from 'recharts/es6/component/Legend'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { usePerformanceMonitor, SystemMetrics, PerformanceAlert, HealthCheck } from '@/lib/monitoring/performance-monitor'

interface MetricCardProps {
  title: string
  value: number
  unit: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  status?: 'good' | 'warning' | 'critical'
}

function MetricCard({ title, value, unit, icon, trend, trendValue, status = 'good' }: MetricCardProps) {
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
      case 'stable': return <Minus className="h-3 w-3 text-gray-500" />
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
          {value.toFixed(1)}{unit}
        </div>
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
  alert: PerformanceAlert
  onResolve: (alertId: string) => void
}

function AlertCard({ alert, onResolve }: AlertCardProps) {
  const getSeverityColor = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
    }
  }

  const getSeverityIcon = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSeverityIcon(alert.severity)}
            <CardTitle className="text-base">{alert.title}</CardTitle>
          </div>
          <Badge className={getSeverityColor(alert.severity)}>
            {alert.severity}
          </Badge>
        </div>
        <CardDescription>{alert.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Umbral:</span>
            <span>{alert.threshold}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Valor actual:</span>
            <span className="font-medium">{alert.currentValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tiempo:</span>
            <span>{alert.timestamp.toLocaleString()}</span>
          </div>
          {alert.actions.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Acciones recomendadas:</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {alert.actions.map((action, index) => (
                  <li key={index}>• {action}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button 
              size="sm" 
              onClick={() => onResolve(alert.id)}
              disabled={alert.resolved}
            >
              {alert.resolved ? 'Resuelto' : 'Marcar como resuelto'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface HealthCheckCardProps {
  healthCheck: HealthCheck
}

function HealthCheckCard({ healthCheck }: HealthCheckCardProps) {
  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'degraded': return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy': return 'bg-red-100 text-red-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">{healthCheck.service}</CardTitle>
          <Badge className={getStatusColor(healthCheck.status)}>
            {getStatusIcon(healthCheck.status)}
            <span className="ml-1 capitalize">{healthCheck.status}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Tiempo de respuesta:</span>
            <span>{healthCheck.responseTime}ms</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Última verificación:</span>
            <span>{healthCheck.lastCheck.toLocaleString()}</span>
          </div>
          {healthCheck.details && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Detalles:</div>
              <div className="text-sm text-muted-foreground space-y-1">
                {Object.entries(healthCheck.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PerformanceDashboard() {
  const [selectedTab, setSelectedTab] = React.useState('overview')
  const [timeRange, setTimeRange] = React.useState('24h')
  const [showReportDialog, setShowReportDialog] = React.useState(false)
  
  const {
    loading,
    metrics,
    alerts,
    healthChecks,
    generateReport,
    resolveAlert,
    refreshMetrics,
    performHealthCheck
  } = usePerformanceMonitor()

  // Procesar datos para gráficos
  const chartData = React.useMemo(() => {
    return metrics.slice(-50).map((metric, index) => ({
      time: metric.timestamp.toLocaleTimeString(),
      cpu: metric.cpu.usage,
      memory: metric.memory.percentage,
      disk: metric.disk.percentage,
      responseTime: metric.application.avgResponseTime,
      activeUsers: metric.application.activeUsers,
      requestsPerSecond: metric.application.requestsPerSecond,
      errorRate: metric.application.errorRate
    }))
  }, [metrics])

  // Métricas actuales
  const currentMetrics = metrics[metrics.length - 1]

  // Calcular tendencias
  const calculateTrend = (metricKey: string) => {
    if (metrics.length < 2) return { trend: 'stable' as const, value: 0 }
    
    const current = metrics[metrics.length - 1]
    const previous = metrics[metrics.length - 2]
    
    let currentValue: number
    let previousValue: number

    switch (metricKey) {
      case 'cpu':
        currentValue = current.cpu.usage
        previousValue = previous.cpu.usage
        break
      case 'memory':
        currentValue = current.memory.percentage
        previousValue = previous.memory.percentage
        break
      case 'responseTime':
        currentValue = current.application.avgResponseTime
        previousValue = previous.application.avgResponseTime
        break
      default:
        return { trend: 'stable' as const, value: 0 }
    }

    const change = ((currentValue - previousValue) / previousValue) * 100
    
    if (Math.abs(change) < 2) return { trend: 'stable' as const, value: change }
    return { trend: change > 0 ? 'up' as const : 'down' as const, value: change }
  }

  const handleGenerateReport = async () => {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7) // Última semana

      const report = await generateReport('weekly', startDate, endDate)
      
      // Crear y descargar archivo
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `performance-report-${report.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setShowReportDialog(false)
    } catch (error) {
      console.error('Error generating report:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando métricas de rendimiento...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoreo de Rendimiento</h1>
          <p className="text-muted-foreground">
            Supervisa el estado y rendimiento del sistema en tiempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="6h">6 horas</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 días</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={refreshMetrics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <DialogTrigger asChild>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Generar Reporte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generar Reporte de Rendimiento</DialogTitle>
                <DialogDescription>
                  Genera un reporte detallado del rendimiento del sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Período</label>
                  <Select defaultValue="weekly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleGenerateReport}>
                    Generar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alertas críticas */}
      {alerts.filter(alert => !alert.resolved && alert.severity === 'critical').length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Hay {alerts.filter(alert => !alert.resolved && alert.severity === 'critical').length} alerta(s) crítica(s) que requieren atención inmediata.
          </AlertDescription>
        </Alert>
      )}

      {/* Métricas principales */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Uso de CPU"
            value={currentMetrics.cpu.usage}
            unit="%"
            icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
            trend={calculateTrend('cpu').trend}
            trendValue={calculateTrend('cpu').value}
            status={currentMetrics.cpu.usage > 80 ? 'critical' : currentMetrics.cpu.usage > 60 ? 'warning' : 'good'}
          />
          <MetricCard
            title="Uso de Memoria"
            value={currentMetrics.memory.percentage}
            unit="%"
            icon={<MemoryStick className="h-4 w-4 text-muted-foreground" />}
            trend={calculateTrend('memory').trend}
            trendValue={calculateTrend('memory').value}
            status={currentMetrics.memory.percentage > 85 ? 'critical' : currentMetrics.memory.percentage > 70 ? 'warning' : 'good'}
          />
          <MetricCard
            title="Tiempo de Respuesta"
            value={currentMetrics.application.avgResponseTime}
            unit="ms"
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            trend={calculateTrend('responseTime').trend}
            trendValue={calculateTrend('responseTime').value}
            status={currentMetrics.application.avgResponseTime > 1000 ? 'critical' : currentMetrics.application.avgResponseTime > 500 ? 'warning' : 'good'}
          />
          <MetricCard
            title="Usuarios Activos"
            value={currentMetrics.application.activeUsers}
            unit=""
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            status="good"
          />
        </div>
      )}

      {/* Tabs de contenido */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="health">Estado de Servicios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico de CPU y Memoria */}
            <Card>
              <CardHeader>
                <CardTitle>Uso de Recursos</CardTitle>
                <CardDescription>CPU y Memoria en tiempo real</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memoria %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Tiempo de Respuesta */}
            <Card>
              <CardHeader>
                <CardTitle>Tiempo de Respuesta</CardTitle>
                <CardDescription>Rendimiento de la aplicación</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="responseTime" stroke="#ffc658" fill="#ffc658" name="Tiempo (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Métricas adicionales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Actividad de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="activeUsers" fill="#8884d8" name="Usuarios" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Solicitudes por Segundo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="requestsPerSecond" stroke="#82ca9d" name="RPS" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasa de Errores</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="errorRate" stroke="#ff7300" fill="#ff7300" name="Errores %" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Métricas detalladas */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                {currentMetrics && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        CPU
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={currentMetrics.cpu.usage} className="w-24" />
                        <span className="text-sm font-medium">{currentMetrics.cpu.usage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4" />
                        Memoria
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={currentMetrics.memory.percentage} className="w-24" />
                        <span className="text-sm font-medium">{currentMetrics.memory.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Disco
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={currentMetrics.disk.percentage} className="w-24" />
                        <span className="text-sm font-medium">{currentMetrics.disk.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Conexiones DB
                      </span>
                      <span className="text-sm font-medium">{currentMetrics.database.connections}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Aplicación</CardTitle>
              </CardHeader>
              <CardContent>
                {currentMetrics && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuarios Activos
                      </span>
                      <span className="text-sm font-medium">{currentMetrics.application.activeUsers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        RPS
                      </span>
                      <span className="text-sm font-medium">{currentMetrics.application.requestsPerSecond.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Tiempo Respuesta
                      </span>
                      <span className="text-sm font-medium">{currentMetrics.application.avgResponseTime.toFixed(0)}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Tasa de Errores
                      </span>
                      <span className="text-sm font-medium">{currentMetrics.application.errorRate.toFixed(2)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Alertas Activas ({alerts.filter(alert => !alert.resolved).length})
            </h2>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Umbrales
            </Button>
          </div>
          
          <div className="grid gap-4">
            {alerts.filter(alert => !alert.resolved).length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-lg font-medium">No hay alertas activas</p>
                    <p className="text-muted-foreground">El sistema está funcionando correctamente</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              alerts
                .filter(alert => !alert.resolved)
                .map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onResolve={resolveAlert}
                  />
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Estado de Servicios</h2>
            <Button onClick={performHealthCheck} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Estado
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthChecks.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-lg font-medium">No hay verificaciones de salud disponibles</p>
                    <p className="text-muted-foreground">Ejecuta una verificación para ver el estado de los servicios</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              healthChecks.map(healthCheck => (
                <HealthCheckCard
                  key={healthCheck.service}
                  healthCheck={healthCheck}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
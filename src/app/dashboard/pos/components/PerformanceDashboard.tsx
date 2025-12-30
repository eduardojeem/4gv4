/**
 * Dashboard de performance para el sistema POS
 * Muestra métricas de rendimiento, alertas y recomendaciones
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Database,
  Gauge,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Zap,
  BarChart3,
  Eye,
  Settings
} from 'lucide-react'
import { usePerformanceMonitor, usePerformanceAlerts } from '../hooks/usePerformanceMonitor'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface PerformanceDashboardProps {
  className?: string
  showDetails?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className = '',
  showDetails = true,
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const {
    performanceScore,
    isMonitoring,
    lastReport,
    webVitals,
    generateReport,
    refreshReport,
    setMonitoring,
    getStatus
  } = usePerformanceMonitor()

  const {
    alerts,
    criticalAlerts,
    warningAlerts,
    hasCriticalAlerts,
    hasWarnings,
    clearAlerts
  } = usePerformanceAlerts()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('1h')

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && isMonitoring) {
      const interval = setInterval(() => {
        refreshReport()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, isMonitoring, refreshInterval, refreshReport])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 500)) // Simular carga
    refreshReport()
    setIsRefreshing(false)
  }

  const handleTimeRangeChange = (range: '1h' | '6h' | '24h') => {
    setSelectedTimeRange(range)
    const now = new Date()
    const start = new Date(now.getTime() - getTimeRangeMs(range))
    generateReport({ start, end: now })
  }

  const getTimeRangeMs = (range: '1h' | '6h' | '24h'): number => {
    switch (range) {
      case '1h': return 60 * 60 * 1000
      case '6h': return 6 * 60 * 60 * 1000
      case '24h': return 24 * 60 * 60 * 1000
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (score >= 70) return <Activity className="h-5 w-5 text-yellow-500" />
    if (score >= 50) return <AlertTriangle className="h-5 w-5 text-orange-500" />
    return <AlertTriangle className="h-5 w-5 text-red-500" />
  }

  const formatMetricValue = (value: number, unit: string = 'ms') => {
    if (value === 0) return 'N/A'
    return `${value.toFixed(1)}${unit}`
  }

  const getMetricIcon = (metricName: string) => {
    switch (metricName) {
      case 'cart-operation':
        return <ShoppingCart className="h-4 w-4" />
      case 'product-search':
        return <Search className="h-4 w-4" />
      case 'sale-processing':
        return <Activity className="h-4 w-4" />
      case 'database-query':
        return <Database className="h-4 w-4" />
      case 'render-time':
        return <Eye className="h-4 w-4" />
      default:
        return <Gauge className="h-4 w-4" />
    }
  }

  if (!isMonitoring) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5" />
            <span>Performance Monitor</span>
          </CardTitle>
          <CardDescription>El monitoreo de performance está deshabilitado</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setMonitoring(true)}>
            <Activity className="h-4 w-4 mr-2" />
            Habilitar Monitoreo
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con Score Principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getScoreIcon(performanceScore)}
              <CardTitle className="text-xl">Performance Dashboard</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonitoring(false)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Score Principal */}
          <div className="text-center space-y-2">
            <div className={`text-4xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}
            </div>
            <div className="text-sm text-muted-foreground">Performance Score</div>
            <Progress value={performanceScore} className="w-full max-w-md mx-auto" />
          </div>

          {/* Alertas Críticas */}
          {hasCriticalAlerts && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítica{criticalAlerts.length > 1 ? 's' : ''}
                  </span>
                  <Button variant="outline" size="sm" onClick={clearAlerts}>
                    Revisar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Filtros de Tiempo */}
          <div className="flex justify-center space-x-2">
            {(['1h', '6h', '24h'] as const).map((range) => (
              <Button
                key={range}
                variant={selectedTimeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Detalles */}
      {showDetails && lastReport && (
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="vitals">Web Vitals</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
          </TabsList>

          {/* Tab de Métricas */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Operaciones de Carrito */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    <span>Operaciones de Carrito</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(lastReport.summary.averageCartOperation)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tiempo promedio</div>
                </CardContent>
              </Card>

              {/* Búsqueda de Productos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Search className="h-4 w-4 text-green-500" />
                    <span>Búsqueda de Productos</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(lastReport.summary.averageProductSearch)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tiempo promedio</div>
                </CardContent>
              </Card>

              {/* Procesamiento de Ventas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <span>Procesamiento de Ventas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(lastReport.summary.averageSaleProcessing)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tiempo promedio</div>
                </CardContent>
              </Card>

              {/* Consultas de Base de Datos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Database className="h-4 w-4 text-orange-500" />
                    <span>Consultas de BD</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(lastReport.summary.averageDatabaseQuery)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tiempo promedio</div>
                </CardContent>
              </Card>

              {/* Tiempo de Renderizado */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-cyan-500" />
                    <span>Renderizado</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(lastReport.summary.averageRenderTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tiempo promedio</div>
                </CardContent>
              </Card>

              {/* Estadísticas Generales */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                    <span>Estadísticas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total operaciones:</span>
                    <span className="font-medium">{lastReport.summary.totalOperations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Operaciones lentas:</span>
                    <span className="font-medium text-orange-600">
                      {lastReport.summary.slowOperations}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Web Vitals */}
          <TabsContent value="vitals" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(webVitals).map(([metric, value]) => (
                <Card key={metric}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{metric.toUpperCase()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatMetricValue(value, metric === 'cls' ? '' : 'ms')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getVitalDescription(metric)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab de Alertas */}
          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Sin alertas</h3>
                  <p className="text-muted-foreground">
                    El sistema está funcionando correctamente
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <Alert
                    key={index}
                    className={
                      alert.type === 'critical'
                        ? 'border-red-200 bg-red-50'
                        : 'border-yellow-200 bg-yellow-50'
                    }
                  >
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        alert.type === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`}
                    />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{alert.message}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(alert.timestamp), {
                              addSuffix: true,
                              locale: es
                            })}
                          </div>
                        </div>
                        <Badge
                          variant={alert.type === 'critical' ? 'destructive' : 'secondary'}
                        >
                          {alert.type}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab de Recomendaciones */}
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Recomendaciones de Optimización</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lastReport.recommendations.length === 0 ? (
                  <p className="text-muted-foreground">
                    No hay recomendaciones disponibles
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lastReport.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        <span className="text-sm">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// Función auxiliar para descripciones de Web Vitals
const getVitalDescription = (metric: string): string => {
  switch (metric) {
    case 'fcp':
      return 'First Contentful Paint'
    case 'lcp':
      return 'Largest Contentful Paint'
    case 'cls':
      return 'Cumulative Layout Shift'
    case 'fid':
      return 'First Input Delay'
    default:
      return 'Web Vital'
  }
}

export default PerformanceDashboard
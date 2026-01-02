'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Zap,
  WifiOff,
  RefreshCw,
  Settings,
  Eye,
  Server,
  Database,
  Globe,
  FileText,
  MoreHorizontal,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react'
import { integrationMonitor, IntegrationHealth, Alert as IntegrationAlert, MonitoringDashboard } from '@/lib/integrations/integration-monitor'

// Componente principal del dashboard
export function IntegrationMonitoringDashboard() {
  const [dashboardData, setDashboardData] = useState<MonitoringDashboard | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([])
  const [alerts, setAlerts] = useState<IntegrationAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)

  // Cargar datos iniciales
  useEffect(() => {
    loadDashboardData()
    
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000) // Actualizar cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Cargar datos del dashboard
      const dashboard = await integrationMonitor.getDashboardData()
      setDashboardData(dashboard)

      // Cargar alertas activas
      const activeAlerts = await integrationMonitor.getActiveAlerts()
      setAlerts(activeAlerts)

      // Simular datos de integraciones (en producción vendría del monitor)
      const mockIntegrations: IntegrationHealth[] = [
        {
          integrationId: '1',
          name: 'API de Pagos Stripe',
          type: 'rest_api',
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: 245,
          uptime: 99.8,
          errorRate: 0.2,
          metrics: {
            requestsPerMinute: 45,
            successRate: 99.8,
            averageResponseTime: 245,
            errorCount: 2,
            timeoutCount: 0,
            rateLimitHits: 0,
            dataQuality: 98.5
          }
        },
        {
          integrationId: '2',
          name: 'Webhook de Inventario',
          type: 'webhook',
          status: 'warning',
          lastCheck: new Date(),
          responseTime: 1200,
          uptime: 97.2,
          errorRate: 5.1,
          lastError: 'Timeout en webhook delivery',
          metrics: {
            requestsPerMinute: 12,
            successRate: 94.9,
            averageResponseTime: 1200,
            errorCount: 8,
            timeoutCount: 3,
            rateLimitHits: 0,
            dataQuality: 95.0
          }
        },
        {
          integrationId: '3',
          name: 'Base de Datos CRM',
          type: 'database',
          status: 'critical',
          lastCheck: new Date(),
          responseTime: 3500,
          uptime: 89.5,
          errorRate: 12.3,
          lastError: 'Connection pool exhausted',
          metrics: {
            requestsPerMinute: 78,
            successRate: 87.7,
            averageResponseTime: 3500,
            errorCount: 45,
            timeoutCount: 12,
            rateLimitHits: 0,
            dataQuality: 85.2
          }
        },
        {
          integrationId: '4',
          name: 'Sincronización de Archivos',
          type: 'file_sync',
          status: 'offline',
          lastCheck: new Date(Date.now() - 5 * 60 * 1000),
          responseTime: 0,
          uptime: 0,
          errorRate: 100,
          lastError: 'Service unavailable',
          metrics: {
            requestsPerMinute: 0,
            successRate: 0,
            averageResponseTime: 0,
            errorCount: 1,
            timeoutCount: 1,
            rateLimitHits: 0,
            dataQuality: 0
          }
        }
      ]
      
      setIntegrations(mockIntegrations)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Componente de métricas generales
  const OverviewMetrics = () => {
    if (!dashboardData) return null

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Server className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.totalIntegrations}</p>
                <p className="text-sm text-gray-500">Integraciones Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.healthyIntegrations}</p>
                <p className="text-sm text-gray-500">Saludables</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.activeAlerts}</p>
                <p className="text-sm text-gray-500">Alertas Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.averageUptime.toFixed(1)}%</p>
                <p className="text-sm text-gray-500">Uptime Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Componente de lista de integraciones
  const IntegrationsList = () => {
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />
        case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
        case 'critical': return <XCircle className="h-5 w-5 text-red-500" />
        case 'offline': return <WifiOff className="h-5 w-5 text-gray-500" />
        default: return <Activity className="h-5 w-5 text-blue-500" />
      }
    }

    const getStatusBadge = (status: string) => {
      const variants = {
        healthy: 'default',
        warning: 'secondary',
        critical: 'destructive',
        offline: 'outline'
      } as const

      const labels = {
        healthy: 'Saludable',
        warning: 'Advertencia',
        critical: 'Crítico',
        offline: 'Offline'
      }

      return (
        <Badge variant={variants[status as keyof typeof variants] || 'default'}>
          {labels[status as keyof typeof labels] || status}
        </Badge>
      )
    }

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'rest_api': return <Globe className="h-4 w-4" />
        case 'webhook': return <Zap className="h-4 w-4" />
        case 'database': return <Database className="h-4 w-4" />
        case 'file_sync': return <FileText className="h-4 w-4" />
        default: return <Server className="h-4 w-4" />
      }
    }

    return (
      <div className="space-y-4">
        {integrations.map(integration => (
          <Card 
            key={integration.integrationId} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedIntegration === integration.integrationId ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedIntegration(
              selectedIntegration === integration.integrationId ? null : integration.integrationId
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(integration.status)}
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      {getTypeIcon(integration.type)}
                      <span className="text-sm text-gray-500 capitalize">
                        {integration.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(integration.status)}
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Tiempo de Respuesta</p>
                  <p className="font-medium">{integration.responseTime}ms</p>
                </div>
                <div>
                  <p className="text-gray-500">Uptime</p>
                  <p className="font-medium">{integration.uptime.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Tasa de Error</p>
                  <p className="font-medium">{integration.errorRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Última Verificación</p>
                  <p className="font-medium">
                    {new Date(integration.lastCheck).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {integration.lastError && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Último Error:</strong> {integration.lastError}
                  </AlertDescription>
                </Alert>
              )}

              {selectedIntegration === integration.integrationId && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-3">Métricas Detalladas</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Requests/min</p>
                      <p className="font-medium">{integration.metrics.requestsPerMinute}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tasa de Éxito</p>
                      <p className="font-medium">{integration.metrics.successRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Timeouts</p>
                      <p className="font-medium">{integration.metrics.timeoutCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rate Limits</p>
                      <p className="font-medium">{integration.metrics.rateLimitHits}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Calidad de Datos</p>
                      <p className="font-medium">{integration.metrics.dataQuality.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Errores Totales</p>
                      <p className="font-medium">{integration.metrics.errorCount}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Componente de alertas
  const AlertsList = () => {
    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'critical': return 'text-red-600 bg-red-50'
        case 'high': return 'text-orange-600 bg-orange-50'
        case 'medium': return 'text-yellow-600 bg-yellow-50'
        case 'low': return 'text-blue-600 bg-blue-50'
        default: return 'text-gray-600 bg-gray-50'
      }
    }

    const handleAcknowledgeAlert = async (alertId: string) => {
      try {
        await integrationMonitor.acknowledgeAlert(alertId, 'current-user')
        await loadDashboardData()
      } catch (error) {
        console.error('Error acknowledging alert:', error)
      }
    }

    const handleResolveAlert = async (alertId: string) => {
      try {
        await integrationMonitor.resolveAlert(alertId)
        await loadDashboardData()
      } catch (error) {
        console.error('Error resolving alert:', error)
      }
    }

    return (
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No hay alertas activas</p>
              <p className="text-gray-500">Todas las integraciones están funcionando correctamente</p>
            </CardContent>
          </Card>
        ) : (
          alerts.map(alert => (
            <Card key={alert.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {alert.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  </div>
                  <div className="flex space-x-2">
                    {alert.status === 'active' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Reconocer
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    )
  }

  // Componente de gráficos de rendimiento
  const PerformanceCharts = () => {
    // Datos simulados para los gráficos
    const responseTimeData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      responseTime: Math.random() * 1000 + 200,
      uptime: 95 + Math.random() * 5
    }))

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tiempo de Respuesta (24h)</CardTitle>
            <CardDescription>Promedio por hora en milisegundos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uptime por Integración</CardTitle>
            <CardDescription>Porcentaje de disponibilidad</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={integrations}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="uptime" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando datos de monitoreo...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Monitoreo de Integraciones</h2>
          <p className="text-gray-600">Estado en tiempo real de todas las integraciones externas</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Pausar' : 'Reanudar'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Métricas generales */}
      <OverviewMetrics />

      {/* Tabs principales */}
      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsList />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsList />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceCharts />
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Gestión de Incidentes</p>
              <p className="text-gray-500">Funcionalidad en desarrollo</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IntegrationMonitoringDashboard
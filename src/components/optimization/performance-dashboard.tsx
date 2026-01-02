'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { Legend } from 'recharts/es6/component/Legend';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { 
  Zap, TrendingUp, AlertTriangle, 
  Clock, Settings, Play, Pause,
  Cpu, HardDrive, Wifi, Database, Server, BarChart3, Target,
  Search, RefreshCw, Eye
} from 'lucide-react'
import { 
  performanceOptimizer,
  type OptimizationRule,
  type OptimizationExecution,
  type PerformanceAlert
} from '@/lib/optimization/performance-optimizer'

interface DashboardStats {
  totalOptimizations: number
  successRate: number
  averageImprovement: number
  activeRules: number
  criticalAlerts: number
  resourceSavings: number
}

interface MetricData {
  timestamp: string
  cpu: number
  memory: number
  responseTime: number
  throughput: number
}

export default function PerformanceDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOptimizations: 0,
    successRate: 0,
    averageImprovement: 0,
    activeRules: 0,
    criticalAlerts: 0,
    resourceSavings: 0
  })

  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [rules, setRules] = useState<OptimizationRule[]>([])
  const [executions, setExecutions] = useState<OptimizationExecution[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedRule, setSelectedRule] = useState<OptimizationRule | null>(null)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load stats
      const [rulesData, executionsData, alertsData] = await Promise.all([
        performanceOptimizer.getActiveOptimizationRules(),
        performanceOptimizer.getOptimizationHistory(100),
        performanceOptimizer.getPerformanceAlerts(false)
      ])

      setRules(rulesData)
      setExecutions(executionsData)
      setAlerts(alertsData)

      // Calculate stats
      const successfulExecutions = executionsData.filter(e => e.status === 'completed')
      const criticalAlerts = alertsData.filter(a => a.severity === 'critical')
      
      setStats({
        totalOptimizations: executionsData.length,
        successRate: executionsData.length > 0 ? (successfulExecutions.length / executionsData.length) * 100 : 0,
        averageImprovement: successfulExecutions.reduce((sum, e) => sum + e.results.performanceImprovement, 0) / (successfulExecutions.length || 1),
        activeRules: rulesData.length,
        criticalAlerts: criticalAlerts.length,
        resourceSavings: successfulExecutions.reduce((sum, e) => sum + e.results.resourceSavings, 0)
      })

      // Generate sample metrics data
      generateSampleMetrics()

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const generateSampleMetrics = () => {
    const now = new Date()
    const data: MetricData[] = []
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      data.push({
        timestamp: timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        cpu: 30 + Math.random() * 40,
        memory: 40 + Math.random() * 35,
        responseTime: 150 + Math.random() * 200,
        throughput: 80 + Math.random() * 40
      })
    }
    
    setMetrics(data)
  }

  const handleStartMonitoring = async () => {
    try {
      await performanceOptimizer.startMonitoring()
      setIsMonitoring(true)
    } catch (error) {
      console.error('Error starting monitoring:', error)
    }
  }

  const handleStopMonitoring = async () => {
    try {
      await performanceOptimizer.stopMonitoring()
      setIsMonitoring(false)
    } catch (error) {
      console.error('Error stopping monitoring:', error)
    }
  }

  const handleExecuteRule = async (ruleId: string) => {
    try {
      await performanceOptimizer.executeOptimizationRule(ruleId, {
        type: 'manual',
        conditions: [],
        reason: 'Manual execution from dashboard',
        user: 'admin'
      })
      loadDashboardData()
    } catch (error) {
      console.error('Error executing rule:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'running': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      case 'pending': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'warning': return 'bg-yellow-500'
      case 'info': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cpu': return <Cpu className="h-4 w-4" />
      case 'memory': return <HardDrive className="h-4 w-4" />
      case 'network': return <Wifi className="h-4 w-4" />
      case 'database': return <Database className="h-4 w-4" />
      default: return <Server className="h-4 w-4" />
    }
  }

  const filteredRules = rules.filter(rule => {
    const matchesCategory = filterCategory === 'all' || rule.category === filterCategory
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Optimización de Rendimiento</h1>
          <p className="text-muted-foreground">
            Sistema inteligente de optimización automática basado en métricas
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isMonitoring ? "destructive" : "default"}
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
          >
            {isMonitoring ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isMonitoring ? 'Detener' : 'Iniciar'} Monitoreo
          </Button>
          <Button variant="outline" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimizaciones</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOptimizations}</div>
            <p className="text-xs text-muted-foreground">Total ejecutadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mejora Promedio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageImprovement.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Rendimiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reglas Activas</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRules}</div>
            <p className="text-xs text-muted-foreground">Configuradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorro de Recursos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resourceSavings.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="executions">Ejecuciones</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Rendimiento (24h)</CardTitle>
                <CardDescription>Evolución de las métricas principales del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memoria %" />
                    <Line type="monotone" dataKey="responseTime" stroke="#ffc658" name="Tiempo Resp. (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Executions */}
            <Card>
              <CardHeader>
                <CardTitle>Ejecuciones Recientes</CardTitle>
                <CardDescription>Últimas optimizaciones ejecutadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {executions.slice(0, 5).map((execution) => (
                    <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(execution.status)}`} />
                        <div>
                          <p className="font-medium">{execution.ruleId}</p>
                          <p className="text-sm text-muted-foreground">
                            {execution.startTime.toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={execution.status === 'completed' ? 'default' : 'secondary'}>
                          {execution.status}
                        </Badge>
                        {execution.results.performanceImprovement > 0 && (
                          <p className="text-sm text-green-600">
                            +{execution.results.performanceImprovement.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas Activas</CardTitle>
                <CardDescription>Alertas que requieren atención</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(alert.severity)}`} />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Optimization Impact */}
            <Card>
              <CardHeader>
                <CardTitle>Impacto de Optimizaciones</CardTitle>
                <CardDescription>Distribución de mejoras por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { category: 'CPU', improvement: 25, savings: 30 },
                    { category: 'Memoria', improvement: 35, savings: 25 },
                    { category: 'Red', improvement: 15, savings: 20 },
                    { category: 'BD', improvement: 45, savings: 40 },
                    { category: 'Cache', improvement: 20, savings: 15 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="improvement" fill="#8884d8" name="Mejora %" />
                    <Bar dataKey="savings" fill="#82ca9d" name="Ahorro %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Uso de CPU</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="cpu" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Uso de Memoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="memory" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card>
              <CardHeader>
                <CardTitle>Tiempo de Respuesta</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTime" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput */}
            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="throughput" stroke="#ff7300" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Buscar reglas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="cpu">CPU</SelectItem>
                  <SelectItem value="memory">Memoria</SelectItem>
                  <SelectItem value="network">Red</SelectItem>
                  <SelectItem value="database">Base de Datos</SelectItem>
                  <SelectItem value="cache">Cache</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowRuleDialog(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Nueva Regla
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(rule.category)}
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                    </div>
                    <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                      {rule.enabled ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <CardDescription>{rule.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Prioridad:</span>
                      <Badge variant={rule.priority === 'critical' ? 'destructive' : 'outline'}>
                        {rule.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Condiciones:</span>
                      <span>{rule.conditions.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Acciones:</span>
                      <span>{rule.actions.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Tasa de éxito:</span>
                      <span>{(rule.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleExecuteRule(rule.id)}
                        disabled={!rule.enabled}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Ejecutar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedRule(rule)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Ejecuciones</CardTitle>
              <CardDescription>Registro completo de optimizaciones ejecutadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executions.map((execution) => (
                  <div key={execution.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${getStatusColor(execution.status)}`} />
                        <div>
                          <h4 className="font-medium">{execution.ruleId}</h4>
                          <p className="text-sm text-muted-foreground">
                            {execution.startTime.toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={execution.status === 'completed' ? 'default' : 'secondary'}>
                          {execution.status}
                        </Badge>
                        {execution.duration && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {execution.duration}s
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {execution.results.success && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Mejora:</span>
                          <span className="ml-2 text-green-600">
                            +{execution.results.performanceImprovement.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ahorro:</span>
                          <span className="ml-2 text-blue-600">
                            {execution.results.resourceSavings.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Acciones:</span>
                          <span className="ml-2">{execution.actions.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Rendimiento</CardTitle>
              <CardDescription>Alertas activas y historial de notificaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${getSeverityColor(alert.severity)}`} />
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {alert.timestamp.toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm mb-3">{alert.message}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-muted-foreground">Métrica:</span>
                        <span className="ml-2">{alert.metricName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="ml-2 font-mono">{alert.currentValue}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Umbral:</span>
                        <span className="ml-2 font-mono">{alert.thresholdValue}</span>
                      </div>
                    </div>
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
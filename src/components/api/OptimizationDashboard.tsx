'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Zap, 
  Database, 
  Shield, 
  BarChart3, 
  Clock, 
  Users, 
  Activity,
  RefreshCw,
  Trash2,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Server,
  Network,
  HardDrive,
  Cpu
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
import { useAPIOptimization } from '@/lib/api/optimization'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  status?: 'good' | 'warning' | 'critical'
}

function MetricCard({ title, value, unit = '', icon, trend, trendValue, status = 'good' }: MetricCardProps) {
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
      case 'up': return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'down': return <TrendingDown className="h-3 w-3 text-red-500" />
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
          {typeof value === 'number' ? value.toFixed(2) : value}{unit}
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

interface CacheEntryRowProps {
  entry: {
    key: string
    size: number
    accessCount: number
    lastAccessed: Date
    ttl: number
  }
  onInvalidate: (key: string) => void
}

function CacheEntryRow({ entry, onInvalidate }: CacheEntryRowProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{entry.key}</div>
        <div className="text-xs text-muted-foreground">
          {formatSize(entry.size)} • {entry.accessCount} accesos • {formatTime(entry.lastAccessed)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          TTL: {entry.ttl}s
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onInvalidate(entry.key)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default function OptimizationDashboard() {
  const [selectedTab, setSelectedTab] = React.useState('overview')
  const [timeRange, setTimeRange] = React.useState('24h')
  const [showCacheConfig, setShowCacheConfig] = React.useState(false)
  const [showRateLimitConfig, setShowRateLimitConfig] = React.useState(false)
  
  const {
    getCacheStats,
    getRateLimitStats,
    getMetrics,
    invalidateCache,
    clearCache
  } = useAPIOptimization()

  // Obtener estadísticas
  const cacheStats = getCacheStats()
  const rateLimitStats = getRateLimitStats()
  const metrics = getMetrics()

  // Datos para gráficos
  const responseTimeData = React.useMemo(() => {
    // Simular datos de tiempo de respuesta
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      responseTime: Math.random() * 200 + 50,
      cacheHitRate: Math.random() * 30 + 70,
      requestCount: Math.floor(Math.random() * 1000) + 100
    }))
  }, [])

  const statusCodeData = React.useMemo(() => {
    return [
      { name: '2xx', value: 85, color: '#10b981' },
      { name: '3xx', value: 8, color: '#f59e0b' },
      { name: '4xx', value: 5, color: '#ef4444' },
      { name: '5xx', value: 2, color: '#dc2626' }
    ]
  }, [])

  const endpointPerformanceData = React.useMemo(() => {
    return [
      { endpoint: '/api/products', avgTime: 120, requests: 1500, errors: 2 },
      { endpoint: '/api/sales', avgTime: 85, requests: 800, errors: 1 },
      { endpoint: '/api/inventory', avgTime: 200, requests: 600, errors: 5 },
      { endpoint: '/api/customers', avgTime: 95, requests: 400, errors: 0 },
      { endpoint: '/api/reports', avgTime: 350, requests: 200, errors: 3 }
    ]
  }, [])

  const handleInvalidateCache = (key: string) => {
    // Implementar invalidación de cache específica
    console.log('Invalidating cache key:', key)
  }

  const handleClearAllCache = () => {
    clearCache()
  }

  const handleInvalidateCacheByTag = (tag: string) => {
    invalidateCache(tag)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Optimización de API</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona el rendimiento de las APIs del sistema
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
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tiempo de Respuesta Promedio"
          value={metrics.averageResponseTime}
          unit="ms"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          trend="down"
          trendValue={12}
          status={metrics.averageResponseTime > 500 ? 'critical' : metrics.averageResponseTime > 200 ? 'warning' : 'good'}
        />
        <MetricCard
          title="Tasa de Cache Hit"
          value={(metrics.cacheHitRate * 100)}
          unit="%"
          icon={<Database className="h-4 w-4 text-muted-foreground" />}
          trend="up"
          trendValue={5}
          status={metrics.cacheHitRate < 0.5 ? 'critical' : metrics.cacheHitRate < 0.7 ? 'warning' : 'good'}
        />
        <MetricCard
          title="Requests Totales"
          value={metrics.totalRequests}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          trend="up"
          trendValue={8}
          status="good"
        />
        <MetricCard
          title="Tasa de Errores"
          value={(metrics.errorRate * 100)}
          unit="%"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          trend="down"
          trendValue={3}
          status={metrics.errorRate > 0.05 ? 'critical' : metrics.errorRate > 0.02 ? 'warning' : 'good'}
        />
      </div>

      {/* Tabs de contenido */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="ratelimit">Rate Limiting</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico de tiempo de respuesta */}
            <Card>
              <CardHeader>
                <CardTitle>Tiempo de Respuesta</CardTitle>
                <CardDescription>Rendimiento de API en tiempo real</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Tiempo (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de cache hit rate */}
            <Card>
              <CardHeader>
                <CardTitle>Tasa de Cache Hit</CardTitle>
                <CardDescription>Eficiencia del sistema de cache</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="cacheHitRate" stroke="#82ca9d" fill="#82ca9d" name="Hit Rate %" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Distribución de códigos de estado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Códigos de Estado</CardTitle>
                <CardDescription>Últimas 24 horas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusCodeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusCodeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requests por Hora</CardTitle>
                <CardDescription>Volumen de tráfico</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requestCount" fill="#ffc658" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Estadísticas de cache */}
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas de Cache</CardTitle>
                <CardDescription>Estado actual del sistema de cache</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Entradas:</span>
                  <span className="font-medium">{cacheStats.size}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tamaño total:</span>
                  <span className="font-medium">{(cacheStats.totalSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Uso de memoria:</span>
                    <span className="font-medium">{((cacheStats.totalSize / cacheStats.maxSize) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(cacheStats.totalSize / cacheStats.maxSize) * 100} />
                </div>
                <div className="flex justify-between">
                  <span>Hit Rate:</span>
                  <span className="font-medium">{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Acciones de cache */}
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Cache</CardTitle>
                <CardDescription>Operaciones de mantenimiento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleClearAllCache} variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Todo el Cache
                </Button>
                
                <div className="space-y-2">
                  <Label>Invalidar por Tag</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Tag name" />
                    <Button onClick={() => handleInvalidateCacheByTag('products')}>
                      Invalidar
                    </Button>
                  </div>
                </div>

                <Dialog open={showCacheConfig} onOpenChange={setShowCacheConfig}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Cache
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configuración de Cache</DialogTitle>
                      <DialogDescription>
                        Ajusta los parámetros del sistema de cache
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>TTL por defecto (segundos)</Label>
                        <Input type="number" defaultValue="300" />
                      </div>
                      <div>
                        <Label>Tamaño máximo (MB)</Label>
                        <Input type="number" defaultValue="100" />
                      </div>
                      <div>
                        <Label>Estrategia de eviction</Label>
                        <Select defaultValue="lru">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lru">LRU (Least Recently Used)</SelectItem>
                            <SelectItem value="lfu">LFU (Least Frequently Used)</SelectItem>
                            <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCacheConfig(false)}>
                          Cancelar
                        </Button>
                        <Button>Guardar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Top entradas de cache */}
            <Card>
              <CardHeader>
                <CardTitle>Top Entradas de Cache</CardTitle>
                <CardDescription>Más accedidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cacheStats.entries.slice(0, 5).map((entry, index) => (
                    <div key={index} className="flex justify-between items-center p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{entry.key}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.accessCount} accesos
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInvalidateCache(entry.key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista completa de entradas de cache */}
          <Card>
            <CardHeader>
              <CardTitle>Entradas de Cache</CardTitle>
              <CardDescription>Todas las entradas actualmente en cache</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cacheStats.entries.map((entry, index) => (
                  <CacheEntryRow
                    key={index}
                    entry={entry}
                    onInvalidate={handleInvalidateCache}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ratelimit" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Estadísticas de rate limiting */}
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas de Rate Limiting</CardTitle>
                <CardDescription>Estado actual del sistema de límites</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Conexiones activas:</span>
                  <span className="font-medium">{rateLimitStats.activeConnections}</span>
                </div>
                <div className="flex justify-between">
                  <span>Requests bloqueados:</span>
                  <span className="font-medium text-red-600">{rateLimitStats.blockedRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total requests:</span>
                  <span className="font-medium">{rateLimitStats.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Promedio por cliente:</span>
                  <span className="font-medium">{rateLimitStats.averageRequestsPerKey.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Configuración de rate limiting */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
                <CardDescription>Ajustar límites de rate limiting</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showRateLimitConfig} onOpenChange={setShowRateLimitConfig}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Rate Limits
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configuración de Rate Limiting</DialogTitle>
                      <DialogDescription>
                        Ajusta los límites de requests por cliente
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Ventana de tiempo (minutos)</Label>
                        <Input type="number" defaultValue="15" />
                      </div>
                      <div>
                        <Label>Máximo requests por ventana</Label>
                        <Input type="number" defaultValue="100" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowRateLimitConfig(false)}>
                          Cancelar
                        </Button>
                        <Button>Guardar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Métricas de rendimiento */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Rendimiento</CardTitle>
                <CardDescription>Indicadores clave de rendimiento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.averageResponseTime.toFixed(0)}ms
                    </div>
                    <div className="text-sm text-muted-foreground">Tiempo promedio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(metrics.cacheHitRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Cache hit rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {metrics.totalRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">Total requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {(metrics.errorRate * 100).toFixed(2)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Error rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints más lentos */}
            <Card>
              <CardHeader>
                <CardTitle>Endpoints Más Lentos</CardTitle>
                <CardDescription>Top 5 endpoints con mayor tiempo de respuesta</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.slowestEndpoints.slice(0, 5).map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{endpoint.endpoint}</div>
                        <div className="text-xs text-muted-foreground">
                          {endpoint.requestCount} requests
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{endpoint.averageTime.toFixed(0)}ms</div>
                        <div className="text-xs text-muted-foreground">
                          Max: {endpoint.maxTime.toFixed(0)}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Endpoint</CardTitle>
              <CardDescription>Métricas detalladas de cada endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Endpoint</th>
                      <th className="text-right p-2">Requests</th>
                      <th className="text-right p-2">Tiempo Promedio</th>
                      <th className="text-right p-2">Error Rate</th>
                      <th className="text-right p-2">Cache Hit Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointPerformanceData.map((endpoint, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{endpoint.endpoint}</td>
                        <td className="p-2 text-right">{endpoint.requests}</td>
                        <td className="p-2 text-right">{endpoint.avgTime}ms</td>
                        <td className="p-2 text-right">
                          <span className={endpoint.errors > 0 ? 'text-red-600' : 'text-green-600'}>
                            {((endpoint.errors / endpoint.requests) * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className="text-blue-600">
                            {(Math.random() * 30 + 70).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
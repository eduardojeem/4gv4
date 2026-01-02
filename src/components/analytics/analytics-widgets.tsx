'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { Legend } from 'recharts/es6/component/Legend';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart, 
  Activity,
  Eye,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Calendar,
  Filter
} from 'lucide-react'

// Interfaces para widgets
interface WidgetProps {
  className?: string
  timeRange?: string
  refreshInterval?: number
}

interface MetricData {
  current: number
  previous: number
  change: number
  trend: 'up' | 'down' | 'stable'
  target?: number
}

interface ChartDataPoint {
  name: string
  value: number
  date?: string
  [key: string]: string | number | undefined
}

// Widget de métricas en tiempo real
function RealTimeMetricsWidget({ className, refreshInterval = 30000 }: WidgetProps) {
  const [metrics, setMetrics] = useState({
    activeUsers: { current: 1247, previous: 1156, change: 7.9, trend: 'up' as const },
    pageViews: { current: 8934, previous: 8234, change: 8.5, trend: 'up' as const },
    bounceRate: { current: 32.4, previous: 35.1, change: -7.7, trend: 'down' as const },
    avgSessionDuration: { current: 245, previous: 238, change: 2.9, trend: 'up' as const }
  })

  const [isLive, setIsLive] = useState(true)

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setMetrics(prev => ({
        activeUsers: {
          ...prev.activeUsers,
          current: prev.activeUsers.current + Math.floor(Math.random() * 20 - 10)
        },
        pageViews: {
          ...prev.pageViews,
          current: prev.pageViews.current + Math.floor(Math.random() * 50)
        },
        bounceRate: {
          ...prev.bounceRate,
          current: Math.max(0, Math.min(100, prev.bounceRate.current + (Math.random() * 2 - 1)))
        },
        avgSessionDuration: {
          ...prev.avgSessionDuration,
          current: Math.max(0, prev.avgSessionDuration.current + Math.floor(Math.random() * 10 - 5))
        }
      }))
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [isLive, refreshInterval])

  const MetricCard = ({ title, metric, unit = '', icon: Icon }: {
    title: string
    metric: MetricData
    unit?: string
    icon: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold">
            {metric.current.toLocaleString()}{unit}
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className={`flex items-center space-x-1 ${
          metric.trend === 'up' ? 'text-green-600' : 
          metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {metric.trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : 
           metric.trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null}
          <span className="text-sm font-medium">
            {Math.abs(metric.change).toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-gray-500">vs anterior</p>
      </div>
    </div>
  )

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Métricas en Tiempo Real</CardTitle>
          <CardDescription>Actualización automática cada {refreshInterval / 1000}s</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-500">{isLive ? 'En vivo' : 'Pausado'}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? 'Pausar' : 'Reanudar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetricCard
          title="Usuarios Activos"
          metric={metrics.activeUsers}
          icon={Users}
        />
        <MetricCard
          title="Páginas Vistas"
          metric={metrics.pageViews}
          icon={Eye}
        />
        <MetricCard
          title="Tasa de Rebote"
          metric={metrics.bounceRate}
          unit="%"
          icon={Target}
        />
        <MetricCard
          title="Duración Promedio"
          metric={metrics.avgSessionDuration}
          unit="s"
          icon={Clock}
        />
      </CardContent>
    </Card>
  )
}

// Widget de conversión en embudo
function ConversionFunnelWidget({ className }: WidgetProps) {
  const [funnelData] = useState([
    { stage: 'Visitantes', count: 10000, percentage: 100, color: '#8884d8' },
    { stage: 'Productos Vistos', count: 7500, percentage: 75, color: '#82ca9d' },
    { stage: 'Carrito Agregado', count: 3200, percentage: 32, color: '#ffc658' },
    { stage: 'Checkout Iniciado', count: 1800, percentage: 18, color: '#ff7300' },
    { stage: 'Compra Completada', count: 1200, percentage: 12, color: '#00ff00' }
  ])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Embudo de Conversión</CardTitle>
        <CardDescription>Análisis del proceso de compra</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {funnelData.map((stage, index) => (
            <div key={stage.stage} className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{stage.stage}</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{stage.count.toLocaleString()}</span>
                  <span className="text-sm text-gray-500 ml-2">({stage.percentage}%)</span>
                </div>
              </div>
              <div className="relative">
                <Progress value={stage.percentage} className="h-8" />
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: stage.color, opacity: 0.8 }}
                />
              </div>
              {index < funnelData.length - 1 && (
                <div className="text-center mt-2">
                  <span className="text-xs text-red-500">
                    -{((funnelData[index].count - funnelData[index + 1].count) / funnelData[index].count * 100).toFixed(1)}% abandono
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tasa de Conversión Global</span>
            <span className="text-lg font-bold text-blue-600">12%</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            De cada 100 visitantes, 12 realizan una compra
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Widget de mapa de calor de actividad
function ActivityHeatmapWidget({ className }: WidgetProps) {
  const [heatmapData] = useState(() => {
    const data: Array<{ day: number; hour: number; activity: number; dayName: string; label: string }> = []
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const hours = Array.from({ length: 24 }, (_, i) => i)

    days.forEach((day, dayIndex) => {
      hours.forEach(hour => {
        const activity = Math.random() * 100
        data.push({
          day: dayIndex,
          hour,
          activity,
          dayName: day,
          label: `${day} ${hour}:00`
        })
      })
    })

    return data
  })

  const getActivityColor = (activity: number) => {
    if (activity < 20) return '#f0f9ff'
    if (activity < 40) return '#bae6fd'
    if (activity < 60) return '#7dd3fc'
    if (activity < 80) return '#38bdf8'
    return '#0284c7'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Mapa de Calor de Actividad</CardTitle>
        <CardDescription>Actividad de usuarios por día y hora</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-25 gap-1 text-xs">
            <div></div>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="text-center text-gray-500">
                {i % 6 === 0 ? i : ''}
              </div>
            ))}
          </div>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-25 gap-1">
              <div className="text-xs text-gray-500 flex items-center">{day}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const dataPoint = heatmapData.find(d => d.day === dayIndex && d.hour === hour)
                return (
                  <div
                    key={hour}
                    className="w-4 h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-300"
                    style={{ backgroundColor: getActivityColor(dataPoint?.activity || 0) }}
                    title={`${day} ${hour}:00 - ${dataPoint?.activity.toFixed(0)}% actividad`}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>Menos actividad</span>
          <div className="flex space-x-1">
            {[0, 20, 40, 60, 80].map(level => (
              <div
                key={level}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getActivityColor(level) }}
              />
            ))}
          </div>
          <span>Más actividad</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Widget de alertas y notificaciones
function AlertsWidget({ className }: WidgetProps) {
  const [alerts] = useState([
    {
      id: 1,
      type: 'warning',
      title: 'Tasa de conversión baja',
      message: 'La tasa de conversión ha bajado un 15% en las últimas 2 horas',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      severity: 'medium'
    },
    {
      id: 2,
      type: 'error',
      title: 'Error en API de pagos',
      message: 'Se detectaron errores en el procesamiento de pagos',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      severity: 'high'
    },
    {
      id: 3,
      type: 'success',
      title: 'Meta de ventas alcanzada',
      message: 'Se ha superado la meta de ventas diarias en un 120%',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      severity: 'low'
    },
    {
      id: 4,
      type: 'info',
      title: 'Nuevo pico de tráfico',
      message: 'Se registró un aumento del 45% en el tráfico web',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      severity: 'medium'
    }
  ])

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      default: return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    } as const

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'default'}>
        {severity === 'high' ? 'Alta' : severity === 'medium' ? 'Media' : 'Baja'}
      </Badge>
    )
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `hace ${hours}h`
    } else {
      return `hace ${minutes}m`
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Alertas y Notificaciones
          <Badge variant="outline">{alerts.length}</Badge>
        </CardTitle>
        <CardDescription>Eventos importantes del sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex-shrink-0 mt-1">
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alert.title}
                  </p>
                  {getSeverityBadge(alert.severity)}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {alert.message}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {formatTimestamp(alert.timestamp)}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full">
            Ver todas las alertas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Widget de comparación de períodos
function PeriodComparisonWidget({ className }: WidgetProps) {
  const [comparisonData] = useState([
    { metric: 'Ingresos', current: 45230, previous: 38940, unit: '€' },
    { metric: 'Pedidos', current: 1247, previous: 1156, unit: '' },
    { metric: 'Clientes', current: 892, previous: 834, unit: '' },
    { metric: 'Tasa Conv.', current: 3.2, previous: 2.8, unit: '%' }
  ])

  const calculateChange = (current: number, previous: number) => {
    return ((current - previous) / previous) * 100
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Comparación de Períodos</CardTitle>
        <CardDescription>Último mes vs mes anterior</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {comparisonData.map(item => {
            const change = calculateChange(item.current, item.previous)
            const isPositive = change > 0
            
            return (
              <div key={item.metric} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">{item.metric}</p>
                  <p className="text-lg font-bold">
                    {item.current.toLocaleString()}{item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`flex items-center space-x-1 ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                      {Math.abs(change).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {item.previous.toLocaleString()}{item.unit} anterior
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Widget de objetivos y KPIs
function KPITargetsWidget({ className }: WidgetProps) {
  const [kpis] = useState([
    { 
      name: 'Ingresos Mensuales', 
      current: 45230, 
      target: 50000, 
      unit: '€',
      color: '#8884d8'
    },
    { 
      name: 'Nuevos Clientes', 
      current: 234, 
      target: 300, 
      unit: '',
      color: '#82ca9d'
    },
    { 
      name: 'Tasa de Conversión', 
      current: 3.2, 
      target: 4.0, 
      unit: '%',
      color: '#ffc658'
    },
    { 
      name: 'Satisfacción Cliente', 
      current: 4.6, 
      target: 4.8, 
      unit: '/5',
      color: '#ff7300'
    }
  ])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Objetivos y KPIs</CardTitle>
        <CardDescription>Progreso hacia metas establecidas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {kpis.map(kpi => {
            const progress = (kpi.current / kpi.target) * 100
            const isOnTrack = progress >= 80
            
            return (
              <div key={kpi.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{kpi.name}</span>
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      {kpi.current.toLocaleString()}{kpi.unit}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">
                      / {kpi.target.toLocaleString()}{kpi.unit}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={Math.min(progress, 100)} className="h-3" />
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isOnTrack ? 'text-green-600' : 'text-red-600'}`}>
                      {progress.toFixed(1)}% completado
                    </span>
                    <Badge variant={isOnTrack ? 'default' : 'destructive'}>
                      {isOnTrack ? 'En objetivo' : 'Requiere atención'}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export {
  RealTimeMetricsWidget,
  ConversionFunnelWidget,
  ActivityHeatmapWidget,
  AlertsWidget,
  PeriodComparisonWidget,
  KPITargetsWidget
}

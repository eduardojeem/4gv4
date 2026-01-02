'use client'

import { useMemo, useState, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
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
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import {
  TrendingUp,
  TrendingDown,
  Wrench,
  DollarSign,
  Clock,
  Activity,
  Users,
  CheckCircle2,
  Download,
  Target,
  Zap,
  AlertTriangle,
  Award,
  Filter,
  RefreshCw,
  Calendar,
  BarChart3
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useRepairs } from '@/contexts/RepairsContext'
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, subDays, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Tipos optimizados
interface AnalyticsMetrics {
  totalRepairs: number
  completedRepairs: number
  inProgressRepairs: number
  urgentRepairs: number
  totalRevenue: number
  avgRepairValue: number
  completionRate: number
  avgRepairTime: number
  onTimeDeliveries: number
  onTimeRate: number
}

interface MonthlyData {
  month: string
  monthShort: string
  totalRepairs: number
  completedRepairs: number
  revenue: number
  avgRepairTime: number
}

interface TechnicianPerformance {
  name: string
  totalRepairs: number
  completedRepairs: number
  revenue: number
  avgTime: number
  efficiency: number
}

// Hook optimizado para analytics
function useOptimizedRepairAnalytics(timeRange: string) {
  const { repairs, isLoading } = useRepairs()

  return useMemo(() => {
    if (!repairs.length) {
      return {
        metrics: {} as AnalyticsMetrics,
        monthlyData: [] as MonthlyData[],
        statusAnalysis: [],
        technicianAnalysis: [] as TechnicianPerformance[],
        deviceTypeAnalysis: [],
        priorityAnalysis: [],
        dailyTrend: []
      }
    }

    const now = new Date()
    const monthCount = timeRange === '12months' ? 12 : 6

    // Pre-calcular fechas una sola vez
    const monthRanges = Array.from({ length: monthCount }, (_, i) => {
      const monthDate = subMonths(now, monthCount - 1 - i)
      return {
        date: monthDate,
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
        monthShort: format(monthDate, 'MMM', { locale: es }),
        month: format(monthDate, 'MMM yyyy', { locale: es }),
        key: format(monthDate, 'yyyy-MM')
      }
    })

    // Usar Maps para mejor rendimiento O(1) lookup
    const repairsByMonth = new Map<string, any[]>()
    const completedByMonth = new Map<string, any[]>()
    const technicianStats = new Map<string, TechnicianPerformance>()
    const statusStats = new Map<string, { name: string; count: number; revenue: number }>()
    const deviceStats = new Map<string, { name: string; count: number; revenue: number }>()
    const priorityStats = new Map<string, { name: string; count: number; avgTime: number; totalTime: number }>()

    // Labels maps para evitar recálculos
    const statusLabels = new Map([
      ['recibido', 'Recibido'],
      ['diagnostico', 'En Diagnóstico'],
      ['reparacion', 'En Reparación'],
      ['pausado', 'Pausado'],
      ['listo', 'Listo'],
      ['entregado', 'Entregado'],
      ['cancelado', 'Cancelado']
    ])

    const deviceLabels = new Map([
      ['smartphone', 'Smartphones'],
      ['tablet', 'Tablets'],
      ['laptop', 'Laptops'],
      ['desktop', 'Desktops'],
      ['accessory', 'Accesorios'],
      ['other', 'Otros']
    ])

    const priorityLabels = new Map([
      ['low', 'Baja'],
      ['medium', 'Media'],
      ['high', 'Alta']
    ])

    // Inicializar Maps
    monthRanges.forEach(range => {
      repairsByMonth.set(range.key, [])
      completedByMonth.set(range.key, [])
    })

    // Métricas acumulativas
    let totalRepairs = 0
    let completedRepairs = 0
    let inProgressRepairs = 0
    let urgentRepairs = 0
    let totalRevenue = 0
    let onTimeDeliveries = 0
    let totalRepairTime = 0
    let completedWithTime = 0

    // Procesar todas las reparaciones en una sola iteración
    repairs.forEach(repair => {
      totalRepairs++
      const repairDate = new Date(repair.createdAt)
      const monthKey = format(repairDate, 'yyyy-MM')
      const status = repair.dbStatus || 'unknown'
      const deviceType = repair.deviceType || 'unknown'
      const priority = repair.priority || 'medium'
      const technicianName = repair.technician?.name || 'Sin asignar'
      const revenue = repair.finalCost || repair.estimatedCost || 0

      // Agregar a mes correspondiente
      const monthRepairs = repairsByMonth.get(monthKey)
      if (monthRepairs) {
        monthRepairs.push(repair)
      }

      // Métricas generales
      totalRevenue += revenue

      if (status === 'entregado') {
        completedRepairs++
        const monthCompleted = completedByMonth.get(monthKey)
        if (monthCompleted) {
          monthCompleted.push(repair)
        }

        // Calcular tiempo de reparación
        if (repair.completedAt && repair.createdAt) {
          const repairTime = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          totalRepairTime += repairTime
          completedWithTime++
          
          if (repairTime <= 7) {
            onTimeDeliveries++
          }
        }
      }

      if (['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(status)) {
        inProgressRepairs++
      }

      if (repair.urgency === 'urgent') {
        urgentRepairs++
      }

      // Estadísticas por estado
      const statusKey = statusLabels.get(status) || status
      const statusStat = statusStats.get(statusKey) || { name: statusKey, count: 0, revenue: 0 }
      statusStat.count++
      statusStat.revenue += revenue
      statusStats.set(statusKey, statusStat)

      // Estadísticas por dispositivo
      const deviceKey = deviceLabels.get(deviceType) || deviceType
      const deviceStat = deviceStats.get(deviceKey) || { name: deviceKey, count: 0, revenue: 0 }
      deviceStat.count++
      deviceStat.revenue += revenue
      deviceStats.set(deviceKey, deviceStat)

      // Estadísticas por prioridad
      const priorityKey = priorityLabels.get(priority) || priority
      const priorityStat = priorityStats.get(priorityKey) || { name: priorityKey, count: 0, avgTime: 0, totalTime: 0 }
      priorityStat.count++
      if (repair.completedAt && repair.createdAt) {
        const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
        priorityStat.totalTime += days
      }
      priorityStats.set(priorityKey, priorityStat)

      // Estadísticas por técnico
      const techStat = technicianStats.get(technicianName) || {
        name: technicianName,
        totalRepairs: 0,
        completedRepairs: 0,
        revenue: 0,
        avgTime: 0,
        efficiency: 0
      }
      techStat.totalRepairs++
      if (status === 'entregado') {
        techStat.completedRepairs++
        techStat.revenue += revenue
      }
      technicianStats.set(technicianName, techStat)
    })

    // Calcular promedios y eficiencias
    priorityStats.forEach(stat => {
      stat.avgTime = stat.count > 0 ? stat.totalTime / stat.count : 0
    })

    technicianStats.forEach(tech => {
      tech.efficiency = tech.totalRepairs > 0 ? (tech.completedRepairs / tech.totalRepairs) * 100 : 0
    })

    // Generar datos mensuales optimizado
    const monthlyData: MonthlyData[] = monthRanges.map(range => {
      const monthRepairs = repairsByMonth.get(range.key) || []
      const completedRepairs = completedByMonth.get(range.key) || []
      
      const revenue = completedRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
      
      let avgRepairTime = 0
      if (completedRepairs.length > 0) {
        const totalTime = completedRepairs.reduce((sum, r) => {
          if (r.completedAt && r.createdAt) {
            return sum + differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
          }
          return sum
        }, 0)
        avgRepairTime = totalTime / completedRepairs.length
      }
      
      return {
        month: range.month,
        monthShort: range.monthShort,
        totalRepairs: monthRepairs.length,
        completedRepairs: completedRepairs.length,
        revenue,
        avgRepairTime
      }
    })

    // Tendencia diaria (últimos 7 días)
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dayRepairs = repairs.filter(r => {
        const repairDate = new Date(r.createdAt)
        return format(repairDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      })
      
      return {
        date: format(date, 'dd/MM'),
        repairs: dayRepairs.length,
        completed: dayRepairs.filter(r => r.dbStatus === 'entregado').length,
        revenue: dayRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
      }
    })

    // Métricas calculadas
    const metrics: AnalyticsMetrics = {
      totalRepairs,
      completedRepairs,
      inProgressRepairs,
      urgentRepairs,
      totalRevenue,
      avgRepairValue: totalRepairs > 0 ? totalRevenue / totalRepairs : 0,
      completionRate: totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0,
      avgRepairTime: completedWithTime > 0 ? totalRepairTime / completedWithTime : 0,
      onTimeDeliveries,
      onTimeRate: completedWithTime > 0 ? (onTimeDeliveries / completedWithTime) * 100 : 0
    }

    return {
      metrics,
      monthlyData,
      statusAnalysis: Array.from(statusStats.values()),
      technicianAnalysis: Array.from(technicianStats.values()).sort((a, b) => b.efficiency - a.efficiency),
      deviceTypeAnalysis: Array.from(deviceStats.values()).sort((a, b) => b.count - a.count),
      priorityAnalysis: Array.from(priorityStats.values()),
      dailyTrend
    }
  }, [repairs, timeRange])
}

// Componente de métrica optimizado
const MetricCard = memo(({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  format = 'number',
  gradient,
  trend
}: {
  title: string
  value: number | string
  change?: number
  icon: any
  format?: 'number' | 'currency' | 'percentage' | 'days'
  gradient: string
  trend?: 'up' | 'down' | 'neutral'
}) => {
  const formatValue = useCallback((val: number | string) => {
    if (typeof val === 'string') return val
    if (val === undefined || val === null || isNaN(Number(val))) return '0'
    
    const numVal = Number(val)
    
    switch (format) {
      case 'currency':
        return (
          <div className="flex items-center gap-1">
            <GSIcon className="h-5 w-5" />
            {numVal.toLocaleString()}
          </div>
        )
      case 'percentage':
        return `${Math.round(numVal)}%`
      case 'days':
        return `${Math.round(numVal)} días`
      default:
        return numVal.toLocaleString()
    }
  }, [format])

  return (
    <Card className={`${gradient} border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-white">
          {title}
        </CardTitle>
        <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white mb-1">
          {formatValue(value)}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 text-xs text-white/90">
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            <span>
              {change > 0 ? '+' : ''}{change}%
            </span>
            <span className="text-white/70">vs anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

MetricCard.displayName = 'MetricCard'

// Tooltip personalizado optimizado
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3">
      <div className="font-medium text-sm mb-1">{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium">
            {entry.name.includes('Revenue') || entry.name.includes('Ingresos') ? (
              <span className="flex items-center gap-1">
                <GSIcon className="h-3 w-3" />
                {entry.value.toLocaleString()}
              </span>
            ) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
})

CustomTooltip.displayName = 'CustomTooltip'

interface OptimizedRepairAnalyticsProps {
  className?: string
}

export function OptimizedRepairAnalytics({ className }: OptimizedRepairAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('6months')
  const [activeTab, setActiveTab] = useState('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const analytics = useOptimizedRepairAnalytics(timeRange)
  const { refreshRepairs } = useRepairs()

  const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ]

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshRepairs()
      toast.success('Datos actualizados')
    } catch (error) {
      toast.error('Error al actualizar datos')
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshRepairs])

  const exportData = useCallback(() => {
    const csvData = [
      ['Métrica', 'Valor'],
      ['Total Reparaciones', analytics.metrics.totalRepairs],
      ['Completadas', analytics.metrics.completedRepairs],
      ['Tasa de Completado', `${Math.round(analytics.metrics.completionRate)}%`],
      ['Tiempo Promedio', `${Math.round(analytics.metrics.avgRepairTime)} días`],
      ['Ingresos Totales', analytics.metrics.totalRevenue],
      ['Valor Promedio', Math.round(analytics.metrics.avgRepairValue)]
    ]

    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `repair_analytics_${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    
    toast.success('Datos exportados exitosamente')
  }, [analytics])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header optimizado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Optimizado</h1>
            <p className="text-muted-foreground">
              Análisis de rendimiento en tiempo real
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="12months">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Actualizar
          </Button>
          
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales optimizadas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Reparaciones"
          value={analytics.metrics.totalRepairs}
          icon={Wrench}
          gradient="bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400"
        />
        
        <MetricCard
          title="Tasa de Completado"
          value={analytics.metrics.completionRate}
          format="percentage"
          icon={CheckCircle2}
          gradient="bg-gradient-to-br from-green-400 via-blue-500 to-purple-600"
        />
        
        <MetricCard
          title="Tiempo Promedio"
          value={analytics.metrics.avgRepairTime}
          format="days"
          icon={Clock}
          gradient="bg-gradient-to-br from-orange-400 via-pink-500 to-red-500"
        />
        
        <MetricCard
          title="Ingresos Totales"
          value={analytics.metrics.totalRevenue}
          format="currency"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-700"
        />
      </div>

      {/* Tabs optimizados */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border-0 p-2">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent h-auto p-0">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <BarChart3 className="h-4 w-4" />
              Vista General
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <Activity className="h-4 w-4" />
              Rendimiento
            </TabsTrigger>
            <TabsTrigger 
              value="technicians" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <Users className="h-4 w-4" />
              Técnicos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Gráficos principales */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tendencia temporal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tendencias Temporales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthShort" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="totalRepairs"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      name="Total Reparaciones"
                    />
                    <Area
                      type="monotone"
                      dataKey="completedRepairs"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      name="Completadas"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por estado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Distribución por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.statusAnalysis}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {analytics.statusAnalysis.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Dispositivos */}
          <Card>
            <CardHeader>
              <CardTitle>Reparaciones por Tipo de Dispositivo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.deviceTypeAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Métricas de rendimiento */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-300">
                  <Target className="h-4 w-4" />
                  Tasa de Completado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-rose-700 dark:text-rose-300">
                      {Math.round(analytics.metrics.completionRate)}%
                    </span>
                    <Badge 
                      variant={analytics.metrics.completionRate >= 80 ? 'default' : 'secondary'}
                      className={analytics.metrics.completionRate >= 80 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      }
                    >
                      {analytics.metrics.completionRate >= 80 ? 'Excelente' : 'Mejorable'}
                    </Badge>
                  </div>
                  <Progress value={analytics.metrics.completionRate} className="h-3" />
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {analytics.metrics.completedRepairs} de {analytics.metrics.totalRepairs} reparaciones
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Zap className="h-4 w-4" />
                  Entregas a Tiempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                      {Math.round(analytics.metrics.onTimeRate)}%
                    </span>
                    <Badge 
                      variant={analytics.metrics.onTimeRate >= 70 ? 'default' : 'destructive'}
                    >
                      {analytics.metrics.onTimeRate >= 70 ? 'Bueno' : 'Crítico'}
                    </Badge>
                  </div>
                  <Progress value={analytics.metrics.onTimeRate} className="h-3" />
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Meta: ≤7 días por reparación
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Reparaciones Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                      {analytics.metrics.urgentRepairs}
                    </span>
                    <Badge 
                      variant={analytics.metrics.urgentRepairs > 5 ? 'destructive' : 'secondary'}
                      className={analytics.metrics.urgentRepairs > 5 ? 'animate-pulse' : ''}
                    >
                      {analytics.metrics.urgentRepairs > 5 ? 'Alto' : 'Normal'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      analytics.metrics.urgentRepairs > 5 ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                    }`} />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Requieren atención inmediata
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendencia diaria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Tendencia de los Últimos 7 Días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="repairs"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    name="Reparaciones"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    name="Completadas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Rendimiento por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.technicianAnalysis.slice(0, 5).map((tech, index) => {
                  const gradients = [
                    'from-yellow-400 via-orange-500 to-red-500',
                    'from-gray-300 via-gray-400 to-gray-500',
                    'from-amber-600 via-yellow-700 to-orange-800',
                    'from-blue-400 via-indigo-500 to-purple-600',
                    'from-green-400 via-teal-500 to-cyan-600'
                  ]
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${gradients[index]} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{tech.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tech.completedRepairs} de {tech.totalRepairs} completadas
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={tech.efficiency} className="w-20 h-2" />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(tech.efficiency)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-bold">
                          <GSIcon className="h-4 w-4" />
                          {tech.revenue.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(tech.avgTime)} días promedio
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
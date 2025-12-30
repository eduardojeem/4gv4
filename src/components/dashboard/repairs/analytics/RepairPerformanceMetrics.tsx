'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Award,
  Activity
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useRepairs } from '@/contexts/RepairsContext'
import { format, subDays, isWithinInterval, differenceInDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

interface RepairPerformanceMetricsProps {
  className?: string
}

export function RepairPerformanceMetrics({ className }: RepairPerformanceMetricsProps) {
  const { repairs, isLoading } = useRepairs()
  const [timeFrame, setTimeFrame] = useState('week')

  const performanceMetrics = useMemo(() => {
    const now = new Date()
    
    // Definir rangos de tiempo
    const ranges = {
      week: { start: subDays(now, 7), end: now },
      month: { start: subDays(now, 30), end: now },
      quarter: { start: subDays(now, 90), end: now }
    }
    
    const currentRange = ranges[timeFrame as keyof typeof ranges]
    
    // Optimizar filtrado con Map para mejor rendimiento
    const currentPeriodRepairs: any[] = []
    const previousPeriodRepairs: any[] = []
    
    // Período anterior para comparación
    const previousRange = {
      start: subDays(currentRange.start, differenceInDays(currentRange.end, currentRange.start)),
      end: currentRange.start
    }
    
    // Filtrar una sola vez para mejor rendimiento
    repairs.forEach(repair => {
      const repairDate = new Date(repair.createdAt)
      if (isWithinInterval(repairDate, currentRange)) {
        currentPeriodRepairs.push(repair)
      } else if (isWithinInterval(repairDate, previousRange)) {
        previousPeriodRepairs.push(repair)
      }
    })

    // Optimizar cálculo de métricas con una sola iteración
    const currentMetrics = {
      totalRepairs: currentPeriodRepairs.length,
      completedRepairs: 0,
      inProgressRepairs: 0,
      urgentRepairs: 0,
      revenue: 0,
      avgRepairTime: 0,
      onTimeDeliveries: 0
    }

    const previousMetrics = {
      totalRepairs: previousPeriodRepairs.length,
      completedRepairs: 0,
      revenue: 0
    }

    // Calcular métricas actuales en una sola iteración
    currentPeriodRepairs.forEach((r: any) => {
      if (r.dbStatus === 'entregado') currentMetrics.completedRepairs++
      if (['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.dbStatus || '')) {
        currentMetrics.inProgressRepairs++
      }
      if (r.urgency === 'urgent') currentMetrics.urgentRepairs++
      currentMetrics.revenue += (r.finalCost || r.estimatedCost || 0)
    })

    // Calcular métricas del período anterior
    previousPeriodRepairs.forEach((r: any) => {
      if (r.dbStatus === 'entregado') previousMetrics.completedRepairs++
      previousMetrics.revenue += (r.finalCost || r.estimatedCost || 0)
    })

    // Calcular tiempo promedio de reparación y entregas a tiempo en una iteración
    const completedWithTime: any[] = []
    let totalRepairTime = 0
    
    currentPeriodRepairs.forEach((r: any) => {
      if (r.dbStatus === 'entregado' && r.completedAt && r.createdAt) {
        const repairTime = differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
        completedWithTime.push(r)
        totalRepairTime += repairTime
        
        // Calcular entregas a tiempo (≤7 días)
        if (repairTime <= 7) {
          currentMetrics.onTimeDeliveries++
        }
      }
    })
    
    if (completedWithTime.length > 0) {
      currentMetrics.avgRepairTime = totalRepairTime / completedWithTime.length
    }

    // Calcular cambios porcentuales
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const changes = {
      totalRepairs: calculateChange(currentMetrics.totalRepairs, previousMetrics.totalRepairs),
      completedRepairs: calculateChange(currentMetrics.completedRepairs, previousMetrics.completedRepairs),
      revenue: calculateChange(currentMetrics.revenue, previousMetrics.revenue)
    }

    // Datos para gráfico de tendencia diaria
    const dailyTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i)
      const dayRepairs = repairs.filter(r => {
        const repairDate = new Date(r.createdAt)
        return format(repairDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      })
      
      dailyTrend.push({
        date: format(date, 'dd/MM'),
        repairs: dayRepairs.length,
        completed: dayRepairs.filter(r => r.dbStatus === 'entregado').length,
        revenue: dayRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
      })
    }

    // Análisis por técnico (top 5)
    const technicianPerformance = repairs.reduce((acc, repair) => {
      if (!repair.technician?.name) return acc
      
      const techName = repair.technician.name
      if (!acc[techName]) {
        acc[techName] = {
          name: techName,
          totalRepairs: 0,
          completedRepairs: 0,
          avgTime: 0,
          totalTime: 0,
          efficiency: 0
        }
      }
      
      acc[techName].totalRepairs++
      if (repair.dbStatus === 'entregado') {
        acc[techName].completedRepairs++
        if (repair.completedAt && repair.createdAt) {
          const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          acc[techName].totalTime += days
        }
      }
      
      return acc
    }, {} as Record<string, any>)

    // Calcular eficiencia por técnico
    Object.values(technicianPerformance).forEach((tech: any) => {
      tech.avgTime = tech.completedRepairs > 0 ? tech.totalTime / tech.completedRepairs : 0
      tech.efficiency = tech.totalRepairs > 0 ? (tech.completedRepairs / tech.totalRepairs) * 100 : 0
    })

    const topTechnicians = Object.values(technicianPerformance)
      .sort((a: any, b: any) => b.efficiency - a.efficiency)
      .slice(0, 5)

    return {
      current: currentMetrics,
      previous: previousMetrics,
      changes,
      dailyTrend,
      topTechnicians,
      completionRate: currentMetrics.totalRepairs > 0 
        ? (currentMetrics.completedRepairs / currentMetrics.totalRepairs) * 100 
        : 0,
      onTimeRate: completedWithTime.length > 0 
        ? (currentMetrics.onTimeDeliveries / completedWithTime.length) * 100 
        : 0
    }
  }, [repairs, timeFrame])

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'number',
    colorScheme = 'blue' 
  }: {
    title: string
    value: number | string
    change?: number
    icon: any
    format?: 'number' | 'currency' | 'percentage' | 'days'
    colorScheme?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
  }) => {
    const formatValue = (val: number | string) => {
      if (typeof val === 'string') return val
      
      switch (format) {
        case 'currency':
          return (
            <div className="flex items-center gap-1">
              <GSIcon className="h-5 w-5" />
              {val.toLocaleString()}
            </div>
          )
        case 'percentage':
          return `${val}%`
        case 'days':
          return `${val} días`
        default:
          return val.toString()
      }
    }

    const colors = {
      blue: 'from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900 text-blue-700 dark:text-blue-300',
      green: 'from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900 text-green-700 dark:text-green-300',
      orange: 'from-orange-50 to-amber-50 border-orange-100 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900 text-orange-700 dark:text-orange-300',
      purple: 'from-purple-50 to-violet-50 border-purple-100 dark:from-purple-950/20 dark:to-violet-950/20 dark:border-purple-900 text-purple-700 dark:text-purple-300',
      red: 'from-red-50 to-rose-50 border-red-100 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-900 text-red-700 dark:text-red-300'
    }

    return (
      <Card className={`bg-gradient-to-br ${colors[colorScheme]}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-1">
            {formatValue(value)}
          </div>
          {change !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {change > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : null}
              <span className={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}>
                {change > 0 ? '+' : ''}{change}%
              </span>
              <span className="text-muted-foreground">vs período anterior</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <div className="p-8 text-center">Cargando métricas...</div>
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con selector de tiempo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Métricas de Rendimiento</h2>
          <p className="text-muted-foreground">Análisis en tiempo real del desempeño de reparaciones</p>
        </div>
        <Tabs value={timeFrame} onValueChange={setTimeFrame}>
          <TabsList>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mes</TabsTrigger>
            <TabsTrigger value="quarter">Trimestre</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Métricas principales con gradientes vibrantes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:rotate-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Reparaciones</CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {performanceMetrics.current.totalRepairs}
            </div>
            {performanceMetrics.changes.totalRepairs !== undefined && (
              <div className="flex items-center gap-1 text-xs text-white/90">
                {performanceMetrics.changes.totalRepairs > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : performanceMetrics.changes.totalRepairs < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>
                  {performanceMetrics.changes.totalRepairs > 0 ? '+' : ''}{performanceMetrics.changes.totalRepairs}%
                </span>
                <span className="text-white/70">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:rotate-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Completadas</CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {performanceMetrics.current.completedRepairs}
            </div>
            {performanceMetrics.changes.completedRepairs !== undefined && (
              <div className="flex items-center gap-1 text-xs text-white/90">
                {performanceMetrics.changes.completedRepairs > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : performanceMetrics.changes.completedRepairs < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>
                  {performanceMetrics.changes.completedRepairs > 0 ? '+' : ''}{performanceMetrics.changes.completedRepairs}%
                </span>
                <span className="text-white/70">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:rotate-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Tiempo Promedio</CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {Math.round(performanceMetrics.current.avgRepairTime)} días
            </div>
            <p className="text-xs text-white/80">
              Por reparación completada
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:rotate-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Ingresos</CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1 flex items-center gap-1">
              <GSIcon className="h-5 w-5" />
              {performanceMetrics.current.revenue.toLocaleString()}
            </div>
            {performanceMetrics.changes.revenue !== undefined && (
              <div className="flex items-center gap-1 text-xs text-white/90">
                {performanceMetrics.changes.revenue > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : performanceMetrics.changes.revenue < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>
                  {performanceMetrics.changes.revenue > 0 ? '+' : ''}{performanceMetrics.changes.revenue}%
                </span>
                <span className="text-white/70">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas de eficiencia con diseño vibrante */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-rose-100 via-pink-50 to-rose-50 dark:from-rose-950/30 dark:via-pink-950/20 dark:to-rose-950/30 border-rose-200 dark:border-rose-800 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <div className="p-2 bg-rose-500/20 rounded-full">
                <Target className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              Tasa de Completado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold text-rose-700 dark:text-rose-300">
                  {Math.round(performanceMetrics.completionRate)}%
                </span>
                <Badge 
                  variant={performanceMetrics.completionRate >= 80 ? 'default' : 'secondary'}
                  className={performanceMetrics.completionRate >= 80 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  }
                >
                  {performanceMetrics.completionRate >= 80 ? 'Excelente' : 'Mejorable'}
                </Badge>
              </div>
              <div className="relative">
                <Progress 
                  value={performanceMetrics.completionRate} 
                  className="h-3 bg-rose-200 dark:bg-rose-800"
                />
                <div 
                  className="absolute top-0 left-0 h-3 bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${performanceMetrics.completionRate}%` }}
                />
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {performanceMetrics.current.completedRepairs} de {performanceMetrics.current.totalRepairs} reparaciones
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-100 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/20 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <div className="p-2 bg-emerald-500/20 rounded-full">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Entregas a Tiempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                  {Math.round(performanceMetrics.onTimeRate)}%
                </span>
                <Badge 
                  variant={performanceMetrics.onTimeRate >= 70 ? 'default' : 'destructive'}
                  className={performanceMetrics.onTimeRate >= 70 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                  }
                >
                  {performanceMetrics.onTimeRate >= 70 ? 'Bueno' : 'Crítico'}
                </Badge>
              </div>
              <div className="relative">
                <Progress 
                  value={performanceMetrics.onTimeRate} 
                  className="h-3 bg-emerald-200 dark:bg-emerald-800"
                />
                <div 
                  className="absolute top-0 left-0 h-3 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${performanceMetrics.onTimeRate}%` }}
                />
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Meta: ≤7 días por reparación
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <div className="p-2 bg-amber-500/20 rounded-full">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Reparaciones Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {performanceMetrics.current.urgentRepairs}
                </span>
                <Badge 
                  variant={performanceMetrics.current.urgentRepairs > 5 ? 'destructive' : 'secondary'}
                  className={performanceMetrics.current.urgentRepairs > 5 
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                  }
                >
                  {performanceMetrics.current.urgentRepairs > 5 ? 'Alto' : 'Normal'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  performanceMetrics.current.urgentRepairs > 5 
                    ? 'bg-red-500 animate-pulse' 
                    : 'bg-green-500'
                }`} />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Requieren atención inmediata
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendencia de los Últimos 7 Días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performanceMetrics.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="repairs"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
                name="Reparaciones"
              />
              <Area
                type="monotone"
                dataKey="completed"
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

      {/* Top técnicos con diseño mejorado */}
      <Card className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 border-slate-200 dark:border-slate-700 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
              <Award className="h-5 w-5 text-white" />
            </div>
            Top Técnicos por Eficiencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performanceMetrics.topTechnicians.map((tech: any, index) => {
              const gradients = [
                'from-yellow-400 via-orange-500 to-red-500', // 1st place - gold
                'from-gray-300 via-gray-400 to-gray-500',   // 2nd place - silver
                'from-amber-600 via-yellow-700 to-orange-800', // 3rd place - bronze
                'from-blue-400 via-indigo-500 to-purple-600',  // 4th place
                'from-green-400 via-teal-500 to-cyan-600'      // 5th place
              ]
              
              return (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${gradients[index]} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg relative overflow-hidden`}>
                      <span className="relative z-10">{index + 1}</span>
                      {index === 0 && (
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/30 to-transparent animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{tech.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {tech.completedRepairs} de {tech.totalRepairs} completadas
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${gradients[index]} rounded-full transition-all duration-500`}
                            style={{ width: `${tech.efficiency}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {Math.round(tech.efficiency)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-bold text-lg">
                      <span className={`${
                        index === 0 ? 'text-yellow-600' :
                        index === 1 ? 'text-gray-600' :
                        index === 2 ? 'text-amber-700' :
                        'text-blue-600'
                      }`}>
                        {Math.round(tech.efficiency)}%
                      </span>
                      {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {Math.round(tech.avgTime)} días promedio
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
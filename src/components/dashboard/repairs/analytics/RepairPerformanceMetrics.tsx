'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
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

      {/* Métricas principales con diseño glassmorphism */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Reparaciones */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-cyan-400 to-blue-600 group-hover:opacity-10 transition-opacity duration-300" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 to-blue-600 opacity-50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Total Reparaciones</CardTitle>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Activity className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black tracking-tight mb-1 text-foreground">
              {performanceMetrics.current.totalRepairs}
            </div>
            {performanceMetrics.changes.totalRepairs !== undefined && (
              <div className="flex items-center gap-1.5 text-sm mt-2">
                <span className={cn(
                  "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                  performanceMetrics.changes.totalRepairs > 0 ? "bg-green-500/10 text-green-600 dark:text-green-400" : 
                  performanceMetrics.changes.totalRepairs < 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : 
                  "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                )}>
                  {performanceMetrics.changes.totalRepairs > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : performanceMetrics.changes.totalRepairs < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {performanceMetrics.changes.totalRepairs > 0 ? '+' : ''}{performanceMetrics.changes.totalRepairs}%
                </span>
                <span className="text-muted-foreground text-xs font-medium">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Completadas */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-emerald-400 to-teal-600 group-hover:opacity-10 transition-opacity duration-300" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-400 to-teal-600 opacity-50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Completadas</CardTitle>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black tracking-tight mb-1 text-foreground">
              {performanceMetrics.current.completedRepairs}
            </div>
            {performanceMetrics.changes.completedRepairs !== undefined && (
              <div className="flex items-center gap-1.5 text-sm mt-2">
                <span className={cn(
                  "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                  performanceMetrics.changes.completedRepairs > 0 ? "bg-green-500/10 text-green-600 dark:text-green-400" : 
                  performanceMetrics.changes.completedRepairs < 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : 
                  "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                )}>
                  {performanceMetrics.changes.completedRepairs > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : performanceMetrics.changes.completedRepairs < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {performanceMetrics.changes.completedRepairs > 0 ? '+' : ''}{performanceMetrics.changes.completedRepairs}%
                </span>
                <span className="text-muted-foreground text-xs font-medium">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Tiempo Promedio */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-orange-400 to-yellow-500 group-hover:opacity-10 transition-opacity duration-300" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-400 to-yellow-500 opacity-50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Tiempo Promedio</CardTitle>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-400 to-yellow-500 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black tracking-tight mb-1 text-foreground">
              {Math.round(performanceMetrics.current.avgRepairTime)} días
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-2">
              Por reparación completada
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Ingresos */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-purple-500 to-indigo-600 group-hover:opacity-10 transition-opacity duration-300" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-indigo-600 opacity-50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Ingresos</CardTitle>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Target className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black tracking-tight mb-1 text-foreground flex items-center gap-1.5">
              <GSIcon className="h-6 w-6 text-muted-foreground/50" />
              {performanceMetrics.current.revenue.toLocaleString()}
            </div>
            {performanceMetrics.changes.revenue !== undefined && (
              <div className="flex items-center gap-1.5 text-sm mt-2">
                <span className={cn(
                  "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                  performanceMetrics.changes.revenue > 0 ? "bg-green-500/10 text-green-600 dark:text-green-400" : 
                  performanceMetrics.changes.revenue < 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : 
                  "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                )}>
                  {performanceMetrics.changes.revenue > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : performanceMetrics.changes.revenue < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {performanceMetrics.changes.revenue > 0 ? '+' : ''}{performanceMetrics.changes.revenue}%
                </span>
                <span className="text-muted-foreground text-xs font-medium">vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas de eficiencia con diseño premium */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tasa de Completado */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-rose-400 to-pink-600 group-hover:opacity-10 transition-opacity duration-300" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
              <div className="p-2 bg-gradient-to-br from-rose-400/20 to-pink-600/20 rounded-xl">
                <Target className="h-5 w-5 text-rose-500" />
              </div>
              Tasa de Completado
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black tracking-tight text-foreground">
                  {Math.round(performanceMetrics.completionRate)}%
                </span>
                <Badge 
                  variant="outline"
                  className={cn(
                    "mb-1",
                    performanceMetrics.completionRate >= 80 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" 
                      : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                  )}
                >
                  {performanceMetrics.completionRate >= 80 ? 'Excelente' : 'Mejorable'}
                </Badge>
              </div>
              <div className="relative pt-2">
                <Progress 
                  value={performanceMetrics.completionRate} 
                  className="h-2 bg-rose-500/10"
                />
                <div 
                  className="absolute top-2 left-0 h-2 bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${performanceMetrics.completionRate}%` }}
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                <strong className="text-foreground">{performanceMetrics.current.completedRepairs}</strong> de {performanceMetrics.current.totalRepairs} reparaciones completadas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Entregas a Tiempo */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-emerald-400 to-teal-600 group-hover:opacity-10 transition-opacity duration-300" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
              <div className="p-2 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-xl">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              Entregas a Tiempo
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black tracking-tight text-foreground">
                  {Math.round(performanceMetrics.onTimeRate)}%
                </span>
                <Badge 
                  variant="outline"
                  className={cn(
                    "mb-1",
                    performanceMetrics.onTimeRate >= 70 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" 
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  )}
                >
                  {performanceMetrics.onTimeRate >= 70 ? 'Bueno' : 'Crítico'}
                </Badge>
              </div>
              <div className="relative pt-2">
                <Progress 
                  value={performanceMetrics.onTimeRate} 
                  className="h-2 bg-emerald-500/10"
                />
                <div 
                  className="absolute top-2 left-0 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${performanceMetrics.onTimeRate}%` }}
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Meta operativa: <strong className="text-foreground">≤7 días</strong> por reparación
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Reparaciones Urgentes */}
        <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-amber-400 to-orange-600 group-hover:opacity-10 transition-opacity duration-300" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
              <div className="p-2 bg-gradient-to-br from-amber-400/20 to-orange-600/20 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              Reparaciones Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black tracking-tight text-foreground">
                  {performanceMetrics.current.urgentRepairs}
                </span>
                <Badge 
                  variant="outline"
                  className={cn(
                    "mb-1",
                    performanceMetrics.current.urgentRepairs > 5 
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" 
                      : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                  )}
                >
                  {performanceMetrics.current.urgentRepairs > 5 ? 'Alto' : 'Normal'}
                </Badge>
              </div>
              
              <div className="pt-4 pb-1">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 shadow-sm">
                  <div className="relative flex h-3 w-3">
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      performanceMetrics.current.urgentRepairs > 5 ? "bg-red-400" : "bg-green-400"
                    )}></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-3 w-3",
                      performanceMetrics.current.urgentRepairs > 5 ? "bg-red-500" : "bg-green-500"
                    )}></span>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Requieren <strong className="text-foreground">atención inmediata</strong>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendencia */}
      <Card className="bg-background/50 backdrop-blur-xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
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
      <Card className="bg-background/50 backdrop-blur-xl border-border/50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-amber-400/5 to-orange-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-xl">
              <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            </div>
            Top Técnicos por Eficiencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performanceMetrics.topTechnicians.map((tech: any, index) => {
              const gradients = [
                'from-yellow-400 via-orange-500 to-red-500', // 1st place - gold
                'from-slate-300 via-slate-400 to-slate-500',   // 2nd place - silver
                'from-amber-600 via-yellow-700 to-orange-800', // 3rd place - bronze
                'from-blue-400 via-indigo-500 to-purple-600',  // 4th place
                'from-emerald-400 via-teal-500 to-cyan-600'      // 5th place
              ]
              
              return (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 bg-background/40 backdrop-blur-md rounded-xl border border-border/50 hover:bg-background/80 transition-all duration-300 hover:scale-[1.01] hover:shadow-md group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${gradients[index]} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm relative overflow-hidden group-hover:shadow-md transition-shadow`}>
                      <span className="relative z-10">{index + 1}</span>
                      {index === 0 && (
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/30 to-transparent animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{tech.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tech.completedRepairs} de {tech.totalRepairs} completadas
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${gradients[index]} rounded-full transition-all duration-500`}
                            style={{ width: `${tech.efficiency}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {Math.round(tech.efficiency)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-bold text-lg justify-end">
                      <span className={`${
                        index === 0 ? 'text-yellow-600 dark:text-yellow-500' :
                        index === 1 ? 'text-slate-600 dark:text-slate-400' :
                        index === 2 ? 'text-amber-700 dark:text-amber-600' :
                        'text-blue-600 dark:text-blue-400'
                      }`}>
                        {Math.round(tech.efficiency)}%
                      </span>
                      {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {Math.round(tech.avgTime)} días prom.
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
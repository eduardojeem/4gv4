'use client'

import { useMemo, useState, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AreaChart } from 'recharts/es6/chart/AreaChart'
import { Area } from 'recharts/es6/cartesian/Area'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Award,
  Activity,
  Coins,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { deliveredRepairRevenue, deliveryPromiseOutcome } from '@/lib/repairs/analytics-values'
import { useRepairs } from '@/contexts/RepairsContext'
import type { Repair } from '@/types/repairs'
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns'

interface TechnicianStats {
  name: string
  totalRepairs: number
  completedRepairs: number
  avgTime: number
  totalTime: number
  efficiency: number
}

interface RepairPerformanceMetricsProps {
  className?: string
}

interface MetricCardProps {
  title: string
  value: number | string
  change?: number
  icon: React.ElementType
  sub?: string
  accent: 'blue' | 'emerald' | 'amber' | 'indigo'
}

const ACCENT_STYLES = {
  blue: {
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'border-l-4 border-l-blue-500',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    border: 'border-l-4 border-l-emerald-500',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-l-4 border-l-amber-500',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    border: 'border-l-4 border-l-indigo-500',
  },
} as const

function PerfMetricCard({ title, value, change, icon: Icon, sub, accent }: MetricCardProps) {
  const style = ACCENT_STYLES[accent]

  return (
    <Card className={cn('overflow-hidden border-border/70 bg-card shadow-xs transition-all hover:shadow-md', style.border)}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shadow-2xs', style.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {change !== undefined ? (
          <div className="flex items-center gap-1.5 text-xs mt-1.5">
            <span
              className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums',
                change > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : change < 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {change > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {change > 0 ? '+' : ''}{change}%
            </span>
            <span className="text-muted-foreground text-[11px]">vs ciclo anterior</span>
          </div>
        ) : sub ? (
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface TooltipPayloadEntry {
  color?: string
  name: string
  value: number | string
  [key: string]: unknown
}

const ChartTooltip = memo(function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 p-3 text-xs shadow-xl backdrop-blur-md space-y-1.5">
      <div className="font-bold text-foreground border-b border-border/50 pb-1">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-3 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
          </div>
          <span className="font-bold text-foreground tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
})

export function RepairPerformanceMetrics({ className }: RepairPerformanceMetricsProps) {
  const { repairs, isLoading, error } = useRepairs()
  const [timeFrame, setTimeFrame] = useState('week')

  const performanceMetrics = useMemo(() => {
    const now = new Date()

    const ranges = {
      week: { start: subDays(now, 7), end: now },
      month: { start: subDays(now, 30), end: now },
      quarter: { start: subDays(now, 90), end: now },
    }

    const currentRange = ranges[timeFrame as keyof typeof ranges]

    const currentPeriodRepairs: Repair[] = []
    const previousPeriodRepairs: Repair[] = []

    const previousRange = {
      start: subDays(currentRange.start, differenceInDays(currentRange.end, currentRange.start)),
      end: currentRange.start,
    }

    repairs.forEach((repair) => {
      const repairDate = new Date(repair.createdAt)
      if (isWithinInterval(repairDate, currentRange)) {
        currentPeriodRepairs.push(repair)
      } else if (isWithinInterval(repairDate, previousRange)) {
        previousPeriodRepairs.push(repair)
      }
    })

    const currentMetrics = {
      totalRepairs: currentPeriodRepairs.length,
      completedRepairs: 0,
      inProgressRepairs: 0,
      urgentRepairs: 0,
      revenue: 0,
      avgRepairTime: 0,
      onTimeDeliveries: 0,
    }

    const previousMetrics = {
      totalRepairs: previousPeriodRepairs.length,
      completedRepairs: 0,
      revenue: 0,
    }

    currentPeriodRepairs.forEach((r) => {
      if (r.dbStatus === 'entregado') currentMetrics.completedRepairs++
      if (['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.dbStatus || '')) {
        currentMetrics.inProgressRepairs++
      }
      if (r.urgency === 'urgent') currentMetrics.urgentRepairs++
      currentMetrics.revenue += deliveredRepairRevenue(r)
    })

    previousPeriodRepairs.forEach((r) => {
      if (r.dbStatus === 'entregado') previousMetrics.completedRepairs++
      previousMetrics.revenue += deliveredRepairRevenue(r)
    })

    const completedWithTime: Repair[] = []
    let totalRepairTime = 0
    let completedWithPromise = 0

    currentPeriodRepairs.forEach((r) => {
      if (r.dbStatus === 'entregado' && r.completedAt && r.createdAt) {
        const repairTime = differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
        completedWithTime.push(r)
        totalRepairTime += repairTime

        const onTime = deliveryPromiseOutcome(r)
        if (onTime !== null) {
          completedWithPromise++
          if (onTime) currentMetrics.onTimeDeliveries++
        }
      }
    })

    if (completedWithTime.length > 0) {
      currentMetrics.avgRepairTime = totalRepairTime / completedWithTime.length
    }

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const changes = {
      totalRepairs: calculateChange(currentMetrics.totalRepairs, previousMetrics.totalRepairs),
      completedRepairs: calculateChange(currentMetrics.completedRepairs, previousMetrics.completedRepairs),
      revenue: calculateChange(currentMetrics.revenue, previousMetrics.revenue),
    }

    const dailyTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i)
      const dayRepairs = currentPeriodRepairs.filter((r) => {
        const repairDate = new Date(r.createdAt)
        return format(repairDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      })

      dailyTrend.push({
        date: format(date, 'dd/MM'),
        repairs: dayRepairs.length,
        completed: dayRepairs.filter((r) => r.dbStatus === 'entregado').length,
        revenue: dayRepairs.reduce((sum, r) => sum + (deliveredRepairRevenue(r)), 0),
      })
    }

    const technicianPerformance = currentPeriodRepairs.reduce((acc, repair) => {
      if (!repair.technician?.name) return acc

      const techName = repair.technician.name
      if (!acc[techName]) {
        acc[techName] = {
          name: techName,
          totalRepairs: 0,
          completedRepairs: 0,
          avgTime: 0,
          totalTime: 0,
          efficiency: 0,
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
    }, {} as Record<string, TechnicianStats>)

    Object.values(technicianPerformance).forEach((tech) => {
      tech.avgTime = tech.completedRepairs > 0 ? tech.totalTime / tech.completedRepairs : 0
      tech.efficiency = tech.totalRepairs > 0 ? (tech.completedRepairs / tech.totalRepairs) * 100 : 0
    })

    const topTechnicians = Object.values(technicianPerformance)
      .sort((a, b) => b.efficiency - a.efficiency)
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
      onTimeRate: completedWithPromise > 0
        ? (currentMetrics.onTimeDeliveries / completedWithPromise) * 100
        : null,
    }
  }, [repairs, timeFrame])

  if (error) return <p role="alert" className="p-6 text-destructive">No se pudo cargar el rendimiento del taller.</p>

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Cargando métricas de rendimiento…</div>
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Selector de Rango */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/60 p-3.5 rounded-2xl border border-border/70 shadow-2xs">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Ventana Temporal de Desempeño
          </h2>
          <p className="text-xs text-muted-foreground">
            Comparativa de eficiencia contra el ciclo anterior.
          </p>
        </div>

        <Tabs value={timeFrame} onValueChange={setTimeFrame}>
          <TabsList className="h-8 bg-card border border-border/70 rounded-xl p-0.5">
            <TabsTrigger value="week" className="text-xs h-7 px-3 rounded-lg font-semibold">Semana</TabsTrigger>
            <TabsTrigger value="month" className="text-xs h-7 px-3 rounded-lg font-semibold">Mes</TabsTrigger>
            <TabsTrigger value="quarter" className="text-xs h-7 px-3 rounded-lg font-semibold">Trimestre</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tarjetas Principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PerfMetricCard
          title="Órdenes del Ciclo"
          value={performanceMetrics.current.totalRepairs}
          change={performanceMetrics.changes.totalRepairs}
          icon={Activity}
          accent="blue"
        />

        <PerfMetricCard
          title="Completadas"
          value={performanceMetrics.current.completedRepairs}
          change={performanceMetrics.changes.completedRepairs}
          icon={CheckCircle2}
          accent="emerald"
        />

        <PerfMetricCard
          title="Tiempo Promedio"
          value={`${performanceMetrics.current.avgRepairTime.toFixed(1)} días`}
          sub="Por reparación completada"
          icon={Clock}
          accent="amber"
        />

        <PerfMetricCard
          title="Facturación del Ciclo"
          value={formatCurrency(performanceMetrics.current.revenue)}
          change={performanceMetrics.changes.revenue}
          icon={Coins}
          accent="indigo"
        />
      </div>

      {/* Bloque de Calidad y Cumplimiento Operativo */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tasa de Completado */}
        <Card className="border-border/70 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span>Tasa de Resolución</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-semibold',
                  performanceMetrics.completionRate >= 80
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                )}
              >
                {performanceMetrics.completionRate >= 80 ? 'Objetivo Cumplido' : 'Por Mejorar'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {Math.round(performanceMetrics.completionRate)}%
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {performanceMetrics.current.completedRepairs} de {performanceMetrics.current.totalRepairs} órdenes
              </span>
            </div>
            <Progress value={performanceMetrics.completionRate} className="h-2 bg-muted/60" />
            <p className="text-[11px] text-muted-foreground">
              Porcentaje de reparaciones finalizadas respecto al total recepcionado.
            </p>
          </CardContent>
        </Card>

        {/* Entregas a Tiempo */}
        <Card className="border-border/70 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                <span>Entregas a Tiempo</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-semibold',
                  (performanceMetrics.onTimeRate ?? 0) >= 70
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
                )}
              >
                {performanceMetrics.onTimeRate === null ? 'Sin fechas de compromiso' : performanceMetrics.onTimeRate >= 70 ? 'Plazo Saludable' : 'Alerta Demoras'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {performanceMetrics.onTimeRate === null ? 'No disponible' : `${Math.round(performanceMetrics.onTimeRate)}%`}
              </span>
              <span className="text-xs text-muted-foreground font-medium">Según fecha prometida</span>
            </div>
            <Progress value={performanceMetrics.onTimeRate ?? 0} className="h-2 bg-muted/60" />
            <p className="text-[11px] text-muted-foreground">
              Órdenes cerradas dentro de la ventana de compromiso al cliente.
            </p>
          </CardContent>
        </Card>

        {/* Reparaciones Urgentes */}
        <Card className="border-border/70 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Órdenes Urgentes</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-semibold',
                  performanceMetrics.current.urgentRepairs > 5
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
                )}
              >
                {performanceMetrics.current.urgentRepairs > 5 ? 'Prioridad Alta' : 'Controlado'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {performanceMetrics.current.urgentRepairs}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {performanceMetrics.current.inProgressRepairs} activas en taller
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full shrink-0', performanceMetrics.current.urgentRepairs > 5 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500')} />
              <span>
                {performanceMetrics.current.urgentRepairs > 0
                  ? 'Equipos que requieren atención prioritaria en mesa.'
                  : 'Sin órdenes catalogadas como urgentes en este ciclo.'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendencia Diaria */}
      <Card className="border-border/70 bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span>Flujo Diario de Reparaciones (Últimos 7 días)</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Ingresadas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Entregadas
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={performanceMetrics.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="repairsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#888888" />
              <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="repairs"
                stroke="#3b82f6"
                fill="url(#repairsGrad)"
                strokeWidth={2}
                name="Ingresadas"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#10b981"
                fill="url(#completedGrad)"
                strokeWidth={2}
                name="Entregadas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Técnicos por Eficiencia */}
      <Card className="border-border/70 bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Award className="h-4 w-4" />
            </div>
            <span>Top 5 Técnicos por Tasa de Eficiencia</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2.5">
            {performanceMetrics.topTechnicians.length > 0 ? (
              performanceMetrics.topTechnicians.map((tech, index) => {
                const medalColors = [
                  'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  'border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-400',
                  'border-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-500',
                ]
                const medalClass = medalColors[index] || 'border-border bg-muted/30 text-muted-foreground'

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/10 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs border shadow-2xs', medalClass)}>
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{tech.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tech.completedRepairs} de {tech.totalRepairs} reparaciones completadas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Resolución</span>
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          {Math.round(tech.efficiency)}%
                        </span>
                      </div>
                      <div className="text-right border-l border-border/60 pl-3">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Tiempo prom.</span>
                        <span className="text-sm font-bold text-muted-foreground tabular-nums">
                          {tech.avgTime > 0 ? `${tech.avgTime.toFixed(1)}d` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No hay técnicos con reparaciones registradas en este período.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
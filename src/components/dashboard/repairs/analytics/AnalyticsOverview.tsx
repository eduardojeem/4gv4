'use client'

import { useState, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import {
  TrendingUp,
  Wrench,
  Clock,
  Activity,
  CheckCircle2,
  Download,
  RefreshCw,
  Coins,
  Smartphone,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useRepairs } from '@/contexts/RepairsContext'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'

// Paleta armónica para estados de reparación
const STATUS_COLORS: Record<string, string> = {
  'Recibido': '#0284c7', // Sky
  'En Diagnóstico': '#f59e0b', // Amber
  'En Reparación': '#6366f1', // Indigo
  'Pausado': '#f97316', // Orange
  'Listo': '#10b981', // Emerald
  'Entregado': '#16a34a', // Green
  'Cancelado': '#64748b', // Slate
}

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

interface MetricCardProps {
  title: string
  value: number | string
  sub?: string
  icon: React.ElementType
  format?: 'number' | 'currency' | 'percentage' | 'days'
  accent: 'blue' | 'emerald' | 'amber' | 'indigo'
}

const ACCENT_MAP = {
  blue: {
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'border-l-4 border-l-blue-500',
    valueColor: 'text-foreground',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    border: 'border-l-4 border-l-emerald-500',
    valueColor: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-l-4 border-l-amber-500',
    valueColor: 'text-amber-600 dark:text-amber-400',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    border: 'border-l-4 border-l-indigo-500',
    valueColor: 'text-foreground',
  },
} as const

const MetricCard = memo(function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  format = 'number',
  accent,
}: MetricCardProps) {
  const style = ACCENT_MAP[accent]

  const formattedValue = () => {
    if (typeof value === 'string') return value
    const num = Number(value) || 0
    switch (format) {
      case 'currency':
        return formatCurrency(num)
      case 'percentage':
        return `${Math.round(num)}%`
      case 'days':
        return `${num.toFixed(1)} días`
      default:
        return num.toLocaleString()
    }
  }

  return (
    <Card className={cn('relative overflow-hidden border-border/70 bg-card shadow-xs transition-all hover:shadow-md', style.border)}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shadow-2xs', style.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className={cn('text-2xl font-bold tracking-tight tabular-nums', style.valueColor)}>
          {formattedValue()}
        </div>
        {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
})

interface TooltipPayloadEntry {
  color?: string
  name: string
  value: number | string
  [key: string]: unknown
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

const ChartTooltip = memo(function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 p-3 text-xs shadow-xl backdrop-blur-md space-y-1.5">
      <div className="font-bold text-foreground border-b border-border/50 pb-1">{label}</div>
      {payload.map((entry, index) => {
        const isRevenue =
          entry.name.toLowerCase().includes('ingreso') ||
          entry.name.toLowerCase().includes('revenue') ||
          entry.name.toLowerCase().includes('facturación')

        const val = typeof entry.value === 'number' && isRevenue
          ? formatCurrency(entry.value)
          : entry.value.toLocaleString()

        return (
          <div key={index} className="flex items-center justify-between gap-3 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">{val}</span>
          </div>
        )
      })}
    </div>
  )
})

export function AnalyticsOverview({ className, timeRange = '6months', onTimeRangeChange }: { className?: string; timeRange?: string; onTimeRangeChange?: (value: string) => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const analytics = useRepairAnalytics(timeRange)
  const { refreshRepairs } = useRepairs()

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshRepairs()
      toast.success('Analíticas actualizadas con éxito.')
    } catch {
      toast.error('No se pudieron actualizar los datos.')
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshRepairs])

  const exportData = useCallback(() => {
    const csvData = [
      ['Métrica', 'Valor'],
      ['Total Reparaciones', String(analytics.metrics?.totalRepairs || 0)],
      ['Completadas', String(analytics.metrics?.completedRepairs || 0)],
      ['Tasa de Resolución', `${Math.round(analytics.metrics?.completionRate || 0)}%`],
      ['Tiempo Promedio (días)', `${(analytics.metrics?.avgRepairTime || 0).toFixed(1)}`],
      ['Ingresos Totales', formatCurrency(analytics.metrics?.totalRevenue || 0)],
      ['Valor Promedio', formatCurrency(Math.round(analytics.metrics?.avgRepairValue || 0))],
    ]

    const csvContent = csvData.map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `analiticas_reparaciones_${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('Datos exportados en CSV con éxito.')
  }, [analytics])

  const metrics = analytics.metrics || {
    totalRepairs: 0,
    completedRepairs: 0,
    completionRate: 0,
    avgRepairTime: 0,
    totalRevenue: 0,
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controles de Período y Acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/60 p-3.5 rounded-2xl border border-border/70 shadow-2xs">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Período de Análisis
          </h2>
          <p className="text-xs text-muted-foreground">
            Reparaciones ingresadas en el período; ingresos por las entregadas de ese grupo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border/70 rounded-xl">
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
            className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-border/70"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin text-primary')} />
            <span>Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportData}
            className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-border/70"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Reparaciones"
          value={metrics.totalRepairs}
          sub={`${metrics.completedRepairs} terminadas`}
          icon={Wrench}
          accent="blue"
        />

        <MetricCard
          title="Tasa de Resolución"
          value={metrics.completionRate}
          format="percentage"
          sub="Efectividad de cierre"
          icon={CheckCircle2}
          accent="emerald"
        />

        <MetricCard
          title="Tiempo Promedio"
          value={metrics.avgRepairTime}
          format="days"
          sub="Para entrega final"
          icon={Clock}
          accent="amber"
        />

        <MetricCard
          title="Ingresos Totales"
          value={metrics.totalRevenue}
          format="currency"
          sub="Facturación en el período"
          icon={Coins}
          accent="indigo"
        />
      </div>

      {/* Gráficos Principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tendencias Temporales */}
        <Card className="border-border/70 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span>Evolución Mensual de Reparaciones</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Total
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completadas
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {analytics.monthlyData && analytics.monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalRepairs"
                    stroke="#3b82f6"
                    fill="url(#totalGrad)"
                    strokeWidth={2}
                    name="Total Reparaciones"
                  />
                  <Area
                    type="monotone"
                    dataKey="completedRepairs"
                    stroke="#10b981"
                    fill="url(#compGrad)"
                    strokeWidth={2}
                    name="Completadas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                Sin datos mensuales registrados.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución por Estado */}
        <Card className="border-border/70 bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                <Activity className="h-4 w-4" />
              </div>
              <span>Distribución Actual por Estado</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {analytics.statusAnalysis && analytics.statusAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.statusAnalysis}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.statusAnalysis.map((entry, index) => {
                      const color = STATUS_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                      return <Cell key={`cell-${index}`} fill={color} stroke="transparent" />
                    })}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                Sin estados registrados en el período.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispositivos Atendidos */}
      <Card className="border-border/70 bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-4 w-4" />
            </div>
            <span>Volumen por Categoría de Dispositivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {analytics.deviceTypeAnalysis && analytics.deviceTypeAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.deviceTypeAnalysis} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} name="Órdenes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
              Sin datos de dispositivos disponibles.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

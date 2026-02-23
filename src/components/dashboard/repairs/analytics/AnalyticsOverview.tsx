
'use client'

import { useState, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import {
  TrendingUp,
  TrendingDown,
  Wrench,
  DollarSign,
  Clock,
  Activity,
  CheckCircle2,
  Download,
  RefreshCw,
  BarChart3
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useRepairs } from '@/contexts/RepairsContext'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'

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

interface AnalyticsOverviewProps {
  className?: string
}

export function AnalyticsOverview({ className }: AnalyticsOverviewProps) {
  const [timeRange, setTimeRange] = useState('6months')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const analytics = useRepairAnalytics(timeRange)
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
          <div>
            <h2 className="text-xl font-bold tracking-tight">Vista General</h2>
            <p className="text-muted-foreground text-sm">
              Resumen de actividad y métricas clave
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
    </div>
  )
}

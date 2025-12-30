'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Target,
  Activity,
  BarChart3,
  Zap,
  Award
} from 'lucide-react'
import { TechnicianAnalytics } from '@/hooks/use-technician-analytics'
import { GSIcon } from '@/components/ui/standardized-components'

interface TechnicianMetricsTabProps {
  analytics: TechnicianAnalytics
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const statusLabels: Record<string, string> = {
  recibido: 'Recibido',
  diagnostico: 'Diagnóstico',
  reparacion: 'Reparación',
  pausado: 'Pausado',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
}

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta'
}

// Tooltip personalizado
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
            {entry.name.includes('Ingresos') ? (
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

export const TechnicianMetricsTab = memo(function TechnicianMetricsTab({
  analytics
}: TechnicianMetricsTabProps) {
  const { metrics, weeklyTrend, statusDistribution, priorityBreakdown } = analytics

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Eficiencia General
            </CardTitle>
            <div className="p-2 bg-blue-500 rounded-full">
              <Zap className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
              {Math.round(metrics.efficiency)}%
            </div>
            <Progress value={metrics.efficiency} className="h-2 mb-2" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Basado en completado y tiempo
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/50 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Tiempo Promedio
            </CardTitle>
            <div className="p-2 bg-green-500 rounded-full">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">
              {metrics.avgCompletionTime.toFixed(1)}d
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={metrics.avgCompletionTime <= 7 ? 'default' : 'destructive'} className="text-xs">
                {metrics.avgCompletionTime <= 7 ? 'Excelente' : 'Mejorable'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Ingresos Totales
            </CardTitle>
            <div className="p-2 bg-purple-500 rounded-full">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold text-purple-900 dark:text-purple-100 mb-2">
              <GSIcon className="h-6 w-6" />
              {metrics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Promedio por trabajo: {Math.round(metrics.avgJobValue).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/50 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Tasa de Completado
            </CardTitle>
            <div className="p-2 bg-orange-500 rounded-full">
              <Target className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mb-2">
              {Math.round(metrics.completionRate)}%
            </div>
            <Progress value={metrics.completionRate} className="h-2 mb-2" />
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {metrics.completedJobs} de {metrics.totalJobs} trabajos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tendencia Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Completados"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Ingresos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
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
                  data={statusDistribution.map(item => ({
                    ...item,
                    name: statusLabels[item.status] || item.status
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Análisis por Prioridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityBreakdown.map(item => ({
                ...item,
                name: priorityLabels[item.priority] || item.priority
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Cantidad" />
                <Bar dataKey="avgTime" fill="#10b981" radius={[4, 4, 0, 0]} name="Tiempo Promedio (días)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Resumen de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Entregas a Tiempo</span>
                <div className="flex items-center gap-2">
                  <Progress value={metrics.onTimeRate} className="w-20 h-2" />
                  <span className="font-bold">{Math.round(metrics.onTimeRate)}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Carga de Trabajo</span>
                <Badge variant={
                  metrics.workload === 'light' ? 'default' :
                  metrics.workload === 'normal' ? 'secondary' :
                  metrics.workload === 'heavy' ? 'destructive' : 'destructive'
                }>
                  {metrics.workload === 'light' ? 'Ligera' :
                   metrics.workload === 'normal' ? 'Normal' :
                   metrics.workload === 'heavy' ? 'Pesada' : 'Sobrecargado'}
                </Badge>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Estado Actual</span>
                <Badge variant={
                  metrics.status === 'available' ? 'default' :
                  metrics.status === 'busy' ? 'secondary' : 'destructive'
                }>
                  {metrics.status === 'available' ? 'Disponible' :
                   metrics.status === 'busy' ? 'Ocupado' :
                   metrics.status === 'offline' ? 'Desconectado' : 'No Disponible'}
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {Math.round(metrics.efficiency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Puntuación de Eficiencia
                  </div>
                  <Progress value={metrics.efficiency} className="mt-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})
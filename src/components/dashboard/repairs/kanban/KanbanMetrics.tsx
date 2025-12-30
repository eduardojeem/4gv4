'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Target,
  Zap,
  DollarSign,
  Activity,
  BarChart3
} from 'lucide-react'
import { KanbanMetrics as KanbanMetricsType } from '@/hooks/use-kanban-analytics'

interface KanbanMetricsProps {
  metrics: KanbanMetricsType
}

export const KanbanMetrics = memo(function KanbanMetrics({
  metrics
}: KanbanMetricsProps) {
  const { overallStats, trends } = metrics

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Items */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/70 border-blue-200 dark:border-blue-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Total de Elementos
          </CardTitle>
          <div className="p-2 bg-blue-500 dark:bg-blue-600 rounded-full">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
            {metrics.totalItems}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
              {overallStats.throughput} por día
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Completion Time */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/70 border-green-200 dark:border-green-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
            Tiempo Promedio
          </CardTitle>
          <div className="p-2 bg-green-500 dark:bg-green-600 rounded-full">
            <Clock className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">
            {overallStats.avgCompletionTime}h
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={overallStats.avgCompletionTime <= 48 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {overallStats.avgCompletionTime <= 48 ? 'Excelente' : 'Mejorable'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Urgent Items */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/70 border-orange-200 dark:border-orange-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
            Elementos Urgentes
          </CardTitle>
          <div className="p-2 bg-orange-500 dark:bg-orange-600 rounded-full">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mb-2">
            {overallStats.urgentPercentage}%
          </div>
          <Progress value={overallStats.urgentPercentage} className="h-2 mb-2" />
          <div className="flex items-center gap-2">
            <Badge 
              variant={overallStats.urgentPercentage <= 20 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {overallStats.urgentPercentage <= 20 ? 'Controlado' : 'Alto'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/70 border-purple-200 dark:border-purple-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Valor Total
          </CardTitle>
          <div className="p-2 bg-purple-500 dark:bg-purple-600 rounded-full">
            <DollarSign className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-2">
            ${overallStats.totalValue.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
              En proceso
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trends Analysis */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Análisis de Tendencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Bottleneck */}
            <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="font-medium text-red-700 dark:text-red-300">Cuello de Botella</span>
              </div>
              {trends.bottleneck ? (
                <div>
                  <div className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">
                    {trends.bottleneck.replace('_', ' ')}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {metrics.byStatus[trends.bottleneck].count} elementos acumulados
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-600 dark:text-red-400">
                  Sin cuellos de botella detectados
                </div>
              )}
            </div>

            {/* Fastest Column */}
            <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-700 dark:text-green-300">Más Rápida</span>
              </div>
              {trends.fastestColumn ? (
                <div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100 capitalize">
                    {trends.fastestColumn.replace('_', ' ')}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {metrics.byStatus[trends.fastestColumn].avgWaitTime}h promedio
                  </div>
                </div>
              ) : (
                <div className="text-sm text-green-600 dark:text-green-400">
                  Datos insuficientes
                </div>
              )}
            </div>

            {/* Overdue Analysis */}
            <div className="p-4 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="font-medium text-orange-700 dark:text-orange-300">Elementos Atrasados</span>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
                  {overallStats.overduePercentage}%
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Más de 7 días en proceso
                </div>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-muted dark:border-muted/50">
              <span className="font-medium">Throughput Diario</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{overallStats.throughput}</span>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">elementos/día</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-muted dark:border-muted/50">
              <span className="font-medium">Eficiencia General</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={Math.max(0, 100 - overallStats.overduePercentage)} 
                  className="w-20 h-2" 
                />
                <span className="font-bold">
                  {Math.max(0, 100 - overallStats.overduePercentage).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
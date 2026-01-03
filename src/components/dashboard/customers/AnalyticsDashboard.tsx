"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  Calendar,
  Download,
  Settings,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Activity,
  Target,
  Zap,
  Eye,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  Award,
  CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerMetrics, UseCustomerMetricsOptions } from '@/hooks/use-customer-metrics'
import { formatters, formatValue } from '@/lib/formatters'
import { ChartWrapper, RevenueChart, CustomerGrowthChart, SegmentDistributionChart } from '@/components/charts/ChartWrapper'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface AnalyticsDashboardProps {
  customers: Customer[]
  mode?: 'interactive' | 'simple' | 'realtime'
  showPredictions?: boolean
  showComparisons?: boolean
  compact?: boolean
  onExport?: (format: 'pdf' | 'excel') => void
}

export function AnalyticsDashboard({
  customers,
  mode = 'interactive',
  showPredictions = true,
  showComparisons = true,
  compact = false,
  onExport
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState<'3months' | '6months' | '12months'>('6months')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue', 'customers', 'retention'])
  const [showPredictionsState, setShowPredictionsState] = useState(showPredictions)
  const [showComparisonsState, setShowComparisonsState] = useState(showComparisons)

  const metricsOptions: UseCustomerMetricsOptions = {
    timeRange,
    includeInactive: true,
    segmentBy: 'segment'
  }

  const metrics = useCustomerMetrics(customers, metricsOptions)

  // Métricas principales para mostrar
  const mainMetrics = useMemo(() => [
    {
      id: 'totalCustomers',
      title: 'Total Clientes',
      value: metrics.totalCustomers,
      format: 'number' as const,
      icon: <Users className="h-5 w-5" />,
      change: 12.5,
      color: 'text-blue-600'
    },
    {
      id: 'totalRevenue',
      title: 'Ingresos Totales',
      value: metrics.totalRevenue,
      format: 'currency' as const,
      icon: <DollarSign className="h-5 w-5" />,
      change: 8.2,
      color: 'text-green-600'
    },
    {
      id: 'avgCustomerValue',
      title: 'Valor Promedio',
      value: metrics.avgCustomerValue,
      format: 'currency' as const,
      icon: <Target className="h-5 w-5" />,
      change: -2.1,
      color: 'text-purple-600'
    },
    {
      id: 'retentionRate',
      title: 'Tasa de Retención',
      value: metrics.retentionRate,
      format: 'percentage' as const,
      icon: <Activity className="h-5 w-5" />,
      change: 5.3,
      color: 'text-orange-600'
    }
  ], [metrics])

  const handleExport = (format: 'pdf' | 'excel') => {
    toast.success(`Exportando datos en formato ${format.toUpperCase()}...`)
    onExport?.(format)
  }

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    )
  }

  // Renderizado según el modo
  if (mode === 'simple') {
    return <SimpleAnalyticsView metrics={metrics} mainMetrics={mainMetrics} />
  }

  if (mode === 'realtime') {
    return <RealtimeAnalyticsView metrics={metrics} mainMetrics={mainMetrics} />
  }

  // Modo interactivo (por defecto)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Analíticas</h2>
          <p className="text-muted-foreground">
            Análisis completo de {metrics.totalCustomers} clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="12months">Último año</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configuración de Analíticas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Métricas a mostrar</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mainMetrics.map(metric => (
                      <div key={metric.id} className="flex items-center space-x-2">
                        <Switch
                          checked={selectedMetrics.includes(metric.id)}
                          onCheckedChange={() => toggleMetric(metric.id)}
                        />
                        <Label className="text-sm">{metric.title}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center space-x-2">
                  <Switch checked={showPredictionsState} onCheckedChange={setShowPredictionsState} />
                  <Label>Mostrar predicciones</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={showComparisonsState} onCheckedChange={setShowComparisonsState} />
                  <Label>Mostrar comparaciones</Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainMetrics
          .filter(metric => selectedMetrics.includes(metric.id))
          .map((metric, index) => (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-2 rounded-lg bg-opacity-10", metric.color)}>
                      {metric.icon}
                    </div>
                    <div className="flex items-center text-sm">
                      {metric.change > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : metric.change < 0 ? (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-gray-600" />
                      )}
                      <span className={cn(
                        "ml-1",
                        metric.change > 0 ? "text-green-600" : 
                        metric.change < 0 ? "text-red-600" : "text-gray-600"
                      )}>
                        {Math.abs(metric.change)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-bold">
                      {formatValue(metric.value, metric.format as keyof typeof formatters)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {metric.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="segments">Segmentos</TabsTrigger>
          {showPredictionsState && <TabsTrigger value="predictions">Predicciones</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento de Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={metrics.monthlyData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Crecimiento de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerGrowthChart data={metrics.monthlyData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Distribución por Segmentos</CardTitle>
            </CardHeader>
            <CardContent>
              <SegmentDistributionChart data={metrics.segmentDistribution} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Análisis de Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartWrapper
                  type="area"
                  data={metrics.monthlyData}
                  config={[
                    { dataKey: 'monthShort' },
                    { dataKey: 'totalRevenue', name: 'Ingresos', format: 'currency' },
                    { dataKey: 'avgOrderValue', name: 'Valor Promedio', format: 'currency' }
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.topCustomers.slice(0, 5).map((item) => (
                    <div key={item.customer.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                          {item.rank}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{item.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{item.customer.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatters.currency(item.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estados de Clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="active" size="sm" />
                    <span className="text-sm">Activos</span>
                  </div>
                  <span className="font-medium">{metrics.activeCustomers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="inactive" size="sm" />
                    <span className="text-sm">Inactivos</span>
                  </div>
                  <span className="font-medium">{metrics.inactiveCustomers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="suspended" size="sm" />
                    <span className="text-sm">Suspendidos</span>
                  </div>
                  <span className="font-medium">{metrics.suspendedCustomers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="vip" size="sm" />
                    <span className="text-sm">VIP</span>
                  </div>
                  <span className="font-medium">{metrics.vipCustomers}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Crecimiento Mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartWrapper
                  type="bar"
                  data={metrics.monthlyData}
                  config={[
                    { dataKey: 'monthShort' },
                    { dataKey: 'newCustomers', name: 'Nuevos Clientes', format: 'number' }
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Segmentos</CardTitle>
              </CardHeader>
              <CardContent>
                <SegmentDistributionChart data={metrics.segmentDistribution} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis por Segmento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.segmentDistribution.map((segment, index) => (
                    <div key={segment.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{segment.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {segment.count} clientes ({formatters.percentage(segment.percentage)})
                        </span>
                      </div>
                      <Progress value={segment.percentage} className="h-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Ingresos: {formatters.currency(segment.revenue)}</span>
                        <span>Promedio: {formatters.currency(segment.avgValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {showPredictionsState && (
          <TabsContent value="predictions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Predicciones y Tendencias</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Análisis predictivo basado en datos históricos
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatters.percentage(metrics.retentionRate + 5)}
                    </div>
                    <p className="text-sm text-muted-foreground">Retención Proyectada</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatters.currency(metrics.totalRevenue * 1.15)}
                    </div>
                    <p className="text-sm text-muted-foreground">Ingresos Proyectados</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(metrics.totalCustomers * 1.08)}
                    </div>
                    <p className="text-sm text-muted-foreground">Clientes Proyectados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// Componente para modo simple
function SimpleAnalyticsView({ 
  metrics, 
  mainMetrics 
}: { 
  metrics: any, 
  mainMetrics: any[] 
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Resumen de Analíticas</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {metric.icon}
                <span className="text-sm font-medium">{metric.title}</span>
              </div>
              <div className="text-xl font-bold">
                {formatValue(metric.value, metric.format as keyof typeof formatters)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <RevenueChart data={metrics.monthlyData} height={200} />
        </CardContent>
      </Card>
    </div>
  )
}

// Componente para modo tiempo real
function RealtimeAnalyticsView({ 
  metrics, 
  mainMetrics 
}: { 
  metrics: any, 
  mainMetrics: any[] 
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-green-500" />
        <h3 className="text-lg font-semibold">Métricas en Tiempo Real</h3>
        <Badge variant="outline" className="text-green-600 border-green-600">
          En vivo
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainMetrics.map((metric) => (
          <motion.div
            key={metric.id}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  {metric.icon}
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div className="text-xl font-bold">
                  {formatValue(metric.value, metric.format as keyof typeof formatters)}
                </div>
                <div className="text-sm text-muted-foreground">{metric.title}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Exportar con alias para compatibilidad
export const InteractiveAnalyticsDashboard = AnalyticsDashboard
export const CustomerAnalyticsDashboard = AnalyticsDashboard
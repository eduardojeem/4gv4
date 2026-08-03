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
import { ChartWrapper, RevenueChart, CustomerGrowthChart, SegmentDistributionChart, DebtDistributionChart } from '@/components/charts/ChartWrapper'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface AnalyticsDashboardProps {
  customers: Customer[]
  creditSummaries?: Record<string, any>
  mode?: 'interactive' | 'simple' | 'realtime'
  showPredictions?: boolean
  showComparisons?: boolean
  compact?: boolean
  onExport?: (format: 'pdf' | 'excel') => void
}

export function AnalyticsDashboard({
  customers,
  creditSummaries,
  mode = 'interactive',
  showPredictions = true,
  showComparisons = true,
  compact = false,
  onExport
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState<'3months' | '6months' | '12months'>('6months')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue', 'customers', 'retention', 'totalDebt'])
  const [showPredictionsState, setShowPredictionsState] = useState(showPredictions)
  const [showComparisonsState, setShowComparisonsState] = useState(showComparisons)

  const metricsOptions: UseCustomerMetricsOptions = {
    timeRange,
    includeInactive: true,
    segmentBy: 'segment',
    creditSummaries
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
      id: 'totalDebt',
      title: 'Deuda Total Clientes',
      value: metrics.totalDebt || 0,
      format: 'currency' as const,
      icon: <CreditCard className="h-5 w-5" />,
      change: -4.5,
      color: 'text-rose-600'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Dashboard de Analíticas de Clientes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Análisis consolidado y rendimiento para <span className="font-semibold text-slate-700 dark:text-slate-200">{metrics.totalCustomers} clientes</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-44 h-9 text-xs bg-white dark:bg-[#0d1117] border-slate-200 dark:border-white/10">
              <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#0d1117] border-slate-200 dark:border-white/10">
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="12months">Último año</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-white dark:bg-[#0d1117] border-slate-200 dark:border-white/10">
                <Settings className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-[#0d1117] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Configuración de Analíticas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Métricas a mostrar</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mainMetrics.map(metric => (
                      <div key={metric.id} className="flex items-center space-x-2">
                        <Switch
                          checked={selectedMetrics.includes(metric.id)}
                          onCheckedChange={() => toggleMetric(metric.id)}
                        />
                        <Label className="text-sm cursor-pointer">{metric.title}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator className="bg-slate-100 dark:bg-white/10" />
                <div className="flex items-center space-x-2">
                  <Switch checked={showPredictionsState} onCheckedChange={setShowPredictionsState} />
                  <Label className="text-sm cursor-pointer">Mostrar predicciones</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={showComparisonsState} onCheckedChange={setShowComparisonsState} />
                  <Label className="text-sm cursor-pointer">Mostrar comparaciones</Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => handleExport('excel')} className="h-9 text-xs bg-white dark:bg-[#0d1117] border-slate-200 dark:border-white/10">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {mainMetrics
          .filter(metric => selectedMetrics.includes(metric.id))
          .map((metric, index) => (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {metric.title}
                    </p>
                    <div className="flex items-center text-xs font-semibold">
                      {metric.change > 0 ? (
                        <span className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                          <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          {Math.abs(metric.change)}%
                        </span>
                      ) : metric.change < 0 ? (
                        <span className="flex items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                          <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          {Math.abs(metric.change)}%
                        </span>
                      ) : (
                        <span className="flex items-center text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          <Minus className="h-3 w-3 mr-0.5" />
                          0%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {formatValue(metric.value, metric.format as keyof typeof formatters)}
                    </h3>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
                      {metric.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 rounded-xl grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#0d1117] data-[state=active]:shadow-sm">Resumen</TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-lg text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#0d1117] data-[state=active]:shadow-sm">Ingresos</TabsTrigger>
          <TabsTrigger value="customers" className="rounded-lg text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#0d1117] data-[state=active]:shadow-sm">Clientes</TabsTrigger>
          <TabsTrigger value="segments" className="rounded-lg text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#0d1117] data-[state=active]:shadow-sm">Segmentos</TabsTrigger>
          {showPredictionsState && <TabsTrigger value="predictions" className="rounded-lg text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#0d1117] data-[state=active]:shadow-sm">Predicciones</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Crecimiento de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={Array.isArray(metrics.monthlyData) ? metrics.monthlyData : []} />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Crecimiento de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerGrowthChart data={Array.isArray(metrics.monthlyData) ? metrics.monthlyData : []} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-purple-500" />
                  Distribución por Segmentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SegmentDistributionChart data={Array.isArray(metrics.segmentDistribution) ? metrics.segmentDistribution : []} />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-rose-500" />
                  Distribución de Deuda por Clientes
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agrupa a los clientes según el monto total pendiente de pago ({metrics.customersWithDebt || 0} cliente{metrics.customersWithDebt !== 1 ? 's' : ''} con saldo activo).
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <DebtDistributionChart data={Array.isArray(metrics.debtDistribution) ? metrics.debtDistribution : []} />
                <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-3 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="font-semibold text-slate-900 dark:text-slate-200 mb-1">Categorías de saldo:</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>Al día:</strong> ₲ 0 pendiente</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span><strong>Baja:</strong> &lt; ₲ 500.000</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Media:</strong> ₲ 500k - ₲ 2M</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span><strong>Alta:</strong> &gt; ₲ 2.000.000</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                  data={Array.isArray(metrics.monthlyData) ? metrics.monthlyData : []}
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
                  {(Array.isArray(metrics.topCustomers) ? metrics.topCustomers : []).slice(0, 5).map((item) => (
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
                    <Badge variant="secondary" className="text-xs">VIP</Badge>
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
                  {metrics.segmentDistribution.map((segment, index) => {
                    const count = segment.value
                    const percentage = metrics.totalCustomers > 0 ? (count / metrics.totalCustomers) * 100 : 0
                    const revenue = metrics.totalRevenue * (percentage / 100)
                    const avgValue = count > 0 ? revenue / count : 0
                    return (
                    <div key={segment.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{segment.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {count} clientes ({formatters.percentage(percentage)})
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Ingresos: {formatters.currency(revenue)}</span>
                        <span>Promedio: {formatters.currency(avgValue)}</span>
                      </div>
                    </div>
                  )})}
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

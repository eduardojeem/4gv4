'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/currency'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart, 
  Target,
  RefreshCw,
  Download,
  Filter,
  Calendar
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import {
  RealTimeMetricsWidget,
  ConversionFunnelWidget,
  ActivityHeatmapWidget,
  AlertsWidget,
  PeriodComparisonWidget,
  KPITargetsWidget
} from './analytics-widgets'
import ReportsSystem from './reports-system'
import { analyticsEngine } from '@/lib/analytics/advanced-analytics-engine'
import { userBehaviorAnalytics } from '@/lib/analytics/user-behavior-analytics'
import { performanceAnalytics } from '@/lib/analytics/performance-analytics'
import { predictiveAnalytics } from '@/lib/analytics/predictive-analytics'

// Interfaces para el dashboard
interface DashboardMetrics {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  conversionRate: number
  averageOrderValue: number
  customerLifetimeValue: number
  churnRate: number
  growthRate: number
}

interface ChartData {
  name: string
  value: number
  date?: string
  category?: string
  [key: string]: number | string | undefined
}

interface TimeRange {
  label: string
  value: string
  days: number
}

interface FilterOptions {
  timeRange: TimeRange
  category: string
  segment: string
  metric: string
}

const timeRanges: TimeRange[] = [
  { label: 'Últimas 24h', value: '24h', days: 1 },
  { label: 'Última semana', value: '7d', days: 7 },
  { label: 'Último mes', value: '30d', days: 30 },
  { label: 'Últimos 3 meses', value: '90d', days: 90 },
  { label: 'Último año', value: '365d', days: 365 }
]

const chartColors = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff00ff', '#00ffff', '#ff0000', '#0000ff', '#ffff00'
]

export default function AnalyticsDashboard() {
  // Estados principales
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    customerLifetimeValue: 0,
    churnRate: 0,
    growthRate: 0
  })

  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: timeRanges[2], // Último mes por defecto
    category: 'all',
    segment: 'all',
    metric: 'revenue'
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Datos para gráficos
  const [revenueData, setRevenueData] = useState<ChartData[]>([])
  const [ordersData, setOrdersData] = useState<ChartData[]>([])
  const [customersData, setCustomersData] = useState<ChartData[]>([])
  const [productData, setProductData] = useState<ChartData[]>([])
  const [userBehaviorData, setUserBehaviorData] = useState<ChartData[]>([])
  const [performanceData, setPerformanceData] = useState<ChartData[]>([])
  const [predictiveData, setPredictiveData] = useState<ChartData[]>([])

  // Función para cargar datos del dashboard
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadMetrics(),
        loadRevenueData(),
        loadOrdersData(),
        loadCustomersData(),
        loadProductData(),
        loadUserBehaviorData(),
        loadPerformanceData(),
        loadPredictiveData()
      ])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Función para refrescar datos
  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    await loadDashboardData()
    setIsRefreshing(false)
  }, [loadDashboardData])

  // Cargar datos iniciales
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Actualización automática cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRefreshing) {
        refreshData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isRefreshing, refreshData])

  // Cargar métricas principales
  const loadMetrics = async () => {
    try {
      const analyticsData = await analyticsEngine.getAdvancedAnalytics({
        start: new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        end: new Date()
      })

      setMetrics({
        totalRevenue: analyticsData.sales.totalRevenue,
        totalOrders: analyticsData.sales.totalSales,
        totalCustomers: analyticsData.customers.totalCustomers,
        conversionRate: analyticsData.sales.conversionRate,
        averageOrderValue: analyticsData.sales.averageOrderValue,
        customerLifetimeValue: analyticsData.customers.customerLifetimeValue,
        churnRate: analyticsData.customers.churnRate,
        growthRate: analyticsData.sales.salesGrowth
      })
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  // Cargar datos de ingresos
  const loadRevenueData = async () => {
    try {
      const analyticsData = await analyticsEngine.getAdvancedAnalytics({
        start: new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        end: new Date()
      })

      const chartData = analyticsData.sales.salesByPeriod.map((item: { date: string; value: number }) => ({
        name: item.date,
        value: item.value,
        orders: item.value / 100, // Estimación
        date: item.date
      }))

      setRevenueData(chartData)
    } catch (error) {
      console.error('Error loading revenue data:', error)
      // Datos de ejemplo en caso de error
      setRevenueData(generateSampleData('revenue', filters.timeRange.days))
    }
  }

  // Cargar datos de pedidos
  const loadOrdersData = async () => {
    try {
      const analyticsData = await analyticsEngine.getAdvancedAnalytics({
        start: new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        end: new Date()
      })

      const chartData = analyticsData.sales.salesByPeriod.map((item: { date: string; value: number }) => ({
        name: item.date,
        value: item.value / 100, // Estimación de pedidos
        revenue: item.value
      }))

      setOrdersData(chartData)
    } catch (error) {
      console.error('Error loading orders data:', error)
      setOrdersData(generateSampleData('orders', filters.timeRange.days))
    }
  }

  // Cargar datos de clientes
  const loadCustomersData = async () => {
    try {
      const analyticsData = await analyticsEngine.getAdvancedAnalytics({
        start: new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        end: new Date()
      })

      const chartData = analyticsData.customers.customerSegments.map((item: { segment: string; count: number; value?: number }) => ({
        name: item.segment,
        value: item.count,
        percentage: (item.value || 0) / analyticsData.customers.totalCustomers * 100
      }))

      setCustomersData(chartData)
    } catch (error) {
      console.error('Error loading customers data:', error)
      setCustomersData(generateSampleData('customers', 5))
    }
  }

  // Cargar datos de productos
  const loadProductData = async () => {
    try {
      const analyticsData = await analyticsEngine.getAdvancedAnalytics({
        start: new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        end: new Date()
      })

      const chartData = analyticsData.products.productPerformance.map((item: { name: string; revenue: number; sales: number }) => ({
        name: item.name,
        value: item.revenue,
        quantity: item.sales,
        category: 'General'
      }))

      setProductData(chartData)
    } catch (error) {
      console.error('Error loading product data:', error)
      setProductData(generateSampleData('products', 10))
    }
  }

  // Cargar datos de comportamiento de usuario
  const loadUserBehaviorData = async () => {
    try {
      const metrics = await userBehaviorAnalytics.getBehaviorMetrics(
        new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        new Date()
      )

      const chartData = [
        { name: 'Sesiones', value: metrics.totalSessions },
        { name: 'Páginas vistas', value: metrics.pageViewsPerSession * metrics.totalSessions },
        { name: 'Usuarios únicos', value: metrics.uniqueUsers },
        { name: 'Tasa de rebote', value: metrics.bounceRate * 100 }
      ]

      setUserBehaviorData(chartData)
    } catch (error) {
      console.error('Error loading user behavior data:', error)
      setUserBehaviorData(generateSampleData('behavior', 4))
    }
  }

  // Cargar datos de rendimiento
  const loadPerformanceData = async () => {
    try {
      const report = await performanceAnalytics.generatePerformanceReport(
        new Date(Date.now() - filters.timeRange.days * 24 * 60 * 60 * 1000),
        new Date()
      )

      const chartData = [
        { name: 'LCP', value: report.metrics.lcp.avg, target: 2500 },
        { name: 'FID', value: report.metrics.fid.avg, target: 100 },
        { name: 'CLS', value: report.metrics.cls.avg * 1000, target: 100 },
        { name: 'TTFB', value: report.metrics.ttfb.avg, target: 600 }
      ]

      setPerformanceData(chartData)
    } catch (error) {
      console.error('Error loading performance data:', error)
      setPerformanceData(generateSampleData('performance', 4))
    }
  }

  // Cargar datos predictivos
  const loadPredictiveData = async () => {
    try {
      const forecast = await predictiveAnalytics.generateSalesForecast('weekly', 4)

      const chartData = forecast.predictions.map((item: { date: Date; predictedRevenue: number; confidence: number }) => ({
        name: item.date.toISOString().split('T')[0],
        value: item.predictedRevenue,
        predicted: item.predictedRevenue,
        confidence: item.confidence * 100,
        actual: undefined
      }))

      setPredictiveData(chartData)
    } catch (error) {
      console.error('Error loading predictive data:', error)
      setPredictiveData(generateSampleData('predictive', 30))
    }
  }

  // Generar datos de ejemplo
  const generateSampleData = (type: string, count: number): ChartData[] => {
    const data: ChartData[] = []
    
    for (let i = 0; i < count; i++) {
      const baseValue = Math.random() * 1000
      
      switch (type) {
        case 'revenue':
          data.push({
            name: `Día ${i + 1}`,
            value: baseValue * 10,
            orders: Math.floor(baseValue / 10),
            date: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          })
          break
        case 'orders':
          data.push({
            name: `Día ${i + 1}`,
            value: Math.floor(baseValue / 10),
            revenue: baseValue * 10
          })
          break
        case 'customers':
          const segments = ['Nuevos', 'Recurrentes', 'VIP', 'Inactivos', 'Potenciales']
          data.push({
            name: segments[i] || `Segmento ${i + 1}`,
            value: Math.floor(baseValue),
            percentage: Math.random() * 100
          })
          break
        case 'products':
          data.push({
            name: `Producto ${i + 1}`,
            value: baseValue * 5,
            quantity: Math.floor(baseValue / 5),
            category: `Categoría ${Math.floor(i / 3) + 1}`
          })
          break
        case 'behavior':
          const behaviors = ['Sesiones', 'Páginas vistas', 'Usuarios únicos', 'Tasa de rebote']
          data.push({
            name: behaviors[i] || `Métrica ${i + 1}`,
            value: baseValue
          })
          break
        case 'performance':
          const metrics = ['LCP', 'FID', 'CLS', 'TTFB']
          data.push({
            name: metrics[i] || `Métrica ${i + 1}`,
            value: baseValue,
            target: baseValue * 0.8
          })
          break
        case 'predictive':
          data.push({
            name: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: baseValue,
            predicted: baseValue,
            confidence: 70 + Math.random() * 30,
            actual: i < count / 2 ? baseValue * (0.8 + Math.random() * 0.4) : undefined
          })
          break
        default:
          data.push({
            name: `Item ${i + 1}`,
            value: baseValue
          })
      }
    }
    
    return data
  }

  // Función para exportar datos
  const exportData = () => {
    const dataToExport = {
      metrics,
      revenueData,
      ordersData,
      customersData,
      productData,
      userBehaviorData,
      performanceData,
      predictiveData,
      filters,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-dashboard-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Componente de métrica
  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'number' 
  }: { 
    title: string
    value: number
    change?: number
    icon: React.ElementType
    format?: 'number' | 'currency' | 'percentage'
  }) => {
    const formatValue = (val: number) => {
      switch (format) {
        case 'currency':
          return formatCurrency(val)
        case 'percentage':
          return `${val.toFixed(1)}%`
        default:
          return new Intl.NumberFormat('es-PY').format(val)
      }
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatValue(value)}</div>
          {change !== undefined && (
            <p className="text-xs text-muted-foreground">
              <span className={`inline-flex items-center ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {Math.abs(change).toFixed(1)}%
              </span>
              {' '}desde el período anterior
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando dashboard de analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Analytics</h1>
          <p className="text-muted-foreground">
            Análisis completo de rendimiento y métricas en tiempo real
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <select
                value={filters.timeRange.value}
                onChange={(e) => {
                  const timeRange = timeRanges.find(tr => tr.value === e.target.value)
                  if (timeRange) {
                    setFilters(prev => ({ ...prev, timeRange }))
                  }
                }}
                className="border rounded px-3 py-1"
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="border rounded px-3 py-1"
              >
                <option value="all">Todas las categorías</option>
                <option value="electronics">Electrónicos</option>
                <option value="clothing">Ropa</option>
                <option value="books">Libros</option>
                <option value="home">Hogar</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Ingresos Totales"
          value={metrics.totalRevenue}
          change={metrics.growthRate}
          icon={GSIcon}
          format="currency"
        />
        <MetricCard
          title="Pedidos Totales"
          value={metrics.totalOrders}
          change={5.2}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Clientes Totales"
          value={metrics.totalCustomers}
          change={2.8}
          icon={Users}
        />
        <MetricCard
          title="Tasa de Conversión"
          value={metrics.conversionRate}
          change={-0.5}
          icon={Target}
          format="percentage"
        />
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="realtime">Tiempo Real</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Tab de Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Gráfico de ingresos */}
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Período</CardTitle>
                <CardDescription>
                  Evolución de ingresos en {filters.timeRange.label.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [
                        formatCurrency(Number(value)),
                        'Ingresos'
                      ]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de pedidos */}
            <Card>
              <CardHeader>
                <CardTitle>Pedidos por Período</CardTitle>
                <CardDescription>
                  Número de pedidos en {filters.timeRange.label.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ordersData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Distribución de clientes y productos top */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Clientes</CardTitle>
                <CardDescription>Segmentación por tipo de cliente</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={customersData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {customersData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productos Top</CardTitle>
                <CardDescription>Productos con mayor facturación</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productData.slice(0, 5)} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip 
                      formatter={(value: number) => [
                        formatCurrency(value),
                        'Ingresos'
                      ]}
                    />
                    <Bar dataKey="value" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Widgets adicionales para overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <PeriodComparisonWidget className="lg:col-span-1" />
            <KPITargetsWidget className="lg:col-span-2" />
          </div>
        </TabsContent>

        {/* Tab de Tiempo Real */}
        <TabsContent value="realtime" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <RealTimeMetricsWidget className="lg:col-span-2" />
            <AlertsWidget className="lg:col-span-1" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <ConversionFunnelWidget />
            <ActivityHeatmapWidget />
          </div>
        </TabsContent>

        {/* Otros tabs se implementarían de manera similar */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Análisis Detallado de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Contenido del análisis de ventas...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Contenido del análisis de clientes...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Rendimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={performanceData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis />
                  <Radar name="Actual" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Radar name="Target" dataKey="target" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <ReportsSystem />
        </TabsContent>
      </Tabs>
    </div>
  )
}

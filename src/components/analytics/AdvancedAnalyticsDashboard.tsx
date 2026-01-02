'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { ComposedChart } from 'recharts';
import { Legend } from 'recharts/es6/component/Legend';
import { RadialBarChart } from 'recharts';
import { RadialBar } from 'recharts';
import { ScatterChart } from 'recharts';
import { Scatter } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  Package,
  AlertTriangle,
  Target,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  Eye,
  Settings,
  Zap,
  Brain,
  Shield,
  Clock,
  Gauge
} from 'lucide-react'
import { analyticsEngine, type AdvancedAnalyticsData } from '@/lib/analytics/advanced-analytics-engine'
import { formatCurrency } from '@/lib/currency'

interface AdvancedAnalyticsDashboardProps {
  className?: string
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
]

export default function AdvancedAnalyticsDashboard({ className }: AdvancedAnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('30d')
  const [refreshing, setRefreshing] = useState(false)

  // Cargar datos de analytics
  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const dateRange = getDateRange(timeRange)
      const data = await analyticsEngine.getAdvancedAnalytics(dateRange)
      setAnalyticsData(data)
    } catch (err) {
      setError('Error al cargar los datos de analytics')
      console.error('Analytics error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refrescar datos
  const refreshAnalytics = async () => {
    setRefreshing(true)
    analyticsEngine.clearCache()
    await loadAnalytics()
    setRefreshing(false)
  }

  // Cargar datos al montar el componente
  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  // Función para obtener rango de fechas
  const getDateRange = (range: string) => {
    const end = new Date()
    const start = new Date()
    
    switch (range) {
      case '7d':
        start.setDate(end.getDate() - 7)
        break
      case '30d':
        start.setDate(end.getDate() - 30)
        break
      case '90d':
        start.setDate(end.getDate() - 90)
        break
      case '1y':
        start.setFullYear(end.getFullYear() - 1)
        break
      default:
        start.setDate(end.getDate() - 30)
    }
    
    return { start, end }
  }

  // Componente de KPI Card
  const KPICard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    color = 'blue',
    format = 'number'
  }: {
    title: string
    value: number | string
    change?: number
    trend?: 'up' | 'down' | 'stable'
    icon: React.ElementType
    color?: string
    format?: 'number' | 'currency' | 'percentage'
  }) => {
    const formatValue = (val: number | string) => {
      if (typeof val === 'string') return val
      
      switch (format) {
        case 'currency':
          return formatCurrency(val)
        case 'percentage':
          return `${val.toFixed(1)}%`
        default:
          return val.toLocaleString()
      }
    }

    const getTrendColor = () => {
      switch (trend) {
        case 'up': return 'text-green-600'
        case 'down': return 'text-red-600'
        default: return 'text-gray-600'
      }
    }

    const getTrendIcon = () => {
      switch (trend) {
        case 'up': return <TrendingUp className="h-3 w-3" />
        case 'down': return <TrendingDown className="h-3 w-3" />
        default: return null
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{formatValue(value)}</p>
                {change !== undefined && (
                  <div className={`flex items-center space-x-1 text-sm ${getTrendColor()}`}>
                    {getTrendIcon()}
                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Componente de gráfico de área
  const AreaChartComponent = ({ data, title, dataKey, color = '#3b82f6' }: {
    data: any[]
    title: string
    dataKey: string
    color?: string
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), title]} />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fill={color} 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )

  // Componente de gráfico de barras
  const BarChartComponent = ({ data, title, dataKey, color = '#3b82f6' }: {
    data: any[]
    title: string
    dataKey: string
    color?: string
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey={dataKey} fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )

  // Componente de gráfico circular
  const PieChartComponent = ({ data, title }: {
    data: any[]
    title: string
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )

  // Componente de tabla de top productos
  const TopProductsTable = ({ products }: { products: any[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Top Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.slice(0, 5).map((product, index) => (
            <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium">{product.productName}</p>
                  <p className="text-sm text-gray-600">{product.quantity} unidades</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                <p className={`text-sm ${product.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.growth > 0 ? '+' : ''}{product.growth.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  // Componente de alertas
  const AlertsComponent = ({ alerts }: { alerts: any[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
          Alertas de Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  alert.severity === 'critical' ? 'bg-red-500' :
                  alert.severity === 'low' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                <div>
                  <p className="font-medium">{alert.productName}</p>
                  <p className="text-sm text-gray-600">Stock: {alert.currentStock}</p>
                </div>
              </div>
              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                {alert.severity === 'critical' ? 'Crítico' : 'Bajo'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !analyticsData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error || 'Error al cargar datos'}</p>
          <Button onClick={loadAnalytics} className="mt-4">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics Avanzado</h1>
          <p className="text-muted-foreground">Inteligencia de negocio en tiempo real</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshAnalytics}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center space-x-2">
            <GSIcon className="h-4 w-4" />
            <span>Ventas</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Productos</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Financiero</span>
          </TabsTrigger>
          <TabsTrigger value="operational" className="flex items-center space-x-2">
            <Gauge className="h-4 w-4" />
            <span>Operacional</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Ingresos Totales"
              value={analyticsData.sales.totalRevenue}
              change={analyticsData.sales.salesGrowth}
              trend="up"
              icon={GSIcon}
              color="green"
              format="currency"
            />
            <KPICard
              title="Ventas Totales"
              value={analyticsData.sales.totalSales}
              change={8.2}
              trend="up"
              icon={ShoppingBag}
              color="blue"
            />
            <KPICard
              title="Clientes Activos"
              value={analyticsData.customers.activeCustomers}
              change={5.1}
              trend="up"
              icon={Users}
              color="purple"
            />
            <KPICard
              title="Productos Activos"
              value={analyticsData.products.activeProducts}
              change={2.3}
              trend="up"
              icon={Package}
              color="orange"
            />
          </div>

          {/* Gráficos principales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaChartComponent
              data={analyticsData.sales.salesByPeriod}
              title="Tendencia de Ventas"
              dataKey="value"
              color="#10b981"
            />
            <PieChartComponent
              data={analyticsData.sales.salesByPaymentMethod.map(item => ({
                name: item.method,
                value: item.amount
              }))}
              title="Ventas por Método de Pago"
            />
          </div>

          {/* Tablas y alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopProductsTable products={analyticsData.sales.topSellingProducts} />
            <AlertsComponent alerts={analyticsData.products.stockAlerts} />
          </div>
        </TabsContent>

        {/* Tab: Ventas */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard
              title="Ingresos Totales"
              value={analyticsData.sales.totalRevenue}
              change={analyticsData.sales.salesGrowth}
              trend="up"
              icon={GSIcon}
              format="currency"
            />
            <KPICard
              title="Valor Promedio de Orden"
              value={analyticsData.sales.averageOrderValue}
              change={3.2}
              trend="up"
              icon={Target}
              format="currency"
            />
            <KPICard
              title="Tasa de Conversión"
              value={analyticsData.sales.conversionRate}
              change={0.8}
              trend="up"
              icon={TrendingUp}
              format="percentage"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaChartComponent
              data={analyticsData.sales.salesByPeriod}
              title="Ventas por Período"
              dataKey="value"
            />
            <BarChartComponent
              data={analyticsData.sales.salesByCategory}
              title="Ventas por Categoría"
              dataKey="revenue"
            />
          </div>

          <TopProductsTable products={analyticsData.sales.topSellingProducts} />
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              title="Total Clientes"
              value={analyticsData.customers.totalCustomers}
              change={5.2}
              trend="up"
              icon={Users}
            />
            <KPICard
              title="Nuevos Clientes"
              value={analyticsData.customers.newCustomers}
              change={12.1}
              trend="up"
              icon={TrendingUp}
            />
            <KPICard
              title="Retención"
              value={analyticsData.customers.customerRetentionRate}
              change={2.1}
              trend="up"
              icon={Target}
              format="percentage"
            />
            <KPICard
              title="Valor de Vida"
              value={analyticsData.customers.customerLifetimeValue}
              change={8.5}
              trend="up"
              icon={GSIcon}
              format="currency"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartComponent
              data={analyticsData.customers.customerSegments.map(segment => ({
                name: segment.segment,
                value: segment.count
              }))}
              title="Segmentación de Clientes"
            />
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Lealtad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Clientes Recurrentes</span>
                  <span className="font-semibold">{analyticsData.customers.loyaltyMetrics.repeatCustomers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Frecuencia Promedio</span>
                  <span className="font-semibold">{analyticsData.customers.loyaltyMetrics.averageOrderFrequency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Score de Lealtad</span>
                  <span className="font-semibold">{analyticsData.customers.loyaltyMetrics.loyaltyScore}/10</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Satisfacción</span>
                    <span>{analyticsData.customers.customerSatisfactionScore}/5</span>
                  </div>
                  <Progress value={analyticsData.customers.customerSatisfactionScore * 20} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              title="Total Productos"
              value={analyticsData.products.totalProducts}
              change={3.1}
              trend="up"
              icon={Package}
            />
            <KPICard
              title="Valor Inventario"
              value={analyticsData.products.inventoryValue}
              change={5.8}
              trend="up"
              icon={GSIcon}
              format="currency"
            />
            <KPICard
              title="Rotación Stock"
              value={analyticsData.products.stockTurnover}
              change={2.3}
              trend="up"
              icon={Activity}
            />
            <KPICard
              title="Margen Promedio"
              value={analyticsData.products.profitMargins.averageMargin}
              change={1.2}
              trend="up"
              icon={TrendingUp}
              format="percentage"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertsComponent alerts={analyticsData.products.stockAlerts} />
            <Card>
              <CardHeader>
                <CardTitle>Pronóstico de Demanda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.products.demandForecast.slice(0, 5).map((forecast, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{forecast.productName}</p>
                        <p className="text-sm text-gray-600">Confianza: {(forecast.confidence * 100).toFixed(0)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{forecast.predictedDemand} unidades</p>
                        <Progress value={forecast.confidence * 100} className="w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Financiero */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              title="Ingresos Brutos"
              value={analyticsData.financial.grossRevenue}
              change={8.5}
              trend="up"
              icon={GSIcon}
              format="currency"
            />
            <KPICard
              title="Ganancia Bruta"
              value={analyticsData.financial.grossProfit}
              change={12.3}
              trend="up"
              icon={TrendingUp}
              format="currency"
            />
            <KPICard
              title="Margen de Ganancia"
              value={analyticsData.financial.profitMargin}
              change={2.1}
              trend="up"
              icon={Target}
              format="percentage"
            />
            <KPICard
              title="ROE"
              value={analyticsData.financial.financialRatios.returnOnEquity}
              change={1.8}
              trend="up"
              icon={Activity}
              format="percentage"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaChartComponent
              data={analyticsData.financial.cashFlow}
              title="Flujo de Caja"
              dataKey="netFlow"
              color="#8b5cf6"
            />
            <PieChartComponent
              data={analyticsData.financial.expenseBreakdown.map(expense => ({
                name: expense.category,
                value: expense.amount
              }))}
              title="Desglose de Gastos"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ratios Financieros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Ratio Corriente</p>
                  <p className="text-2xl font-bold">{analyticsData.financial.financialRatios.currentRatio}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Ratio Rápido</p>
                  <p className="text-2xl font-bold">{analyticsData.financial.financialRatios.quickRatio}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">ROA</p>
                  <p className="text-2xl font-bold">{analyticsData.financial.financialRatios.returnOnAssets}%</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Deuda/Capital</p>
                  <p className="text-2xl font-bold">{analyticsData.financial.financialRatios.debtToEquity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Operacional */}
        <TabsContent value="operational" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              title="Tiempo de Respuesta"
              value={`${analyticsData.operational.systemPerformance.responseTime}ms`}
              change={-5.2}
              trend="up"
              icon={Clock}
            />
            <KPICard
              title="Disponibilidad"
              value={analyticsData.operational.uptime.availability}
              change={0.1}
              trend="up"
              icon={Shield}
              format="percentage"
            />
            <KPICard
              title="Usuarios Activos"
              value={analyticsData.operational.userActivity.activeUsers}
              change={8.3}
              trend="up"
              icon={Users}
            />
            <KPICard
              title="Tasa de Error"
              value={analyticsData.operational.errorRates.errorRate}
              change={-12.5}
              trend="up"
              icon={AlertTriangle}
              format="percentage"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Utilización de Recursos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>CPU</span>
                    <span>{analyticsData.operational.resourceUtilization.cpuUsage}%</span>
                  </div>
                  <Progress value={analyticsData.operational.resourceUtilization.cpuUsage} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Memoria</span>
                    <span>{analyticsData.operational.resourceUtilization.memoryUsage}%</span>
                  </div>
                  <Progress value={analyticsData.operational.resourceUtilization.memoryUsage} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Disco</span>
                    <span>{analyticsData.operational.resourceUtilization.diskUsage}%</span>
                  </div>
                  <Progress value={analyticsData.operational.resourceUtilization.diskUsage} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Red</span>
                    <span>{analyticsData.operational.resourceUtilization.networkUsage}%</span>
                  </div>
                  <Progress value={analyticsData.operational.resourceUtilization.networkUsage} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Proceso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Tiempo Proc. Orden</span>
                  <span className="font-semibold">{analyticsData.operational.processEfficiency.orderProcessingTime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Rotación Inventario</span>
                  <span className="font-semibold">{analyticsData.operational.processEfficiency.inventoryTurnover}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tiempo Servicio Cliente</span>
                  <span className="font-semibold">{analyticsData.operational.processEfficiency.customerServiceTime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tasa de Cumplimiento</span>
                  <span className="font-semibold">{analyticsData.operational.processEfficiency.fulfillmentRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
import { GSIcon } from '@/components/ui/standardized-components'

"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
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
import { Legend } from 'recharts/es6/component/Legend';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { 
  TrendingUp, TrendingDown, Users, ShoppingCart, 
  Download, BarChart3, PieChart as PieChartIcon,
  Activity, Target, RefreshCw
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'
import { useAnalytics } from '@/hooks/use-analytics'

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [activeTab, setActiveTab] = useState('overview')
  
  const { 
    loading, 
    salesData, 
    categoryData, 
    topProducts, 
    metrics,
    refreshAnalytics 
  } = useAnalytics(timeRange)

  const kpiCards = [
    {
      title: "Ingresos Totales",
      value: formatCurrency(metrics.totalRevenue),
      change: "+0.0%", // Todo: Calculate real change
      trend: "up",
      icon: GSIcon,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800"
    },
    {
      title: "Ventas Totales",
      value: metrics.totalSales.toString(),
      change: "+0.0%", // Todo: Calculate real change
      trend: "up",
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800"
    },
    {
      title: "Ticket Promedio",
      value: formatCurrency(metrics.averageTicket),
      change: "+0.0%",
      trend: "up",
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      borderColor: "border-orange-200 dark:border-orange-800"
    },
    {
      title: "Productos Vendidos", // Replaced Conversion Rate
      value: topProducts.reduce((acc, curr) => acc + curr.sales, 0).toString(),
      change: "+0.0%",
      trend: "up",
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      borderColor: "border-purple-200 dark:border-purple-800"
    }
  ]

  if (loading && salesData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando datos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-blue-700 dark:text-blue-400">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-700 dark:text-blue-400" />
              Analytics y Reportes
            </h2>
            <p className="text-blue-600 dark:text-blue-300 mt-1">Análisis detallado del rendimiento del negocio</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-32 border-blue-300 dark:border-blue-700 dark:bg-gray-900">
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
              className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
              onClick={() => refreshAnalytics()}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown
          
          return (
            <Card key={index} className={`${kpi.borderColor} dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                    <Icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                  {/* <div className={`flex items-center text-sm ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendIcon className="h-4 w-4 mr-1" />
                    {kpi.change}
                  </div> */}
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{kpi.title}</h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs de Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Activity className="h-4 w-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger 
            value="sales" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white"
          >
            <GSIcon className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
          <TabsTrigger 
            value="products" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
          >
            <PieChartIcon className="h-4 w-4 mr-2" />
            Productos
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Ventas Mensuales */}
            <Card className="border-blue-200 dark:border-blue-800 dark:bg-gray-800 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-b border-blue-200 dark:border-blue-800">
                <CardTitle className="text-blue-800 dark:text-blue-300">Tendencia de Ingresos</CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">Ingresos en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area 
                      type="monotone" 
                      dataKey="ingresos" 
                      stroke="#3b82f6" 
                      fill="url(#colorIngresos)" 
                      name="Ingresos"
                    />
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Categorías */}
            <Card className="border-green-200 dark:border-green-800 dark:bg-gray-800 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-b border-green-200 dark:border-green-800">
                <CardTitle className="text-green-800 dark:text-green-300">Ventas por Categoría</CardTitle>
                <CardDescription className="text-green-600 dark:text-green-400">Distribución de ingresos por categoría</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No hay datos suficientes para mostrar
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Ventas */}
        <TabsContent value="sales" className="space-y-6">
          <Card className="border-green-200 dark:border-green-800 dark:bg-gray-800 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-b border-green-200 dark:border-green-800">
              <CardTitle className="text-green-800 dark:text-green-300">Volumen de Ventas</CardTitle>
              <CardDescription className="text-green-600 dark:text-green-400">Número de transacciones por período</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ventas" fill="#10b981" name="Transacciones" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <Card className="border-orange-200 dark:border-orange-800 dark:bg-gray-800 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-b border-orange-200 dark:border-orange-800">
              <CardTitle className="text-orange-800 dark:text-orange-300">Top Productos</CardTitle>
              <CardDescription className="text-orange-600 dark:text-orange-400">Productos con mayores ingresos</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-900 dark:text-orange-300">{product.name}</p>
                        <p className="text-sm text-orange-600 dark:text-orange-400">{product.sales} unidades vendidas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-800 dark:text-orange-300">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de productos disponibles
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

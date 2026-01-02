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
  Calendar, Download, Filter, BarChart3, PieChart as PieChartIcon,
  Activity, Target, Eye, Clock
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

// Datos mock para los gráficos
const salesData = [
  { name: 'Ene', ventas: 4000, usuarios: 240, productos: 24 },
  { name: 'Feb', ventas: 3000, usuarios: 139, productos: 22 },
  { name: 'Mar', ventas: 2000, usuarios: 980, productos: 29 },
  { name: 'Abr', ventas: 2780, usuarios: 390, productos: 20 },
  { name: 'May', ventas: 1890, usuarios: 480, productos: 21 },
  { name: 'Jun', ventas: 2390, usuarios: 380, productos: 25 },
  { name: 'Jul', ventas: 3490, usuarios: 430, productos: 30 },
]

const dailySalesData = [
  { day: 'Lun', ventas: 120, visitas: 340 },
  { day: 'Mar', ventas: 98, visitas: 280 },
  { day: 'Mié', ventas: 86, visitas: 290 },
  { day: 'Jue', ventas: 99, visitas: 320 },
  { day: 'Vie', ventas: 85, visitas: 250 },
  { day: 'Sáb', ventas: 65, visitas: 180 },
  { day: 'Dom', ventas: 55, visitas: 160 },
]

const categoryData = [
  { name: 'Electrónicos', value: 400, color: '#8884d8' },
  { name: 'Ropa', value: 300, color: '#82ca9d' },
  { name: 'Hogar', value: 200, color: '#ffc658' },
  { name: 'Deportes', value: 150, color: '#ff7300' },
  { name: 'Libros', value: 100, color: '#00ff88' },
]

const userActivityData = [
  { hour: '00:00', activos: 12 },
  { hour: '04:00', activos: 8 },
  { hour: '08:00', activos: 45 },
  { hour: '12:00', activos: 78 },
  { hour: '16:00', activos: 65 },
  { hour: '20:00', activos: 34 },
]

const topProductsData = [
  { producto: 'iPhone 15', ventas: 145, ingresos: 145000 },
  { producto: 'Samsung Galaxy', ventas: 132, ingresos: 118800 },
  { producto: 'MacBook Pro', ventas: 98, ingresos: 245000 },
  { producto: 'iPad Air', ventas: 87, ingresos: 52200 },
  { producto: 'AirPods Pro', ventas: 76, ingresos: 19000 },
]

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('7d')
  const [activeTab, setActiveTab] = useState('overview')

  const kpiCards = [
    {
      title: "Ingresos Totales",
      value: "$124,563",
      change: "+12.5%",
      trend: "up",
      icon: GSIcon,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    {
      title: "Usuarios Activos",
      value: "2,847",
      change: "+8.2%",
      trend: "up",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      title: "Ventas Totales",
      value: "1,234",
      change: "-2.1%",
      trend: "down",
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    },
    {
      title: "Tasa Conversión",
      value: "3.24%",
      change: "+0.8%",
      trend: "up",
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header simplificado */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-blue-700">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-700" />
              Analytics y Reportes
            </h2>
            <p className="text-blue-600 mt-1">Análisis detallado del rendimiento del negocio</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 border-blue-300">
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
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
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
            <Card key={index} className={`${kpi.borderColor} shadow-lg hover:shadow-xl transition-all duration-300`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                    <Icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                  <div className={`flex items-center text-sm ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendIcon className="h-4 w-4 mr-1" />
                    {kpi.change}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-600">{kpi.title}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs de Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-blue-100 to-indigo-100 p-1">
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
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Usuarios
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
            <Card className="border-blue-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                <CardTitle className="text-blue-800">Tendencia de Ventas</CardTitle>
                <CardDescription className="text-blue-600">Ventas de los últimos 7 meses</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="ventas" 
                      stroke="#3b82f6" 
                      fill="url(#colorVentas)" 
                    />
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Categorías */}
            <Card className="border-green-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
                <CardTitle className="text-green-800">Ventas por Categoría</CardTitle>
                <CardDescription className="text-green-600">Distribución de productos vendidos</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Ventas */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ventas Diarias */}
            <Card className="lg:col-span-2 border-green-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
                <CardTitle className="text-green-800">Ventas Diarias</CardTitle>
                <CardDescription className="text-green-600">Comparativa de ventas y visitas</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySalesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ventas" fill="#10b981" name="Ventas" />
                    <Bar dataKey="visitas" fill="#6366f1" name="Visitas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Productos */}
            <Card className="border-orange-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200">
                <CardTitle className="text-orange-800">Top Productos</CardTitle>
                <CardDescription className="text-orange-600">Más vendidos</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {topProductsData.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-900">{product.producto}</p>
                        <p className="text-sm text-orange-600">{product.ventas} ventas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-800">{formatCurrency(product.ingresos)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Usuarios */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actividad de Usuarios */}
            <Card className="border-purple-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                <CardTitle className="text-purple-800">Actividad por Hora</CardTitle>
                <CardDescription className="text-purple-600">Usuarios activos durante el día</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={userActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="activos" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Crecimiento de Usuarios */}
            <Card className="border-indigo-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-b border-indigo-200">
                <CardTitle className="text-indigo-800">Crecimiento de Usuarios</CardTitle>
                <CardDescription className="text-indigo-600">Nuevos registros mensuales</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="usuarios" 
                      stroke="#6366f1" 
                      fill="url(#colorUsuarios)" 
                    />
                    <defs>
                      <linearGradient id="colorUsuarios" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <Card className="border-orange-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200">
              <CardTitle className="text-orange-800">Rendimiento de Productos</CardTitle>
              <CardDescription className="text-orange-600">Análisis de productos por mes</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="productos" fill="#f97316" name="Productos Vendidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

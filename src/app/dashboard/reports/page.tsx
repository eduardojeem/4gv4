'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  Calendar as CalendarIcon,
  Download,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SalesData {
  date: string
  sales: number
  orders: number
  customers: number
}

interface ProductData {
  name: string
  sales: number
  quantity: number
}

interface CategoryData {
  name: string
  value: number
  color: string
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [productData, setProductData] = useState<ProductData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])

  // Estado de carga
  const [loading, setLoading] = useState(true)

  // Cargar datos reales de Supabase
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setLoading(true)
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        
        // Obtener ventas de los últimos 30 días (o rango seleccionado)
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('id, created_at, total_amount, status')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true })

        if (salesError) throw salesError

        // Obtener items de venta para análisis de productos y categorías
        const { data: saleItems, error: itemsError } = await supabase
          .from('sale_items')
          .select(`
            quantity,
            total_price,
            product:products (
              name,
              category:categories (
                name
              )
            ),
            sale:sales!inner (
              created_at,
              status
            )
          `)
          .gte('sale.created_at', dateRange.from.toISOString())
          .lte('sale.created_at', dateRange.to.toISOString())
          .eq('sale.status', 'completada')

        if (itemsError) throw itemsError

        // Obtener nuevos clientes en el periodo
        const { data: newCustomers, error: customersError } = await supabase
          .from('customers')
          .select('created_at')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
        
        if (customersError) throw customersError

        // Procesar datos para el gráfico de ventas
        const salesByDate: Record<string, { sales: number; orders: number; customers: number }> = {}
        
        // Inicializar con ventas
        sales?.forEach(sale => {
          if (sale.status !== 'completada') return
          
          const date = new Date(sale.created_at).toISOString().split('T')[0]
          if (!salesByDate[date]) {
            salesByDate[date] = { sales: 0, orders: 0, customers: 0 }
          }
          salesByDate[date].sales += Number(sale.total_amount) || 0
          salesByDate[date].orders += 1
        })

        // Agregar datos de clientes
        newCustomers?.forEach(customer => {
          const date = new Date(customer.created_at).toISOString().split('T')[0]
          if (!salesByDate[date]) {
            salesByDate[date] = { sales: 0, orders: 0, customers: 0 }
          }
          salesByDate[date].customers += 1
        })

        const processedSalesData: SalesData[] = Object.entries(salesByDate).map(([date, data]) => ({
          date,
          sales: data.sales,
          orders: data.orders,
          customers: data.customers
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        setSalesData(processedSalesData)

        // Procesar datos de productos
        const productStats: Record<string, { sales: number; quantity: number }> = {}
        const categoryStats: Record<string, number> = {}

        saleItems?.forEach((item: any) => {
          const productName = item.product?.name || 'Desconocido'
          const categoryName = item.product?.category?.name || 'Sin categoría'
          const total = Number(item.total_price) || 0
          const quantity = item.quantity || 0

          // Productos
          if (!productStats[productName]) {
            productStats[productName] = { sales: 0, quantity: 0 }
          }
          productStats[productName].sales += total
          productStats[productName].quantity += quantity

          // Categorías
          categoryStats[categoryName] = (categoryStats[categoryName] || 0) + total
        })

        // Top 5 Productos
        const processedProductData: ProductData[] = Object.entries(productStats)
          .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            quantity: stats.quantity
          }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5)

        setProductData(processedProductData)

        // Categorías
        const processedCategoryData: CategoryData[] = Object.entries(categoryStats)
          .map(([name, value], index) => ({
            name,
            value,
            color: `hsl(${index * 45}, 70%, 50%)`
          }))
          .sort((a, b) => b.value - a.value)

        setCategoryData(processedCategoryData)
        
      } catch (error) {
        console.error('Error fetching reports data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReportsData()
  }, [dateRange])

  const formatPrice = (price: number) => {
    return `₱${(price / 1000000).toFixed(1)}M`
  }

  const formatFullPrice = (price: number) => {
    return `₱${price.toLocaleString()}`
  }

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0)
  const totalOrders = salesData.reduce((sum, item) => sum + item.orders, 0)
  const totalCustomers = salesData.reduce((sum, item) => sum + item.customers, 0)
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

  const exportReport = (type: string) => {
    // Aquí iría la lógica de exportación
    alert(`Exportando reporte de ${type}...`)
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reportes y Analytics</h1>
          <p className="text-muted-foreground">
            Análisis detallado de ventas y rendimiento
          </p>
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
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
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ventas Totales</p>
                <p className="text-2xl font-bold">{formatFullPrice(totalSales)}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">+12.5%</span>
              <span className="text-sm text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Órdenes</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">+8.2%</span>
              <span className="text-sm text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">{totalCustomers}</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-sm text-red-500">-2.1%</span>
              <span className="text-sm text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Promedio</p>
                <p className="text-2xl font-bold">{formatFullPrice(avgOrderValue)}</p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Package className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-500">+5.7%</span>
              <span className="text-sm text-muted-foreground ml-1">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos y análisis */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })}
                  />
                  <YAxis tickFormatter={formatPrice} />
                  <Tooltip 
                    formatter={(value: number) => [formatFullPrice(value), 'Ventas']}
                    labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatPrice} />
                  <Tooltip formatter={(value: number) => [formatFullPrice(value), 'Ventas']} />
                  <Bar dataKey="sales" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranking de Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productData.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatFullPrice(product.sales)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
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
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold text-blue-600">156</p>
                  <p className="text-sm text-muted-foreground">Clientes Nuevos</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold text-green-600">89%</p>
                  <p className="text-sm text-muted-foreground">Tasa de Retención</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold text-purple-600">4.2</p>
                  <p className="text-sm text-muted-foreground">Compras Promedio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  FileText, 
  Calendar as CalendarIcon,
  Package,
  AlertTriangle,
  Users,
  Target,
  PieChart,
  LineChart,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  Loader2
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useSales } from '@/hooks/useSales'

// Interfaces
interface ReportData {
  totalProducts: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
  totalSuppliers: number
  totalCategories: number
  averageMargin: number
  totalRevenue: number
  topSellingProducts: ProductSales[]
  categoryDistribution: CategoryData[]
  supplierPerformance: SupplierData[]
  stockMovements: StockMovement[]
  salesTrends: SalesTrend[]
  profitabilityAnalysis: ProfitData[]
}

interface ProductSales {
  id: string
  name: string
  category: string
  unitsSold: number
  revenue: number
  profit: number
  margin: number
  trend: 'up' | 'down' | 'stable'
}

interface CategoryData {
  name: string
  productCount: number
  totalValue: number
  percentage: number
  averageMargin: number
  color: string
}

interface SupplierData {
  id: string
  name: string
  totalOrders: number
  totalValue: number
  averageDeliveryTime: number
  qualityRating: number
  onTimeDelivery: number
  status: 'excellent' | 'good' | 'average' | 'poor'
}

interface StockMovement {
  id: string
  date: Date
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia'
  product: string
  quantity: number
  value: number
  reason: string
  user: string
}

interface SalesTrend {
  period: string
  sales: number
  revenue: number
  profit: number
  units: number
}

interface ProfitData {
  product: string
  category: string
  cost: number
  price: number
  margin: number
  profit: number
  volume: number
  totalProfit: number
}

const InventoryReports: React.FC = () => {
  const supabase = createClient()
  const { sales, fetchSales, loading: salesLoading } = useSales()

  // Estados
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<{from: Date, to: Date}>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [reportType, setReportType] = useState<string>('general')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Colores para gráficas
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16']

  const generateReport = useCallback(async () => {
    setIsGenerating(true)
    try {
      // 1. Fetch Products (All) for Aggregation
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name)
        `)
      
      if (productsError) throw productsError

      // 2. Fetch Suppliers
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
      
      if (suppliersError) throw suppliersError

      // 3. Fetch Stock Movements
      const { data: movements, error: movementsError } = await supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sale_price, purchase_price)
        `)
        .gte('created_at', selectedDateRange.from.toISOString())
        .lte('created_at', selectedDateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .limit(100) // Limit for UI table

      if (movementsError) throw movementsError

      // 4. Fetch Sales (Using hook or direct query if hook doesn't support custom range efficiently for reports)
      // Since useSales is hook based, we can try to use it or just query directly for reports to avoid state conflicts
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            products (name, category:categories(name), purchase_price)
          )
        `)
        .gte('created_at', selectedDateRange.from.toISOString())
        .lte('created_at', selectedDateRange.to.toISOString())

      if (salesError) throw salesError

      // --- CALCULATIONS ---

      // Inventory Stats
      const totalProducts = products?.length || 0
      const totalValue = products?.reduce((sum, p) => sum + (p.stock_quantity * p.purchase_price), 0) || 0
      const lowStockItems = products?.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length || 0
      const outOfStockItems = products?.filter(p => p.stock_quantity === 0).length || 0
      const totalSuppliers = suppliers?.length || 0
      
      // Category Distribution
      const categoryMap = new Map<string, { count: number; value: number; marginSum: number }>()
      products?.forEach(p => {
        const catName = p.category?.name || 'Sin Categoría'
        const current = categoryMap.get(catName) || { count: 0, value: 0, marginSum: 0 }
        
        const margin = p.sale_price > 0 ? ((p.sale_price - p.purchase_price) / p.sale_price) * 100 : 0
        
        categoryMap.set(catName, {
          count: current.count + 1,
          value: current.value + (p.stock_quantity * p.purchase_price),
          marginSum: current.marginSum + margin
        })
      })

      const categoryDistribution: CategoryData[] = Array.from(categoryMap.entries()).map(([name, data], index) => ({
        name,
        productCount: data.count,
        totalValue: data.value,
        percentage: totalValue > 0 ? Number(((data.value / totalValue) * 100).toFixed(1)) : 0,
        averageMargin: data.count > 0 ? Number((data.marginSum / data.count).toFixed(1)) : 0,
        color: COLORS[index % COLORS.length]
      })).sort((a, b) => b.totalValue - a.totalValue)

      const totalCategories = categoryDistribution.length
      const averageMargin = products && products.length > 0 
        ? products.reduce((sum, p) => {
            const m = p.sale_price > 0 ? ((p.sale_price - p.purchase_price) / p.sale_price) * 100 : 0
            return sum + m
          }, 0) / products.length
        : 0

      // Sales Analysis
      let totalRevenue = 0
      const productSalesMap = new Map<string, { 
        name: string; 
        category: string; 
        units: number; 
        revenue: number; 
        cost: number 
      }>()

      salesData?.forEach(sale => {
        totalRevenue += sale.total_amount
        sale.sale_items.forEach((item: any) => {
          const pid = item.product_id
          const current = productSalesMap.get(pid) || { 
            name: item.products?.name || 'Desconocido', 
            category: item.products?.category?.name || 'N/A', 
            units: 0, 
            revenue: 0, 
            cost: 0 
          }
          
          // Estimación de costo basada en el producto actual (limitación: no histórico)
          const unitCost = item.products?.purchase_price || 0
          
          productSalesMap.set(pid, {
            name: current.name,
            category: current.category,
            units: current.units + item.quantity,
            revenue: current.revenue + item.subtotal,
            cost: current.cost + (item.quantity * unitCost)
          })
        })
      })

      const topSellingProducts: ProductSales[] = Array.from(productSalesMap.entries())
        .map(([id, data]) => {
          const profit = data.revenue - data.cost
          const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0
          return {
            id,
            name: data.name,
            category: data.category,
            unitsSold: data.units,
            revenue: data.revenue,
            profit,
            margin: Number(margin.toFixed(1)),
            trend: 'stable' // To implement trend, we'd need comparison with previous period
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Profitability Analysis
      const profitabilityAnalysis: ProfitData[] = Array.from(productSalesMap.values())
        .map(data => {
          const profit = data.revenue - data.cost
          const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0
          const avgPrice = data.units > 0 ? data.revenue / data.units : 0
          const avgCost = data.units > 0 ? data.cost / data.units : 0
          
          return {
            product: data.name,
            category: data.category,
            cost: avgCost,
            price: avgPrice,
            margin: Number(margin.toFixed(1)),
            profit: profit / (data.units || 1),
            volume: data.units,
            totalProfit: profit
          }
        })
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 20)

      // Stock Movements
      const stockMovements: StockMovement[] = (movements || []).map((m: any) => ({
        id: m.id,
        date: new Date(m.created_at),
        type: m.type,
        product: m.product?.name || 'Desconocido',
        quantity: m.quantity,
        value: Math.abs(m.quantity * (m.product?.purchase_price || 0)), // Estimado
        reason: m.reason || '',
        user: 'Admin' // Should fetch user name if user_id exists
      }))

      // Supplier Performance (Mock logic based on product availability/pricing as we don't have orders table yet)
      const supplierPerformance: SupplierData[] = (suppliers || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        totalOrders: 0, // Placeholder
        totalValue: 0, // Placeholder
        averageDeliveryTime: s.deliveryTime || 0,
        qualityRating: s.rating || 0,
        onTimeDelivery: 100,
        status: (s.rating >= 4 ? 'excellent' : s.rating >= 3 ? 'good' : 'average') as any
      }))

      // Sales Trends (Mock for now, requires complex aggregation over time)
      const salesTrends: SalesTrend[] = [] 

      setReportData({
        totalProducts,
        totalValue,
        lowStockItems,
        outOfStockItems,
        totalSuppliers,
        totalCategories,
        averageMargin: Number(averageMargin.toFixed(1)),
        totalRevenue,
        topSellingProducts,
        categoryDistribution,
        supplierPerformance,
        stockMovements,
        salesTrends,
        profitabilityAnalysis
      })

    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [supabase, selectedDateRange])

  useEffect(() => {
    generateReport()
  }, [generateReport])

  const exportReport = async (exportFormat: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true)
    // Implementación futura de exportación real
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log(`Exportando reporte como ${exportFormat}`)
    setIsExporting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'average': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'poor': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'stable': return <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      default: return <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'salida': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'ajuste': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'transferencia': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400">Generando reporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes de Inventario</h2>
          <p className="text-gray-600 dark:text-gray-400">Análisis detallado y estadísticas del inventario</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportReport('pdf')} disabled={isExporting} className="dark:bg-gray-800 dark:border-gray-700">
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport('excel')} disabled={isExporting} className="dark:bg-gray-800 dark:border-gray-700">
            <BarChart3 className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={generateReport} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left dark:bg-gray-700 dark:border-gray-600">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDateRange.from && selectedDateRange.to
                      ? `${format(selectedDateRange.from, 'dd/MM/yyyy')} - ${format(selectedDateRange.to, 'dd/MM/yyyy')}`
                      : 'Seleccionar período'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{
                      from: selectedDateRange.from,
                      to: selectedDateRange.to
                    }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setSelectedDateRange({ from: range.from, to: range.to })
                      }
                    }}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {reportData.categoryDistribution.map(cat => (
                    <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {reportData.supplierPerformance.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Productos</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{reportData.totalProducts.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor Inventario</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${reportData.totalValue.toLocaleString()}</p>
              </div>
              <GSIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Margen Promedio</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{reportData.averageMargin}%</p>
              </div>
              <Target className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ventas (Período)</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">${reportData.totalRevenue.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Reportes */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 dark:bg-gray-800 dark:border-gray-700">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="profitability">Rentabilidad</TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alertas de Stock */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center dark:text-white">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                  Alertas de Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                      <span className="font-medium text-red-800 dark:text-red-300">Sin Stock</span>
                    </div>
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">{reportData.outOfStockItems}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                      <span className="font-medium text-yellow-800 dark:text-yellow-300">Stock Bajo</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">{reportData.lowStockItems}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      <span className="font-medium text-green-800 dark:text-green-300">Stock Normal</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                      {reportData.totalProducts - reportData.lowStockItems - reportData.outOfStockItems}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribución por Categorías */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center dark:text-white">
                  <PieChart className="h-5 w-5 mr-2 text-blue-600" />
                  Distribución por Categorías
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.categoryDistribution.slice(0, 5).map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium dark:text-gray-300">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold dark:text-white">{category.percentage}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{category.productCount} productos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Productos Más Vendidos</CardTitle>
              <CardDescription className="dark:text-gray-400">Top 10 productos por ventas y rentabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-left py-3 dark:text-gray-300">Categoría</th>
                      <th className="text-right py-3 dark:text-gray-300">Unidades</th>
                      <th className="text-right py-3 dark:text-gray-300">Ingresos</th>
                      <th className="text-right py-3 dark:text-gray-300">Ganancia</th>
                      <th className="text-right py-3 dark:text-gray-300">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {reportData.topSellingProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">No hay datos de ventas para este período</td>
                      </tr>
                    ) : (
                      reportData.topSellingProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 font-medium dark:text-white">{product.name}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{product.category}</Badge>
                          </td>
                          <td className="text-right py-3 dark:text-gray-300">{product.unitsSold.toLocaleString()}</td>
                          <td className="text-right py-3 dark:text-gray-300">${product.revenue.toLocaleString()}</td>
                          <td className="text-right py-3 dark:text-gray-300">${product.profit.toLocaleString()}</td>
                          <td className="text-right py-3 dark:text-gray-300">{product.margin}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Categorías */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportData.categoryDistribution.map((category) => (
              <Card key={category.name} className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between dark:text-white">
                    <span>{category.name}</span>
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Productos:</span>
                      <span className="font-semibold dark:text-white">{category.productCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Valor Total:</span>
                      <span className="font-semibold dark:text-white">${category.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Participación:</span>
                      <span className="font-semibold dark:text-white">{category.percentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Margen Promedio:</span>
                      <span className="font-semibold dark:text-white">{category.averageMargin}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Proveedores */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Rendimiento de Proveedores</CardTitle>
              <CardDescription className="dark:text-gray-400">Listado de proveedores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 dark:text-gray-300">Proveedor</th>
                      <th className="text-right py-3 dark:text-gray-300">Calidad</th>
                      <th className="text-right py-3 dark:text-gray-300">Tiempo Entrega</th>
                      <th className="text-center py-3 dark:text-gray-300">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {reportData.supplierPerformance.map((supplier) => (
                      <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 font-medium dark:text-white">{supplier.name}</td>
                        <td className="text-right py-3">
                          <div className="flex items-center justify-end">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            <span className="dark:text-gray-300">{supplier.qualityRating}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 dark:text-gray-300">{supplier.averageDeliveryTime} días</td>
                        <td className="text-center py-3">
                          <Badge className={getStatusColor(supplier.status)}>
                            {supplier.status.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Movimientos */}
        <TabsContent value="movements" className="space-y-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Movimientos de Stock Recientes</CardTitle>
              <CardDescription className="dark:text-gray-400">Historial de entradas, salidas y ajustes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 dark:text-gray-300">Fecha</th>
                      <th className="text-left py-3 dark:text-gray-300">Tipo</th>
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-right py-3 dark:text-gray-300">Cantidad</th>
                      <th className="text-right py-3 dark:text-gray-300">Valor</th>
                      <th className="text-left py-3 dark:text-gray-300">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {reportData.stockMovements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 dark:text-gray-300">{format(movement.date, 'dd/MM/yyyy')}</td>
                        <td className="py-3">
                          <Badge className={getMovementTypeColor(movement.type)}>
                            {movement.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 font-medium dark:text-white">{movement.product}</td>
                        <td className="text-right py-3">
                          <span className={movement.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </td>
                        <td className="text-right py-3">
                          <span className={movement.value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            ${Math.abs(movement.value).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 dark:text-gray-300">{movement.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Rentabilidad */}
        <TabsContent value="profitability" className="space-y-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Análisis de Rentabilidad</CardTitle>
              <CardDescription className="dark:text-gray-400">Basado en ventas registradas en el período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-left py-3 dark:text-gray-300">Categoría</th>
                      <th className="text-right py-3 dark:text-gray-300">Costo Est.</th>
                      <th className="text-right py-3 dark:text-gray-300">Precio Prom.</th>
                      <th className="text-right py-3 dark:text-gray-300">Margen %</th>
                      <th className="text-right py-3 dark:text-gray-300">Ganancia Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {reportData.profitabilityAnalysis.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">No hay ventas registradas para analizar rentabilidad</td>
                      </tr>
                    ) : (
                      reportData.profitabilityAnalysis.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 font-medium dark:text-white">{item.product}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{item.category}</Badge>
                          </td>
                          <td className="text-right py-3 dark:text-gray-300">${item.cost.toLocaleString()}</td>
                          <td className="text-right py-3 dark:text-gray-300">${item.price.toLocaleString()}</td>
                          <td className="text-right py-3">
                            <span className={`font-semibold ${item.margin >= 30 ? 'text-green-600 dark:text-green-400' : item.margin >= 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                              {item.margin}%
                            </span>
                          </td>
                          <td className="text-right py-3 font-semibold text-green-600 dark:text-green-400">
                            ${item.totalProfit.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default InventoryReports
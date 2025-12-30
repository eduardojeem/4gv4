'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  ShoppingCart,
  Target,
  Activity,
  PieChart,
  LineChart,
  Filter,
  RefreshCw,
  Eye,
  Printer,
  Mail,
  Share2,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  Truck,
  Warehouse,
  Calculator,
  Globe,
  Zap
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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
  // Estados
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<{from: Date, to: Date}>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [reportType, setReportType] = useState<string>('general')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Datos mock
  const mockReportData: ReportData = {
    totalProducts: 1247,
    totalValue: 2850000,
    lowStockItems: 23,
    outOfStockItems: 8,
    totalSuppliers: 45,
    totalCategories: 12,
    averageMargin: 35.2,
    totalRevenue: 4250000,
    topSellingProducts: [
      {
        id: '1',
        name: 'iPhone 15 Pro',
        category: 'Smartphones',
        unitsSold: 245,
        revenue: 245000,
        profit: 49000,
        margin: 20,
        trend: 'up'
      },
      {
        id: '2',
        name: 'MacBook Air M3',
        category: 'Laptops',
        unitsSold: 89,
        revenue: 178000,
        profit: 35600,
        margin: 20,
        trend: 'up'
      },
      {
        id: '3',
        name: 'Samsung Galaxy S24',
        category: 'Smartphones',
        unitsSold: 156,
        revenue: 124800,
        profit: 24960,
        margin: 20,
        trend: 'stable'
      },
      {
        id: '4',
        name: 'Sony WH-1000XM5',
        category: 'Audio',
        unitsSold: 234,
        revenue: 70200,
        profit: 21060,
        margin: 30,
        trend: 'up'
      },
      {
        id: '5',
        name: 'iPad Pro 12.9"',
        category: 'Tablets',
        unitsSold: 67,
        revenue: 80400,
        profit: 16080,
        margin: 20,
        trend: 'down'
      }
    ],
    categoryDistribution: [
      { name: 'Smartphones', productCount: 156, totalValue: 780000, percentage: 27.4, averageMargin: 22.5, color: '#3B82F6' },
      { name: 'Laptops', productCount: 89, totalValue: 623000, percentage: 21.9, averageMargin: 18.2, color: '#10B981' },
      { name: 'Audio', productCount: 234, totalValue: 345000, percentage: 12.1, averageMargin: 35.8, color: '#F59E0B' },
      { name: 'Tablets', productCount: 78, totalValue: 312000, percentage: 10.9, averageMargin: 25.1, color: '#EF4444' },
      { name: 'Accesorios', productCount: 456, totalValue: 234000, percentage: 8.2, averageMargin: 45.2, color: '#8B5CF6' },
      { name: 'Gaming', productCount: 123, totalValue: 456000, percentage: 16.0, averageMargin: 28.7, color: '#06B6D4' },
      { name: 'Otros', productCount: 111, totalValue: 100000, percentage: 3.5, averageMargin: 32.1, color: '#84CC16' }
    ],
    supplierPerformance: [
      {
        id: '1',
        name: 'Apple Inc.',
        totalOrders: 45,
        totalValue: 2500000,
        averageDeliveryTime: 7,
        qualityRating: 4.9,
        onTimeDelivery: 96,
        status: 'excellent'
      },
      {
        id: '2',
        name: 'Samsung Electronics',
        totalOrders: 32,
        totalValue: 1800000,
        averageDeliveryTime: 10,
        qualityRating: 4.7,
        onTimeDelivery: 92,
        status: 'excellent'
      },
      {
        id: '3',
        name: 'Lenovo Group',
        totalOrders: 28,
        totalValue: 1200000,
        averageDeliveryTime: 14,
        qualityRating: 4.5,
        onTimeDelivery: 88,
        status: 'good'
      },
      {
        id: '4',
        name: 'Sony Corporation',
        totalOrders: 18,
        totalValue: 650000,
        averageDeliveryTime: 12,
        qualityRating: 4.8,
        onTimeDelivery: 94,
        status: 'excellent'
      },
      {
        id: '5',
        name: 'TechDistributor SA',
        totalOrders: 12,
        totalValue: 180000,
        averageDeliveryTime: 21,
        qualityRating: 3.2,
        onTimeDelivery: 67,
        status: 'poor'
      }
    ],
    stockMovements: [
      {
        id: '1',
        date: new Date('2024-01-20'),
        type: 'entrada',
        product: 'iPhone 15 Pro',
        quantity: 50,
        value: 50000,
        reason: 'Compra a proveedor',
        user: 'Admin'
      },
      {
        id: '2',
        date: new Date('2024-01-19'),
        type: 'salida',
        product: 'MacBook Air M3',
        quantity: -15,
        value: -30000,
        reason: 'Venta',
        user: 'Vendedor1'
      },
      {
        id: '3',
        date: new Date('2024-01-18'),
        type: 'ajuste',
        product: 'Samsung Galaxy S24',
        quantity: -2,
        value: -1600,
        reason: 'Producto dañado',
        user: 'Admin'
      }
    ],
    salesTrends: [
      { period: 'Ene 2024', sales: 156, revenue: 234000, profit: 46800, units: 1245 },
      { period: 'Feb 2024', sales: 189, revenue: 283500, profit: 56700, units: 1456 },
      { period: 'Mar 2024', sales: 234, revenue: 351000, profit: 70200, units: 1789 },
      { period: 'Abr 2024', sales: 198, revenue: 297000, profit: 59400, units: 1567 },
      { period: 'May 2024', sales: 267, revenue: 400500, profit: 80100, units: 1923 },
      { period: 'Jun 2024', sales: 245, revenue: 367500, profit: 73500, units: 1834 }
    ],
    profitabilityAnalysis: [
      {
        product: 'iPhone 15 Pro',
        category: 'Smartphones',
        cost: 800,
        price: 1000,
        margin: 20,
        profit: 200,
        volume: 245,
        totalProfit: 49000
      },
      {
        product: 'MacBook Air M3',
        category: 'Laptops',
        cost: 1600,
        price: 2000,
        margin: 20,
        profit: 400,
        volume: 89,
        totalProfit: 35600
      },
      {
        product: 'Sony WH-1000XM5',
        category: 'Audio',
        cost: 210,
        price: 300,
        margin: 30,
        profit: 90,
        volume: 234,
        totalProfit: 21060
      }
    ]
  }

  // Efectos
  useEffect(() => {
    generateReport()
  }, [selectedDateRange, selectedCategory, selectedSupplier])

  // Funciones
  const generateReport = async () => {
    setIsGenerating(true)
    // Simular carga de datos
    await new Promise(resolve => setTimeout(resolve, 1000))
    setReportData(mockReportData)
    setIsGenerating(false)
  }

  const exportReport = async (exportFormat: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true)
    // Simular exportación
    await new Promise(resolve => setTimeout(resolve, 2000))

    // En una implementación real, aquí se generaría y descargaría el archivo
    const fileName = `reporte-inventario-${exportFormat}-${format(new Date(), 'yyyy-MM-dd')}`
    console.log(`Exportando reporte como ${exportFormat}: ${fileName}`)

    setIsExporting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800'
      case 'good': return 'bg-blue-100 text-blue-800'
      case 'average': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />
      case 'stable': return <Minus className="h-4 w-4 text-gray-600" />
      default: return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800'
      case 'salida': return 'bg-red-100 text-red-800'
      case 'ajuste': return 'bg-yellow-100 text-yellow-800'
      case 'transferencia': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Generando reporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reportes de Inventario</h2>
          <p className="text-gray-600">Análisis detallado y estadísticas del inventario</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => exportReport('pdf')} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport('excel')} disabled={isExporting}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => exportReport('csv')} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={generateReport} disabled={isGenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
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
                <SelectTrigger>
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
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de reporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="sales">Ventas</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="profitability">Rentabilidad</SelectItem>
                  <SelectItem value="suppliers">Proveedores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Productos</p>
                <p className="text-2xl font-bold text-blue-600">{reportData.totalProducts.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">+12% vs mes anterior</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">${reportData.totalValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">+8% vs mes anterior</p>
              </div>
              <GSIcon className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Margen Promedio</p>
                <p className="text-2xl font-bold text-purple-600">{reportData.averageMargin}%</p>
                <p className="text-xs text-gray-500 mt-1">+2.1% vs mes anterior</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                <p className="text-2xl font-bold text-orange-600">${reportData.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">+15% vs mes anterior</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Reportes */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                  Alertas de Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="h-5 w-5 text-red-600 mr-2" />
                      <span className="font-medium text-red-800">Sin Stock</span>
                    </div>
                    <Badge className="bg-red-100 text-red-800">{reportData.outOfStockItems}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                      <span className="font-medium text-yellow-800">Stock Bajo</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">{reportData.lowStockItems}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-medium text-green-800">Stock Normal</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {reportData.totalProducts - reportData.lowStockItems - reportData.outOfStockItems}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribución por Categorías */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
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
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{category.percentage}%</p>
                        <p className="text-xs text-gray-500">{category.productCount} productos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendencias de Ventas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LineChart className="h-5 w-5 mr-2 text-green-600" />
                Tendencias de Ventas (Últimos 6 Meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Ventas Totales</p>
                    <p className="text-xl font-bold text-blue-600">
                      {reportData.salesTrends.reduce((sum, trend) => sum + trend.sales, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ingresos</p>
                    <p className="text-xl font-bold text-green-600">
                      ${reportData.salesTrends.reduce((sum, trend) => sum + trend.revenue, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ganancia</p>
                    <p className="text-xl font-bold text-purple-600">
                      ${reportData.salesTrends.reduce((sum, trend) => sum + trend.profit, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Unidades</p>
                    <p className="text-xl font-bold text-orange-600">
                      {reportData.salesTrends.reduce((sum, trend) => sum + trend.units, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Período</th>
                        <th className="text-right py-2">Ventas</th>
                        <th className="text-right py-2">Ingresos</th>
                        <th className="text-right py-2">Ganancia</th>
                        <th className="text-right py-2">Unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.salesTrends.map((trend, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 font-medium">{trend.period}</td>
                          <td className="text-right py-2">{trend.sales}</td>
                          <td className="text-right py-2">${trend.revenue.toLocaleString()}</td>
                          <td className="text-right py-2">${trend.profit.toLocaleString()}</td>
                          <td className="text-right py-2">{trend.units.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Productos Más Vendidos</CardTitle>
              <CardDescription>Top 10 productos por ventas y rentabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Producto</th>
                      <th className="text-left py-3">Categoría</th>
                      <th className="text-right py-3">Unidades</th>
                      <th className="text-right py-3">Ingresos</th>
                      <th className="text-right py-3">Ganancia</th>
                      <th className="text-right py-3">Margen</th>
                      <th className="text-center py-3">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topSellingProducts.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-medium">{product.name}</td>
                        <td className="py-3">
                          <Badge variant="outline">{product.category}</Badge>
                        </td>
                        <td className="text-right py-3">{product.unitsSold.toLocaleString()}</td>
                        <td className="text-right py-3">${product.revenue.toLocaleString()}</td>
                        <td className="text-right py-3">${product.profit.toLocaleString()}</td>
                        <td className="text-right py-3">{product.margin}%</td>
                        <td className="text-center py-3">{getTrendIcon(product.trend)}</td>
                      </tr>
                    ))}
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
              <Card key={category.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
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
                      <span className="text-sm text-gray-600">Productos:</span>
                      <span className="font-semibold">{category.productCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor Total:</span>
                      <span className="font-semibold">${category.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Participación:</span>
                      <span className="font-semibold">{category.percentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Margen Promedio:</span>
                      <span className="font-semibold">{category.averageMargin}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Proveedores */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de Proveedores</CardTitle>
              <CardDescription>Análisis de desempeño y calidad de proveedores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Proveedor</th>
                      <th className="text-right py-3">Órdenes</th>
                      <th className="text-right py-3">Valor Total</th>
                      <th className="text-right py-3">Tiempo Entrega</th>
                      <th className="text-right py-3">Calidad</th>
                      <th className="text-right py-3">Puntualidad</th>
                      <th className="text-center py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.supplierPerformance.map((supplier) => (
                      <tr key={supplier.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-medium">{supplier.name}</td>
                        <td className="text-right py-3">{supplier.totalOrders}</td>
                        <td className="text-right py-3">${supplier.totalValue.toLocaleString()}</td>
                        <td className="text-right py-3">{supplier.averageDeliveryTime} días</td>
                        <td className="text-right py-3">
                          <div className="flex items-center justify-end">
                            <Star className="h-4 w-4 text-yellow-400 mr-1" />
                            {supplier.qualityRating}
                          </div>
                        </td>
                        <td className="text-right py-3">{supplier.onTimeDelivery}%</td>
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
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Stock Recientes</CardTitle>
              <CardDescription>Historial de entradas, salidas y ajustes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Fecha</th>
                      <th className="text-left py-3">Tipo</th>
                      <th className="text-left py-3">Producto</th>
                      <th className="text-right py-3">Cantidad</th>
                      <th className="text-right py-3">Valor</th>
                      <th className="text-left py-3">Motivo</th>
                      <th className="text-left py-3">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.stockMovements.map((movement) => (
                      <tr key={movement.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{format(movement.date, 'dd/MM/yyyy')}</td>
                        <td className="py-3">
                          <Badge className={getMovementTypeColor(movement.type)}>
                            {movement.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 font-medium">{movement.product}</td>
                        <td className="text-right py-3">
                          <span className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </td>
                        <td className="text-right py-3">
                          <span className={movement.value > 0 ? 'text-green-600' : 'text-red-600'}>
                            ${Math.abs(movement.value).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3">{movement.reason}</td>
                        <td className="py-3">{movement.user}</td>
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
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Rentabilidad</CardTitle>
              <CardDescription>Productos más rentables y análisis de márgenes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Producto</th>
                      <th className="text-left py-3">Categoría</th>
                      <th className="text-right py-3">Costo</th>
                      <th className="text-right py-3">Precio</th>
                      <th className="text-right py-3">Margen %</th>
                      <th className="text-right py-3">Ganancia/Unidad</th>
                      <th className="text-right py-3">Volumen</th>
                      <th className="text-right py-3">Ganancia Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.profitabilityAnalysis.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-medium">{item.product}</td>
                        <td className="py-3">
                          <Badge variant="outline">{item.category}</Badge>
                        </td>
                        <td className="text-right py-3">${item.cost.toLocaleString()}</td>
                        <td className="text-right py-3">${item.price.toLocaleString()}</td>
                        <td className="text-right py-3">
                          <span className={`font-semibold ${item.margin >= 30 ? 'text-green-600' : item.margin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {item.margin}%
                          </span>
                        </td>
                        <td className="text-right py-3">${item.profit.toLocaleString()}</td>
                        <td className="text-right py-3">{item.volume.toLocaleString()}</td>
                        <td className="text-right py-3 font-semibold text-green-600">
                          ${item.totalProfit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
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

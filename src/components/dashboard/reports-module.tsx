'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Scatter,
  ScatterChart
} from 'recharts'
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  Activity,
  Filter,
  RefreshCw,
  Eye,
  Settings,
  Share,
  Printer,
  Mail,
  FileSpreadsheet,
  FileImage,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { addDays, subDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

// Tipos para reportes
export interface ReportData {
  id: string
  name: string
  description: string
  type: 'sales' | 'inventory' | 'financial' | 'performance' | 'custom'
  data: any[]
  generatedAt: Date
  period: {
    start: Date
    end: Date
  }
  metrics: Record<string, number>
}

export interface ReportConfig {
  id: string
  name: string
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed' | 'scatter'
  dataKey: string
  xAxisKey: string
  yAxisKey?: string
  colors: string[]
  showLegend: boolean
  showGrid: boolean
  animated: boolean
}

// Configuraciones predefinidas de reportes
const reportConfigs: ReportConfig[] = [
  {
    id: 'sales-trend',
    name: 'Tendencia de Ventas',
    type: 'line',
    dataKey: 'sales',
    xAxisKey: 'date',
    colors: ['#3b82f6', '#10b981', '#f59e0b'],
    showLegend: true,
    showGrid: true,
    animated: true
  },
  {
    id: 'category-distribution',
    name: 'Distribución por Categoría',
    type: 'pie',
    dataKey: 'value',
    xAxisKey: 'category',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    showLegend: true,
    showGrid: false,
    animated: true
  },
  {
    id: 'inventory-levels',
    name: 'Niveles de Inventario',
    type: 'bar',
    dataKey: 'stock',
    xAxisKey: 'product',
    colors: ['#10b981', '#f59e0b', '#ef4444'],
    showLegend: true,
    showGrid: true,
    animated: true
  },
  {
    id: 'revenue-analysis',
    name: 'Análisis de Ingresos',
    type: 'area',
    dataKey: 'revenue',
    xAxisKey: 'month',
    colors: ['#3b82f6', '#10b981'],
    showLegend: true,
    showGrid: true,
    animated: true
  }
]

// Hook para generar datos de reportes
export function useReportsData(products: any[] = []) {
  const generateSalesData = useCallback(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return months.map(month => ({
      month,
      ventas: Math.floor(Math.random() * 100000) + 50000,
      ingresos: Math.floor(Math.random() * 500000) + 200000,
      productos: Math.floor(Math.random() * 50) + 20,
      clientes: Math.floor(Math.random() * 200) + 100
    }))
  }, [])

  const generateCategoryData = useCallback(() => {
    const categories = ['Electrónicos', 'Ropa', 'Hogar', 'Deportes', 'Libros', 'Salud']
    return categories.map(category => ({
      category,
      value: Math.floor(Math.random() * 1000) + 100,
      productos: Math.floor(Math.random() * 50) + 10,
      ingresos: Math.floor(Math.random() * 100000) + 20000
    }))
  }, [])

  const generateInventoryData = useCallback(() => {
    return products.slice(0, 10).map(product => ({
      product: product.name || `Producto ${product.id}`,
      stock: product.stock_quantity || 0,
      minStock: product.min_stock || 10,
      maxStock: (product.stock_quantity || 0) * 2,
      valor: (product.price || 0) * (product.stock_quantity || 0),
      rotacion: Math.floor(Math.random() * 10) + 1
    }))
  }, [products])

  const generatePerformanceData = useCallback(() => {
    const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
    return weeks.map(week => ({
      week,
      eficiencia: Math.floor(Math.random() * 30) + 70,
      satisfaccion: Math.floor(Math.random() * 20) + 80,
      entregas: Math.floor(Math.random() * 10) + 90,
      calidad: Math.floor(Math.random() * 15) + 85
    }))
  }, [])

  const generateFinancialData = useCallback(() => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
    return quarters.map(quarter => ({
      quarter,
      ingresos: Math.floor(Math.random() * 500000) + 300000,
      gastos: Math.floor(Math.random() * 200000) + 150000,
      utilidad: Math.floor(Math.random() * 300000) + 100000,
      margen: Math.floor(Math.random() * 20) + 15
    }))
  }, [])

  return {
    salesData: generateSalesData(),
    categoryData: generateCategoryData(),
    inventoryData: generateInventoryData(),
    performanceData: generatePerformanceData(),
    financialData: generateFinancialData()
  }
}

// Componente de gráfico dinámico
function DynamicChart({ 
  config, 
  data, 
  height = 300 
}: { 
  config: ReportConfig
  data: any[]
  height?: number 
}) {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (config.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={config.xAxisKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Bar 
              dataKey={config.dataKey} 
              fill={config.colors[0]}
              animationDuration={config.animated ? 1000 : 0}
            />
          </BarChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={config.xAxisKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Line 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={config.colors[0]}
              strokeWidth={2}
              animationDuration={config.animated ? 1000 : 0}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={config.xAxisKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Area 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={config.colors[0]}
              fill={config.colors[0]}
              fillOpacity={0.6}
              animationDuration={config.animated ? 1000 : 0}
            />
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={config.dataKey}
              animationDuration={config.animated ? 1000 : 0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={config.colors[index % config.colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            {config.showLegend && <Legend />}
          </PieChart>
        )

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={config.xAxisKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Bar dataKey={config.dataKey} fill={config.colors[0]} />
            <Line type="monotone" dataKey={config.yAxisKey} stroke={config.colors[1]} />
          </ComposedChart>
        )

      default:
        return <div>Tipo de gráfico no soportado</div>
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  )
}

// Componente de métricas clave
function KeyMetrics({ data }: { data: any }) {
  const metrics = [
    {
      title: 'Ingresos Totales',
      value: '$2,450,000',
      change: '+12.5%',
      trend: 'up',
      icon: GSIcon,
      color: 'text-green-600'
    },
    {
      title: 'Productos Vendidos',
      value: '1,234',
      change: '+8.2%',
      trend: 'up',
      icon: Package,
      color: 'text-blue-600'
    },
    {
      title: 'Clientes Activos',
      value: '856',
      change: '+15.3%',
      trend: 'up',
      icon: Users,
      color: 'text-purple-600'
    },
    {
      title: 'Tasa de Conversión',
      value: '3.2%',
      change: '-2.1%',
      trend: 'down',
      icon: Target,
      color: 'text-orange-600'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <Card key={index} className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <div className="flex items-center mt-1">
                  {metric.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                  )}
                  <span className={`text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-full bg-gray-100`}>
                <metric.icon className={`h-6 w-6 ${metric.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Componente de exportación
function ExportOptions({ onExport }: { onExport: (format: string) => void }) {
  const { toast } = useToast()

  const exportFormats = [
    { id: 'pdf', name: 'PDF', icon: FileText, description: 'Documento PDF completo' },
    { id: 'excel', name: 'Excel', icon: FileSpreadsheet, description: 'Hoja de cálculo Excel' },
    { id: 'csv', name: 'CSV', icon: FileSpreadsheet, description: 'Valores separados por comas' },
    { id: 'png', name: 'PNG', icon: FileImage, description: 'Imagen PNG de alta calidad' }
  ]

  const handleExport = (format: string) => {
    toast({
      title: 'Exportando reporte',
      description: `Generando archivo ${format.toUpperCase()}...`
    })
    onExport(format)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Reporte
        </CardTitle>
        <CardDescription>
          Descarga el reporte en diferentes formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {exportFormats.map((format) => (
          <div key={format.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <format.icon className="h-5 w-5 text-gray-600" />
              <div>
                <p className="font-medium">{format.name}</p>
                <p className="text-sm text-gray-500">{format.description}</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleExport(format.id)}
            >
              Descargar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Componente principal del módulo de reportes
export default function ReportsModule({ products = [] }: { products?: any[] }) {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [activeReport, setActiveReport] = useState('sales')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { toast } = useToast()

  const {
    salesData,
    categoryData,
    inventoryData,
    performanceData,
    financialData
  } = useReportsData(products)

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    const now = new Date()
    
    switch (period) {
      case 'week':
        setDateRange({
          from: subDays(now, 7),
          to: now
        })
        break
      case 'month':
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now)
        })
        break
      case 'quarter':
        setDateRange({
          from: subDays(now, 90),
          to: now
        })
        break
      case 'year':
        setDateRange({
          from: startOfYear(now),
          to: endOfYear(now)
        })
        break
    }
  }

  const handleExport = (format: string) => {
    // Simulación de exportación
    setTimeout(() => {
      toast({
        title: 'Reporte exportado',
        description: `El archivo ${format.toUpperCase()} se ha descargado correctamente.`
      })
    }, 2000)
  }

  const handleRefresh = () => {
    toast({
      title: 'Actualizando datos',
      description: 'Los reportes se están actualizando...'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Reportes e Indicadores
              </CardTitle>
              <CardDescription>
                Análisis completo de rendimiento y métricas del negocio
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-refresh">Auto-actualizar</Label>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
              </div>
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas clave */}
      <KeyMetrics data={salesData} />

      {/* Reportes por pestañas */}
      <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
          <TabsTrigger value="financial">Financiero</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia de Ventas</CardTitle>
                  <CardDescription>Evolución mensual de ventas e ingresos</CardDescription>
                </CardHeader>
                <CardContent>
                  <DynamicChart
                    config={reportConfigs[0]}
                    data={salesData}
                    height={350}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Categoría</CardTitle>
                  <CardDescription>Participación de cada categoría en las ventas</CardDescription>
                </CardHeader>
                <CardContent>
                  <DynamicChart
                    config={reportConfigs[1]}
                    data={categoryData}
                    height={350}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <ExportOptions onExport={handleExport} />
              
              <Card>
                <CardHeader>
                  <CardTitle>Resumen del Período</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Ventas</span>
                    <span className="font-semibold">$2,450,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Productos Vendidos</span>
                    <span className="font-semibold">1,234</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Ticket Promedio</span>
                    <span className="font-semibold">$1,986</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Crecimiento</span>
                    <Badge variant="secondary" className="text-green-600">
                      +12.5%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Niveles de Stock</CardTitle>
                <CardDescription>Estado actual del inventario por producto</CardDescription>
              </CardHeader>
              <CardContent>
                <DynamicChart
                  config={reportConfigs[2]}
                  data={inventoryData}
                  height={350}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rotación de Inventario</CardTitle>
                <CardDescription>Velocidad de rotación por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <DynamicChart
                  config={{...reportConfigs[3], dataKey: 'rotacion', xAxisKey: 'product'}}
                  data={inventoryData}
                  height={350}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis Financiero</CardTitle>
              <CardDescription>Ingresos, gastos y utilidades por trimestre</CardDescription>
            </CardHeader>
            <CardContent>
              <DynamicChart
                config={{
                  id: 'financial',
                  name: 'Análisis Financiero',
                  type: 'composed',
                  dataKey: 'ingresos',
                  xAxisKey: 'quarter',
                  yAxisKey: 'gastos',
                  colors: ['#3b82f6', '#ef4444'],
                  showLegend: true,
                  showGrid: true,
                  animated: true
                }}
                data={financialData}
                height={400}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Indicadores de Rendimiento</CardTitle>
              <CardDescription>KPIs clave del negocio</CardDescription>
            </CardHeader>
            <CardContent>
              <DynamicChart
                config={{
                  id: 'performance',
                  name: 'Rendimiento',
                  type: 'line',
                  dataKey: 'eficiencia',
                  xAxisKey: 'week',
                  colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                  showLegend: true,
                  showGrid: true,
                  animated: true
                }}
                data={performanceData}
                height={350}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reportes Personalizados</CardTitle>
              <CardDescription>Crea reportes adaptados a tus necesidades específicas</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Constructor de Reportes</h3>
              <p className="text-gray-500 mb-4">
                Próximamente: herramienta para crear reportes personalizados
              </p>
              <Button variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                Solicitar Acceso Beta
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

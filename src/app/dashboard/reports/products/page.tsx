'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion  } from '../../../../components/ui/motion'
import Link from 'next/link'
import { XLSX, jsPDF, showDisabledFeatureMessage } from '@/components/stubs/HeavyDependencyStubs';
// Comentado temporalmente para optimización de bundle
// import autoTable from 'jspdf-autotable'
import {
  BarChart3,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  FileText,
  PieChart,
  Activity,
  RefreshCw,
  Sparkles,
  ArrowLeft
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { PieChart as RechartsPieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { Area } from 'recharts/es6/cartesian/Area';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

import { createClient } from '@/lib/supabase/client'

// Datos mock eliminados

export default function ProductReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  
  // Datos para gráficas (inicialmente vacíos)
  const salesTrendData: any[] = []
  const categoryData: any[] = []
  const topProductsData: any[] = []

  // Cargar datos reales desde Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          // Add filters if needed
        
        if (error) throw error

        if (data) {
          // Transform data to match UI expectations if needed
          // For now, we just use what we have or map it
          const formattedProducts = data.map(p => ({
            id: p.id,
            name: p.name,
            category: 'General', // Would need join with categories
            sku: p.sku,
            stock_quantity: p.stock_quantity,
            min_stock: p.min_stock_level || 0,
            sale_price: p.sale_price,
            purchase_price: 0, // Not exposed publicly usually
            total_sales: 0, // Would need to calculate from sales items
            revenue: 0,
            profit: 0,
            margin: 0,
            last_sale: null,
            supplier: '', // Would need join
            status: p.is_active ? 'active' : 'inactive'
          }))
          setProducts(formattedProducts)
        }
      } catch (error) {
        console.error('Error loading product reports:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  })
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Filtrar datos basado en los filtros seleccionados
  const filteredData = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
      const matchesStatus = selectedStatus === 'all' || product.status === selectedStatus
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.sku.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesCategory && matchesStatus && matchesSearch
    })
  }, [selectedCategory, selectedStatus, searchTerm])

  // Calcular métricas
  const metrics = useMemo(() => {
    const totalProducts = filteredData.length
    const totalRevenue = filteredData.reduce((sum, product) => sum + product.revenue, 0)
    const totalProfit = filteredData.reduce((sum, product) => sum + product.profit, 0)
    const totalSales = filteredData.reduce((sum, product) => sum + product.total_sales, 0)
    const averageMargin = filteredData.reduce((sum, product) => sum + product.margin, 0) / totalProducts
    const lowStockProducts = filteredData.filter(product => product.stock_quantity <= product.min_stock).length

    return {
      totalProducts,
      totalRevenue,
      totalProfit,
      totalSales,
      averageMargin: averageMargin || 0,
      lowStockProducts
    }
  }, [filteredData])

  // Función mejorada para exportar datos
  const exportData = useCallback(async (fileFormat: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true)
    
    try {
      // Simular procesamiento con progreso
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `reporte-productos-${timestamp}`
      
      if (fileFormat === 'csv') {
        const BOM = '\uFEFF' // UTF-8 BOM para Excel
        const headers = ['Producto', 'SKU', 'Categoría', 'Stock', 'Precio Venta', 'Ventas Totales', 'Ingresos', 'Margen %']
        const csvContent = [
          headers.join(','),
          ...filteredData.map(product => [
            `"${product.name}"`,
            product.sku,
            `"${product.category}"`,
            product.stock_quantity,
            product.sale_price,
            product.total_sales,
            product.revenue,
            product.margin.toFixed(1)
          ].join(','))
        ].join('\n')
        
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        
      } else if (fileFormat === 'excel') {
        // Crear workbook con múltiples hojas
        const wb = XLSX.utils.book_new()
        
        // Hoja principal con datos de productos
        const wsData = [
          ['REPORTE DE PRODUCTOS - 4G CELULARES'],
          [`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`],
          [`Filtros aplicados: Categoría: ${selectedCategory}, Estado: ${selectedStatus}`],
          [`Total de productos: ${filteredData.length}`],
          [],
          ['Producto', 'SKU', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Precio Venta', 'Precio Compra', 'Ventas Totales', 'Ingresos', 'Ganancia', 'Margen %', 'Estado'],
          ...filteredData.map(product => [
            product.name,
            product.sku,
            product.category,
            product.stock_quantity,
            product.min_stock,
            product.sale_price,
            product.purchase_price,
            product.total_sales,
            product.revenue,
            product.profit,
            product.margin,
            product.stock_quantity <= product.min_stock ? 'Stock Bajo' : 'Normal'
          ])
        ]
        
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        
        // Aplicar estilos
        if (ws['A1']) {
          ws['A1'].s = {
            font: { bold: true, sz: 16, color: { rgb: "1F4E79" } },
            alignment: { horizontal: "center" }
          }
        }
        
        // Merge para el título
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }]
        
        // Ajustar anchos de columna
        ws['!cols'] = [
          { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
          { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }
        ]
        
        XLSX.utils.book_append_sheet(wb, ws, 'Productos')
        
        // Hoja de resumen
        const summaryData = [
          ['RESUMEN EJECUTIVO'],
          [],
          ['Métrica', 'Valor'],
          ['Total de Productos', metrics.totalProducts],
          ['Ingresos Totales', `$${(metrics.totalRevenue / 1000000).toFixed(2)}M`],
          ['Ganancia Total', `$${(metrics.totalProfit / 1000000).toFixed(2)}M`],
          ['Ventas Totales', metrics.totalSales],
          ['Margen Promedio', `${metrics.averageMargin.toFixed(1)}%`],
          ['Productos con Stock Bajo', metrics.lowStockProducts]
        ]
        
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')
        
        // Metadatos del archivo
        wb.Props = {
          Title: "Reporte de Productos",
          Subject: "Análisis de Inventario y Ventas",
          Author: "4G Celulares - Sistema de Gestión",
          CreatedDate: new Date()
        }
        
        XLSX.writeFile(wb, `${filename}.xlsx`)
        
      } else if (fileFormat === 'pdf') {
        try {
          const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
          
          // Header
          doc.setFontSize(18)
          doc.setTextColor(31, 78, 121)
          doc.text('REPORTE DE PRODUCTOS - 4G CELULARES', 40, 40)
          
          // Información del reporte
          doc.setFontSize(10)
          doc.setTextColor(100, 100, 100)
          doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`, 40, 60)
          doc.text(`Filtros: Categoría: ${selectedCategory === 'all' ? 'Todas' : selectedCategory}, Estado: ${selectedStatus === 'all' ? 'Todos' : selectedStatus}`, 40, 75)
          doc.text(`Total de productos: ${filteredData.length}`, 40, 90)
          
          // Resumen de métricas
          doc.setFontSize(12)
          doc.setTextColor(31, 78, 121)
          doc.text('RESUMEN EJECUTIVO', 40, 115)
          
          doc.setFontSize(9)
          doc.setTextColor(0, 0, 0)
          const summaryY = 135
          doc.text(`Ingresos Totales: $${(metrics.totalRevenue / 1000000).toFixed(2)}M`, 40, summaryY)
          doc.text(`Ganancia Total: $${(metrics.totalProfit / 1000000).toFixed(2)}M`, 200, summaryY)
          doc.text(`Margen Promedio: ${metrics.averageMargin.toFixed(1)}%`, 360, summaryY)
          doc.text(`Stock Bajo: ${metrics.lowStockProducts} productos`, 500, summaryY)
          
          // Línea separadora
          doc.setDrawColor(200, 200, 200)
          doc.line(40, 150, doc.internal.pageSize.width - 40, 150)
          
          // Preparar datos para la tabla
          const tableHeaders = ['Producto', 'SKU', 'Categoría', 'Stock', 'Precio', 'Ventas', 'Ingresos', 'Margen %']
          const tableData = filteredData.slice(0, 50).map(product => [
            product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
            product.sku,
            product.category,
            product.stock_quantity,
            `$${(product.sale_price / 1000).toFixed(0)}K`,
            product.total_sales,
            `$${(product.revenue / 1000000).toFixed(1)}M`,
            `${product.margin.toFixed(1)}%`
          ])
          
          // Tabla de productos usando autoTable
          autoTable(doc, {
            startY: 165,
            head: [tableHeaders],
            body: tableData,
            styles: { 
              fontSize: 8,
              cellPadding: 4,
              lineColor: [200, 200, 200],
              lineWidth: 0.5
            },
            headStyles: { 
              fillColor: [54, 96, 146],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [248, 249, 250]
            },
            margin: { left: 40, right: 40 },
            didDrawPage: (data: any) => {
              // Footer
              const pageCount = doc.getNumberOfPages()
              const pageSize = doc.internal.pageSize
              
              doc.setFontSize(8)
              doc.setTextColor(150, 150, 150)
              doc.text(
                `Página ${data.pageNumber} de ${pageCount}`,
                pageSize.width - 100,
                pageSize.height - 30
              )
              
              doc.text(
                '4G Celulares - Sistema de Gestión',
                40,
                pageSize.height - 30
              )
            }
          })
          
          if (filteredData.length > 50) {
            doc.setFontSize(8)
            doc.setTextColor(150, 150, 150)
            doc.text(`Nota: Se muestran los primeros 50 productos de ${filteredData.length} total.`, 40, doc.internal.pageSize.height - 50)
          }
          
          doc.save(`${filename}.pdf`)
          console.log('✅ PDF de productos generado exitosamente')
          
        } catch (error) {
          console.error('❌ Error al generar PDF de productos:', error)
          throw error
        }
      }
      
      console.log(`✅ Reporte exportado exitosamente en formato ${fileFormat.toUpperCase()}`)
      
    } catch (error) {
      console.error('❌ Error al exportar:', error)
    } finally {
      setIsExporting(false)
    }
  }, [filteredData, metrics, selectedCategory, selectedStatus])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header mejorado */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/80 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Botón para volver atrás */}
              <Link href="/dashboard/reports">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Reportes
                </Button>
              </Link>
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 rounded-2xl shadow-lg dark:shadow-blue-500/20"
              >
                <BarChart3 className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Reportes de Productos
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  Análisis detallado de inventario, ventas y rentabilidad
                </p>
              </div>
            </div>
            
            {/* Botones de exportación mejorados */}
            <div className="flex items-center gap-3">
              {/* Exportación rápida */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportData('csv')}
                  disabled={isExporting}
                  className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-green-50 dark:hover:bg-green-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                  title="Exportar datos como CSV"
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                  CSV
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportData('excel')}
                  disabled={isExporting}
                  className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                  title="Exportar como Excel con múltiples hojas"
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  Excel
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportData('pdf')}
                  disabled={isExporting}
                  className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-red-50 dark:hover:bg-red-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                  title="Exportar reporte completo en PDF"
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  PDF
                </Button>
              </div>
              
              {/* Indicador de progreso */}
              {isExporting && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse"></div>
                  Procesando {filteredData.length} productos...
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Reporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Rango de Fechas</Label>
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={(range) => {
                    if (!range || !range.from || !range.to) {
                      setDateRange({ from: subMonths(new Date(), 1), to: new Date() })
                    } else {
                      setDateRange({ from: range.from, to: range.to })
                    }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    <SelectItem value="Smartphones">Smartphones</SelectItem>
                    <SelectItem value="Accesorios">Accesorios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="low_stock">Stock Bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Buscar Producto</Label>
                <Input
                  placeholder="Nombre o SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Productos</p>
                    <p className="text-2xl font-bold">{metrics.totalProducts}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="text-2xl font-bold">
                      ${(metrics.totalRevenue / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <GSIcon className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ganancia</p>
                    <p className="text-2xl font-bold">
                      ${(metrics.totalProfit / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas</p>
                    <p className="text-2xl font-bold">{metrics.totalSales}</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Margen Prom.</p>
                    <p className="text-2xl font-bold">{metrics.averageMargin.toFixed(1)}%</p>
                  </div>
                  <PieChart className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Bajo</p>
                    <p className="text-2xl font-bold">{metrics.lowStockProducts}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tabs de Reportes */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="profitability">Rentabilidad</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Productos Top por Ingresos */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Productos por Ingresos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProductsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          name === 'revenue' ? `$${value}M` : value,
                          name === 'revenue' ? 'Ingresos' : 'Ventas'
                        ]}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Distribución por Categoría */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={salesTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [
                        name === 'revenue' ? `$${(Number(value) / 1000000).toFixed(1)}M` : Number(value),
                        name === 'revenue' ? 'Ingresos' : 'Ventas'
                      ]}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            {/* Tabla de Inventario */}
            <Card>
              <CardHeader>
                <CardTitle>Estado del Inventario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Producto</th>
                        <th className="text-left p-2">SKU</th>
                        <th className="text-left p-2">Stock Actual</th>
                        <th className="text-left p-2">Stock Mínimo</th>
                        <th className="text-left p-2">Estado</th>
                        <th className="text-left p-2">Última Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((product) => (
                        <tr key={product.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{product.name}</td>
                          <td className="p-2 text-muted-foreground">{product.sku}</td>
                          <td className="p-2">{product.stock_quantity}</td>
                          <td className="p-2">{product.min_stock}</td>
                          <td className="p-2">
                            <Badge variant={product.stock_quantity <= product.min_stock ? 'destructive' : 'default'}>
                              {product.stock_quantity <= product.min_stock ? 'Stock Bajo' : 'Normal'}
                            </Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {format(new Date(product.last_sale), 'dd/MM/yyyy', { locale: es })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profitability" className="space-y-6">
            {/* Análisis de Rentabilidad */}
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Rentabilidad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Producto</th>
                        <th className="text-left p-2">Precio Venta</th>
                        <th className="text-left p-2">Precio Compra</th>
                        <th className="text-left p-2">Margen %</th>
                        <th className="text-left p-2">Ganancia Total</th>
                        <th className="text-left p-2">Ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData
                        .sort((a, b) => b.margin - a.margin)
                        .map((product) => (
                        <tr key={product.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{product.name}</td>
                          <td className="p-2">${product.sale_price.toLocaleString()}</td>
                          <td className="p-2">${product.purchase_price.toLocaleString()}</td>
                          <td className="p-2">
                            <Badge variant={product.margin > 30 ? 'default' : product.margin > 15 ? 'secondary' : 'destructive'}>
                              {product.margin.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-2 font-medium text-green-600">
                            ${(product.profit / 1000000).toFixed(2)}M
                          </td>
                          <td className="p-2">{product.total_sales}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

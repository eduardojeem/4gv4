'use client'

import React, { useState, useCallback, useMemo } from 'react'
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
  FileText,
  Calendar as CalendarIcon,
  Package,
  Wallet,
  AlertTriangle,
  Target,
  PieChart,
  RefreshCw,
  CheckCircle,
  XCircle,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'

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
  qualityRating: number
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

interface ReportSaleItemRow {
  product_id: string
  quantity: number
  subtotal: number
  products?: {
    name?: string | null
    purchase_price?: number | null
    category?: { name?: string | null } | null
  } | null
}

interface ReportSaleRow {
  total_amount: number
  sale_items: ReportSaleItemRow[]
}

interface ReportMovementRow {
  id: string
  created_at: string
  type?: string | null
  movement_type?: string | null
  quantity?: number | null
  reason?: string | null
  notes?: string | null
  product?: {
    name?: string | null
    purchase_price?: number | null
  } | null
}

interface ReportSupplierRow {
  id: string
  name: string
  rating?: number | null
}

type ReportProductRow = {
  id: string
  stock_quantity?: number | null
  sale_price?: number | null
  purchase_price?: number | null
  min_stock?: number | null
  category?: { name?: string | null } | null
}

const REPORT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16']

const REPORT_DATE_SLUG = () => new Date().toISOString().slice(0, 10)

async function exportInventoryExcel(data: ReportData) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.json_to_sheet([
    { metrica: 'Total productos', valor: data.totalProducts },
    { metrica: 'Valor inventario', valor: data.totalValue },
    { metrica: 'Stock bajo', valor: data.lowStockItems },
    { metrica: 'Sin stock', valor: data.outOfStockItems },
    { metrica: 'Margen promedio (%)', valor: data.averageMargin },
    { metrica: 'Ventas del periodo', valor: data.totalRevenue },
  ])

  const productsSheet = XLSX.utils.json_to_sheet(
    data.topSellingProducts.map((p) => ({
      producto: p.name,
      categoria: p.category,
      unidades: p.unitsSold,
      ingresos: p.revenue,
      ganancia: p.profit,
      margen: p.margin,
    }))
  )

  const categoriesSheet = XLSX.utils.json_to_sheet(
    data.categoryDistribution.map((c) => ({
      categoria: c.name,
      productos: c.productCount,
      valor: c.totalValue,
      participacion: c.percentage,
      margen_promedio: c.averageMargin,
    }))
  )

  const profitabilitySheet = XLSX.utils.json_to_sheet(
    data.profitabilityAnalysis.map((p) => ({
      producto: p.product,
      categoria: p.category,
      costo: p.cost,
      precio: p.price,
      margen: p.margin,
      ganancia_total: p.totalProfit,
    }))
  )

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')
  XLSX.utils.book_append_sheet(workbook, productsSheet, 'Productos')
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categorias')
  XLSX.utils.book_append_sheet(workbook, profitabilitySheet, 'Rentabilidad')

  XLSX.writeFile(workbook, `reporte_inventario_${REPORT_DATE_SLUG()}.xlsx`)
}

async function exportInventoryPdf(data: ReportData) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const getLastTableY = () => {
    const tableAwareDoc = doc as typeof doc & { lastAutoTable?: { finalY?: number } }
    return tableAwareDoc.lastAutoTable?.finalY ?? 96
  }

  doc.setFontSize(20)
  doc.text('Reporte de inventario', 40, 50)
  doc.setFontSize(10)
  doc.text(`Generado ${new Date().toLocaleDateString('es-PY')}`, 40, 70)

  autoTable(doc, {
    startY: 92,
    head: [['Metrica', 'Valor']],
    body: [
      ['Total productos', String(data.totalProducts)],
      ['Valor inventario', formatCurrency(data.totalValue)],
      ['Stock bajo', String(data.lowStockItems)],
      ['Sin stock', String(data.outOfStockItems)],
      ['Margen promedio', `${data.averageMargin}%`],
      ['Ventas del periodo', formatCurrency(data.totalRevenue)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  autoTable(doc, {
    startY: getLastTableY() + 24,
    head: [['Producto', 'Categoria', 'Unidades', 'Ingresos', 'Ganancia', 'Margen']],
    body: data.topSellingProducts.map((p) => [
      p.name,
      p.category,
      String(p.unitsSold),
      formatCurrency(p.revenue),
      formatCurrency(p.profit),
      `${p.margin}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  if (data.profitabilityAnalysis.length > 0) {
    doc.addPage()
    doc.setFontSize(16)
    doc.text('Rentabilidad por producto', 40, 50)
    autoTable(doc, {
      startY: 72,
      head: [['Producto', 'Categoria', 'Costo', 'Precio', 'Margen', 'Ganancia total']],
      body: data.profitabilityAnalysis.map((p) => [
        p.product,
        p.category,
        formatCurrency(p.cost),
        formatCurrency(p.price),
        `${p.margin}%`,
        formatCurrency(p.totalProfit),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 92, 246] },
    })
  }

  doc.save(`reporte_inventario_${REPORT_DATE_SLUG()}.pdf`)
}

// KPI card alineada al lenguaje del dashboard admin (border-l-4 + acento -500).
function InventoryKpiCard({
  title,
  value,
  accent,
  icon: Icon,
}: {
  title: string
  value: string
  accent: { border: string; icon: string }
  icon: LucideIcon
}) {
  return (
    <Card className={cn('border-l-4 shadow-sm', accent.border)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
          </div>
          <Icon className={cn('h-5 w-5', accent.icon)} />
        </div>
      </CardContent>
    </Card>
  )
}

const InventoryReports: React.FC = () => {
  const supabase = createClient()
  const { selectedBranchId } = useBranch()

  // Estados
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<{from: Date, to: Date}>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const generateReport = useCallback(async () => {
    setIsGenerating(true)
    setLoadError(null)
    try {
      // 1. Fetch Products for Aggregation (solo columnas usadas, con límite de seguridad)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id, name, stock_quantity, sale_price, purchase_price, min_stock, is_active,
          category:categories(name)
        `)
        .limit(2000)

      if (productsError) throw productsError

      const branchAwareProducts = await loadBranchInventoryStockMap(
        supabase as unknown as BranchInventoryClient,
        selectedBranchId,
        (products || []).map((product) => product.id)
      ).then(({ stockMap, branchScoped }) =>
        applyBranchInventoryToProducts(
          (products || []) as Array<{ id: string; stock_quantity?: number | null } & Record<string, unknown>>,
          stockMap,
          branchScoped
        )
      )

      // 2. Fetch Suppliers (solo columnas usadas)
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, rating')
        .limit(1000)

      if (suppliersError) throw suppliersError

      // 3. Fetch Stock Movements
      const { data: movements, error: movementsError } = await withBranchFilter(
        supabase
        .from('product_movements')
        .select(`
          id,
          created_at,
          type,
          movement_type,
          quantity,
          reason,
          notes,
          product:products(name, sale_price, purchase_price)
        `)
        .gte('created_at', selectedDateRange.from.toISOString())
        .lte('created_at', selectedDateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .limit(100),
        selectedBranchId
      ) // Limit for UI table

      if (movementsError) throw movementsError

      // 4. Fetch Sales (Using hook or direct query if hook doesn't support custom range efficiently for reports)
      // Since useSales is hook based, we can try to use it or just query directly for reports to avoid state conflicts
      const { data: salesData, error: salesError } = await withBranchFilter(
        supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          sale_items (
            product_id,
            quantity,
            subtotal,
            products (name, category:categories(name), purchase_price)
          )
        `)
        .gte('created_at', selectedDateRange.from.toISOString())
        .lte('created_at', selectedDateRange.to.toISOString()),
        selectedBranchId
      )

      if (salesError) throw salesError

      // --- CALCULATIONS ---

      // Inventory Stats
      const totalProducts = branchAwareProducts?.length || 0
      const totalValue = branchAwareProducts?.reduce((sum, p) => sum + (Number(p.stock_quantity || 0) * Number(p.purchase_price || 0)), 0) || 0
      const lowStockItems = branchAwareProducts?.filter(p => Number(p.stock_quantity || 0) <= Number(p.min_stock || 0) && Number(p.stock_quantity || 0) > 0).length || 0
      const outOfStockItems = branchAwareProducts?.filter(p => Number(p.stock_quantity || 0) === 0).length || 0
      const totalSuppliers = suppliers?.length || 0
      
      // Category Distribution
      const categoryMap = new Map<string, { count: number; value: number; marginSum: number }>()
      branchAwareProducts?.forEach(p => {
        const product = p as ReportProductRow
        const catName = product.category?.name || 'Sin Categoria'
        const current = categoryMap.get(catName) || { count: 0, value: 0, marginSum: 0 }
        
        const salePrice = Number(p.sale_price || 0)
        const purchasePrice = Number(p.purchase_price || 0)
        const margin = salePrice > 0 ? ((salePrice - purchasePrice) / salePrice) * 100 : 0
        
        categoryMap.set(catName, {
          count: current.count + 1,
          value: current.value + (Number(p.stock_quantity || 0) * purchasePrice),
          marginSum: current.marginSum + margin
        })
      })

      const categoryDistribution: CategoryData[] = Array.from(categoryMap.entries()).map(([name, data], index) => ({
        name,
        productCount: data.count,
        totalValue: data.value,
        percentage: totalValue > 0 ? Number(((data.value / totalValue) * 100).toFixed(1)) : 0,
        averageMargin: data.count > 0 ? Number((data.marginSum / data.count).toFixed(1)) : 0,
        color: REPORT_COLORS[index % REPORT_COLORS.length]
      })).sort((a, b) => b.totalValue - a.totalValue)

      const totalCategories = categoryDistribution.length
      const averageMargin = branchAwareProducts && branchAwareProducts.length > 0 
        ? branchAwareProducts.reduce((sum, p) => {
            const salePrice = Number(p.sale_price || 0)
            const purchasePrice = Number(p.purchase_price || 0)
            const m = salePrice > 0 ? ((salePrice - purchasePrice) / salePrice) * 100 : 0
            return sum + m
          }, 0) / branchAwareProducts.length
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

      ;((salesData || []) as ReportSaleRow[]).forEach((sale) => {
        totalRevenue += Number(sale.total_amount || 0)
        const items = sale.sale_items || []
        if (Array.isArray(items)) {
          items.forEach((item) => {
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
              units: current.units + Number(item.quantity || 0),
              revenue: current.revenue + Number(item.subtotal || 0),
              cost: current.cost + (Number(item.quantity || 0) * Number(unitCost || 0))
            })
          })
        }
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
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
      // Nota: no recortamos aqui; el slice se aplica despues del filtro por categoria
      // (ver filteredProducts) para que filtrar no vacie la tabla por culpa de un top-N global.

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
      // Sin slice aqui: se recorta tras filtrar por categoria (ver filteredProfitability).

      // Stock Movements
      const stockMovements: StockMovement[] = ((movements || []) as ReportMovementRow[]).map((m) => ({
        id: m.id,
        date: new Date(m.created_at),
        type: (m.type || m.movement_type || 'ajuste') as StockMovement['type'],
        product: m.product?.name || 'Desconocido',
        quantity: Number(m.quantity || 0),
        value: Math.abs(Number(m.quantity || 0) * Number(m.product?.purchase_price || 0)), // Estimado
        reason: m.reason || m.notes || '',
      }))

      // Supplier Performance: solo exponemos lo que existe de verdad en la tabla (rating).
      // No hay tabla de ordenes ni tiempos de entrega reales, asi que no inventamos metricas.
      const supplierPerformance: SupplierData[] = ((suppliers || []) as ReportSupplierRow[]).map((s) => ({
        id: s.id,
        name: s.name,
        qualityRating: Number(s.rating || 0),
        status: Number(s.rating || 0) >= 4 ? 'excellent' : Number(s.rating || 0) >= 3 ? 'good' : 'average'
      }))

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
        profitabilityAnalysis
      })

    } catch (error) {
      const msg = error instanceof Error
        ? error.stack || error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as any).message)
          : JSON.stringify(error)
      console.error('Error generating report:', msg)
      setLoadError(
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error
            ? String((error as any).message)
            : 'No se pudo generar el reporte de inventario.'
      )
    } finally {
      setIsGenerating(false)
    }
  }, [selectedBranchId, supabase, selectedDateRange])

  // Datos filtrados por los selectores de Categoría / Proveedor.
  // El recorte (top-N) se aplica DESPUÉS del filtro para que elegir una categoría
  // no vacíe la tabla por culpa de un top global calculado sobre todas las categorías.
  const filteredProducts = useMemo(
    () => (reportData?.topSellingProducts || [])
      .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
      .slice(0, 10),
    [reportData, selectedCategory]
  )
  const filteredProfitability = useMemo(
    () => (reportData?.profitabilityAnalysis || [])
      .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
      .slice(0, 20),
    [reportData, selectedCategory]
  )
  const filteredCategories = useMemo(
    () => (reportData?.categoryDistribution || []).filter(
      (c) => selectedCategory === 'all' || c.name === selectedCategory
    ),
    [reportData, selectedCategory]
  )
  const filteredSuppliers = useMemo(
    () => (reportData?.supplierPerformance || []).filter(
      (s) => selectedSupplier === 'all' || s.id === selectedSupplier
    ),
    [reportData, selectedSupplier]
  )

  const exportReport = async (exportFormat: 'pdf' | 'excel') => {
    if (!reportData) return
    setIsExporting(true)
    try {
      // Exportamos lo que el usuario está viendo (respeta los filtros activos).
      const exportData: ReportData = {
        ...reportData,
        topSellingProducts: filteredProducts,
        profitabilityAnalysis: filteredProfitability,
        categoryDistribution: filteredCategories,
        supplierPerformance: filteredSuppliers,
      }
      if (exportFormat === 'excel') {
        await exportInventoryExcel(exportData)
        toast.success('Excel generado')
      } else {
        await exportInventoryPdf(exportData)
        toast.success('PDF generado')
      }
    } catch (error) {
      console.error('Error exportando reporte:', error)
      toast.error(`No se pudo generar el ${exportFormat === 'excel' ? 'Excel' : 'PDF'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'average': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'poor': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'salida': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'ajuste': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'transferencia': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (loadError && !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <XCircle className="h-10 w-10 mx-auto mb-4 text-red-500 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No se pudo cargar el reporte</h3>
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <Button onClick={generateReport} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <BarChart3 className="h-10 w-10 mx-auto mb-4 text-blue-500" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Generar reporte de inventario</h3>
          <p className="text-sm text-muted-foreground mb-4">
            El reporte consulta productos, proveedores, movimientos y ventas. Generalo solo cuando necesites analizar o exportar la informacion.
          </p>
          <Button onClick={generateReport} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generando...' : 'Generar reporte'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Reportes de inventario</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Stock, categorías, proveedores, movimientos y rentabilidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportReport('pdf')} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport('excel')} disabled={isExporting}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={generateReport} disabled={isGenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
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
              <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Categoría</Label>
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
              <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">Proveedor</Label>
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
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales (estilo dashboard: borde lateral + acento -500) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InventoryKpiCard
          title="Total productos"
          value={reportData.totalProducts.toLocaleString()}
          accent={{ border: 'border-l-blue-500', icon: 'text-blue-500' }}
          icon={Package}
        />
        <InventoryKpiCard
          title="Valor inventario"
          value={formatCurrency(reportData.totalValue)}
          accent={{ border: 'border-l-emerald-500', icon: 'text-emerald-500' }}
          icon={Wallet}
        />
        <InventoryKpiCard
          title="Margen promedio"
          value={`${reportData.averageMargin}%`}
          accent={{ border: 'border-l-violet-500', icon: 'text-violet-500' }}
          icon={Target}
        />
        <InventoryKpiCard
          title="Ventas del período"
          value={formatCurrency(reportData.totalRevenue)}
          accent={{ border: 'border-l-amber-500', icon: 'text-amber-500' }}
          icon={TrendingUp}
        />
      </div>

      {/* Tabs de Reportes */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
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
            <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-foreground">
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
            <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-foreground">
                  <PieChart className="h-5 w-5 mr-2 text-blue-600" />
                  Distribución por Categorías
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.categoryDistribution.slice(0, 5).map((category) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium dark:text-gray-300">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{category.percentage}%</p>
                        <p className="text-xs text-muted-foreground">{category.productCount} productos</p>
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
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Productos Más Vendidos</CardTitle>
              <CardDescription className="dark:text-gray-400">Top 10 productos por ventas y rentabilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-left py-3 dark:text-gray-300">Categoría</th>
                      <th className="text-right py-3 dark:text-gray-300">Unidades</th>
                      <th className="text-right py-3 dark:text-gray-300">Ingresos</th>
                      <th className="text-right py-3 dark:text-gray-300">Ganancia</th>
                      <th className="text-right py-3 dark:text-gray-300">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">No hay datos de ventas para este período</td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-muted/50">
                          <td className="py-3 font-medium text-foreground">{product.name}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-muted-foreground">{product.category}</Badge>
                          </td>
                          <td className="text-right py-3 dark:text-gray-300">{product.unitsSold.toLocaleString()}</td>
                          <td className="text-right py-3 dark:text-gray-300">{formatCurrency(product.revenue)}</td>
                          <td className="text-right py-3 dark:text-gray-300">{formatCurrency(product.profit)}</td>
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
            {filteredCategories.map((category) => (
              <Card key={category.name} className="border border-gray-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-foreground">
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
                      <span className="text-sm text-muted-foreground">Productos:</span>
                      <span className="font-semibold text-foreground">{category.productCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valor Total:</span>
                      <span className="font-semibold text-foreground">{formatCurrency(category.totalValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Participación:</span>
                      <span className="font-semibold text-foreground">{category.percentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Margen Promedio:</span>
                      <span className="font-semibold text-foreground">{category.averageMargin}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Proveedores */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Rendimiento de Proveedores</CardTitle>
              <CardDescription className="dark:text-gray-400">Listado de proveedores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 dark:text-gray-300">Proveedor</th>
                      <th className="text-right py-3 dark:text-gray-300">Calidad</th>
                      <th className="text-center py-3 dark:text-gray-300">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-gray-500">No hay proveedores registrados</td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-muted/50">
                          <td className="py-3 font-medium text-foreground">{supplier.name}</td>
                          <td className="text-right py-3">
                            <div className="flex items-center justify-end">
                              <Star className="h-4 w-4 text-yellow-400 mr-1" />
                              <span className="dark:text-gray-300">{supplier.qualityRating}</span>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <Badge className={getStatusColor(supplier.status)}>
                              {supplier.status.toUpperCase()}
                            </Badge>
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

        {/* Tab: Movimientos */}
        <TabsContent value="movements" className="space-y-6">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Movimientos de Stock Recientes</CardTitle>
              <CardDescription className="dark:text-gray-400">Historial de entradas, salidas y ajustes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 dark:text-gray-300">Fecha</th>
                      <th className="text-left py-3 dark:text-gray-300">Tipo</th>
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-right py-3 dark:text-gray-300">Cantidad</th>
                      <th className="text-right py-3 dark:text-gray-300">Valor</th>
                      <th className="text-left py-3 dark:text-gray-300">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.stockMovements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-muted/50">
                        <td className="py-3 dark:text-gray-300">{format(movement.date, 'dd/MM/yyyy')}</td>
                        <td className="py-3">
                          <Badge className={getMovementTypeColor(movement.type)}>
                            {movement.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 font-medium text-foreground">{movement.product}</td>
                        <td className="text-right py-3">
                          <span className={movement.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </td>
                        <td className="text-right py-3">
                          <span className={movement.value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatCurrency(Math.abs(movement.value))}
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
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Análisis de Rentabilidad</CardTitle>
              <CardDescription className="dark:text-gray-400">Basado en ventas registradas en el período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 dark:text-gray-300">Producto</th>
                      <th className="text-left py-3 dark:text-gray-300">Categoría</th>
                      <th className="text-right py-3 dark:text-gray-300">Costo Est.</th>
                      <th className="text-right py-3 dark:text-gray-300">Precio Prom.</th>
                      <th className="text-right py-3 dark:text-gray-300">Margen %</th>
                      <th className="text-right py-3 dark:text-gray-300">Ganancia Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProfitability.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">No hay ventas registradas para analizar rentabilidad</td>
                      </tr>
                    ) : (
                      filteredProfitability.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/50">
                          <td className="py-3 font-medium text-foreground">{item.product}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-muted-foreground">{item.category}</Badge>
                          </td>
                          <td className="text-right py-3 dark:text-gray-300">{formatCurrency(item.cost)}</td>
                          <td className="text-right py-3 dark:text-gray-300">{formatCurrency(item.price)}</td>
                          <td className="text-right py-3">
                            <span className={`font-semibold ${item.margin >= 30 ? 'text-green-600 dark:text-green-400' : item.margin >= 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                              {item.margin}%
                            </span>
                          </td>
                          <td className="text-right py-3 font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(item.totalProfit)}
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

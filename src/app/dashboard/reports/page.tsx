'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { ChartExporter } from '@/components/reports/ChartExporter'
import { useSubscriptionStatus, canExportReports } from '@/contexts/SubscriptionStatusContext'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar as CalendarIcon,
  Download,
  Filter,
  Loader2,
  AlertCircle,
  BarChart3,
  Wrench,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { chartColors } from '@/utils/chart-utils'
import { logger } from '@/lib/logger'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { ReportsProductsTab } from '@/components/reports/ReportsProductsTab'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { chunkQueryValues } from '@/lib/analytics/query-batches'

// Sanitiza una celda CSV: previene inyección de fórmulas y escapa comas/comillas/saltos.
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

interface SalesData {
  date: string
  sales: number
  orders: number
  customers: number
}

interface ProductData {
  id?: string
  name: string
  sales: number
  quantity: number
  profit: number
  category?: string
  share?: number
}

interface CategoryData {
  name: string
  sales: number
  quantity: number
  color: string
}

interface KpiDelta {
  sales: number | null
  orders: number | null
  customers: number | null
  aov: number | null
}

export default function ReportsPage() {
  const { selectedBranchId } = useBranch()
  const { planCode, organizationName, effectiveModules } = useSubscriptionStatus()
  const hasRepairs = effectiveModules.includes('repairs')
  const canExport = canExportReports(planCode) // exportar/descargar: Basic en adelante
  const canViewCost = useCanViewCost()
  const reportBrand = organizationName || 'Mi Negocio'
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [productData, setProductData] = useState<ProductData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [customersNewCount, setCustomersNewCount] = useState(0)
  const [retentionRate, setRetentionRate] = useState(0)
  const [avgPurchasesPerCustomer, setAvgPurchasesPerCustomer] = useState(0)
  const [productTopCount, setProductTopCount] = useState(5)
  const [productSortBy, setProductSortBy] = useState<'sales' | 'quantity'>('sales')
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedProductTrend, setSelectedProductTrend] = useState<{ date: string; sales: number; qty: number }[]>([])
  const [repairsTrend, setRepairsTrend] = useState<{ date: string; count: number }[]>([])
  const [repairsStatusDist, setRepairsStatusDist] = useState<{ name: string; value: number; color: string }[]>([])
  const [repairsMetrics, setRepairsMetrics] = useState<{ total: number; completionRate: number; avgCost: number; avgTATDays: number; avgLabor: number; avgParts: number }>({ total: 0, completionRate: 0, avgCost: 0, avgTATDays: 0, avgLabor: 0, avgParts: 0 })
  const [categoryTopCount, setCategoryTopCount] = useState(5)
  const [categoryMetricBy, setCategoryMetricBy] = useState<'sales' | 'quantity'>('sales')
  const [categoryChartType, setCategoryChartType] = useState<'pie' | 'bar'>('pie')
  const [categoryDateRange, setCategoryDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })
  const [categoryMinSales, setCategoryMinSales] = useState<number>(0)
  const [saleItemsAll, setSaleItemsAll] = useState<any[]>([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [kpiDelta, setKpiDelta] = useState<KpiDelta>({ sales: null, orders: null, customers: null, aov: null })
  
  // Estado para controlar refrescos por tiempo real
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Referencias para exportación
  const salesChartRef = useRef<HTMLDivElement>(null)
  const repairsChartRef = useRef<HTMLDivElement>(null)
  const repairsStatusRef = useRef<HTMLDivElement>(null)
  const productsChartRef = useRef<HTMLDivElement>(null)
  const productTrendRef = useRef<HTMLDivElement>(null)
  const categoriesChartRef = useRef<HTMLDivElement>(null)
  const toLocalDateKey = useCallback((value: string | Date) => {
    const d = new Date(value)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const visibleProducts = useMemo(() => {
    const totalProductSales = productData.reduce((s, p) => s + p.sales, 0)
    const filtered = productCategoryFilter === 'all' ? productData : productData.filter((p) => p.category === productCategoryFilter)
    const sorted = [...filtered].sort((a, b) => productSortBy === 'sales' ? b.sales - a.sales : b.quantity - a.quantity)
    return sorted.slice(0, productTopCount).map((p) => ({ ...p, share: totalProductSales > 0 ? (p.sales / totalProductSales) * 100 : 0 }))
  }, [productData, productCategoryFilter, productSortBy, productTopCount])

  useEffect(() => {
    const byDate: Record<string, { sales: number; qty: number }> = {}
    if (!selectedProductId) {
      setSelectedProductTrend([])
      return
    }
    (saleItemsAll as any[]).forEach((item: any) => {
      const status = item?.sale?.status
      const created = item?.sale?.created_at ? new Date(item.sale.created_at) : null
      if (!isCompletedSaleStatus(status) || !created) return
      if (created < dateRange.from || created > dateRange.to) return
      const key = String(item.product_id || '')
      if (!key || key !== selectedProductId) return
      const day = toLocalDateKey(created)
      const qty = Number(item.quantity) || 0
      const sales = Number(item.subtotal ?? qty * Number(item.unit_price ?? 0)) || 0
      if (!byDate[day]) byDate[day] = { sales: 0, qty: 0 }
      byDate[day].sales += sales
      byDate[day].qty += qty
    })
    const trend = Object.entries(byDate)
      .map(([date, v]) => ({ date, sales: v.sales, qty: v.qty }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    setSelectedProductTrend(trend)
  }, [saleItemsAll, selectedProductId, dateRange, toLocalDateKey])

  const categoryComputed = useMemo(() => {
    const aggMap: Record<string, { sales: number; quantity: number; color: string; name: string }> = {}
    const palette = chartColors.getColorPalette((saleItemsAll as any[]).length || 1)
    ;(saleItemsAll as any[]).forEach((item: any, idx: number) => {
      const status = item?.sale?.status
      const created = item?.sale?.created_at ? new Date(item.sale.created_at) : null
      if (!isCompletedSaleStatus(status) || !created) return
      if (created < categoryDateRange.from || created > categoryDateRange.to) return
      const name = item.product?.category?.name || 'Sin categoría'
      const qty = Number(item.quantity) || 0
      const sales = Number(item.subtotal ?? qty * Number(item.unit_price ?? 0)) || 0
      if (!aggMap[name]) {
        aggMap[name] = {
          sales: 0,
          quantity: 0,
          color: palette[idx % palette.length],
          name
        }
      }
      aggMap[name].sales += sales
      aggMap[name].quantity += qty
    })
    const data: CategoryData[] = Object.values(aggMap).filter(c => c.sales >= categoryMinSales)
    const totalSales = data.reduce((s, c) => s + c.sales, 0)
    const totalQty = data.reduce((s, c) => s + c.quantity, 0)
    const sorted = [...data].sort((a, b) => categoryMetricBy === 'sales' ? b.sales - a.sales : b.quantity - a.quantity)
    const top = sorted.slice(0, categoryTopCount)
    const rest = sorted.slice(categoryTopCount)
    const othersValue = categoryMetricBy === 'sales' ? rest.reduce((s, c) => s + c.sales, 0) : rest.reduce((s, c) => s + c.quantity, 0)
    const visible = othersValue > 0
      ? [
          ...top,
          {
            name: 'Otros',
            sales: categoryMetricBy === 'sales' ? othersValue : 0,
            quantity: categoryMetricBy === 'quantity' ? othersValue : 0,
            color: '#e5e7eb'
          }
        ]
      : top
    return { data, totalSales, totalQty, visible }
  }, [saleItemsAll, categoryDateRange, categoryMinSales, categoryMetricBy, categoryTopCount])

  // Estado de carga
  const [loading, setLoading] = useState(true)

  // Configurar suscripciones en tiempo real
  useEffect(() => {
    const supabase = createClient()
    const channels: RealtimeChannel[] = []
    
    // Función debounce para evitar múltiples refrescos simultáneos
    let timeout: NodeJS.Timeout
    const handleUpdate = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1)
      }, 1000)
    }

    const tables = [
      'sales',
      'sale_items',
      'customers',
      ...(hasRepairs ? ['repairs'] : []),
    ]
    
    tables.forEach(table => {
      const channel = supabase
        .channel(`realtime-reports-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table },
          () => {
            logger.info(`[Reports] Cambio detectado en ${table}`)
            handleUpdate()
          }
        )
        .subscribe()
      channels.push(channel)
    })

    return () => {
      if (timeout) clearTimeout(timeout)
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [hasRepairs])

  // Cargar datos reales de Supabase
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setLoading(true)
        setErrorMsg(null)
        const supabase = createClient()
        const periodMs = Math.max(1, dateRange.to.getTime() - dateRange.from.getTime())
        const previousTo = new Date(dateRange.from.getTime() - 1)
        const previousFrom = new Date(previousTo.getTime() - periodMs)

        // Obtener ventas del periodo actual
        const { data: sales, error: salesError } = await withBranchFilter(
          supabase
            .from('sales')
            .select('id, created_at, total_amount, status, customer_id')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString())
            .order('created_at', { ascending: true }),
          selectedBranchId
        )

        if (salesError) throw salesError
        const safeSales = sales ?? []
        const completedSales = safeSales.filter(sale => isCompletedSaleStatus((sale as any).status))

        // Datos de clientes actual + periodo anterior y ventas periodo anterior
        const [{ data: previousSales, error: previousSalesError }, { data: newCustomers, error: customersError }, { data: previousCustomers, error: previousCustomersError }] = await Promise.all([
          withBranchFilter(
            supabase
              .from('sales')
              .select('id, total_amount, status')
              .gte('created_at', previousFrom.toISOString())
              .lte('created_at', previousTo.toISOString()),
            selectedBranchId
          ),
          supabase
            .from('customers')
            .select('created_at')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase
            .from('customers')
            .select('created_at')
            .gte('created_at', previousFrom.toISOString())
            .lte('created_at', previousTo.toISOString())
        ])

        if (previousSalesError) throw previousSalesError
        if (customersError) throw customersError
        if (previousCustomersError) throw previousCustomersError
        const safeCustomers = newCustomers ?? []
        const safePreviousCustomers = previousCustomers ?? []
        const safePreviousSales = previousSales ?? []
        const previousCompletedSales = safePreviousSales.filter((sale: any) => isCompletedSaleStatus(sale.status))

        const sumSales = (rows: any[]) => rows.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0)
        const currentSalesTotal = sumSales(completedSales as any[])
        const previousSalesTotal = sumSales(previousCompletedSales as any[])
        const currentOrdersCount = completedSales.length
        const previousOrdersCount = previousCompletedSales.length
        const currentAov = currentOrdersCount > 0 ? currentSalesTotal / currentOrdersCount : 0
        const previousAov = previousOrdersCount > 0 ? previousSalesTotal / previousOrdersCount : 0

        const pctChange = (current: number, previous: number): number | null => {
          if (previous <= 0) return null
          return ((current - previous) / previous) * 100
        }

        setKpiDelta({
          sales: pctChange(currentSalesTotal, previousSalesTotal),
          orders: pctChange(currentOrdersCount, previousOrdersCount),
          customers: pctChange(safeCustomers.length, safePreviousCustomers.length),
          aov: pctChange(currentAov, previousAov)
        })

        // Obtener items de venta para análisis de productos y categorías
        const itemsFrom = dateRange.from <= categoryDateRange.from ? dateRange.from : categoryDateRange.from
        const itemsTo = dateRange.to >= categoryDateRange.to ? dateRange.to : categoryDateRange.to
        const { data: itemSales, error: itemSalesError } = await withBranchFilter(
          supabase
            .from('sales')
            .select('id, created_at, status')
            .gte('created_at', itemsFrom.toISOString())
            .lte('created_at', itemsTo.toISOString()),
          selectedBranchId
        )
        if (itemSalesError) throw itemSalesError
        const safeItemSales = itemSales ?? []
        const completedSalesForItems = safeItemSales.filter((sale: any) => isCompletedSaleStatus(sale.status))
        const completedSalesForItemsById = new Map(completedSalesForItems.map((sale: any) => [sale.id, sale]))

        let safeSaleItems: any[] = []
        if (completedSalesForItems.length > 0) {
          const saleIds = completedSalesForItems.map((sale: any) => sale.id)
          const saleItemResults = await Promise.all(
            chunkQueryValues(saleIds).map((saleIdBatch) =>
              supabase
                .from('sale_items')
                .select(`
                  sale_id,
                  product_id,
                  quantity,
                  unit_price,
                  subtotal,
                  product:products (
                    id,
                    name,
                    purchase_price,
                    category:categories (
                      name
                    )
                  )
                `)
                .in('sale_id', saleIdBatch)
            )
          )
          const itemsError = saleItemResults.find((result) => result.error)?.error
          if (itemsError) throw itemsError
          const saleItems = saleItemResults.flatMap((result) => result.data ?? [])
          const safeSaleItemsRaw = saleItems
          safeSaleItems = safeSaleItemsRaw.map((item: any) => {
            const sale = completedSalesForItemsById.get(item.sale_id)
            return {
              ...item,
              sale: sale ? { created_at: sale.created_at, status: sale.status } : null
            }
          })
        }
        setSaleItemsAll(safeSaleItems as any[])
        // Procesar datos para el gráfico de ventas
        const salesByDate: Record<string, { sales: number; orders: number; customers: number }> = {}
        const ordersByCustomer: Record<string, number> = {}
        
        // Inicializar con ventas
        safeSales.forEach(sale => {
          if (!isCompletedSaleStatus(sale.status)) return
          
          const date = toLocalDateKey(sale.created_at)
          if (!salesByDate[date]) {
            salesByDate[date] = { sales: 0, orders: 0, customers: 0 }
          }
          const totalValue = Number((sale as any).total_amount) || 0
          salesByDate[date].sales += totalValue
          salesByDate[date].orders += 1
          const cid = (sale as any).customer_id || 'no_customer'
          ordersByCustomer[cid] = (ordersByCustomer[cid] || 0) + 1
        })

        // Agregar datos de clientes
        safeCustomers.forEach(customer => {
          const date = toLocalDateKey(customer.created_at)
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

        setCustomersNewCount(safeCustomers.length)
        const customersWithOrders = Object.keys(ordersByCustomer).filter(k => k !== 'no_customer')
        const repeatCustomers = customersWithOrders.filter(k => (ordersByCustomer[k] || 0) >= 2)
        const uniqueCustomersCount = customersWithOrders.length
        setRetentionRate(uniqueCustomersCount > 0 ? (repeatCustomers.length / uniqueCustomersCount) * 100 : 0)
        const totalOrders = processedSalesData.reduce((sum, item) => sum + item.orders, 0)
        setAvgPurchasesPerCustomer(uniqueCustomersCount > 0 ? totalOrders / uniqueCustomersCount : 0)

        const { data: repairsData, error: repairsError } = hasRepairs ? await withBranchFilter(
          supabase
            .from('repairs')
            .select('id, created_at, received_at, completed_at, status, final_cost, labor_cost, parts_cost')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          selectedBranchId
        ) : { data: [], error: null }

        if (repairsError) throw repairsError
        const safeRepairs = repairsData ?? []

        const trendMap: Record<string, number> = {}
        const statusMap: Record<string, number> = {}
        let completed = 0
        let totalCost = 0
        let totalLabor = 0
        let totalParts = 0
        let costedCount = 0
        let tatSumDays = 0
        let tatCount = 0

        safeRepairs.forEach((r: any) => {
          // Se agrupa por created_at, el mismo campo que filtra la consulta
          // de arriba (gte/lte dateRange). Antes se agrupaba por
          // received_at cuando existía, y como esa fecha puede caer fuera
          // del rango elegido, el gráfico de tendencia mostraba barras en
          // fechas que el usuario nunca seleccionó.
          const dateKey = r.created_at ? toLocalDateKey(r.created_at) : null
          if (dateKey) trendMap[dateKey] = (trendMap[dateKey] || 0) + 1

          const st = r.status || 'desconocido'
          statusMap[st] = (statusMap[st] || 0) + 1

          const fc = Number(r.final_cost) || 0
          const lc = Number(r.labor_cost) || 0
          const pc = Number(r.parts_cost) || 0
          totalCost += fc
          totalLabor += lc
          totalParts += pc
          // Solo cuenta para el promedio de costo si ya tiene costo cargado:
          // si no, dividir por el total de reparaciones (incluidas las que
          // todavía están en diagnóstico/reparación, sin cotizar) hundía el
          // promedio artificialmente.
          if (fc > 0 || lc > 0 || pc > 0) costedCount += 1

          if (r.status === 'entregado' && r.received_at && r.completed_at) {
            completed += 1
            const start = new Date(r.received_at).getTime()
            const end = new Date(r.completed_at).getTime()
            const days = Math.max(0, (end - start) / (1000 * 60 * 60 * 24))
            tatSumDays += days
            tatCount += 1
          }
        })

        const trendList = Object.entries(trendMap)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setRepairsTrend(trendList)

        const statusEntries = Object.entries(statusMap)
        const statusColors = chartColors.getColorPalette(statusEntries.length || 1)
        const statuses = statusEntries
          .map(([name, value], idx) => ({
            name,
            value,
            color: statusColors[idx % statusColors.length]
          }))
          .sort((a, b) => b.value - a.value)
        setRepairsStatusDist(statuses)

        const totalRepairs = safeRepairs.length
        const completionRate = totalRepairs > 0 ? (completed / totalRepairs) * 100 : 0
        const avgCost = costedCount > 0 ? totalCost / costedCount : 0
        const avgLabor = costedCount > 0 ? totalLabor / costedCount : 0
        const avgParts = costedCount > 0 ? totalParts / costedCount : 0
        const avgTATDays = tatCount > 0 ? tatSumDays / tatCount : 0
        setRepairsMetrics({ total: totalRepairs, completionRate, avgCost, avgTATDays, avgLabor, avgParts })

        // Procesar datos de productos
        const productStats: Record<string, { id?: string; name: string; sales: number; quantity: number; category: string; profit: number }> = {}
        const categorySales: Record<string, number> = {}
        const categoryQty: Record<string, number> = {}
        let overallProfit = 0

        safeSaleItems.forEach((item: any) => {
          // safeSaleItems se trae con el rango ampliado (unión con
          // categoryDateRange, que tiene su propio selector de fecha
          // independiente) para que el gráfico de categorías pueda cubrir
          // su propia ventana. Acá hay que volver a acotar al dateRange
          // principal: si no, "Top Productos" y "Ganancia Estimada" traían
          // ventas de fuera del período que el usuario eligió arriba.
          const itemCreated = item?.sale?.created_at ? new Date(item.sale.created_at) : null
          if (!itemCreated || itemCreated < dateRange.from || itemCreated > dateRange.to) return

          const pid = item.product_id || item.product?.id
          const productName = item.product?.name || 'Desconocido'
          const categoryName = item.product?.category?.name || 'Sin categoría'
          const quantity = Number(item.quantity) || 0
          const unitPrice = Number(item.unit_price) || 0
          const purchasePrice = Number(item.product?.purchase_price) || 0
          const total = Number(item.subtotal ?? quantity * unitPrice) || 0
          const profit = total - (quantity * purchasePrice)

          overallProfit += profit

          // Productos
          const key = String(pid || productName)
          if (!productStats[key]) {
            productStats[key] = { id: pid, name: productName, sales: 0, quantity: 0, category: categoryName, profit: 0 }
          }
          productStats[key].sales += total
          productStats[key].quantity += quantity
          productStats[key].profit += profit

          // Categorías
          categorySales[categoryName] = (categorySales[categoryName] || 0) + total
          categoryQty[categoryName] = (categoryQty[categoryName] || 0) + quantity
        })
        
        setTotalProfit(overallProfit)

        // Top 5 Productos
        const processedProductData: ProductData[] = Object.values(productStats)
          .map((stats) => ({
            id: stats.id,
            name: stats.name,
            sales: stats.sales,
            quantity: stats.quantity,
            profit: stats.profit,
            category: stats.category
          }))
          .sort((a, b) => b.sales - a.sales)

        setProductData(processedProductData)

        // Categorías
        const allCategoryNames = Array.from(new Set([...Object.keys(categorySales), ...Object.keys(categoryQty)]))
        const categoryColorsPalette = chartColors.getColorPalette(allCategoryNames.length || 1)
        const processedCategoryData: CategoryData[] = allCategoryNames
          .map((name, index) => ({
            name,
            sales: categorySales[name] || 0,
            quantity: categoryQty[name] || 0,
            color: categoryColorsPalette[index % categoryColorsPalette.length]
          }))
          .sort((a, b) => b.sales - a.sales)

        setCategoryData(processedCategoryData)
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
        logger.error('Error fetching reports data', { error: msg })
        setErrorMsg(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchReportsData()
  }, [categoryDateRange, dateRange, hasRepairs, refreshTrigger, selectedBranchId, toLocalDateKey])

  useEffect(() => {
    const now = new Date()
    if (selectedPeriod === '7d') {
      setDateRange({ from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now })
    } else if (selectedPeriod === '30d') {
      setDateRange({ from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now })
    } else if (selectedPeriod === '90d') {
      setDateRange({ from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to: now })
    } else if (selectedPeriod === '1y') {
      setDateRange({ from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now })
    }
  }, [selectedPeriod])

  const formatPrice = (price: number) => {
    return `Gs${(price / 1000000).toFixed(1)}M`
  }

  const formatFullPrice = (price: number) => {
    return `Gs${price.toLocaleString()}`
  }

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0)
  const totalOrders = salesData.reduce((sum, item) => sum + item.orders, 0)
  const totalCustomers = salesData.reduce((sum, item) => sum + item.customers, 0)
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
  const formatDelta = (value: number | null) => value === null ? 'N/A' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`

  const exportReport = (type: string) => {
    try {
    const BOM = '\uFEFF'
    if (type === 'ventas') {
      const headers = ['Fecha','Ventas','Órdenes','Clientes']
      const rows = salesData.map(d => [d.date, d.sales, d.orders, d.customers])
      const csv = [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-ventas-${new Date().toISOString().slice(0,10)}.csv`
      a.click(); window.URL.revokeObjectURL(url)
      if (rows.length === 0) {
        toast.warning('CSV descargado, pero no hay ventas en el período seleccionado.')
      } else {
        toast.success(`CSV de ventas descargado (${rows.length} fila${rows.length === 1 ? '' : 's'}).`)
      }
    } else if (type === 'reparaciones') {
      const headers = ['Fecha','Cantidad']
      const rows = repairsTrend.map(d => [d.date, d.count])
      const csv = [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-reparaciones-${new Date().toISOString().slice(0,10)}.csv`
      a.click(); window.URL.revokeObjectURL(url)
      if (rows.length === 0) {
        toast.warning('CSV descargado, pero no hay reparaciones en el período seleccionado.')
      } else {
        toast.success(`CSV de reparaciones descargado (${rows.length} fila${rows.length === 1 ? '' : 's'}).`)
      }
    }
    } catch (error) {
      logger.error('Error exporting CSV report', { type, error })
      toast.error('No se pudo generar el CSV.', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const salesLineColor = chartColors.primary[0]
  const repairsLineColor = chartColors.danger[0]
  const productSalesColor = chartColors.primary[0]
  const productQuantityColor = chartColors.success[0]
  const selectedProductSalesColor = chartColors.primary[1] || chartColors.primary[0]
  const selectedProductQtyColor = chartColors.success[1] || chartColors.success[0]
  const categoriesBarColor = chartColors.info[0]

  // `loading` se seteaba pero nunca se leía: la página siempre pintaba KPIs
  // en cero y gráficos vacíos mientras cargaba, en vez de mostrar que algo
  // estaba pasando. Se distingue la carga inicial (todavía no hay nada que
  // mostrar → skeleton completo) de un refetch por cambio de filtro (ya hay
  // datos → se dejan visibles con un indicador chico, sin parpadeo de página).
  const hasAnyData = salesData.length > 0 || productData.length > 0 || repairsMetrics.total > 0
  const isInitialLoading = loading && !hasAnyData && !errorMsg
  const isRefetching = loading && hasAnyData

  return (
    <div className="container mx-auto p-4 space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">No se pudieron cargar los reportes</p>
            <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Reportes y Analytics</h1>
            {isRefetching && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Actualizando…
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
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

          {canExport ? (
            <ChartExporter
              title={`Reporte de Gestión - ${reportBrand}`}
              data={salesData}
              metrics={{
                'Ventas Totales': formatFullPrice(totalSales),
                'Órdenes': totalOrders,
                'Clientes': totalCustomers,
                'Valor Promedio': formatFullPrice(avgOrderValue),
                ...(canViewCost ? { 'Ganancia Estimada': formatFullPrice(totalProfit) } : {}),
                'Reparaciones Totales': repairsMetrics.total,
                'Tasa de Finalización': `${repairsMetrics.completionRate.toFixed(0)}%`
              }}
              chartRefs={[salesChartRef, repairsChartRef, repairsStatusRef, productsChartRef, productTrendRef, categoriesChartRef]}
              chartTitles={['Tendencia de Ventas', 'Tendencia de Reparaciones', 'Distribución por Estado', 'Productos Más Vendidos', 'Tendencia del Producto', 'Distribución por Categorías']}
              chartData={[salesData, repairsTrend, repairsStatusDist, visibleProducts, selectedProductTrend, categoryComputed.visible]}
            />
          ) : (
            <Button variant="outline" disabled title="Exportar disponible desde el plan Basic" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {isInitialLoading ? (
        <ReportsSkeleton />
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ventas Totales</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{formatFullPrice(totalSales)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-center">
              {(kpiDelta.sales ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.sales ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.sales)}</span>
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">vs periodo anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Órdenes</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{totalOrders}</p>
              </div>
              <ShoppingCart className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center">
              {(kpiDelta.orders ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.orders ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.orders)}</span>
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">vs periodo anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Clientes</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{totalCustomers}</p>
              </div>
              <Users className="h-5 w-5 text-violet-500" />
            </div>
            <div className="mt-2 flex items-center">
              {(kpiDelta.customers ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.customers ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.customers)}</span>
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">vs periodo anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Valor Promedio</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{formatFullPrice(avgOrderValue)}</p>
              </div>
              <Package className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-center">
              {(kpiDelta.aov ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.aov ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.aov)}</span>
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">vs periodo anterior</span>
            </div>
          </CardContent>
        </Card>

        {canViewCost && (
        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ganancia Est.</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{formatFullPrice(totalProfit)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Margen: {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Gráficos y análisis */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          {hasRepairs ? <TabsTrigger value="repairs">Reparaciones</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={salesChartRef}>
              {salesData.length === 0 ? (
                <ChartEmptyState message="No hay ventas registradas en el período seleccionado." />
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })}
                  />
                  <YAxis tickFormatter={formatPrice} />
                  <Tooltip
                    formatter={(value: number) => [formatFullPrice(value), 'Ventas']}
                    labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke={salesLineColor}
                    strokeWidth={2}
                    dot={{ fill: salesLineColor }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {hasRepairs ? <TabsContent value="repairs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Reparaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={repairsChartRef}>
              {repairsTrend.length === 0 ? (
                <ChartEmptyState message="No hay reparaciones registradas en el período seleccionado." />
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={repairsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={repairsLineColor}
                    strokeWidth={2}
                    dot={{ fill: repairsLineColor }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribución por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={repairsStatusRef}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={repairsStatusDist} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}` }>
                    {repairsStatusDist.map((entry, index) => (
                      <Cell key={`cell-r-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Reparaciones', value: String(repairsMetrics.total), icon: Wrench, border: 'border-l-slate-400', iconColor: 'text-slate-500' },
              { label: 'Finalización', value: `${repairsMetrics.completionRate.toFixed(0)}%`, icon: CheckCircle2, border: 'border-l-emerald-500', iconColor: 'text-emerald-500' },
              { label: 'Ticket Promedio', value: formatFullPrice(Math.round(repairsMetrics.avgCost)), icon: DollarSign, border: 'border-l-violet-500', iconColor: 'text-violet-500' },
              { label: 'Mano de Obra', value: formatFullPrice(Math.round(repairsMetrics.avgLabor)), icon: DollarSign, border: 'border-l-blue-500', iconColor: 'text-blue-500' },
              { label: 'Repuestos', value: formatFullPrice(Math.round(repairsMetrics.avgParts)), icon: Package, border: 'border-l-amber-500', iconColor: 'text-amber-500' },
              { label: 'Tiempo (TAT)', value: `${repairsMetrics.avgTATDays.toFixed(1)} días`, icon: Clock, border: 'border-l-cyan-500', iconColor: 'text-cyan-500' },
            ].map(({ label, value, icon: Icon, border, iconColor }) => (
              <Card key={label} className={`border-l-4 ${border} shadow-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                  </div>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => exportReport('reparaciones')} disabled={!canExport} title={!canExport ? 'Exportar disponible desde el plan Basic' : undefined}>Exportar Reparaciones (CSV)</Button>
          </div>
        </TabsContent> : null}

        <ReportsProductsTab
          productTopCount={productTopCount}
          setProductTopCount={setProductTopCount}
          productSortBy={productSortBy}
          setProductSortBy={setProductSortBy}
          productCategoryFilter={productCategoryFilter}
          setProductCategoryFilter={setProductCategoryFilter}
          categoryData={categoryData}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
          productData={productData}
          visibleProducts={visibleProducts}
          productsChartRef={productsChartRef}
          productSalesColor={productSalesColor}
          productQuantityColor={productQuantityColor}
          formatPrice={formatPrice}
          formatFullPrice={formatFullPrice}
          selectedProductTrend={selectedProductTrend}
          productTrendRef={productTrendRef}
          selectedProductSalesColor={selectedProductSalesColor}
          selectedProductQtyColor={selectedProductQtyColor}
          canViewCost={canViewCost}
        />

        <TabsContent value="categories" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="w-40">
              <Select value={String(categoryTopCount)} onValueChange={(v) => setCategoryTopCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Top" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={categoryMetricBy} onValueChange={(v) => setCategoryMetricBy(v as 'sales' | 'quantity')}>
                <SelectTrigger>
                  <SelectValue placeholder="Métrica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventas</SelectItem>
                  <SelectItem value="quantity">Cantidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={categoryChartType} onValueChange={(v) => setCategoryChartType(v as 'pie' | 'bar')}>
                <SelectTrigger>
                  <SelectValue placeholder="Gráfico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pie">Circular</SelectItem>
                  <SelectItem value="bar">Barras</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[300px]">
              <DatePickerWithRange
                date={categoryDateRange}
                onDateChange={(range) => {
                  if (!range || !range.from || !range.to) {
                    setCategoryDateRange({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() })
                  } else {
                    setCategoryDateRange({ from: range.from, to: range.to })
                  }
                }}
              />
            </div>
            <div className="w-56 flex items-center gap-2">
              <Input type="number" min={0} placeholder="Mín. ventas (Gs)" value={categoryMinSales}
                onChange={(e) => setCategoryMinSales(Number(e.target.value || 0))} />
            </div>
          </div>

          {(() => {
            const { totalSales, totalQty, visible } = categoryComputed
            return (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución por Categorías</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div ref={categoriesChartRef}>
                    <ResponsiveContainer width="100%" height={300}>
                      {categoryChartType === 'pie' ? (
                        <PieChart>
                          <Pie
                            data={visible}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(p: any) => `${p.name} ${((categoryMetricBy === 'sales' ? (p.sales / (totalSales || 1)) : (p.quantity / (totalQty || 1))) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey={categoryMetricBy === 'sales' ? 'sales' : 'quantity'}
                          >
                            {visible.map((entry, index) => (
                              <Cell key={`cell-cat-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                        </PieChart>
                      ) : (
                        <BarChart data={visible}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={categoryMetricBy === 'sales' ? formatPrice : (v: any) => String(v)} />
                          <Tooltip formatter={(v: number, n: any) => [n === 'sales' ? formatFullPrice(Number(v)) : String(v), n === 'sales' ? 'Ventas' : 'Cantidad']} 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            cursor={{ fill: '#f1f5f9' }}
                          />
                          <Bar
                            dataKey={categoryMetricBy === 'sales' ? 'sales' : 'quantity'}
                            name={categoryMetricBy === 'sales' ? 'Ventas' : 'Cantidad'}
                            fill={categoriesBarColor}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => {
                    const BOM = '\uFEFF'
                    const headers = ['Categoría', categoryMetricBy === 'sales' ? 'Ventas' : 'Cantidad', 'Participación %']
                    const denom = categoryMetricBy === 'sales' ? (totalSales || 1) : (totalQty || 1)
                    const rows = visible.map(c => [c.name, String(categoryMetricBy === 'sales' ? c.sales : c.quantity), (((categoryMetricBy === 'sales' ? c.sales : c.quantity) / denom) * 100).toFixed(1)])
                    const csv = [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')
                    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `categorias-${new Date().toISOString().slice(0,10)}.csv`
                    a.click(); window.URL.revokeObjectURL(url)
                  }} disabled={!canExport} title={!canExport ? 'Exportar disponible desde el plan Basic' : undefined}>Exportar Categorías (CSV)</Button>
                </div>
              </>
            )
          })()}
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-slate-800">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {customersNewCount}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clientes Nuevos</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-slate-800">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {retentionRate.toFixed(0)}%
                  </p>
                  {/* No es retención real (eso compararía contra un período
                      anterior): es qué % de los clientes que compraron en
                      ESTE período volvieron a comprar más de una vez dentro
                      del mismo período. El nombre anterior ("Tasa de
                      Retención") prometía algo distinto de lo que calcula. */}
                  <p className="text-sm text-gray-500 dark:text-gray-400">Compradores Recurrentes</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">2+ compras en el período</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-slate-800">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {avgPurchasesPerCustomer.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Compras Promedio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  )
}

// Estado vacío para un gráfico sin datos en el rango elegido — antes
// Recharts simplemente pintaba los ejes sin ninguna línea/barra, que se ve
// como un gráfico roto en vez de "no hay datos en este período".
function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// Skeleton de carga inicial: antes `loading` se guardaba pero nunca se
// leía, así que la primera carga mostraba KPIs en cero y gráficos vacíos
// en vez de algo que comunique "esto está cargando". Solo se usa mientras
// no hay ningún dato todavía — un refetch por cambio de filtro deja lo
// anterior visible (ver isRefetching) en vez de tapar todo con esto.
function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-muted shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}




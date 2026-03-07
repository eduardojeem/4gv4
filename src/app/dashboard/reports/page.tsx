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
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { chartColors } from '@/utils/chart-utils'
import { logger } from '@/lib/logger'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { ReportsProductsTab } from '@/components/reports/ReportsProductsTab'

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

    const tables = ['sales', 'sale_items', 'repairs', 'customers']
    
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
  }, [])

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
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('id, created_at, total_amount, status, customer_id')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true })

        const safeSales = salesError ? [] : (sales ?? [])
        const completedSales = safeSales.filter(sale => isCompletedSaleStatus((sale as any).status))

        // Datos de clientes actual + periodo anterior y ventas periodo anterior
        const [{ data: previousSales, error: previousSalesError }, { data: newCustomers, error: customersError }, { data: previousCustomers, error: previousCustomersError }] = await Promise.all([
          supabase
            .from('sales')
            .select('id, total_amount, status')
            .gte('created_at', previousFrom.toISOString())
            .lte('created_at', previousTo.toISOString()),
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

        const safeCustomers = customersError ? [] : (newCustomers ?? [])
        const safePreviousCustomers = previousCustomersError ? [] : (previousCustomers ?? [])
        const safePreviousSales = previousSalesError ? [] : (previousSales ?? [])
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
        const { data: itemSales, error: itemSalesError } = await supabase
          .from('sales')
          .select('id, created_at, status')
          .gte('created_at', itemsFrom.toISOString())
          .lte('created_at', itemsTo.toISOString())
        const safeItemSales = itemSalesError ? [] : (itemSales ?? [])
        const completedSalesForItems = safeItemSales.filter((sale: any) => isCompletedSaleStatus(sale.status))
        const completedSalesForItemsById = new Map(completedSalesForItems.map((sale: any) => [sale.id, sale]))

        let safeSaleItems: any[] = []
        if (completedSalesForItems.length > 0) {
          const saleIds = completedSalesForItems.map((sale: any) => sale.id)
          const { data: saleItems, error: itemsError } = await supabase
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
            .in('sale_id', saleIds)

          const safeSaleItemsRaw = itemsError ? [] : (saleItems ?? [])
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

        const { data: repairsData, error: repairsError } = await supabase
          .from('repairs')
          .select('id, created_at, received_at, completed_at, status, final_cost, labor_cost, parts_cost')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())

        const safeRepairs = repairsError ? [] : (repairsData ?? [])

        const trendMap: Record<string, number> = {}
        const statusMap: Record<string, number> = {}
        let completed = 0
        let totalCost = 0
        let totalLabor = 0
        let totalParts = 0
        let tatSumDays = 0
        let tatCount = 0

        safeRepairs.forEach((r: any) => {
          const baseDate = r.received_at || r.created_at
          const dateKey = baseDate ? toLocalDateKey(baseDate) : null
          if (dateKey) trendMap[dateKey] = (trendMap[dateKey] || 0) + 1

          const st = r.status || 'desconocido'
          statusMap[st] = (statusMap[st] || 0) + 1

          const fc = Number(r.final_cost) || 0
          const lc = Number(r.labor_cost) || 0
          const pc = Number(r.parts_cost) || 0
          totalCost += fc
          totalLabor += lc
          totalParts += pc

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
        const avgCost = totalRepairs > 0 ? totalCost / totalRepairs : 0
        const avgLabor = totalRepairs > 0 ? totalLabor / totalRepairs : 0
        const avgParts = totalRepairs > 0 ? totalParts / totalRepairs : 0
        const avgTATDays = tatCount > 0 ? tatSumDays / tatCount : 0
        setRepairsMetrics({ total: totalRepairs, completionRate, avgCost, avgTATDays, avgLabor, avgParts })

        // Procesar datos de productos
        const productStats: Record<string, { id?: string; name: string; sales: number; quantity: number; category: string; profit: number }> = {}
        const categorySales: Record<string, number> = {}
        const categoryQty: Record<string, number> = {}
        let overallProfit = 0

        safeSaleItems.forEach((item: any) => {
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
  }, [dateRange, categoryDateRange, refreshTrigger, toLocalDateKey])

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
    const BOM = '\uFEFF'
    if (type === 'ventas') {
      const headers = ['Fecha','Ventas','Órdenes','Clientes']
      const rows = salesData.map(d => [d.date, d.sales, d.orders, d.customers])
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-ventas-${new Date().toISOString().slice(0,10)}.csv`
      a.click(); window.URL.revokeObjectURL(url)
    } else if (type === 'reparaciones') {
      const headers = ['Fecha','Cantidad']
      const rows = repairsTrend.map(d => [d.date, d.count])
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-reparaciones-${new Date().toISOString().slice(0,10)}.csv`
      a.click(); window.URL.revokeObjectURL(url)
    }
  }

  const salesLineColor = chartColors.primary[0]
  const repairsLineColor = chartColors.danger[0]
  const productSalesColor = chartColors.primary[0]
  const productQuantityColor = chartColors.success[0]
  const selectedProductSalesColor = chartColors.primary[1] || chartColors.primary[0]
  const selectedProductQtyColor = chartColors.success[1] || chartColors.success[0]
  const categoriesBarColor = chartColors.info[0]

  return (
    <div className="container mx-auto p-4 space-y-6">
      {errorMsg && (
        <div className="p-3 border rounded text-red-600 bg-red-50">{errorMsg}</div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Reportes y Analytics</h1>
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
          
          <ChartExporter
            title="Reporte de Gestión - 4G Celulares"
            data={salesData}
            metrics={{
              'Ventas Totales': formatFullPrice(totalSales),
              'Órdenes': totalOrders,
              'Clientes': totalCustomers,
              'Valor Promedio': formatFullPrice(avgOrderValue),
              'Ganancia Estimada': formatFullPrice(totalProfit),
              'Reparaciones Totales': repairsMetrics.total,
              'Tasa de Finalización': `${repairsMetrics.completionRate.toFixed(0)}%`
            }}
            chartRefs={[salesChartRef, repairsChartRef, repairsStatusRef, productsChartRef, productTrendRef, categoriesChartRef]}
            chartTitles={['Tendencia de Ventas', 'Tendencia de Reparaciones', 'Distribución por Estado', 'Productos Más Vendidos', 'Tendencia del Producto', 'Distribución por Categorías']}
            chartData={[salesData, repairsTrend, repairsStatusDist, visibleProducts, selectedProductTrend, categoryComputed.visible]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40 border border-emerald-200 dark:border-emerald-700 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ventas Totales</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                  {formatFullPrice(totalSales)}
                </p>
              </div>
              <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/60 rounded-full flex items-center justify-center shadow-sm">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              {(kpiDelta.sales ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.sales ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.sales)}</span>
              <span className="text-sm text-emerald-900/70 dark:text-emerald-100/80 ml-1">
                vs periodo anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/40 border border-blue-200 dark:border-blue-800 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Órdenes</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                  {totalOrders}
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/60 rounded-full flex items-center justify-center shadow-sm">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              {(kpiDelta.orders ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.orders ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.orders)}</span>
              <span className="text-sm text-slate-700/80 dark:text-slate-100/80 ml-1">
                vs periodo anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border border-violet-200 dark:border-violet-800 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-200">
                  {totalCustomers}
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/60 rounded-full flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              {(kpiDelta.customers ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.customers ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.customers)}</span>
              <span className="text-sm text-slate-700/80 dark:text-slate-100/80 ml-1">
                vs periodo anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Promedio</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                  {formatFullPrice(avgOrderValue)}
                </p>
              </div>
              <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/60 rounded-full flex items-center justify-center shadow-sm">
                <Package className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
            </div>
            <div className="flex items-center mt-2">
              {(kpiDelta.aov ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${(kpiDelta.aov ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{formatDelta(kpiDelta.aov)}</span>
              <span className="text-sm text-slate-700/80 dark:text-slate-100/80 ml-1">
                vs periodo anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950/40 dark:to-pink-950/40 border border-indigo-200 dark:border-indigo-800 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ganancia Est.</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">
                  {formatFullPrice(totalProfit)}
                </p>
              </div>
              <div className="h-10 w-10 bg-pink-100 dark:bg-pink-900/60 rounded-full flex items-center justify-center shadow-sm">
                <DollarSign className="h-5 w-5 text-pink-600 dark:text-pink-300" />
              </div>
            </div>
            <div className="flex items-center mt-2">
               <span className="text-sm text-slate-700/80 dark:text-slate-100/80">
                Margen: {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%
              </span>
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
          <TabsTrigger value="repairs">Reparaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={salesChartRef}>
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
                    contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                    itemStyle={{ color: '#1e293b' }}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repairs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Reparaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={repairsChartRef}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={repairsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })} 
                    contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                    itemStyle={{ color: '#1e293b' }}
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
                    contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                    itemStyle={{ color: '#1e293b' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Reparaciones</p><p className="text-xl font-bold">{repairsMetrics.total}</p></div></CardContent></Card>
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Finalización</p><p className="text-xl font-bold">{repairsMetrics.completionRate.toFixed(0)}%</p></div></CardContent></Card>
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Ticket Promedio</p><p className="text-xl font-bold">{formatFullPrice(Math.round(repairsMetrics.avgCost))}</p></div></CardContent></Card>
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Mano de Obra</p><p className="text-xl font-bold text-blue-600">{formatFullPrice(Math.round(repairsMetrics.avgLabor))}</p></div></CardContent></Card>
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Repuestos</p><p className="text-xl font-bold text-amber-600">{formatFullPrice(Math.round(repairsMetrics.avgParts))}</p></div></CardContent></Card>
            <Card className="col-span-1"><CardContent className="p-4"><div className="flex flex-col"> <p className="text-xs font-medium text-muted-foreground">Tiempo (TAT)</p><p className="text-xl font-bold">{repairsMetrics.avgTATDays.toFixed(1)} días</p></div></CardContent></Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => exportReport('reparaciones')}>Exportar Reparaciones (CSV)</Button>
          </div>
        </TabsContent>
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
                            contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                            itemStyle={{ color: '#1e293b' }}
                          />
                        </PieChart>
                      ) : (
                        <BarChart data={visible}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={categoryMetricBy === 'sales' ? formatPrice : (v: any) => String(v)} />
                          <Tooltip formatter={(v: number, n: any) => [n === 'sales' ? formatFullPrice(Number(v)) : String(v), n === 'sales' ? 'Ventas' : 'Cantidad']} 
                            contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', color: '#1e293b' }}
                            itemStyle={{ color: '#1e293b' }}
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
                    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
                    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `categorias-${new Date().toISOString().slice(0,10)}.csv`
                    a.click(); window.URL.revokeObjectURL(url)
                  }}>Exportar Categorías (CSV)</Button>
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
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-100 dark:border-blue-900">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {customersNewCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Clientes Nuevos</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40 border-emerald-100 dark:border-emerald-900">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {retentionRate.toFixed(0)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Tasa de Retención</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40 border-purple-100 dark:border-purple-900">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {avgPurchasesPerCustomer.toFixed(1)}
                  </p>
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







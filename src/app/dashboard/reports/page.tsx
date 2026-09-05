'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BarChart } from 'recharts/es6/chart/BarChart'
import { Bar } from 'recharts/es6/cartesian/Bar'
import { AreaChart } from 'recharts/es6/chart/AreaChart'
import { Area } from 'recharts/es6/cartesian/Area'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { LineChart } from 'recharts/es6/chart/LineChart'
import { Line } from 'recharts/es6/cartesian/Line'
import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
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
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Award,
  CreditCard,
  FileText
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
import { useAuth } from '@/contexts/auth-context'
import { withBranchFilter } from '@/lib/branches/client'
import { chunkQueryValues } from '@/lib/analytics/query-batches'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { ReportsCreditsTab } from '@/components/reports/ReportsCreditsTab'
import type { CreditReport } from '@/lib/reports/credit-report'
import {
  exportSalesSectionPDF,
  exportCategoriesSectionPDF,
  exportRepairsSectionPDF
} from '@/lib/reports/section-pdf-exporter'
import { calculateRepairCompletion } from '@/lib/reports/repair-report'
import {
  buildSalesActivitySummary,
  calculateAveragePurchasesPerIdentifiedCustomer,
  calculateHistoricalProfit,
  createCalendarPeriodRange,
} from '@/lib/reports/sales-report'

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

type CostSnapshotRow = { sale_item_id: string; total_cost: number | null }
type CostSnapshotQueryResult = {
  data: CostSnapshotRow[] | null
  error: { message: string } | null
}
type CostSnapshotQuery = PromiseLike<CostSnapshotQueryResult> & {
  select: (columns: string) => CostSnapshotQuery
  eq: (column: string, value: string) => CostSnapshotQuery
  in: (column: string, values: string[]) => CostSnapshotQuery
}

export default function ReportsPage() {
  const { selectedBranchId, selectedBranch } = useBranch()
  const { organization } = useActiveOrganization()
  const { user } = useAuth()
  const { planCode, organizationName, effectiveModules } = useSubscriptionStatus()
  const hasRepairs = effectiveModules.includes('repairs')
  const hasCredits = effectiveModules.includes('credits')
  const canExport = canExportReports(planCode) // exportar/descargar: Basic en adelante
  const canViewCost = useCanViewCost()
  const reportBrand = organizationName || 'Mi Negocio'

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => createCalendarPeriodRange(new Date(), 30))
  const [selectedPeriod, setSelectedPeriod] = useState('30d')

  // Lo que hace que un PDF descargado se pueda identificar despues: de que
  // periodo habla, de que sucursal y quien lo pidio. Sin esto, el reporte de
  // enero y el de marzo salian identicos.
  const reportContext = useMemo(() => ({
    periodFrom: dateRange.from,
    periodTo: dateRange.to,
    branchName: selectedBranch?.name ?? null,
    generatedBy: user?.profile?.name || user?.email || null,
  }), [dateRange.from, dateRange.to, selectedBranch?.name, user?.profile?.name, user?.email])
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
  const [creditReport, setCreditReport] = useState<CreditReport | null>(null)
  const [creditReportLoading, setCreditReportLoading] = useState(false)
  const [creditReportError, setCreditReportError] = useState<string | null>(null)
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
  const [profitCoverage, setProfitCoverage] = useState({ coveredItems: 0, totalItems: 0, coveredRevenue: 0 })
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
      ...(hasCredits ? ['customer_credits', 'credit_installments', 'credit_payments'] : []),
    ]
    const childTablesWithoutOrganizationId = new Set(['sale_items', 'credit_installments', 'credit_payments'])
    
    tables.forEach(table => {
      const channel = supabase
        .channel(`realtime-reports-${table}`)
        .on(
          'postgres_changes',
          childTablesWithoutOrganizationId.has(table)
            ? { event: '*', schema: 'public', table }
            : { event: '*', schema: 'public', table, filter: `organization_id=eq.${organization?.id ?? '__none__'}` },
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
  }, [hasCredits, hasRepairs, organization?.id])

  // Cargar datos reales de Supabase
  useEffect(() => {
    const fetchReportsData = async () => {
      if (!organization?.id) return
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
            .eq('organization_id', organization.id)
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
              .eq('organization_id', organization.id)
              .gte('created_at', previousFrom.toISOString())
              .lte('created_at', previousTo.toISOString()),
            selectedBranchId
          ),
          supabase
            .from('customers')
            .select('created_at')
            .eq('organization_id', organization.id)
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          supabase
            .from('customers')
            .select('created_at')
            .eq('organization_id', organization.id)
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
            .eq('organization_id', organization.id)
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
                  id,
                  sale_id,
                  product_id,
                  quantity,
                  unit_price,
                  subtotal,
                  product:products (
                    id,
                    name,
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
          const historicalCostByItem = new Map<string, number>()
          if (canViewCost && safeSaleItemsRaw.length > 0) {
            const snapshotResults = await Promise.all(
              chunkQueryValues(safeSaleItemsRaw.map((item) => String(item.id))).map((itemIdBatch) => {
                let query = (supabase as unknown as { from: (table: string) => CostSnapshotQuery })
                  .from('sale_item_cost_snapshots')
                  .select('sale_item_id, total_cost')
                  .eq('organization_id', organization.id)
                  .in('sale_item_id', itemIdBatch)
                if (selectedBranchId) query = query.eq('branch_id', selectedBranchId)
                return query
              })
            )
            const snapshotError = snapshotResults.find((result) => result.error)?.error
            if (snapshotError) {
              logger.warn('Historical POS costs unavailable for reports', { message: snapshotError.message })
            } else {
              snapshotResults.flatMap((result) => result.data ?? []).forEach((snapshot) => {
                if (snapshot.total_cost !== null) {
                  historicalCostByItem.set(String(snapshot.sale_item_id), Number(snapshot.total_cost))
                }
              })
            }
          }
          safeSaleItems = safeSaleItemsRaw.map((item: any) => {
            const sale = completedSalesForItemsById.get(item.sale_id)
            return {
              ...item,
              sale: sale ? { created_at: sale.created_at, status: sale.status } : null,
              historical_total_cost: historicalCostByItem.has(String(item.id))
                ? historicalCostByItem.get(String(item.id))
                : null,
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
          const cid = sale.customer_id
          if (cid) ordersByCustomer[cid] = (ordersByCustomer[cid] || 0) + 1
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
        const customersWithOrders = Object.keys(ordersByCustomer)
        const repeatCustomers = customersWithOrders.filter(k => (ordersByCustomer[k] || 0) >= 2)
        const uniqueCustomersCount = customersWithOrders.length
        setRetentionRate(uniqueCustomersCount > 0 ? (repeatCustomers.length / uniqueCustomersCount) * 100 : 0)
        setAvgPurchasesPerCustomer(calculateAveragePurchasesPerIdentifiedCustomer(ordersByCustomer))

        const { data: repairsData, error: repairsError } = hasRepairs ? await withBranchFilter(
          supabase
            .from('repairs')
            .select('id, created_at, received_at, completed_at, status, final_cost, labor_cost, parts_cost')
            .eq('organization_id', organization.id)
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString()),
          selectedBranchId
        ) : { data: [], error: null }

        if (repairsError) throw repairsError
        const safeRepairs = repairsData ?? []

        const trendMap: Record<string, number> = {}
        const statusMap: Record<string, number> = {}
        let totalCost = 0
        let totalLabor = 0
        let totalParts = 0
        let costedCount = 0

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
        const completion = calculateRepairCompletion(safeRepairs.map((repair) => ({
          status: repair.status,
          receivedAt: repair.received_at,
          completedAt: repair.completed_at,
        })))
        const completionRate = completion.completionRate
        const avgCost = costedCount > 0 ? totalCost / costedCount : 0
        const avgLabor = costedCount > 0 ? totalLabor / costedCount : 0
        const avgParts = costedCount > 0 ? totalParts / costedCount : 0
        const avgTATDays = completion.averageTurnaroundDays
        setRepairsMetrics({ total: totalRepairs, completionRate, avgCost, avgTATDays, avgLabor, avgParts })

        // Procesar datos de productos
        const productStats: Record<string, { id?: string; name: string; sales: number; quantity: number; category: string; profit: number }> = {}
        const categorySales: Record<string, number> = {}
        const categoryQty: Record<string, number> = {}
        const profitItems: Array<{ subtotal: number; historicalTotalCost: number | null }> = []

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
          const total = Number(item.subtotal ?? quantity * unitPrice) || 0
          const historicalTotalCost = item.historical_total_cost === null
            ? null
            : Number(item.historical_total_cost)
          const profit = historicalTotalCost === null ? 0 : total - historicalTotalCost

          profitItems.push({ subtotal: total, historicalTotalCost })

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
        
        const historicalProfit = calculateHistoricalProfit(profitItems)
        setTotalProfit(historicalProfit.profit)
        setProfitCoverage({
          coveredItems: historicalProfit.coveredItems,
          totalItems: historicalProfit.totalItems,
          coveredRevenue: historicalProfit.coveredRevenue,
        })

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
  }, [canViewCost, categoryDateRange, dateRange, hasRepairs, organization?.id, refreshTrigger, selectedBranchId, toLocalDateKey])

  useEffect(() => {
    if (!hasCredits || !organization?.id) {
      setCreditReport(null)
      setCreditReportError(null)
      setCreditReportLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchCreditReport = async () => {
      setCreditReportLoading(true)
      setCreditReportError(null)
      try {
        const params = new URLSearchParams({
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        })
        if (selectedBranchId) params.set('branchId', selectedBranchId)

        const response = await fetch(`/api/reports/credits?${params.toString()}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null) as { success?: boolean; data?: CreditReport; error?: string } | null
        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error || 'No se pudo cargar el reporte de créditos.')
        }

        const hasCreditData = body.data.statusDistribution.length > 0
          || body.data.period.grantedCount > 0
          || body.data.period.paymentsReceived > 0
        setCreditReport(hasCreditData ? body.data : null)
      } catch (error) {
        if (controller.signal.aborted) return
        setCreditReportError(error instanceof Error ? error.message : 'No se pudo cargar el reporte de créditos.')
      } finally {
        if (!controller.signal.aborted) setCreditReportLoading(false)
      }
    }

    void fetchCreditReport()
    return () => controller.abort()
  }, [dateRange, hasCredits, organization?.id, refreshTrigger, selectedBranchId])

  useEffect(() => {
    const now = new Date()
    if (selectedPeriod === '7d') {
      setDateRange(createCalendarPeriodRange(now, 7))
    } else if (selectedPeriod === '30d') {
      setDateRange(createCalendarPeriodRange(now, 30))
    } else if (selectedPeriod === '90d') {
      setDateRange(createCalendarPeriodRange(now, 90))
    } else if (selectedPeriod === '1y') {
      setDateRange(createCalendarPeriodRange(now, 365))
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

  const salesSummary = useMemo(
    () => buildSalesActivitySummary(salesData, dateRange),
    [dateRange, salesData],
  )

  const exportReport = (type: string) => {
    try {
      const BOM = '\uFEFF'
      const nowStr = new Date().toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      const fromStr = format(dateRange.from, 'dd/MM/yyyy', { locale: es })
      const toStr = format(dateRange.to, 'dd/MM/yyyy', { locale: es })

      const getDayOfWeek = (dStr: string) => {
        try {
          const parts = dStr.split('T')[0].split('-')
          if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
            return days[d.getDay()] || ''
          }
        } catch {}
        return ''
      }

      if (type === 'ventas') {
        const totalSalesSum = salesData.reduce((acc, d) => acc + (Number(d.sales) || 0), 0)
        const totalOrdersSum = salesData.reduce((acc, d) => acc + (Number(d.orders) || 0), 0)
        const totalProfitSum = salesData.reduce((acc, d) => acc + (Number((d as any).profit) || 0), 0)
        const avgTicket = totalOrdersSum > 0 ? Math.round(totalSalesSum / totalOrdersSum) : 0
        const totalMargin = totalSalesSum > 0 ? ((totalProfitSum / totalSalesSum) * 100).toFixed(1) : '0'

        const metadata = [
          `# =========================================================================`,
          `# SISTEMA 4G - REPORTE DETALLADO DE VENTAS Y FACTURACIÓN`,
          `# Empresa: ${reportBrand}`,
          `# Período: ${fromStr} al ${toStr}`,
          `# Generado el: ${nowStr}`,
          `# Moneda: Guaraníes (PYG / Gs.)`,
          `# =========================================================================`,
        ]

        const headers = [
          'Fecha',
          'Día',
          'Facturación_Gs',
          'Órdenes',
          'Clientes',
          'Ticket_Promedio_Gs',
          ...(canViewCost ? ['Ganancia_Estimada_Gs', 'Margen_Pct'] : []),
          'Participación_Pct'
        ]

        const rows = salesData.map((d) => {
          const s = Number(d.sales) || 0
          const o = Number(d.orders) || 0
          const p = Number((d as any).profit) || 0
          const t = o > 0 ? Math.round(s / o) : s
          const m = s > 0 ? ((p / s) * 100).toFixed(1) : '0'
          const share = totalSalesSum > 0 ? ((s / totalSalesSum) * 100).toFixed(1) : '0'

          return [
            d.date,
            getDayOfWeek(d.date),
            s,
            o,
            d.customers || 0,
            t,
            ...(canViewCost ? [p, `${m}%`] : []),
            `${share}%`
          ]
        })

        const summaryRow = [
          'TOTALES_DEL_PERÍODO',
          `${salesData.length} días`,
          totalSalesSum,
          totalOrdersSum,
          totalCustomers,
          avgTicket,
          ...(canViewCost ? [totalProfitSum, `${totalMargin}%`] : []),
          '100%'
        ]

        const csv = [
          ...metadata,
          headers.join(','),
          ...rows.map((r) => r.map(csvCell).join(',')),
          summaryRow.map(csvCell).join(',')
        ].join('\n')

        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)

        if (rows.length === 0) {
          toast.warning('CSV descargado, pero no hay ventas en el período seleccionado.')
        } else {
          toast.success(`CSV de ventas descargado con metadatos y totales (${rows.length} días).`)
        }
      } else if (type === 'reparaciones') {
        const totalTrendCount = repairsTrend.reduce((acc, t) => acc + (Number(t.count) || 0), 0)

        const metadata = [
          `# =========================================================================`,
          `# SISTEMA 4G - REPORTE DE INGRESOS AL TALLER Y REPARACIONES`,
          `# Empresa: ${reportBrand}`,
          `# Período: ${fromStr} al ${toStr}`,
          `# Generado el: ${nowStr}`,
          `# =========================================================================`,
        ]

        const headers = ['Fecha', 'Día', 'Órdenes_Ingresadas', 'Participación_Pct']

        const rows = repairsTrend.map((d) => {
          const cnt = Number(d.count) || 0
          const pct = totalTrendCount > 0 ? ((cnt / totalTrendCount) * 100).toFixed(1) : '0'
          return [d.date, getDayOfWeek(d.date), cnt, `${pct}%`]
        })

        const summaryRow = [
          'TOTAL_INGRESOS_TALLER',
          `${repairsTrend.length} días`,
          totalTrendCount,
          '100%'
        ]

        const csv = [
          ...metadata,
          headers.join(','),
          ...rows.map((r) => r.map(csvCell).join(',')),
          summaryRow.map(csvCell).join(',')
        ].join('\n')

        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte-reparaciones-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)

        if (rows.length === 0) {
          toast.warning('CSV descargado, pero no hay reparaciones en el período seleccionado.')
        } else {
          toast.success(`CSV de reparaciones descargado con metadatos y totales (${rows.length} registros).`)
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
  const hasAnyData = salesData.length > 0 || productData.length > 0 || repairsMetrics.total > 0
  const isInitialLoading = loading && !hasAnyData && !errorMsg
  const isRefetching = loading && hasAnyData

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-bold">No se pudieron cargar los reportes</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Header con Título, Estado y Controles de Período */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-2xl text-white shadow-md shadow-blue-500/20 shrink-0">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Reportes y Analytics
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                <Sparkles className="h-3 w-3 text-blue-500" />
                {reportBrand}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Métricas de rendimiento, análisis de ventas, productos y comportamiento de clientes
            </p>
          </div>
        </div>

        {/* Controles de Período y Exportación */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pills de Período Rápido */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            {[
              { id: '7d', label: '7 Días' },
              { id: '30d', label: '30 Días' },
              { id: '90d', label: '90 Días' },
              { id: '1y', label: '1 Año' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedPeriod === p.id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Botón de Refresco Manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            disabled={loading}
            className="h-9 gap-1.5 font-medium border-slate-200 dark:border-slate-800"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching || loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          {/* Exportador Integral */}
          {canExport ? (
            <ChartExporter
              title={`Reporte de Gestión - ${reportBrand}`}
              data={salesData}
              metrics={{
                'Ventas Totales': formatFullPrice(totalSales),
                'Órdenes': totalOrders,
                'Clientes': totalCustomers,
                'Valor Promedio': formatFullPrice(avgOrderValue),
                ...(canViewCost ? {
                  'Margen Histórico': profitCoverage.coveredItems > 0 ? formatFullPrice(totalProfit) : 'Sin costos históricos',
                } : {}),
                ...(repairsMetrics.total > 0 ? {
                  'Reparaciones Totales': repairsMetrics.total,
                  'Tasa de Finalización': `${repairsMetrics.completionRate.toFixed(0)}%`
                } : {}),
                ...(creditReport ? {
                  'Cartera Créditos': formatFullPrice(creditReport.portfolio.outstandingAmount),
                  'Cobranzas Período': formatFullPrice(creditReport.period.paymentsReceived),
                  'Tasa de Cobranza': `${creditReport.portfolio.collectionRate.toFixed(0)}%`
                } : {})
              }}
              chartRefs={[salesChartRef, repairsChartRef, repairsStatusRef, productsChartRef, productTrendRef, categoriesChartRef]}
              chartTitles={['Tendencia de Ventas', 'Tendencia de Reparaciones', 'Distribución por Estado', 'Productos Más Vendidos', 'Tendencia del Producto', 'Distribución por Categorías']}
              chartData={[salesData, repairsTrend, repairsStatusDist, visibleProducts, selectedProductTrend, categoryComputed.visible]}
              creditReport={creditReport}
            />
          ) : (
            <Button variant="outline" disabled title="Exportar disponible desde el plan Basic" className="h-9 gap-1.5 font-medium">
              <Download className="h-4 w-4" />
              <span>Exportar</span>
            </Button>
          )}
        </div>
      </div>

      {isInitialLoading ? (
        <ReportsSkeleton />
      ) : (
      <>
      {/* Tarjetas KPI Ejecutivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Ventas Totales */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ventas Totales
                </p>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {formatFullPrice(totalSales)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                (kpiDelta.sales ?? 0) >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {(kpiDelta.sales ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                )}
                {formatDelta(kpiDelta.sales)}
              </span>
              <span className="text-[11px] text-muted-foreground">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Órdenes */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-800 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Órdenes Realizadas
                </p>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {totalOrders}
                </p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                (kpiDelta.orders ?? 0) >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {(kpiDelta.orders ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                )}
                {formatDelta(kpiDelta.orders)}
              </span>
              <span className="text-[11px] text-muted-foreground">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl relative overflow-hidden group hover:border-violet-300 dark:hover:border-violet-800 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Clientes Nuevos
                </p>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {totalCustomers}
                </p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                (kpiDelta.customers ?? 0) >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {(kpiDelta.customers ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                )}
                {formatDelta(kpiDelta.customers)}
              </span>
              <span className="text-[11px] text-muted-foreground">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Valor Promedio / Ticket */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-800 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ticket Promedio
                </p>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {formatFullPrice(avgOrderValue)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                (kpiDelta.aov ?? 0) >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {(kpiDelta.aov ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                )}
                {formatDelta(kpiDelta.aov)}
              </span>
              <span className="text-[11px] text-muted-foreground">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Margen histórico (solo visible si puede consultar costos) */}
        {canViewCost && (
          <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all sm:col-span-2 lg:col-span-4 xl:col-span-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500" />
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Margen Histórico
                  </p>
                  <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {profitCoverage.coveredItems > 0 ? formatFullPrice(totalProfit) : '—'}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Margen: {profitCoverage.coveredRevenue > 0 ? ((totalProfit / profitCoverage.coveredRevenue) * 100).toFixed(1) : 0}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {profitCoverage.coveredItems}/{profitCoverage.totalItems} ítems con costo histórico
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navegación por Pestañas de Rendimiento */}
      <Tabs defaultValue="sales" className="space-y-5">
        <div className="flex items-center justify-between overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
          <TabsList className="inline-flex h-auto min-w-max gap-1 bg-transparent p-0">
            <TabsTrigger
              value="sales"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Ventas</span>
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <Package className="h-4 w-4" />
              <span>Productos</span>
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <PieChartIcon className="h-4 w-4" />
              <span>Categorías</span>
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <Users className="h-4 w-4" />
              <span>Clientes</span>
            </TabsTrigger>
            {hasRepairs ? (
              <TabsTrigger
                value="repairs"
                className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                <Wrench className="h-4 w-4" />
                <span>Reparaciones</span>
              </TabsTrigger>
            ) : null}
            {hasCredits ? (
              <TabsTrigger
                value="credits"
                className="gap-2 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                <CreditCard className="h-4 w-4" />
                <span>Créditos</span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        {/* Tab 1: Tendencia de Ventas */}
        <TabsContent value="sales" className="space-y-4">
          <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Tendencia y Evolución de Ventas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Facturación diaria acumulada en el período seleccionado
                  </p>
                </div>
                {canExport && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100"
                      onClick={() => exportSalesSectionPDF({
                        title: `Reporte de Ventas - ${reportBrand}`,
                        context: reportContext,
                        salesData,
                        metrics: {
                          totalSales,
                          totalOrders,
                          totalCustomers,
                          avgOrderValue,
                          totalProfit: canViewCost ? totalProfit : undefined,
                        },
                        chartRef: salesChartRef,
                      })}
                    >
                      <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      PDF de Ventas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold border-slate-200 dark:border-slate-800"
                      onClick={() => exportReport('ventas')}
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div ref={salesChartRef}>
                {salesData.length === 0 ? (
                  <ChartEmptyState message="No hay ventas registradas en el período seleccionado." />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={salesLineColor} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={salesLineColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={formatPrice}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatFullPrice(value), 'Ventas']}
                        labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })}
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          padding: '10px 14px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        }}
                        itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke={salesLineColor}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                        dot={{ r: 3, fill: salesLineColor, strokeWidth: 1, stroke: '#ffffff' }}
                        activeDot={{ r: 6, fill: salesLineColor, strokeWidth: 2, stroke: '#ffffff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Métricas de Rendimiento Destacadas */}
              {salesData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-border/50">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      Día Pico de Ventas
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {salesSummary.peakDay ? format(new Date(salesSummary.peakDay.date), 'dd MMMM yyyy', { locale: es }) : '—'}
                    </p>
                    <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatFullPrice(salesSummary.peakAmount)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      Promedio Diario
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {formatFullPrice(salesSummary.dailyAverage)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      por cada día del período
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      Días con Movimiento
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {salesSummary.activeDays} de {salesSummary.periodDays} días
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {`${((salesSummary.activeDays / salesSummary.periodDays) * 100).toFixed(0)}% de actividad`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Reparaciones (si el módulo está activo) */}
        {hasRepairs ? (
          <TabsContent value="repairs" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { label: 'Reparaciones', value: String(repairsMetrics.total), icon: Wrench, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-white/[0.02]' },
                { label: 'Entregadas / ingresadas', value: `${repairsMetrics.completionRate.toFixed(0)}%`, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
                { label: 'Precio final promedio', value: formatFullPrice(Math.round(repairsMetrics.avgCost)), icon: DollarSign, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50/50 dark:bg-violet-950/20' },
                { label: 'M.O. promedio', value: formatFullPrice(Math.round(repairsMetrics.avgLabor)), icon: DollarSign, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
                { label: 'Repuestos promedio', value: formatFullPrice(Math.round(repairsMetrics.avgParts)), icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
                { label: 'Tiempo (TAT)', value: `${repairsMetrics.avgTATDays.toFixed(1)} días`, icon: Clock, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50/50 dark:bg-cyan-950/20' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className={`border border-slate-200/80 dark:border-white/10 shadow-xs ${bg} rounded-2xl`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    </div>
                    <p className={`mt-2 text-xl font-bold font-mono ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/40 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4.5 w-4.5 text-blue-600" />
                    Tendencia de Ingreso de Reparaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div ref={repairsChartRef}>
                    {repairsTrend.length === 0 ? (
                      <ChartEmptyState message="No hay reparaciones registradas en el período seleccionado." />
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={repairsTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                          <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: es })}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke={repairsLineColor}
                            strokeWidth={2.5}
                            dot={{ fill: repairsLineColor }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/40 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <PieChartIcon className="h-4.5 w-4.5 text-violet-600" />
                    Distribución por Estado
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div ref={repairsStatusRef}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={repairsStatusDist} cx="50%" cy="50%" outerRadius={85} innerRadius={45} dataKey="value" label={({ name, value }) => `${name}: ${value}` }>
                          {repairsStatusDist.map((entry, index) => (
                            <Cell key={`cell-r-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 font-semibold text-xs text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100"
                onClick={() => exportRepairsSectionPDF({
                  title: `Reporte de Reparaciones - ${reportBrand}`,
                  context: reportContext,
                  trend: repairsTrend,
                  statusDist: repairsStatusDist,
                  metrics: repairsMetrics,
                  chartRefs: [repairsChartRef, repairsStatusRef]
                })}
              >
                <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                PDF de Reparaciones
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportReport('reparaciones')}
                disabled={!canExport}
                className="h-8 gap-1.5 font-semibold text-xs border-slate-200 dark:border-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </TabsContent>
        ) : null}

        {hasCredits ? (
          <TabsContent value="credits" className="space-y-4">
            <ReportsCreditsTab
              brand={reportBrand}
              context={reportContext}
              report={creditReport}
              loading={creditReportLoading}
              error={creditReportError}
            />
          </TabsContent>
        ) : null}

        {/* Tab 3: Productos */}
        <ReportsProductsTab
          brand={reportBrand}
          context={reportContext}
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

        {/* Tab 4: Categorías */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Distribución y Participación por Categorías
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Participación de mercado y facturación por rubro comercial
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 font-semibold text-xs text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100"
                    onClick={() => exportCategoriesSectionPDF({
                      title: `Reporte de Categorías - ${reportBrand}`,
                      context: reportContext,
                      categories: categoryComputed.visible,
                      chartRef: categoriesChartRef
                    })}
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    PDF de Categorías
                  </Button>
                  <Select value={String(categoryTopCount)} onValueChange={(v) => setCategoryTopCount(Number(v))}>
                    <SelectTrigger className="w-28 h-8 text-xs font-semibold">
                      <SelectValue placeholder="Top" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Top 5</SelectItem>
                      <SelectItem value="10">Top 10</SelectItem>
                      <SelectItem value="20">Top 20</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryMetricBy} onValueChange={(v) => setCategoryMetricBy(v as 'sales' | 'quantity')}>
                    <SelectTrigger className="w-32 h-8 text-xs font-semibold">
                      <SelectValue placeholder="Métrica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Por Ventas</SelectItem>
                      <SelectItem value="quantity">Por Cantidad</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryChartType} onValueChange={(v) => setCategoryChartType(v as 'pie' | 'bar')}>
                    <SelectTrigger className="w-28 h-8 text-xs font-semibold">
                      <SelectValue placeholder="Gráfico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pie">Circular</SelectItem>
                      <SelectItem value="bar">Barras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {(() => {
                const { totalSales, totalQty, visible } = categoryComputed
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-center">
                    <div ref={categoriesChartRef} className="w-full">
                      <ResponsiveContainer width="100%" height={320}>
                        {categoryChartType === 'pie' ? (
                          <PieChart>
                            <Pie
                              data={visible}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(p: any) => `${p.name} ${((categoryMetricBy === 'sales' ? (p.sales / (totalSales || 1)) : (p.quantity / (totalQty || 1))) * 100).toFixed(0)}%`}
                              outerRadius={105}
                              innerRadius={55}
                              dataKey={categoryMetricBy === 'sales' ? 'sales' : 'quantity'}
                            >
                              {visible.map((entry, index) => (
                                <Cell key={`cell-cat-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }}
                            />
                          </PieChart>
                        ) : (
                          <BarChart data={visible}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={categoryMetricBy === 'sales' ? formatPrice : (v: any) => String(v)} />
                            <Tooltip
                              formatter={(v: number, n: any) => [n === 'sales' ? formatFullPrice(Number(v)) : String(v), n === 'sales' ? 'Ventas' : 'Cantidad']}
                              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px', color: '#fff' }}
                            />
                            <Bar
                              dataKey={categoryMetricBy === 'sales' ? 'sales' : 'quantity'}
                              name={categoryMetricBy === 'sales' ? 'Ventas' : 'Cantidad'}
                              fill={categoriesBarColor}
                              radius={[6, 6, 0, 0]}
                            />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Desglose de Categorías */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Desglose de Participación
                      </h4>
                      <div className="divide-y divide-border/40 rounded-xl border border-border/50 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                        {visible.map((cat) => {
                          const denom = categoryMetricBy === 'sales' ? (totalSales || 1) : (totalQty || 1)
                          const val = categoryMetricBy === 'sales' ? cat.sales : cat.quantity
                          const pct = ((val / denom) * 100)
                          return (
                            <div key={cat.name} className="p-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="text-sm font-semibold truncate">{cat.name}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold font-mono">
                                  {categoryMetricBy === 'sales' ? formatFullPrice(cat.sales) : `${cat.quantity} un.`}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-semibold">
                                  {pct.toFixed(1)}% del total
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 font-semibold text-xs border-slate-200 dark:border-slate-800"
                          onClick={() => {
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
                          }}
                          disabled={!canExport}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Exportar Categorías (CSV)
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Clientes y Fidelización */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
              <div className="h-12 w-12 mx-auto rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                {customersNewCount}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">Clientes Nuevos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Registrados en el período seleccionado</p>
            </Card>

            <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {retentionRate.toFixed(0)}%
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">Compradores Recurrentes</p>
              <p className="text-xs text-muted-foreground mt-0.5">2 o más compras dentro del mismo período</p>
            </Card>

            <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#0d1117] rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-violet-500" />
              <div className="h-12 w-12 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-3">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <p className="text-3xl font-extrabold font-mono text-violet-600 dark:text-violet-400">
                {avgPurchasesPerCustomer.toFixed(1)}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">Frecuencia Media</p>
              <p className="text-xs text-muted-foreground mt-0.5">Promedio de compras por cliente activo</p>
            </Card>
          </div>
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

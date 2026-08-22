import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { endOfDay, format, isAfter, isBefore, startOfDay, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'
import { chunkQueryValues } from '@/lib/analytics/query-batches'
import type { FinanceSummaryReport } from '@/lib/finance/server'

export type AnalyticsPreset = 'today' | '7d' | '30d' | '90d' | 'custom'
const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000

type InsightTone = 'success' | 'warning' | 'danger' | 'info'
type MetricTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface AdminAnalyticsFilters {
  from: Date
  to: Date
  preset: AnalyticsPreset
  branch: string
}

export interface AnalyticsQuickStat {
  id: string
  label: string
  value: number
  formattedValue: string
}

export interface AnalyticsMetricCard {
  id: string
  label: string
  value: string
  rawValue: number
  delta: number | null
  tone: MetricTone
  helper: string
}

export interface TrendPoint {
  label: string
  shortLabel: string
  posRevenue: number
  repairRevenue: number
  grossRevenue: number
  orders: number
}

export interface SimpleSeriesPoint {
  label: string
  value: number
  secondaryValue?: number
  // Index signature para compatibilidad con los tipos de datos de Recharts (Pie/Bar).
  [key: string]: string | number | undefined
}

export interface FinanceComparisonPoint {
  label: string
  ingresos: number
  egresos: number
  ganancia: number
}

export interface AnalyticsTableRow {
  id: string
  label: string
  metric: string
  secondary: string
  detail?: string
}

export interface AnalyticsInsight {
  id: string
  tone: InsightTone
  title: string
  description: string
  context: string
}

export interface AdminAnalyticsSnapshot {
  generatedAt: string | null
  periodLabel: string
  quickStats: AnalyticsQuickStat[]
  headlineCards: AnalyticsMetricCard[]
  salesTrend: TrendPoint[]
  hourlySales: SimpleSeriesPoint[]
  financeComparison: FinanceComparisonPoint[]
  salesByBranch: SimpleSeriesPoint[]
  salesByCashier: AnalyticsTableRow[]
  topCategories: SimpleSeriesPoint[]
  topProducts: AnalyticsTableRow[]
  lowStockProducts: AnalyticsTableRow[]
  customerLeaders: AnalyticsTableRow[]
  technicians: AnalyticsTableRow[]
  repairStatus: SimpleSeriesPoint[]
  insights: AnalyticsInsight[]
  operations: {
    openRegisters: number
    discrepancies: number
    withdrawals: number
    deposits: number
    unresolvedAlerts: number
    criticalAlerts: number
  }
  inventory: {
    lowStockCount: number
    idleProductsCount: number
    turnover: number
    topCategoryName: string
  }
  customers: {
    newCount: number
    recurrentCount: number
    recurrenceRate: number
    bestBuyerName: string
    growth: number | null
  }
  repairs: {
    activeCount: number
    completedCount: number
    avgCycleDays: number
    revenue: number
  }
  finance: {
    operationalRevenue: number
    posRevenue: number
    repairsRevenue: number
    accruedRevenue: number
    accruedExpenses: number
    netProfit: number | null
    margin: number | null
    grossRevenue: number
    visibleExpenses: number
    estimatedProfit: number | null
    growth: number | null
    complete: boolean
    coverageWarnings: FinanceSummaryReport['coverageWarnings']
  }
}

export interface AnalyticsBranchOption {
  id: string
  name: string
  city?: string | null
  code?: string | null
}

interface HookState {
  snapshot: AdminAnalyticsSnapshot
  branchOptions: AnalyticsBranchOption[]
  loading: boolean
  refreshing: boolean
  error: string | null
}

const EMPTY_SNAPSHOT: AdminAnalyticsSnapshot = {
  generatedAt: null,
  periodLabel: 'Sin datos',
  quickStats: [],
  headlineCards: [],
  salesTrend: [],
  hourlySales: [],
  financeComparison: [],
  salesByBranch: [],
  salesByCashier: [],
  topCategories: [],
  topProducts: [],
  lowStockProducts: [],
  customerLeaders: [],
  technicians: [],
  repairStatus: [],
  insights: [],
  operations: {
    openRegisters: 0,
    discrepancies: 0,
    withdrawals: 0,
    deposits: 0,
    unresolvedAlerts: 0,
    criticalAlerts: 0,
  },
  inventory: {
    lowStockCount: 0,
    idleProductsCount: 0,
    turnover: 0,
    topCategoryName: 'Sin categoria',
  },
  customers: {
    newCount: 0,
    recurrentCount: 0,
    recurrenceRate: 0,
    bestBuyerName: 'Sin clientes',
    growth: null,
  },
  repairs: {
    activeCount: 0,
    completedCount: 0,
    avgCycleDays: 0,
    revenue: 0,
  },
  finance: {
    operationalRevenue: 0,
    posRevenue: 0,
    repairsRevenue: 0,
    accruedRevenue: 0,
    accruedExpenses: 0,
    netProfit: null,
    margin: null,
    grossRevenue: 0,
    visibleExpenses: 0,
    estimatedProfit: null,
    growth: null,
    complete: true,
    coverageWarnings: [],
  },
}

const DAY_MS = 24 * 60 * 60 * 1000

interface CategoryRecord {
  name?: string | null
}

interface ProfileRecord {
  id?: string | null
  full_name?: string | null
  email?: string | null
}

interface CustomerRecord {
  id?: string | null
  first_name?: string | null
  last_name?: string | null
  customer_type?: string | null
  email?: string | null
  phone?: string | null
}

interface ProductRecord {
  id?: string | null
  name?: string | null
  purchase_price?: number | string | null
  sale_price?: number | string | null
  stock_quantity?: number | string | null
  stock?: number | string | null
  min_stock?: number | string | null
  is_active?: boolean | null
  category?: CategoryRecord | null
}

interface SaleRecord {
  id?: string | null
  created_at?: string | null
  total_amount?: number | string | null
  total?: number | string | null
  subtotal?: number | string | null
  status?: string | null
  customer_id?: string | null
  cashier_id?: string | null
  user_id?: string | null
  created_by?: string | null
  branch_id?: string | null
}

interface SaleItemRecord {
  id?: string | null
  sale_id?: string | null
  product_id?: string | null
  quantity?: number | string | null
  subtotal?: number | string | null
  total?: number | string | null
  unit_price?: number | string | null
  price?: number | string | null
  product?: ProductRecord | null
}

interface RepairRecord {
  id?: string | null
  created_at?: string | null
  received_at?: string | null
  completed_at?: string | null
  delivered_at?: string | null
  status?: string | null
  final_cost?: number | string | null
  estimated_cost?: number | string | null
  parts_cost?: number | string | null
  technician_id?: string | null
  technician?: ProfileRecord | null
  branch_id?: string | null
}

interface CashClosureRecord {
  id?: string | null
  created_at?: string | null
  branch_id?: string | null
  date?: string | null
  status?: string | null
  discrepancy?: number | string | null
}

interface CashMovementRecord {
  session_id?: string | null
  created_at?: string | null
  type?: string | null
  amount?: number | string | null
}

interface CashAlertRecord {
  session_id?: string | null
  created_at?: string | null
  is_resolved?: boolean | null
  severity?: string | null
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isBetween(date: Date | null, from: Date, to: Date): boolean {
  if (!date) return false
  if (isBefore(date, from)) return false
  if (isAfter(date, to)) return false
  return true
}

// Una reparación cancelada nunca facturó: el cliente no siguió adelante, no
// entró plata. Contarla como ingreso (o como carga de trabajo del técnico)
// infla los números. Cubre las variantes de estado que usa el sistema.
function isCancelledRepairStatus(status: unknown): boolean {
  const value = String(status || '').toLowerCase()
  return value === 'cancelado' || value === 'cancelada' || value === 'cancelled' || value === 'anulado'
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(value)
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function fullNameFromCustomer(customer?: CustomerRecord | null): string {
  if (!customer) return 'Consumidor final'
  const first = String(customer.first_name || '').trim()
  const last = String(customer.last_name || '').trim()
  const joined = `${first} ${last}`.trim()
  return joined || customer.email || customer.phone || 'Cliente sin nombre'
}

function profileName(profile?: ProfileRecord | null): string {
  if (!profile) return 'Equipo'
  return profile.full_name || profile.email || 'Equipo'
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

async function fetchFinanceSummary(filters: AdminAnalyticsFilters): Promise<FinanceSummaryReport> {
  const params = new URLSearchParams({
    startDate: format(startOfDay(filters.from), 'yyyy-MM-dd'),
    endDate: format(endOfDay(filters.to), 'yyyy-MM-dd'),
  })
  if (filters.branch !== 'all') {
    params.set('branchId', filters.branch)
  }

  const response = await fetch(`/api/admin/finances/summary?${params.toString()}`)
  const payload = await response.json().catch(() => null) as FinanceSummaryReport | { error?: string } | null
  if (!response.ok || !payload || !('accrued' in payload)) {
    throw new Error(payload && 'error' in payload ? payload.error : 'No se pudo cargar el resumen financiero.')
  }

  return payload
}

function sumSales(records: SaleRecord[]): number {
  return records.reduce((sum, record) => {
    return sum + toNumber(record.total_amount ?? record.total ?? record.subtotal)
  }, 0)
}

function buildTrendLabel(date: Date, useWeeklyBucket: boolean): { label: string; shortLabel: string } {
  if (useWeeklyBucket) {
    return {
      label: `Semana ${format(date, 'dd MMM')}`,
      shortLabel: format(date, 'dd MMM'),
    }
  }

  return {
    label: format(date, 'dd MMM'),
    shortLabel: format(date, 'dd MMM'),
  }
}

function createFallbackInsight(snapshot: AdminAnalyticsSnapshot): AnalyticsInsight {
  return {
    id: 'stable-baseline',
    tone: 'info',
    title: 'Todo en orden',
    description: 'No hay alertas importantes en este periodo. Buen momento para revisar márgenes, inventario y si los clientes están volviendo.',
    context: snapshot.finance.margin === null
      ? 'Resultado financiero pendiente de cobertura completa'
      : `Margen actual ${snapshot.finance.margin.toFixed(1)}%`,
  }
}

function buildInsights(snapshot: AdminAnalyticsSnapshot): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  if (snapshot.finance.growth !== null) {
    insights.push({
      id: 'growth',
      tone: snapshot.finance.growth >= 0 ? 'success' : 'warning',
      title: snapshot.finance.growth >= 0 ? 'Las ventas están subiendo' : 'Las ventas bajaron respecto al periodo anterior',
      description: `Comparando con el mismo rango anterior, ${snapshot.finance.growth >= 0 ? 'creciste' : 'caíste'} un ${Math.abs(snapshot.finance.growth).toFixed(1)}%.`,
      context: `${snapshot.periodLabel}`,
    })
  }

  if (snapshot.operations.criticalAlerts > 0 || snapshot.operations.discrepancies > 0) {
    insights.push({
      id: 'cash-risk',
      tone: snapshot.operations.criticalAlerts > 0 ? 'danger' : 'warning',
      title: 'Hay problemas con las cajas',
      description: `${snapshot.operations.criticalAlerts} alertas graves y ${formatMoney(snapshot.operations.discrepancies)} en diferencias de dinero detectadas.`,
      context: `${snapshot.operations.openRegisters} cajas abiertas`,
    })
  }

  if (snapshot.inventory.lowStockCount > 0) {
    insights.push({
      id: 'inventory-risk',
      tone: 'warning',
      title: 'Algunos productos se están agotando',
      description: `${snapshot.inventory.lowStockCount} productos tienen stock bajo. La categoría más afectada es ${snapshot.inventory.topCategoryName.toLowerCase()}.`,
      context: `${snapshot.inventory.idleProductsCount} productos sin ventas`,
    })
  }

  if (snapshot.repairs.activeCount > snapshot.repairs.completedCount) {
    insights.push({
      id: 'repair-backlog',
      tone: 'info',
      title: 'El taller tiene más trabajo pendiente que entregado',
      description: `Hay ${snapshot.repairs.activeCount} reparaciones en curso y solo ${snapshot.repairs.completedCount} se entregaron en este periodo.`,
      context: `Demora promedio: ${snapshot.repairs.avgCycleDays.toFixed(1)} días`,
    })
  }

  if (snapshot.customers.recurrenceRate >= 35) {
    insights.push({
      id: 'repeat-customers',
      tone: 'success',
      title: 'Los clientes están volviendo',
      description: `El ${snapshot.customers.recurrenceRate.toFixed(1)}% de los clientes compraron más de una vez en este periodo.`,
      context: `Mejor cliente: ${snapshot.customers.bestBuyerName}`,
    })
  }

  return insights.slice(0, 5)
}

export function useAdminAnalytics(filters: AdminAnalyticsFilters) {
  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  const [state, setState] = useState<HookState>({
    snapshot: EMPTY_SNAPSHOT,
    branchOptions: [],
    loading: true,
    refreshing: false,
    error: null,
  })

  // Cache control: avoid re-fetching if data is fresh
  const lastFetchRef = useRef<{ timestamp: number; key: string } | null>(null)
  const filterKey = useMemo(
    () => `${filters.from.toISOString()}_${filters.to.toISOString()}_${filters.branch}`,
    [filters.from, filters.to, filters.branch]
  )

  const isCacheFresh = useCallback(() => {
    if (!lastFetchRef.current) return false
    if (lastFetchRef.current.key !== filterKey) return false
    return Date.now() - lastFetchRef.current.timestamp < ANALYTICS_CACHE_TTL_MS
  }, [filterKey])

  const fetchAnalytics = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (!supabase) {
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: 'Supabase no esta disponible para analytics.',
      }))
      return
    }

    // Skip fetch if cache is fresh (unless forced initial load with no data)
    if (mode === 'refresh' && isCacheFresh()) {
      setState((previous) => ({ ...previous, refreshing: false }))
      return
    }

    const selectedFrom = startOfDay(filters.from)
    const selectedTo = endOfDay(filters.to)
    const now = new Date()
    const summaryFloor = startOfDay(subDays(now, 29))
    const windowStart = minDate(selectedFrom, summaryFloor)
    const windowEnd = endOfDay(maxDate(selectedTo, now))
    const rangeDays = Math.max(1, Math.round((selectedTo.getTime() - selectedFrom.getTime()) / DAY_MS) + 1)
    const previousTo = endOfDay(subDays(selectedFrom, 1))
    const previousFrom = startOfDay(subDays(selectedFrom, rangeDays))

    setState((previous) => ({
      ...previous,
      loading: mode === 'initial' ? true : previous.loading,
      refreshing: mode === 'refresh',
      error: null,
    }))

    try {
      const [
        salesWindowResponse,
        previousSalesResponse,
        repairsResponse,
        previousRepairsResponse,
        cashClosuresResponse,
        cashMovementsResponse,
        cashAlertsResponse,
        productsResponse,
        productMovementsResponse,
        currentCustomersCountResponse,
        previousCustomersCountResponse,
        financeSummary,
      ] = await Promise.all([
        // Sales: only select needed fields (not full row)
        supabase
          .from('sales')
          .select('id, created_at, total_amount, status, customer_id, created_by, branch_id')
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString()),
        supabase
          .from('sales')
          .select('id, created_at, total_amount, status, branch_id')
          .gte('created_at', previousFrom.toISOString())
          .lte('created_at', previousTo.toISOString()),
        supabase
          .from('repairs')
          .select('id, created_at, received_at, completed_at, delivered_at, status, final_cost, estimated_cost, parts_cost, technician_id, branch_id, technician:profiles!technician_id(id, full_name, email)')
          .gte('created_at', selectedFrom.toISOString())
          .lte('created_at', selectedTo.toISOString()),
        // Previous repairs: only need counts and revenue, minimal fields
        supabase
          .from('repairs')
          .select('id, status, final_cost, estimated_cost, branch_id')
          .gte('created_at', previousFrom.toISOString())
          .lte('created_at', previousTo.toISOString()),
        supabase
          .from('cash_closures')
          .select('id, created_at, branch_id, date, status, discrepancy')
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString()),
        supabase
          .from('cash_movements')
          .select('session_id, created_at, type, amount')
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString()),
        supabase
          .from('cash_alerts')
          .select('session_id, created_at, is_resolved, severity')
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString()),
        supabase
          .from('products')
          .select('id, name, purchase_price, sale_price, stock_quantity, min_stock, is_active, category:categories(name)')
          .eq('is_active', true)
          .limit(2000),
        // Product movements: only need product_id for the "moved" set
        supabase
          .from('product_movements')
          .select('product_id, branch_id')
          .gte('created_at', selectedFrom.toISOString())
          .lte('created_at', selectedTo.toISOString()),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', selectedFrom.toISOString())
          .lte('created_at', selectedTo.toISOString()),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', previousFrom.toISOString())
          .lte('created_at', previousTo.toISOString()),
        fetchFinanceSummary(filters),
      ])

      if (salesWindowResponse.error) throw salesWindowResponse.error
      if (previousSalesResponse.error) throw previousSalesResponse.error
      if (productsResponse.error) throw productsResponse.error

      // Semi-critical: repairs might fail if profiles relation is broken
      if (repairsResponse.error) {
        console.warn('[analytics] repairs query failed:', repairsResponse.error.message)
      }
      if (previousRepairsResponse.error) {
        console.warn('[analytics] previous repairs query failed:', previousRepairsResponse.error.message)
      }

      // Non-critical tables: log but don't throw (they might not exist yet)
      if (cashClosuresResponse.error) {
        console.warn('[analytics] cash_closures query failed:', cashClosuresResponse.error.message)
      }
      if (cashMovementsResponse.error) {
        console.warn('[analytics] cash_movements query failed:', cashMovementsResponse.error.message)
      }
      if (cashAlertsResponse.error) {
        console.warn('[analytics] cash_alerts query failed:', cashAlertsResponse.error.message)
      }
      if (productMovementsResponse.error) {
        console.warn('[analytics] product_movements query failed:', productMovementsResponse.error.message)
      }

      const branchScopedSalesWindow = ((salesWindowResponse.data || []) as SaleRecord[])
        .filter((sale) => isCompletedSaleStatus(sale.status))
        .filter((sale) => filters.branch === 'all' || String(sale.branch_id || 'principal') === filters.branch)
      const previousSales = ((previousSalesResponse.data || []) as SaleRecord[])
        .filter((sale) => isCompletedSaleStatus(sale.status))
        .filter((sale) => filters.branch === 'all' || String(sale.branch_id || 'principal') === filters.branch)
      const selectedSales = branchScopedSalesWindow.filter((sale) => isBetween(toDate(sale.created_at), selectedFrom, selectedTo))
      const quickSales = branchScopedSalesWindow.filter((sale) => isBetween(toDate(sale.created_at), summaryFloor, windowEnd))
      const selectedRepairs = ((repairsResponse.data || []) as RepairRecord[])
        .filter((repair) => filters.branch === 'all' || String(repair.branch_id || 'principal') === filters.branch)
      const previousRepairs = ((previousRepairsResponse.data || []) as RepairRecord[])
        .filter((repair) => filters.branch === 'all' || String(repair.branch_id || 'principal') === filters.branch)
      // Para plata (ingresos, ganancia, carga real del técnico) se excluyen
      // las canceladas: nunca facturaron. selectedRepairs se conserva completo
      // para conteos operativos y el gráfico de estados, que sí deben mostrar
      // las canceladas como una categoría más.
      const revenueRepairs = selectedRepairs.filter((repair) => !isCancelledRepairStatus(repair.status))
      const allClosures = (cashClosuresResponse.data || []) as CashClosureRecord[]
      const allMovements = (cashMovementsResponse.data || []) as CashMovementRecord[]
      const allAlerts = (cashAlertsResponse.data || []) as CashAlertRecord[]
      const baseProducts = (productsResponse.data || []) as Array<ProductRecord & { id: string; stock_quantity?: number | string | null }>
      const inventoryProducts = baseProducts.map((product) => ({
        ...product,
        stock_quantity: toNumber(product.stock_quantity),
      }))
      const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
        supabase as unknown as BranchInventoryClient,
        filters.branch === 'all' ? null : filters.branch,
        baseProducts.map((product) => String(product.id))
      )
      const allProducts = applyBranchInventoryToProducts(
        inventoryProducts,
        stockMap,
        branchScoped
      ) as ProductRecord[]
      const productStockMap = new Map(
        allProducts.map((product) => [
          String(product.id),
          toNumber(product.stock_quantity ?? product.stock),
        ])
      )
      const movedProducts = new Set(
        ((productMovementsResponse.data || []) as Array<{ product_id: string; branch_id?: string | null }>)
          .filter((item) => filters.branch === 'all' || String(item.branch_id || 'principal') === filters.branch)
          .map((item) => item.product_id)
      )

      // Opciones de sucursal para el filtro. Se traen de /api/branches (mismo
      // origen que el selector global), que scopea por organización EN EL
      // SERVIDOR e incluye ciudad/código. Antes esto consultaba la tabla
      // `branches` directo desde el cliente sin filtro de organization_id,
      // confiando solo en RLS: podía listar sucursales de otras organizaciones,
      // mostraba únicamente el nombre (sucursales homónimas indistinguibles) y
      // el fallback pintaba UUIDs crudos como nombre.
      let branchOptions: AnalyticsBranchOption[] = []
      try {
        const branchesResponse = await fetch('/api/branches', { cache: 'no-store' })
        const branchesPayload = await branchesResponse.json().catch(() => null) as {
          branches?: Array<{ id: string; name: string; city?: string | null; code?: string | null; is_active?: boolean | null }>
        } | null

        branchOptions = (branchesPayload?.branches ?? [])
          .filter((b) => b.is_active !== false)
          .map((b) => ({ id: b.id, name: b.name, city: b.city ?? null, code: b.code ?? null }))
      } catch (branchOptionsError) {
        console.warn('[analytics] branch options fetch failed:', branchOptionsError)
        branchOptions = []
      }

      const closureMap = new Map<string, CashClosureRecord>()
      allClosures.forEach((closure) => {
        closureMap.set(String(closure.id), closure)
      })

      const scopedClosures = allClosures.filter((closure) => {
        const closureDate = toDate(closure.created_at)
        if (!isBetween(closureDate, selectedFrom, selectedTo)) return false
        if (filters.branch === 'all') return true
        return String(closure.branch_id || 'principal') === filters.branch
      })

      const scopedMovements = allMovements.filter((movement) => {
        const movementDate = toDate(movement.created_at)
        if (!isBetween(movementDate, selectedFrom, selectedTo)) return false
        if (filters.branch === 'all') return true
        const closure = closureMap.get(String(movement.session_id))
        return String(closure?.branch_id || 'principal') === filters.branch
      })

      const scopedAlerts = allAlerts.filter((alert) => {
        const alertDate = toDate(alert.created_at)
        if (!isBetween(alertDate, selectedFrom, selectedTo)) return false
        if (filters.branch === 'all') return true
        const closure = closureMap.get(String(alert.session_id))
        return String(closure?.branch_id || 'principal') === filters.branch
      })

      const selectedSaleIds = selectedSales.map((sale) => String(sale.id)).filter(Boolean)
      let selectedSaleItems: SaleItemRecord[] = []
      if (selectedSaleIds.length > 0) {
        try {
          const responses = await Promise.all(
            chunkQueryValues(selectedSaleIds).map((saleIds) =>
              supabase
                .from('sale_items')
                .select('id, sale_id, product_id, quantity, subtotal, unit_price, product:products(id, name, purchase_price, stock_quantity, category:categories(name))')
                .in('sale_id', saleIds)
            )
          )
          const failedResponse = responses.find((response) => response.error)
          if (failedResponse?.error) throw failedResponse.error

          selectedSaleItems = responses.flatMap(
            (response) => (response.data ?? []) as unknown as SaleItemRecord[]
          )
        } catch (e) {
          // Sin los items vendidos el reporte se contradice a si mismo: mostraria
          // facturacion real junto a "0 unidades vendidas", categorias vacias y
          // utilidad por producto en cero. Es preferible avisar que no se pudo
          // construir el reporte antes que publicar esos ceros como dato.
          console.warn('[analytics] sale_items query failed:', e)
          throw e
        }
      }

      const customerIds = Array.from(
        new Set(selectedSales.map((sale) => String(sale.customer_id || '')).filter(Boolean))
      )
      const cashierIds = Array.from(
        new Set(selectedSales.map((sale) => String(sale.cashier_id || sale.user_id || sale.created_by || '')).filter(Boolean))
      )

      const [customersResponse, profilesResponse] = await Promise.all([
        customerIds.length > 0
          ? supabase.from('customers').select('id, first_name, last_name, customer_type').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        cashierIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', cashierIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (customersResponse.error) {
        console.warn('[analytics] customers query failed:', customersResponse.error.message || customersResponse.error)
      }
      if (profilesResponse.error) {
        console.warn('[analytics] profiles query failed:', profilesResponse.error.message || profilesResponse.error)
      }

      const customerMap = new Map<string, CustomerRecord>()
      ;((customersResponse.data || []) as CustomerRecord[]).forEach((customer) => {
        customerMap.set(String(customer.id), customer)
      })

      const profileMap = new Map<string, ProfileRecord>()
      ;((profilesResponse.data || []) as ProfileRecord[]).forEach((profile) => {
        profileMap.set(String(profile.id), profile)
      })

      const quickStats: AnalyticsQuickStat[] = (() => {
        const todaySales = quickSales.filter((sale) => {
          const date = toDate(sale.created_at)
          return isBetween(date, startOfDay(now), endOfDay(now))
        })
        const weekSales = quickSales.filter((sale) => {
          const date = toDate(sale.created_at)
          return isBetween(date, startOfDay(subDays(now, 6)), endOfDay(now))
        })
        const todayTotal = sumSales(todaySales)
        const weekTotal = sumSales(weekSales)
        const monthTotal = sumSales(quickSales)

        return [
          { id: 'today', label: 'Hoy', value: todayTotal, formattedValue: formatMoney(todayTotal) },
          { id: 'week', label: '7 dias', value: weekTotal, formattedValue: formatMoney(weekTotal) },
          { id: 'month', label: '30 dias', value: monthTotal, formattedValue: formatMoney(monthTotal) },
        ]
      })()

      const selectedPosRevenue = sumSales(selectedSales)
      const selectedRepairRevenue = revenueRepairs.reduce((sum, repair) => {
        return sum + toNumber(repair.final_cost ?? repair.estimated_cost)
      }, 0)
      const currentGrossRevenue = selectedPosRevenue + selectedRepairRevenue
      // Costo directo de repuestos: solo de las que facturan. Contar el costo
      // de una cancelada (sin contar su ingreso) hundiría la ganancia estimada.
      const withdrawals = scopedMovements
        .filter((movement) => movement.type === 'cash_out')
        .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
      const deposits = scopedMovements
        .filter((movement) => movement.type === 'cash_in')
        .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
      const financeExpenses =
        financeSummary.accrued.directCosts +
        financeSummary.accrued.operatingExpenses +
        financeSummary.accrued.payrollCost
      const financeMargin = financeSummary.accrued.netProfit === null || financeSummary.accrued.revenue <= 0
        ? null
        : (financeSummary.accrued.netProfit / financeSummary.accrued.revenue) * 100
      const financeGrowth = percentChange(
        financeSummary.accrued.revenue,
        financeSummary.comparison.accrued.revenue,
      )

      const selectedOrderCount = selectedSales.length
      const averageTicket = selectedOrderCount > 0 ? selectedPosRevenue / selectedOrderCount : 0
      // "En proceso" = ni entregada, ni lista, ni cancelada. Antes una
      // cancelada contaba como reparación activa (carga de trabajo fantasma).
      const activeRepairs = selectedRepairs.filter((repair) => {
        const status = String(repair.status || '').toLowerCase()
        return !['entregado', 'listo'].includes(status) && !isCancelledRepairStatus(status)
      }).length
      const completedRepairs = selectedRepairs.filter((repair) => String(repair.status || '').toLowerCase() === 'entregado').length
      const unresolvedAlerts = scopedAlerts.filter((alert) => !alert.is_resolved).length
      const criticalAlerts = scopedAlerts.filter((alert) => !alert.is_resolved && String(alert.severity) === 'critical').length
      const discrepancies = scopedClosures.reduce((sum, closure) => sum + Math.abs(toNumber(closure.discrepancy)), 0)

      const lowStockProducts = allProducts
        .filter((product) => {
          const active = product.is_active === undefined ? true : Boolean(product.is_active)
          const stock = toNumber(product.stock_quantity ?? product.stock)
          const minStock = Math.max(1, toNumber(product.min_stock))
          return active && stock <= minStock
        })
        .sort((left, right) => {
          const leftRatio = toNumber(left.stock_quantity ?? left.stock) / Math.max(1, toNumber(left.min_stock))
          const rightRatio = toNumber(right.stock_quantity ?? right.stock) / Math.max(1, toNumber(right.min_stock))
          return leftRatio - rightRatio
        })

      const activeProducts = allProducts.filter((product) => product.is_active !== false)
      const idleProducts = activeProducts.filter((product) => !movedProducts.has(String(product.id)))
      const totalStockVisible = activeProducts.reduce((sum, product) => sum + toNumber(product.stock_quantity ?? product.stock), 0)
      const totalUnitsSold = selectedSaleItems.reduce((sum, item) => sum + toNumber(item.quantity), 0)
      const turnover = totalStockVisible > 0 ? (totalUnitsSold / totalStockVisible) * 100 : 0

      const categoryMap = new Map<string, { revenue: number; quantity: number }>()
      const productMap = new Map<string, { id: string; name: string; revenue: number; quantity: number; profit: number; stock: number }>()

      selectedSaleItems.forEach((item) => {
        const quantity = toNumber(item.quantity)
        const revenue = toNumber(item.subtotal ?? item.total ?? quantity * toNumber(item.unit_price ?? item.price))
        const purchasePrice = toNumber(item.product?.purchase_price)
        const profit = revenue - (quantity * purchasePrice)
        const categoryName = String(item.product?.category?.name || 'Sin categoria')
        const productId = String(item.product_id || item.product?.id || item.id)
        const productName = String(item.product?.name || 'Producto sin nombre')

        const categoryCurrent = categoryMap.get(categoryName) || { revenue: 0, quantity: 0 }
        categoryCurrent.revenue += revenue
        categoryCurrent.quantity += quantity
        categoryMap.set(categoryName, categoryCurrent)

        const productCurrent = productMap.get(productId) || {
          id: productId,
          name: productName,
          revenue: 0,
          quantity: 0,
          profit: 0,
          stock: productStockMap.get(productId) ?? toNumber(item.product?.stock_quantity ?? item.product?.stock),
        }
        productCurrent.revenue += revenue
        productCurrent.quantity += quantity
        productCurrent.profit += profit
        productMap.set(productId, productCurrent)
      })

      const topCategories = Array.from(categoryMap.entries())
        .map(([label, values]) => ({
          label,
          value: values.revenue,
          secondaryValue: values.quantity,
        }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 6)

      const topProducts = Array.from(productMap.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 8)
        .map((product) => ({
          id: product.id,
          label: product.name,
          metric: formatMoney(product.revenue),
          secondary: `${product.quantity} uds`,
          detail: `Margen ${formatMoney(product.profit)} · Stock ${product.stock}`,
        }))

      const customerStats = new Map<string, { name: string; orders: number; total: number }>()
      selectedSales.forEach((sale) => {
        const customerId = String(sale.customer_id || 'walk-in')
        const customer = customerMap.get(customerId)
        const current = customerStats.get(customerId) || {
          name: fullNameFromCustomer(customer),
          orders: 0,
          total: 0,
        }
        current.orders += 1
        current.total += toNumber(sale.total_amount ?? sale.total)
        customerStats.set(customerId, current)
      })

      const recurrentCustomers = Array.from(customerStats.values()).filter((customer) => customer.orders >= 2)
      const recurrenceRate = customerStats.size > 0 ? (recurrentCustomers.length / customerStats.size) * 100 : 0
      const newCustomerGrowth = percentChange(
        currentCustomersCountResponse.count || 0,
        previousCustomersCountResponse.count || 0
      )
      const topBuyers = Array.from(customerStats.entries())
        .filter(([customerId]) => customerId !== 'walk-in')
        .map(([customerId, values]) => ({
          id: customerId,
          label: values.name,
          metric: formatMoney(values.total),
          secondary: `${values.orders} compras`,
          detail: values.orders >= 3 ? 'Alta recurrencia' : 'Cliente activo',
        }))
        .sort((left, right) => {
          const rightValue = customerStats.get(right.id)?.total || 0
          const leftValue = customerStats.get(left.id)?.total || 0
          return rightValue - leftValue
        })
        .slice(0, 6)

      const cashierStats = new Map<string, { name: string; orders: number; total: number }>()
      selectedSales.forEach((sale) => {
        const cashierId = String(sale.cashier_id || sale.user_id || sale.created_by || 'system')
        const current = cashierStats.get(cashierId) || {
          name: profileName(profileMap.get(cashierId)),
          orders: 0,
          total: 0,
        }
        current.orders += 1
        current.total += toNumber(sale.total_amount ?? sale.total)
        cashierStats.set(cashierId, current)
      })

      const salesByCashier = Array.from(cashierStats.entries())
        .map(([cashierId, values]) => ({
          id: cashierId,
          label: values.name,
          metric: formatMoney(values.total),
          secondary: `${values.orders} ventas`,
          detail: `${formatMoney(values.orders > 0 ? values.total / values.orders : 0)} ticket medio`,
        }))
        .sort((left, right) => {
          const rightValue = cashierStats.get(right.id)?.total || 0
          const leftValue = cashierStats.get(left.id)?.total || 0
          return rightValue - leftValue
        })
        .slice(0, 6)

      const repairStatusMap = new Map<string, number>()
      const technicianStats = new Map<string, { name: string; active: number; completed: number; revenue: number; cycleDays: number; cycleCount: number }>()

      selectedRepairs.forEach((repair) => {
        const status = String(repair.status || 'sin estado')
        // El gráfico de estados sí muestra las canceladas (categoría válida).
        repairStatusMap.set(status, (repairStatusMap.get(status) || 0) + 1)

        // Pero el ranking de técnicos no: una cancelada no es carga real ni
        // facturación, así que no suma ni a "activas" ni a "revenue".
        if (isCancelledRepairStatus(status)) return

        const technicianId = String(repair.technician_id || repair.technician?.id || 'unassigned')
        const current = technicianStats.get(technicianId) || {
          name: profileName(repair.technician),
          active: 0,
          completed: 0,
          revenue: 0,
          cycleDays: 0,
          cycleCount: 0,
        }

        const statusLower = status.toLowerCase()
        if (statusLower === 'entregado') current.completed += 1
        else current.active += 1

        current.revenue += toNumber(repair.final_cost ?? repair.estimated_cost)

        const receivedAt = toDate(repair.received_at ?? repair.created_at)
        const completedAt = toDate(repair.completed_at ?? repair.delivered_at)
        if (receivedAt && completedAt) {
          current.cycleDays += Math.max(0, (completedAt.getTime() - receivedAt.getTime()) / DAY_MS)
          current.cycleCount += 1
        }

        technicianStats.set(technicianId, current)
      })

      const technicians = Array.from(technicianStats.entries())
        .map(([technicianId, values]) => ({
          id: technicianId,
          label: values.name,
          metric: `${values.completed} entregadas`,
          secondary: formatMoney(values.revenue),
          detail: `${values.cycleCount > 0 ? (values.cycleDays / values.cycleCount).toFixed(1) : '0.0'} dias promedio`,
        }))
        .sort((left, right) => {
          const rightValue = technicianStats.get(right.id)?.completed || 0
          const leftValue = technicianStats.get(left.id)?.completed || 0
          return rightValue - leftValue
        })
        .slice(0, 6)

      const repairStatus = Array.from(repairStatusMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)

      const salesByBranchMap = new Map<string, number>()
      scopedMovements.forEach((movement) => {
        if (movement.type !== 'sale') return
        const closure = closureMap.get(String(movement.session_id))
        const branch = String(closure?.branch_id || 'principal')
        salesByBranchMap.set(branch, (salesByBranchMap.get(branch) || 0) + toNumber(movement.amount))
      })

      const salesByBranch = Array.from(salesByBranchMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)

      const useWeeklyBuckets = rangeDays > 45
      const trendMap = new Map<string, TrendPoint>()

      // Pre-build sale lookup map for O(1) access in trend builder (avoids O(n²))
      selectedSales.forEach((sale) => {
        const saleDate = toDate(sale.created_at)
        if (!saleDate) return
        const bucketDate = useWeeklyBuckets
          ? startOfDay(subDays(saleDate, saleDate.getDay()))
          : startOfDay(saleDate)
        const key = bucketDate.toISOString()
        const labels = buildTrendLabel(bucketDate, useWeeklyBuckets)
        const current = trendMap.get(key) || {
          label: labels.label,
          shortLabel: labels.shortLabel,
          posRevenue: 0,
          repairRevenue: 0,
          grossRevenue: 0,
          orders: 0,
        }
        const total = toNumber(sale.total_amount ?? sale.total)
        current.posRevenue += total
        current.grossRevenue += total
        current.orders += 1
        trendMap.set(key, current)
      })

      // El gráfico de tendencia refleja ingreso: las canceladas no aportan.
      revenueRepairs.forEach((repair) => {
        const repairDate = toDate(repair.created_at)
        if (!repairDate) return
        const bucketDate = useWeeklyBuckets
          ? startOfDay(subDays(repairDate, repairDate.getDay()))
          : startOfDay(repairDate)
        const key = bucketDate.toISOString()
        const labels = buildTrendLabel(bucketDate, useWeeklyBuckets)
        const current = trendMap.get(key) || {
          label: labels.label,
          shortLabel: labels.shortLabel,
          posRevenue: 0,
          repairRevenue: 0,
          grossRevenue: 0,
          orders: 0,
        }
        const repairRevenue = toNumber(repair.final_cost ?? repair.estimated_cost)
        current.repairRevenue += repairRevenue
        current.grossRevenue += repairRevenue
        trendMap.set(key, current)
      })

      const salesTrend = Array.from(trendMap.entries())
        .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
        .map(([, value]) => value)

      const hourlySalesMap = new Map<number, number>()
      selectedSales.forEach((sale) => {
        const saleDate = toDate(sale.created_at)
        if (!saleDate) return
        const hour = saleDate.getHours()
        hourlySalesMap.set(hour, (hourlySalesMap.get(hour) || 0) + toNumber(sale.total_amount ?? sale.total))
      })

      const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`,
        value: hourlySalesMap.get(hour) || 0,
      }))

      const financeComparison: FinanceComparisonPoint[] = [
        {
          label: 'Actual',
          ingresos: financeSummary.accrued.revenue,
          egresos: financeExpenses,
          ganancia: financeSummary.accrued.netProfit ?? 0,
        },
        {
          label: 'Anterior',
          ingresos: financeSummary.comparison.accrued.revenue,
          egresos:
            financeSummary.comparison.accrued.directCosts +
            financeSummary.comparison.accrued.operatingExpenses +
            financeSummary.comparison.accrued.payrollCost,
          ganancia: financeSummary.comparison.accrued.netProfit ?? 0,
        },
      ]

      const avgCycleDaysBase = Array.from(technicianStats.values()).reduce((sum, technician) => {
        return sum + technician.cycleDays
      }, 0)
      const avgCycleCount = Array.from(technicianStats.values()).reduce((sum, technician) => sum + technician.cycleCount, 0)
      const avgCycleDays = avgCycleCount > 0 ? avgCycleDaysBase / avgCycleCount : 0

      const snapshot: AdminAnalyticsSnapshot = {
        generatedAt: new Date().toISOString(),
        periodLabel: `${format(selectedFrom, 'dd MMM')} - ${format(selectedTo, 'dd MMM')}`,
        quickStats,
        headlineCards: [
          {
            id: 'gross',
            label: 'Total vendido',
            value: formatMoney(currentGrossRevenue),
            rawValue: currentGrossRevenue,
            delta: financeGrowth,
            tone: currentGrossRevenue > 0 ? 'info' : 'neutral',
            helper: 'Ventas + reparaciones del periodo',
          },
          {
            id: 'sales',
            label: 'Cantidad de ventas',
            value: String(selectedOrderCount),
            rawValue: selectedOrderCount,
            delta: percentChange(selectedOrderCount, previousSales.length),
            tone: selectedOrderCount > 0 ? 'success' : 'neutral',
            helper: `${formatMoney(selectedPosRevenue)} facturados`,
          },
          {
            id: 'ticket',
            label: 'Promedio por venta',
            value: formatMoney(averageTicket),
            rawValue: averageTicket,
            delta: percentChange(averageTicket, previousSales.length > 0 ? sumSales(previousSales) / previousSales.length : 0),
            tone: 'neutral',
            helper: 'Cuánto gasta cada cliente en promedio',
          },
          {
            id: 'margin',
            label: 'Margen de ganancia',
            value: financeMargin === null ? 'Pendiente' : `${financeMargin.toFixed(1)}%`,
            rawValue: financeMargin ?? 0,
            delta: null,
            tone: financeMargin === null ? 'warning' : financeMargin >= 20 ? 'success' : financeMargin >= 10 ? 'warning' : 'danger',
            helper: 'Lo que queda después de costos y retiros',
          },
          {
            id: 'repairs',
            label: 'Reparaciones en curso',
            value: String(activeRepairs),
            rawValue: activeRepairs,
            delta: percentChange(activeRepairs, previousRepairs.filter((repair) => {
              const status = String(repair.status || '').toLowerCase()
              return status !== 'entregado' && !isCancelledRepairStatus(status)
            }).length),
            tone: activeRepairs > 0 ? 'info' : 'neutral',
            helper: `${formatMoney(selectedRepairRevenue)} facturados en taller`,
          },
          {
            id: 'alerts',
            label: 'Problemas detectados',
            value: String(unresolvedAlerts),
            rawValue: unresolvedAlerts,
            delta: null,
            tone: criticalAlerts > 0 ? 'danger' : unresolvedAlerts > 0 ? 'warning' : 'success',
            helper: `${criticalAlerts} graves · ${lowStockProducts.length} productos con poco stock`,
          },
        ],
        salesTrend,
        hourlySales,
        financeComparison,
        salesByBranch,
        salesByCashier,
        topCategories,
        topProducts,
        lowStockProducts: lowStockProducts.slice(0, 6).map((product) => ({
          id: String(product.id),
          label: String(product.name || 'Producto'),
          metric: `${toNumber(product.stock_quantity ?? product.stock)} uds`,
          secondary: `Min ${toNumber(product.min_stock)}`,
          detail: String(product.category?.name || 'Sin categoria'),
        })),
        customerLeaders: topBuyers,
        technicians,
        repairStatus,
        insights: [],
        operations: {
          openRegisters: scopedClosures.filter((closure) => !closure.date && String(closure.status || '').toLowerCase() !== 'closed').length,
          discrepancies,
          withdrawals,
          deposits,
          unresolvedAlerts,
          criticalAlerts,
        },
        inventory: {
          lowStockCount: lowStockProducts.length,
          idleProductsCount: idleProducts.length,
          turnover,
          topCategoryName: topCategories[0]?.label || 'Sin categoria',
        },
        customers: {
          newCount: currentCustomersCountResponse.count || 0,
          recurrentCount: recurrentCustomers.length,
          recurrenceRate,
          bestBuyerName: topBuyers[0]?.label || 'Sin clientes',
          growth: newCustomerGrowth,
        },
        repairs: {
          activeCount: activeRepairs,
          completedCount: completedRepairs,
          avgCycleDays,
          revenue: selectedRepairRevenue,
        },
        finance: {
          operationalRevenue: currentGrossRevenue,
          posRevenue: selectedPosRevenue,
          repairsRevenue: selectedRepairRevenue,
          accruedRevenue: financeSummary.accrued.revenue,
          accruedExpenses: financeExpenses,
          netProfit: financeSummary.accrued.netProfit,
          margin: financeMargin,
          grossRevenue: financeSummary.accrued.revenue,
          visibleExpenses: financeExpenses,
          estimatedProfit: financeSummary.accrued.netProfit,
          growth: financeGrowth,
          complete: financeSummary.complete,
          coverageWarnings: financeSummary.coverageWarnings,
        },
      }

      snapshot.insights = buildInsights(snapshot)
      if (snapshot.insights.length === 0) {
        snapshot.insights = [createFallbackInsight(snapshot)]
      }

      setState({
        snapshot,
        branchOptions,
        loading: false,
        refreshing: false,
        error: null,
      })

      // Mark cache as fresh
      lastFetchRef.current = { timestamp: Date.now(), key: filterKey }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error)
      console.error('Error loading admin analytics:', errMsg)
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: 'No se pudo construir el dashboard analytics con los datos actuales.',
      }))
    }
  }, [filters, supabase, isCacheFresh, filterKey])

  useEffect(() => {
    fetchAnalytics('initial')
  }, [fetchAnalytics])

  // No auto-refresh — analytics is a report, not a live feed.
  // User can click "Actualizar" to refresh manually when needed.

  return {
    ...state,
    refresh: () => fetchAnalytics('refresh'),
    forceRefresh: () => {
      lastFetchRef.current = null // Invalidate cache
      return fetchAnalytics('refresh')
    },
  }
}

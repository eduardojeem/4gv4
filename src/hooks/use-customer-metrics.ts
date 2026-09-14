'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/hooks/use-customer-state'
import type { CustomerSpendMetrics } from '@/lib/customers/customer-spend'
import { fetchCustomerSpend } from '@/lib/customers/customer-spend-client'
import { isCountableSale } from '@/lib/customers/customer-spend'

/** Se deriva del tipo de la agregacion para que no puedan divergir. */
export type CustomerMetrics = CustomerSpendMetrics

export type UseCustomerMetricsOptions = {
  timeRange?: '3months' | '6months' | '12months'
  includeInactive?: boolean
  segmentBy?: 'segment' | 'city' | 'customer_type'
  creditSummaries?: Record<string, { total_pending?: number; current_balance?: number }>
}

// Map de métricas por cliente (para listas)
//
// Lo calcula el servidor con la regla única (ver /api/customers/spend). Antes
// eran tres consultas desde el navegador que Supabase cortaba en 1000 filas,
// sin filtro de empresa y contando ventas anuladas.
export function useCustomerSalesMetricsMap(customerIds: string[]) {
  const [loaded, setLoaded] = useState<{ key: string; metrics: Record<string, CustomerMetrics> } | null>(null)
  const key = JSON.stringify([...new Set(customerIds)].sort())

  useEffect(() => {
    const ids = JSON.parse(key) as string[]
    if (ids.length === 0) return
    let cancelled = false

    fetchCustomerSpend(ids)
      .then((metrics) => { if (!cancelled) setLoaded({ key, metrics }) })
      // Sin datos se deja el mapa vacío: la pantalla cae a los totales ya
      // calculados de cada cliente en vez de mostrar un parcial como completo.
      .catch(() => { if (!cancelled) setLoaded({ key, metrics: {} }) })

    return () => { cancelled = true }
  }, [key])

  // Solo vale el resultado de la lista pedida ahora: si cambió, hasta que
  // llegue la nueva no se muestran los totales de la anterior.
  return loaded?.key === key ? loaded.metrics : EMPTY_METRICS
}

const EMPTY_METRICS: Record<string, CustomerMetrics> = {}

// Métricas agregadas para AnalyticsDashboard (compatibles)
export function useCustomerMetrics(customers: Customer[], options?: UseCustomerMetricsOptions) {
  const timeRange = options?.timeRange || '6months'
  const includeInactive = options?.includeInactive ?? true
  const segmentBy = options?.segmentBy || 'segment'

  const totalCustomers = customers.length
  // Total histórico real: los clientes ya llegan con lo gastado calculado.
  const totalRevenue = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
  const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
  const activeCustomers = customers.filter(c => {
    const st = String(c.status || 'active').toLowerCase().trim()
    return st === 'active' || st === 'activo'
  }).length
  const inactiveCustomers = customers.filter(c => {
    const st = String(c.status || '').toLowerCase().trim()
    return st === 'inactive' || st === 'inactivo'
  }).length
  const suspendedCustomers = customers.filter(c => {
    const st = String(c.status || '').toLowerCase().trim()
    return st === 'suspended' || st === 'suspendido'
  }).length
  const vipCustomers = customers.filter(c => {
    const seg = String(c.segment || '').toLowerCase().trim()
    return seg === 'vip'
  }).length

  // Ingresos reales por mes desde la tabla `sales` (clave "YYYY-M").
  // Si la consulta falla, monthlyData cae al estimado homogéneo anterior.
  const months = timeRange === '12months' ? 12 : timeRange === '6months' ? 6 : 3
  const [realMonthly, setRealMonthly] = useState<Map<string, { revenue: number; count: number }> | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchSales = async () => {
      try {
        const start = new Date()
        start.setMonth(start.getMonth() - (months - 1))
        start.setDate(1)
        start.setHours(0, 0, 0, 0)

        const supabase = createClient()
        const { data, error } = await supabase
          .from('sales')
          .select('total_amount, created_at, status')
          .gte('created_at', start.toISOString())

        if (cancelled) return
        if (error || !data) {
          setRealMonthly(null)
          return
        }

        const map = new Map<string, { revenue: number; count: number }>()
        for (const row of data) {
          const created = (row as any).created_at as string | null
          if (!created) continue
          // Una venta anulada no es ingreso del mes.
          if (!isCountableSale((row as { status?: string | null }).status)) continue
          const d = new Date(created)
          const key = `${d.getFullYear()}-${d.getMonth()}`
          const cur = map.get(key) || { revenue: 0, count: 0 }
          cur.revenue += Number((row as any).total_amount) || 0
          cur.count += 1
          map.set(key, cur)
        }
        setRealMonthly(map)
      } catch {
        if (!cancelled) setRealMonthly(null)
      }
    }
    fetchSales()
    return () => {
      cancelled = true
    }
  }, [months])

  const monthlyData = useMemo(() => {
    const now = new Date()
    const data: Array<{ monthShort: string; totalRevenue: number; avgOrderValue: number; newCustomers: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(now.getMonth() - i)
      const monthShort = d.toLocaleString('es-ES', { month: 'short' })
      const newCustomers = customers.filter(c => {
        const dateStr = c.registration_date || c.created_at
        if (!dateStr) return false
        const reg = new Date(dateStr)
        if (isNaN(reg.getTime())) return false
        return reg.getMonth() === d.getMonth() && reg.getFullYear() === d.getFullYear()
      }).length

      const real = realMonthly?.get(`${d.getFullYear()}-${d.getMonth()}`)
      let totalRevenueMonth: number
      let avgOrderValue: number
      if (realMonthly) {
        // Datos reales de ventas del mes
        totalRevenueMonth = real?.revenue || 0
        avgOrderValue = real && real.count > 0 ? real.revenue / real.count : 0
      } else {
        // Fallback: distribución homogénea del revenue estimado
        totalRevenueMonth = totalRevenue / months
        avgOrderValue = totalCustomers > 0 ? totalRevenueMonth / Math.max(1, totalCustomers / months) : 0
      }
      data.push({ monthShort, totalRevenue: totalRevenueMonth, avgOrderValue, newCustomers })
    }
    return data
  }, [customers, totalRevenue, totalCustomers, months, realMonthly])

  const segmentDistribution = useMemo(() => {
    const map: Record<string, number> = {}
    customers.forEach(c => {
      const key = (c as any)[segmentBy] || 'desconocido'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [customers, segmentBy])

  const topCustomers = useMemo(() => {
    const ranked = customers
      .map(c => ({ customer: c, value: c.lifetime_value || 0 }))
      .sort((a, b) => b.value - a.value)
    return ranked.map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [customers])

  const retentionRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 1000) / 10 : 0

  const creditSummaries = options?.creditSummaries || {}

  const getCustomerDebt = (c: Customer) => {
    const summary = creditSummaries[c.id]
    const summaryPending = summary ? Number(summary.total_pending ?? summary.current_balance ?? 0) : 0
    const customerPending = Number(c.current_balance || c.pending_amount || 0)
    return Math.max(0, summaryPending || customerPending)
  }

  const totalDebt = customers.reduce((sum, c) => sum + getCustomerDebt(c), 0)
  const customersWithDebt = customers.filter(c => getCustomerDebt(c) > 0).length

  const debtDistribution = useMemo(() => {
    let alDia = 0
    let deudaBaja = 0 // < 500.000
    let deudaMedia = 0 // 500.000 - 2.000.000
    let deudaAlta = 0 // > 2.000.000

    customers.forEach(c => {
      const debt = getCustomerDebt(c)
      if (debt === 0) alDia++
      else if (debt < 500000) deudaBaja++
      else if (debt < 2000000) deudaMedia++
      else deudaAlta++
    })

    return [
      { name: 'Al día', value: alDia, color: '#10b981' },
      { name: 'Deuda Baja (< 500k)', value: deudaBaja, color: '#3b82f6' },
      { name: 'Deuda Media (500k - 2M)', value: deudaMedia, color: '#f59e0b' },
      { name: 'Deuda Alta (> 2M)', value: deudaAlta, color: '#ef4444' },
    ].filter(item => item.value > 0)
  }, [customers, creditSummaries])

  return {
    totalCustomers,
    totalRevenue,
    totalDebt,
    customersWithDebt,
    avgCustomerValue,
    retentionRate,
    activeCustomers: includeInactive ? activeCustomers : undefined,
    inactiveCustomers: includeInactive ? inactiveCustomers : undefined,
    suspendedCustomers: includeInactive ? suspendedCustomers : undefined,
    vipCustomers,
    monthlyData,
    segmentDistribution,
    debtDistribution,
    topCustomers
  }
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/hooks/use-customer-state'

export type CustomerMetrics = {
  count: number
  total: number
  lastAmount: number
  lastDate: string | null
}

export type UseCustomerMetricsOptions = {
  timeRange?: '3months' | '6months' | '12months'
  includeInactive?: boolean
  segmentBy?: 'segment' | 'city' | 'customer_type'
}

// Map de métricas por cliente (para listas)
export function useCustomerSalesMetricsMap(customerIds: string[]) {
  const [metrics, setMetrics] = useState<Record<string, CustomerMetrics>>({})
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!customerIds || customerIds.length === 0) {
        setMetrics({})
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sales')
        .select('customer_id, total_amount, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
      if (error) {
        setMetrics({})
        return
      }
      const agg: Record<string, CustomerMetrics> = {}
      for (const row of data || []) {
        const cid = String((row as any).customer_id || '')
        if (!cid) continue
        const totalAmt = Number((row as any).total_amount) || 0
        const created = (row as any).created_at as string | null
        if (!agg[cid]) {
          agg[cid] = { count: 1, total: totalAmt, lastAmount: totalAmt, lastDate: created || null }
        } else {
          agg[cid].count += 1
          agg[cid].total += totalAmt
        }
      }
      setMetrics(agg)
    }
    fetchMetrics()
  }, [JSON.stringify(customerIds)])
  return metrics
}

// Métricas agregadas para AnalyticsDashboard (compatibles)
export function useCustomerMetrics(customers: Customer[], options?: UseCustomerMetricsOptions) {
  const timeRange = options?.timeRange || '6months'
  const includeInactive = options?.includeInactive ?? true
  const segmentBy = options?.segmentBy || 'segment'

  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + ((c as any).total_spent_this_year ?? c.lifetime_value ?? 0), 0)
  const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
  const activeCustomers = customers.filter(c => c.status === 'active').length
  const inactiveCustomers = customers.filter(c => c.status === 'inactive').length
  const suspendedCustomers = customers.filter(c => c.status === 'suspended').length
  const vipCustomers = customers.filter(c => c.segment === 'vip').length

  // Mock mensual basado en fechas de registro para compatibilidad visual
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months = timeRange === '12months' ? 12 : timeRange === '6months' ? 6 : 3
    const data: Array<{ monthShort: string; totalRevenue: number; avgOrderValue: number; newCustomers: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(now.getMonth() - i)
      const monthShort = d.toLocaleString('es-ES', { month: 'short' })
      const newCustomers = customers.filter(c => {
        const reg = new Date(c.registration_date)
        return reg.getMonth() === d.getMonth() && reg.getFullYear() === d.getFullYear()
      }).length
      // Simple distribución homogénea del revenue
      const totalRevenueMonth = totalRevenue / months
      const avgOrderValue = totalCustomers > 0 ? totalRevenueMonth / Math.max(1, totalCustomers / months) : 0
      data.push({ monthShort, totalRevenue: totalRevenueMonth, avgOrderValue, newCustomers })
    }
    return data
  }, [customers, totalRevenue, totalCustomers, timeRange])

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
      .map(c => ({ customer: c, value: ((c as any).total_spent_this_year ?? c.lifetime_value ?? 0) as number }))
      .sort((a, b) => b.value - a.value)
    return ranked.map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [customers])

  const retentionRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 1000) / 10 : 0

  return {
    totalCustomers,
    totalRevenue,
    avgCustomerValue,
    retentionRate,
    activeCustomers: includeInactive ? activeCustomers : undefined,
    inactiveCustomers: includeInactive ? inactiveCustomers : undefined,
    suspendedCustomers: includeInactive ? suspendedCustomers : undefined,
    vipCustomers,
    monthlyData,
    segmentDistribution,
    topCustomers
  }
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { isCompletedSaleStatus } from '@/lib/sales-status'

export interface AdminOverviewMetrics {
  todaySalesTotal: number
  todaySalesCount: number
  openCashRegisters: number
  lowStockCount: number
  activeUsersCount: number
}

const INITIAL_METRICS: AdminOverviewMetrics = {
  todaySalesTotal: 0,
  todaySalesCount: 0,
  openCashRegisters: 0,
  lowStockCount: 0,
  activeUsersCount: 0,
}

export function useAdminOverviewMetrics() {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics>(INITIAL_METRICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { organization } = useActiveOrganization()
  const { selectedBranchId } = useBranch()

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient()
      const today = startOfDay(new Date())

      // 1. Ventas del día (monto y cantidad de tickets completados)
      let salesQuery = supabase
        .from('sales')
        .select('total_amount, total, subtotal, status, branch_id, created_at')
        .gte('created_at', today.toISOString())

      if (organization?.id) {
        salesQuery = salesQuery.eq('organization_id', organization.id)
      }
      salesQuery = withBranchFilter(salesQuery, selectedBranchId)

      // 2. Cajas abiertas en tiempo real (sesiones activas sin fecha de cierre)
      let cashQuery = supabase
        .from('cash_closures')
        .select('id', { count: 'exact', head: true })
        .is('date', null)

      if (organization?.id) {
        cashQuery = cashQuery.eq('organization_id', organization.id)
      }
      cashQuery = withBranchFilter(cashQuery, selectedBranchId)

      // 3. Productos activos con stock bajo o en alerta
      let productsQuery = supabase
        .from('products')
        .select('id, stock_quantity, min_stock, is_active')
        .eq('is_active', true)
        .limit(1000)

      if (organization?.id) {
        productsQuery = productsQuery.eq('organization_id', organization.id)
      }

      // 4. Colaboradores activos de ESTA organización (via membresías)
      //    Antes se consultaba `profiles` sin filtrar por org_id, lo que
      //    devolvía usuarios de toda la plataforma.
      let usersQuery = supabase
        .from('organization_members')
        .select('user_id, status', { count: 'exact' })
        .eq('status', 'active')

      if (organization?.id) {
        usersQuery = usersQuery.eq('organization_id', organization.id)
      }

      const [salesRes, cashRes, productsRes, usersRes] = await Promise.allSettled([
        salesQuery,
        cashQuery,
        productsQuery,
        usersQuery,
      ])

      let todaySalesTotal = 0
      let todaySalesCount = 0
      if (salesRes.status === 'fulfilled' && !salesRes.value.error && salesRes.value.data) {
        const completedSales = salesRes.value.data.filter((sale: any) =>
          isCompletedSaleStatus(sale.status)
        )
        todaySalesCount = completedSales.length
        todaySalesTotal = completedSales.reduce((sum: number, sale: any) => {
          const amount = Number(sale.total_amount ?? sale.total ?? sale.subtotal ?? 0)
          return sum + (Number.isFinite(amount) ? amount : 0)
        }, 0)
      }

      let openCashRegisters = 0
      if (cashRes.status === 'fulfilled' && !cashRes.value.error) {
        openCashRegisters = cashRes.value.count ?? 0
      }

      let lowStockCount = 0
      if (productsRes.status === 'fulfilled' && !productsRes.value.error && productsRes.value.data) {
        lowStockCount = productsRes.value.data.filter((p: any) => {
          const stock = Number(p.stock_quantity ?? 0)
          const min = Number(p.min_stock ?? 5)
          return stock <= min
        }).length
      }

      let activeUsersCount = 0
      if (usersRes.status === 'fulfilled' && !usersRes.value.error) {
        // La consulta ya filtra status='active', así que el count es directo.
        activeUsersCount = usersRes.value.count ?? (usersRes.value.data?.length ?? 0)
      }

      setMetrics({
        todaySalesTotal,
        todaySalesCount,
        openCashRegisters,
        lowStockCount,
        activeUsersCount,
      })
      setError(null)
    } catch (err: any) {
      console.warn('[useAdminOverviewMetrics] error loading metrics:', err)
      setError(err?.message || 'Error al cargar métricas')
    } finally {
      setLoading(false)
    }
  }, [organization?.id, selectedBranchId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    metrics,
    loading,
    error,
    refresh,
  }
}

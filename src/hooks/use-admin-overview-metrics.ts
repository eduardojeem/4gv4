'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startOfDay, addDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { loadBranchInventoryStockMap, type BranchInventoryClient } from '@/lib/branches/inventory'
import { isCompletedSaleStatus } from '@/lib/sales-status'

export interface AdminOverviewMetrics {
  todaySalesTotal: number | null
  todaySalesCount: number | null
  openCashRegisters: number | null
  cashAlertsCount: number | null
  lowStockCount: number | null
  activeUsersCount: number | null
}
type MetricGroup = 'sales' | 'cash' | 'inventory' | 'team'
export type OverviewAccess = Record<MetricGroup, boolean>
type MetricErrors = Partial<Record<MetricGroup, string>>
const DEFAULT_ACCESS: OverviewAccess = { sales: true, cash: true, inventory: true, team: true }
const EMPTY_METRICS: AdminOverviewMetrics = {
  todaySalesTotal: null, todaySalesCount: null, openCashRegisters: null,
  cashAlertsCount: null, lowStockCount: null, activeUsersCount: null,
}
const PAGE_SIZE = 500

type QueryResult<T> = { data: T[] | null; count: number | null; error: { message: string } | null }
async function readAll<T>(query: (from: number, to: number) => PromiseLike<QueryResult<T>>, signal: AbortSignal) {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    signal.throwIfAborted()
    const result = await query(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error(result.error.message)
    if (result.count === null) throw new Error('No se pudo verificar la cobertura de los datos.')
    const batch = result.data ?? []
    rows.push(...batch)
    if (rows.length >= result.count) return rows
    if (!batch.length) throw new Error('Los datos cambiaron durante la consulta. Reintentá.')
  }
}

export function useAdminOverviewMetrics(access: OverviewAccess = DEFAULT_ACCESS) {
  const { organization } = useActiveOrganization()
  const { selectedBranchId } = useBranch()
  const organizationId = organization?.id
  const { sales, cash, inventory, team } = access
  const scope = JSON.stringify([organizationId, selectedBranchId, sales, cash, inventory, team])
  const [state, setState] = useState<{
    scope: string; metrics: AdminOverviewMetrics; loading: boolean; errors: MetricErrors; updatedAt: Date | null
  }>({ scope, metrics: EMPTY_METRICS, loading: true, errors: {}, updatedAt: null })
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({ scope, metrics: EMPTY_METRICS, loading: Boolean(organizationId), errors: {}, updatedAt: null })
    if (!organizationId) return
    const metrics = { ...EMPTY_METRICS }
    const errors: MetricErrors = {}
    const run = async (group: MetricGroup, enabled: boolean, work: () => Promise<void>) => {
      if (!enabled) return
      try { await work() } catch {
        errors[group] = 'No disponible. Reintentá para actualizar este indicador.'
      }
    }
    try {
      const supabase = createClient()
      const today = startOfDay(new Date())
      const countRows = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
        const result = await query
        if (result.error) throw new Error(result.error.message)
        if (result.count === null) throw new Error('Conteo no disponible')
        return result.count
      }
      await Promise.all([
        run('sales', sales, async () => {
          const rows = await readAll<{ total_amount: number | null; status: string }>((from, to) =>
            withBranchFilter(supabase.from('sales').select('id,total_amount,status', { count: 'exact' })
              .eq('organization_id', organizationId).gte('created_at', today.toISOString())
              .lt('created_at', addDays(today, 1).toISOString()), selectedBranchId)
              .order('id').range(from, to).abortSignal(controller.signal), controller.signal)
          const completed = rows.filter(row => isCompletedSaleStatus(row.status))
          metrics.todaySalesCount = completed.length
          metrics.todaySalesTotal = completed.reduce((sum, row) => {
            const amount = Number(row.total_amount ?? 0)
            return sum + (Number.isFinite(amount) ? amount : 0)
          }, 0)
        }),
        run('cash', cash, async () => {
          const [open, alerts] = await Promise.all([
            countRows(withBranchFilter(supabase.from('cash_closures').select('id', { count: 'exact', head: true })
              .eq('organization_id', organizationId).is('date', null), selectedBranchId).abortSignal(controller.signal)),
            countRows(withBranchFilter(supabase.from('cash_alerts').select('id', { count: 'exact', head: true })
              .eq('organization_id', organizationId).eq('is_resolved', false), selectedBranchId).abortSignal(controller.signal)),
          ])
          metrics.openCashRegisters = open; metrics.cashAlertsCount = alerts
        }),
        run('inventory', inventory, async () => {
          const products = await readAll<{ id: string; stock_quantity: number | null; min_stock: number | null }>((from, to) =>
            supabase.from('products').select('id,stock_quantity,min_stock', { count: 'exact' })
              .eq('organization_id', organizationId).eq('is_active', true)
              .order('id').range(from, to).abortSignal(controller.signal), controller.signal)
          let stock = products.map(product => ({ stock: Number(product.stock_quantity ?? 0), min: Number(product.min_stock ?? 5) }))
          if (selectedBranchId && selectedBranchId !== 'all' && products.length > 0) {
            const branch = await loadBranchInventoryStockMap(supabase as unknown as BranchInventoryClient, selectedBranchId, products.map(product => product.id))
            if (branch.failed) throw new Error(branch.error ?? 'Stock no disponible')
            stock = products.map(product => ({
              stock: branch.stockMap.get(product.id) ?? 0,
              min: branch.thresholdMap.get(product.id)?.minStock ?? Number(product.min_stock ?? 5),
            }))
          }
          metrics.lowStockCount = stock.filter(product => product.stock <= product.min).length
        }),
        run('team', team, async () => {
          metrics.activeUsersCount = await countRows(supabase.from('organization_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('organization_id', organizationId).eq('status', 'active').abortSignal(controller.signal))
        }),
      ])
    } catch {
      for (const [group, enabled] of Object.entries({ sales, cash, inventory, team })) {
        if (enabled) errors[group as MetricGroup] = 'No se pudieron cargar los indicadores. Reintentá.'
      }
    }
    if (controller.signal.aborted || request.current !== controller) return
    setState({ scope, metrics, loading: false, errors, updatedAt: new Date() })
  }, [scope, organizationId, selectedBranchId, sales, cash, inventory, team])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    return () => { active = false; request.current?.abort() }
  }, [refresh])
  // No mostrar datos de otro alcance mientras comienza la nueva consulta.
  const current = state.scope === scope ? state : {
    metrics: EMPTY_METRICS, loading: Boolean(organizationId), errors: {}, updatedAt: null,
  }
  return { ...current, error: Object.keys(current.errors).length ? 'Algunos indicadores no están disponibles.' : null, refresh }
}
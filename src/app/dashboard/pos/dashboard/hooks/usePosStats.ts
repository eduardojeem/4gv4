import { eachDayOfInterval, format } from 'date-fns'
import { z } from 'zod'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/branch-context'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { getCachedDashboardSummary } from '@/lib/dashboard/summary-cache'
import { calculateProfit } from '../lib/pos-profit'
import { buildDailySales, rangeBounds } from '../lib/pos-dashboard-range'
import { EMPTY_POS_STATS, usePosDetails, type PosStats } from './usePosDetails'
export type { PosStats, PosSaleItem, PosRecentSale, PosEnrichedSale, PosCreditRecord, PosDeliveredRepairRecord } from './usePosDetails'

const amount = z.number().finite()
const summarySchema = z.object({
  totalSales: amount, netSales: amount, totalTransactions: amount, averageTicket: amount,
  totalCost: amount, itemsWithoutCost: amount,
  dailySales: z.array(z.object({ bucket_day: z.string(), sales: amount, transactions: amount })),
  topProducts: z.array(z.object({ name:z.string(), sales:amount, revenue:amount })),
  paymentMethods: z.array(z.object({ name:z.string(), value:amount })),
  recentSales: z.array(z.object({id:z.string(),created_at:z.string(),total:amount.nullable(),payment_method:z.string().nullable(),customer:z.object({name:z.string().nullable()}),customer_name:z.string().nullable(),items_count:amount})),
  creditStats:z.object({totalAmount:amount,count:amount,averageTicket:amount,pendingAmount:amount}),
  repairCreditStats:z.object({totalAmount:amount,count:amount,pendingAmount:amount}),
  repairStats:z.object({totalAmount:amount,deliveredAmount:amount,deliveredCount:amount,readyAmount:amount,readyCount:amount,activeCount:amount,deliveredPartsCost:amount,deliveredLaborCost:amount,netProfit:amount,refundsAmount:amount}),
  refunds:z.object({totalAmount:amount,salesAmount:amount,repairsAmount:amount}),
})
type Summary = z.infer<typeof summarySchema>

export function usePosStats(dateRange: DateRange | undefined) {
  const { scope, currentScope, organizationId: scopeOrganizationId } = useTenantScope()
  const { selectedBranchId, selectedBranch } = useBranch()
  const { organization, isLoading: organizationLoading } = useActiveOrganization()
  const organizationId = organization?.id ?? null
  const branchId = selectedBranchId ?? selectedBranch?.id ?? null
  const bounds = rangeBounds(dateRange)
  const from = bounds?.from
  const to = bounds?.to
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const key = JSON.stringify(['pos', scope, organizationId, branchId, from, to, organization?.role, 'analytics.read', timezone])
  const keyRef = useRef(key)
  useLayoutEffect(() => { keyRef.current = key }, [key])
  const supabase = useMemo(() => createClient(), [])
  const [snapshot, setSnapshot] = useState<{key: string; stats: PosStats} | null>(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<{key:string;error:Error} | null>(null)
  const error = failure?.key === key ? failure.error : null
  const setError = useCallback((error:Error|null) => setFailure(error ? {key,error}:null),[key])
  const [detailSnapshot, setDetailSnapshot] = useState<{key: string; stats: PosStats} | null>(null)
  const { refetch: fetchFullDetails } = usePosDetails(dateRange, false)
  const [detailsLoadingKey, setDetailsLoadingKey] = useState<string | null>(null)
  const detailsLoading = detailsLoadingKey === key
  const [detailFailure, setDetailFailure] = useState<{key:string;error:Error} | null>(null)
  const detailsError = detailFailure?.key === key ? detailFailure.error : null
  const currentKey = snapshot?.key === key
  const detailsLoaded = detailSnapshot?.key === key
  const summary = currentKey ? snapshot.stats : EMPTY_POS_STATS
  const stats = detailsLoaded ? { ...summary, allSales: detailSnapshot.stats.allSales, allCredits: detailSnapshot.stats.allCredits, allRepairCredits: detailSnapshot.stats.allRepairCredits, repairStats: { ...summary.repairStats, deliveredRepairs: detailSnapshot.stats.repairStats.deliveredRepairs } } : summary

  const fetchSummary = useCallback(async (force = false, signal?: AbortSignal) => {
    if (organizationLoading || (scopeOrganizationId && organizationId !== scopeOrganizationId)) return
    if (!organizationId || !from || !to) { setLoading(false); setError(new Error(!organizationId ? 'No hay una organización activa para mostrar estadísticas.' : 'Selecciona un período válido.')); return }
    setLoading(true); setError(null)
    try {
      const raw = await getCachedDashboardSummary<Summary>(key, async () => {
        let query = supabase.rpc('dashboard_pos_summary' as never, { p_organization_id: organizationId, p_branch_id: branchId === 'all' ? null : branchId, p_from: from, p_to: to, p_timezone: timezone } as never)
        if (signal) query = query.abortSignal(signal)
        const { data, error } = await query
        if (error) throw new Error(error.message || 'No se pudo cargar el resumen del POS')
        if (!data || typeof data !== 'object') throw new Error('Resumen del POS no disponible; aplica la migración dashboard_pos_summary.')
        const parsed = summarySchema.safeParse(data)
        if (!parsed.success) throw new Error('El resumen del POS tiene un formato inválido. Reintentá o revisá la migración.')
        const expectedDays = eachDayOfInterval({start:new Date(from),end:new Date(to)}).map(day=>format(day,'yyyy-MM-dd'))
        const dailyBuckets = new Map(parsed.data.dailySales.map(day=>[day.bucket_day,day]))
        if (parsed.data.dailySales.length !== expectedDays.length || dailyBuckets.size !== expectedDays.length || expectedDays.some(day=>!dailyBuckets.has(day))) throw new Error('El resumen diario está incompleto. Reintentá la consulta.')
        return parsed.data
      }, { force, signal })
      if (signal?.aborted || currentScope.current !== scope || keyRef.current !== key) return
      const expectedDays = eachDayOfInterval({start:new Date(from),end:new Date(to)}).map(day=>format(day,'yyyy-MM-dd'))
      const dailyBuckets = new Map(raw.dailySales.map(day=>[day.bucket_day,day]))
      const profit = calculateProfit({ totalSales: raw.totalSales - raw.refunds.salesAmount, netSales: raw.netSales - raw.refunds.salesAmount, totalCost: raw.totalCost, repairDeliveredAmount: raw.repairStats.netProfit })
      const colors: Record<string,string> = { Efectivo:'#10b981', Tarjeta:'#3b82f6', Transferencia:'#f59e0b', Credito:'#8b5cf6', Otros:'#6b7280' }
      const next: PosStats = { ...EMPTY_POS_STATS, ...raw, allSales: [], allCredits: [], allRepairCredits: [],
        repairStats: { ...raw.repairStats, deliveredRepairs: [] },
        recentSales: raw.recentSales.map(sale=>({...sale,total:sale.total??null,payment_method:sale.payment_method??null,customer_name:sale.customer_name??null,customer:{name:sale.customer?.name??null}})),
        topProduct: raw.topProducts[0] ?? {name:'N/A',sales:0},
        dailySales: buildDailySales({from: new Date(from), to: new Date(to)}, []).map((day,i) => ({ ...day, sales: dailyBuckets.get(expectedDays[i])!.sales, transactions: dailyBuckets.get(expectedDays[i])!.transactions })),
        paymentMethods: raw.paymentMethods.map(method => ({ ...method, color: colors[method.name] ?? '#6b7280' })),
        profitStats: { ...profit, itemsWithoutCost: raw.itemsWithoutCost }, warnings: raw.itemsWithoutCost ? [`${raw.itemsWithoutCost} ítem(s) vendidos no tienen precio de compra cargado: el margen mostrado es optimista.`] : [] }
      setSnapshot({key,stats:next})
    } catch (cause) {
      if (!signal?.aborted && currentScope.current === scope && keyRef.current === key) setError(cause instanceof Error ? cause : new Error('No se pudo cargar el resumen'))
    } finally { if (!signal?.aborted && currentScope.current === scope && keyRef.current === key) setLoading(false) }
  }, [organizationLoading, organizationId, scopeOrganizationId, from, to, key, branchId, scope, currentScope, supabase, setError, timezone])
  useEffect(() => {
    const controller = new AbortController()
    void fetchSummary(false, controller.signal)
    return () => controller.abort()
  }, [fetchSummary])
  const loadDetails = useCallback(async () => {
    if (snapshot?.key !== key) throw new Error('Esperá a que se complete el resumen del período antes de solicitar el detalle.')
    if (detailSnapshot?.key === key) return detailSnapshot.stats
    const requestKey = key
    setDetailsLoadingKey(key); setDetailFailure(null)
    try {
      const loaded = await fetchFullDetails()
      const incomplete = loaded?.warnings.filter(message => !message.includes('precio de compra cargado'))
      if (!loaded || incomplete?.length) throw new Error(incomplete?.join(' ') || 'No se pudo cargar el detalle completo')
      if (currentScope.current !== scope || keyRef.current !== requestKey) throw new Error('El ámbito cambió. Vuelve a solicitar el detalle.')
      setDetailSnapshot({key:requestKey,stats:loaded})
      return loaded
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error('No se pudo cargar el detalle')
      if (keyRef.current === requestKey) setDetailFailure({key:requestKey,error:failure})
      throw failure
    } finally { if (keyRef.current === requestKey) setDetailsLoadingKey(null) }
  }, [fetchFullDetails, key, currentScope, scope, detailSnapshot, snapshot])
  const refetch = useCallback(async () => { setDetailSnapshot(null); await fetchSummary(true) }, [fetchSummary])
  return { stats, loading: organizationLoading || loading || (!currentKey && !error), error, refetch, detailsLoaded, detailsLoading, detailsError, loadDetails }
}

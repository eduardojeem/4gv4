import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfDay, format, parseISO, endOfDay, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'

export interface PosStats {
    totalSales: number
    totalTransactions: number
    averageTicket: number
    topProduct: { name: string; sales: number }
    dailySales: Array<{ date: string; fullDate: string; sales: number; transactions: number }>
    paymentMethods: Array<{ name: string; value: number; color: string }>
    topProducts: Array<{ name: string; sales: number; revenue: number }>
    recentSales: any[]
    creditStats: {
        totalAmount: number
        count: number
        averageTicket: number
        pendingAmount: number
    }
    repairStats: {
        totalAmount: number
        deliveredAmount: number
        deliveredCount: number
        readyAmount: number
        readyCount: number
        activeCount: number
    }
    profitStats: {
        totalCost: number
        salesProfit: number
        repairProfit: number
        totalProfit: number
        profitMargin: number
    }
}

interface UsePosStatsReturn {
    stats: PosStats
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

export function usePosStats(dateRange: DateRange | undefined): UsePosStatsReturn {
    const [stats, setStats] = useState<PosStats>({
        totalSales: 0,
        totalTransactions: 0,
        averageTicket: 0,
        topProduct: { name: 'N/A', sales: 0 },
        dailySales: [],
        paymentMethods: [],
        topProducts: [],
        recentSales: [],
        creditStats: {
            totalAmount: 0,
            count: 0,
            averageTicket: 0,
            pendingAmount: 0
        },
        repairStats: {
            totalAmount: 0,
            deliveredAmount: 0,
            deliveredCount: 0,
            readyAmount: 0,
            readyCount: 0,
            activeCount: 0
        },
        profitStats: {
            totalCost: 0,
            salesProfit: 0,
            repairProfit: 0,
            totalProfit: 0,
            profitMargin: 0
        }
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const supabase = useMemo(() => createClient(), [])

    const fetchStats = useCallback(async () => {
        if (!dateRange?.from) return

        setLoading(true)
        setError(null)

        try {
            const from = startOfDay(dateRange.from).toISOString()
            const to = endOfDay(dateRange.to || dateRange.from).toISOString()

            // 1. Fetch Sales Summary
            const salesPromise = supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    total:total_amount,
                    payment_method
                `)
                .gte('created_at', from)
                .lte('created_at', to)
                .order('created_at', { ascending: false })

            // 2. Fetch Credits
            const creditsPromise = supabase
                .from('customer_credits')
                .select(`
                    id,
                    principal,
                    created_at,
                    status
                `)
                .gte('created_at', from)
                .lte('created_at', to)

            // 3. Fetch Recent Sales
            const recentPromise = supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    total:total_amount,
                    payment_method,
                    customer:customers!customer_id(name),
                    sale_items(
                        quantity,
                        subtotal,
                        product:products(name)
                    )
                `)
                .gte('created_at', from)
                .lte('created_at', to)
                .order('created_at', { ascending: false })
                .limit(10)

            // 4. Fetch Repairs created in date range
            const repairsCreatedPromise = supabase
                .from('repairs')
                .select(`
                    id,
                    created_at,
                    delivered_at,
                    status,
                    final_cost,
                    estimated_cost,
                    paid_amount
                `)
                .gte('created_at', from)
                .lte('created_at', to)

            // 5. Fetch Repairs delivered in date range
            const repairsDeliveredPromise = supabase
                .from('repairs')
                .select(`
                    id,
                    created_at,
                    delivered_at,
                    status,
                    final_cost,
                    estimated_cost,
                    paid_amount
                `)
                .gte('delivered_at', from)
                .lte('delivered_at', to)

            // 6. Fetch Ready Repairs
            const repairsReadyPromise = supabase
                .from('repairs')
                .select(`
                    id,
                    final_cost,
                    estimated_cost,
                    paid_amount
                `)
                .eq('status', 'listo')

            // 7. Fetch Active Repairs Count
            const repairsActivePromise = supabase
                .from('repairs')
                .select('id', { count: 'exact', head: true })
                .in('status', ['recibido', 'diagnostico', 'reparacion', 'en_reparacion', 'pausado'])

            // Execute parallel primary queries
            const [
                { data: salesData, error: salesError },
                { data: creditData, error: creditError },
                { data: recentData, error: recentError },
                { data: repairsCreatedData, error: repairsCreatedError },
                { data: repairsDeliveredData, error: repairsDeliveredError },
                { data: repairsReadyData },
                { count: repairsActiveCount }
            ] = await Promise.all([
                salesPromise,
                creditsPromise,
                recentPromise,
                repairsCreatedPromise,
                repairsDeliveredPromise,
                repairsReadyPromise,
                repairsActivePromise
            ])

            if (salesError) throw salesError
            if (recentError) console.error('Error fetching recent:', recentError)
            if (creditError) console.error('Error fetching credits:', creditError)
            if (repairsCreatedError) console.error('Error fetching repairs created:', repairsCreatedError)
            if (repairsDeliveredError) console.error('Error fetching repairs delivered:', repairsDeliveredError)

            // --- Secondary Query: Fetch items for the retrieved sale IDs ---
            const saleIds = (salesData || []).map(s => s.id)
            let itemsData: any[] = []

            if (saleIds.length > 0) {
                const { data: items, error: itemsError } = await supabase
                    .from('sale_items')
                    .select(`
                        quantity,
                        subtotal,
                        sale_id,
                        product:products(name, cost_price, price)
                    `)
                    .in('sale_id', saleIds)

                if (itemsError) {
                    console.error('Error fetching items:', itemsError)
                } else {
                    itemsData = items || []
                }
            }

            // --- Processing ---

            const totalSales = salesData?.reduce((acc, sale) => acc + (sale.total || 0), 0) || 0
            const totalTransactions = salesData?.length || 0
            const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0

            const credits = creditData || []
            const creditTotalAmount = credits.reduce((sum, c) => sum + (c.principal || 0), 0)
            const creditCount = credits.length
            const creditAvgTicket = creditCount > 0 ? creditTotalAmount / creditCount : 0
            const creditPendingAmount = credits
                .filter(c => c.status === 'active' || c.status === 'defaulted')
                .reduce((sum, c) => sum + (c.principal || 0), 0)

            // Process Repairs Stats
            type RepairRow = { id: string; final_cost?: number | null; estimated_cost?: number | null; paid_amount?: number | null; status?: string; delivered_at?: string | null }
            const repairsCreated = (repairsCreatedData || []) as unknown as RepairRow[]
            const repairTotalAmount = repairsCreated.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)

            const repairsDelivered = (repairsDeliveredData || []) as unknown as RepairRow[]
            const repairDeliveredAmount = repairsDelivered.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? r.paid_amount ?? 0) || 0), 0)
            const repairDeliveredCount = repairsDelivered.length

            const repairsReady = (repairsReadyData || []) as unknown as RepairRow[]
            const repairReadyAmount = repairsReady.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)
            const repairReadyCount = repairsReady.length
            const repairActiveCount = repairsActiveCount || 0

            // Process Profit & Margin Stats
            let totalCost = 0
            const productMap = new Map<string, { name: string; sales: number; revenue: number }>()

            itemsData.forEach((item: any) => {
                const name = item.product?.name || 'Producto eliminado'
                const costPrice = Number(item.product?.cost_price || 0)
                const qty = Number(item.quantity || 0)
                const subtotal = Number(item.subtotal || 0)

                totalCost += costPrice * qty

                const current = productMap.get(name) || { name, sales: 0, revenue: 0 }
                productMap.set(name, {
                    name,
                    sales: current.sales + qty,
                    revenue: current.revenue + subtotal
                })
            })

            const salesProfit = totalSales > totalCost ? totalSales - totalCost : 0
            const repairProfit = repairDeliveredAmount
            const totalProfit = salesProfit + repairProfit
            const profitMargin = totalSales > 0 ? (salesProfit / totalSales) * 100 : 0

            const topProducts = Array.from(productMap.values())
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 5)

            const topProduct = topProducts[0] || { name: 'N/A', sales: 0 }

            // Process Daily Sales with Gap Filling
            const daysInInterval = eachDayOfInterval({
                start: dateRange.from,
                end: dateRange.to || dateRange.from
            })

            const daysMap = new Map<string, { date: string; fullDate: string; sales: number; transactions: number }>()

            daysInInterval.forEach(day => {
                const key = format(day, 'dd/MM')
                daysMap.set(key, {
                    date: key,
                    fullDate: format(day, 'EEEE dd/MM/yyyy', { locale: es }),
                    sales: 0,
                    transactions: 0
                })
            })

            salesData?.forEach((sale: any) => {
                const d = parseISO(sale.created_at)
                const key = format(d, 'dd/MM')

                if (daysMap.has(key)) {
                    const entry = daysMap.get(key)!
                    entry.sales += (sale.total || 0)
                    entry.transactions += 1
                }
            })

            const dailySales = Array.from(daysMap.values())

            // Process Payment Methods
            const methodsMap = new Map<string, number>()
            salesData?.forEach((sale: any) => {
                let method = sale.payment_method || 'Otros'
                if (method === 'cash' || method === 'efectivo') method = 'Efectivo'
                else if (method === 'card' || method === 'tarjeta') method = 'Tarjeta'
                else if (method === 'credit') method = 'Credito'
                else if (method === 'transfer' || method === 'transferencia') method = 'Transferencia'
                else method = method.charAt(0).toUpperCase() + method.slice(1)

                methodsMap.set(method, (methodsMap.get(method) || 0) + (sale.total || 0))
            })

            const colors: Record<string, string> = {
                'Efectivo': '#10b981',
                'Tarjeta': '#3b82f6',
                'Transferencia': '#f59e0b',
                'Credito': '#8b5cf6',
                'Otros': '#6b7280'
            }

            const paymentMethods = Array.from(methodsMap.entries()).map(([name, value]) => ({
                name,
                value,
                color: colors[name] || '#6b7280'
            }))

            // Process Recent Sales
            const recentSales = (recentData || []).map((sale: any) => ({
                ...sale,
                items_count: sale.sale_items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0,
                customer_name: sale.customer?.name || 'Cliente Casual'
            }))

            setStats({
                totalSales,
                totalTransactions,
                averageTicket,
                topProduct,
                dailySales,
                paymentMethods,
                topProducts,
                recentSales,
                creditStats: {
                    totalAmount: creditTotalAmount,
                    count: creditCount,
                    averageTicket: creditAvgTicket,
                    pendingAmount: creditPendingAmount
                },
                repairStats: {
                    totalAmount: repairTotalAmount,
                    deliveredAmount: repairDeliveredAmount,
                    deliveredCount: repairDeliveredCount,
                    readyAmount: repairReadyAmount,
                    readyCount: repairReadyCount,
                    activeCount: repairActiveCount
                },
                profitStats: {
                    totalCost,
                    salesProfit,
                    repairProfit,
                    totalProfit,
                    profitMargin
                }
            })

        } catch (err) {
            console.error('Error fetching POS stats:', err)
            setError(err instanceof Error ? err : new Error('Unknown error'))
        } finally {
            setLoading(false)
        }
    }, [dateRange, supabase])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return { stats, loading, error, refetch: fetchStats }
}

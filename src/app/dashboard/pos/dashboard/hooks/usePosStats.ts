import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfDay, format, parseISO, endOfDay, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { calculateProfit, calculateSalesCost, type ProfitResult } from '../lib/pos-profit'

export interface PosStats {
    totalSales: number
    totalTransactions: number
    averageTicket: number
    topProduct: { name: string; sales: number }
    dailySales: Array<{ date: string; fullDate: string; sales: number; transactions: number }>
    paymentMethods: Array<{ name: string; value: number; color: string }>
    topProducts: Array<{ name: string; sales: number; revenue: number }>
    recentSales: any[]
    allSales: any[]
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
        deliveredPartsCost: number
        deliveredLaborCost: number
        netProfit: number
        refundsAmount: number
        deliveredRepairs: any[]
    }
    refunds: {
        totalAmount: number
        salesAmount: number
        repairsAmount: number
    }
    /** Facturacion sin IVA del periodo. */
    netSales: number
    /** Ganancia calculada sobre ambas bases: el interruptor no refetchea. */
    profitStats: ProfitResult & {
        /** Items cuyo producto no tiene costo cargado. */
        itemsWithoutCost: number
    }
    /** Consultas que fallaron. La UI avisa en vez de mostrar ceros. */
    warnings: string[]
}

interface UsePosStatsReturn {
    stats: PosStats
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

const EMPTY_FIGURES = { revenue: 0, salesProfit: 0, totalProfit: 0, profitMargin: 0 }

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
        allSales: [],
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
            activeCount: 0,
            deliveredPartsCost: 0,
            deliveredLaborCost: 0,
            netProfit: 0,
            refundsAmount: 0,
            deliveredRepairs: []
        },
        refunds: {
            totalAmount: 0,
            salesAmount: 0,
            repairsAmount: 0
        },
        netSales: 0,
        profitStats: {
            totalCost: 0,
            repairProfit: 0,
            taxTotal: 0,
            withTax: EMPTY_FIGURES,
            withoutTax: EMPTY_FIGURES,
            costUnavailable: false,
            itemsWithoutCost: 0
        },
        warnings: []
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
                    code,
                    total:total_amount,
                    net:subtotal_amount,
                    payment_method,
                    customer:customers!customer_id(name)
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
                    ticket_number,
                    device_brand,
                    device_model,
                    created_at,
                    delivered_at,
                    status,
                    final_cost,
                    estimated_cost,
                    paid_amount,
                    parts_cost,
                    labor_cost,
                    payment_status
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

            // 8. Fetch Refunds
            const afterSalesPromise = supabase
                .from('after_sales_cases')
                .select('id, source_type, refund_amount, status, request_type, sale_id')
                .not('refund_amount', 'is', null)
                .gte('resolved_at', from)
                .lte('resolved_at', to)

            // Execute parallel primary queries
            const [
                { data: salesData, error: salesError },
                { data: creditData, error: creditError },
                { data: recentData, error: recentError },
                { data: repairsCreatedData, error: repairsCreatedError },
                { data: repairsDeliveredData, error: repairsDeliveredError },
                { data: repairsReadyData },
                { count: repairsActiveCount },
                { data: afterSalesData, error: afterSalesError }
            ] = await Promise.all([
                salesPromise,
                creditsPromise,
                recentPromise,
                repairsCreatedPromise,
                repairsDeliveredPromise,
                repairsReadyPromise,
                repairsActivePromise,
                afterSalesPromise
            ])

            if (salesError) throw salesError

            // Los errores parciales ya no se descartan en silencio: se juntan
            // para que la UI muestre que ese bloque no tiene datos reales, en
            // lugar de dibujar un cero indistinguible de un dato verdadero.
            const warnings: string[] = []
            if (recentError) warnings.push('No se pudieron cargar las transacciones recientes.')
            if (creditError) warnings.push('No se pudieron cargar los créditos.')
            if (repairsCreatedError) warnings.push('No se pudieron cargar las reparaciones del período.')
            if (repairsDeliveredError) warnings.push('No se pudieron cargar las reparaciones entregadas.')

            // --- Secondary Query: Fetch items for the retrieved sale IDs ---
            const saleIds = (salesData || []).map(s => s.id)
            let itemsData: any[] = []
            let costUnavailable = false

            if (saleIds.length > 0) {
                const { data: items, error: itemsError } = await supabase
                    .from('sale_items')
                    .select(`
                        quantity,
                        subtotal,
                        sale_id,
                        product:products(name, purchase_price)
                    `)
                    .in('sale_id', saleIds)

                if (itemsError) {
                    // Sin items no hay costo. Antes esto dejaba totalCost en 0
                    // y la ganancia salia igual a la facturacion.
                    costUnavailable = true
                    warnings.push('No se pudo calcular el costo de mercadería: la ganancia y el margen no están disponibles.')
                } else {
                    itemsData = items || []
                }
            }

            // --- Processing ---

            const totalSales = salesData?.reduce((acc, sale) => acc + (sale.total || 0), 0) || 0
            // Base sin IVA. Si una venta no tiene subtotal se usa su total, para
            // no restar un IVA que no conocemos.
            const netSales = salesData?.reduce(
                (acc, sale) => acc + ((sale as { net?: number | null }).net ?? sale.total ?? 0),
                0
            ) || 0
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
            type RepairRow = { id: string; ticket_number?: string | null; device_brand?: string | null; device_model?: string | null; final_cost?: number | null; estimated_cost?: number | null; paid_amount?: number | null; parts_cost?: number | null; labor_cost?: number | null; payment_status?: string | null; status?: string; delivered_at?: string | null; created_at?: string | null }
            const repairsCreated = (repairsCreatedData || []) as unknown as RepairRow[]
            const repairTotalAmount = repairsCreated.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)

            const repairsDelivered = (repairsDeliveredData || []) as unknown as RepairRow[]
            const repairDeliveredAmount = repairsDelivered.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? r.paid_amount ?? 0) || 0), 0)
            const repairDeliveredCount = repairsDelivered.length
            
            const repairDeliveredPartsCost = repairsDelivered.reduce((sum, r) => sum + (Number(r.parts_cost) || 0), 0)
            const repairDeliveredLaborCost = repairsDelivered.reduce((sum, r) => sum + (Number(r.labor_cost) || 0), 0)
            
            // Procesar reembolsos resueltos
            const afterSales = afterSalesData || []
            const repairRefundsAmount = afterSales
                .filter(c => c.source_type === 'repair' && (c.status === 'resolved' || c.status === 'approved'))
                .reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0)
            const saleRefundsAmount = afterSales
                .filter(c => (c.source_type === 'sale' || c.source_type === 'product' || c.source_type === 'sale_item') && (c.status === 'resolved' || c.status === 'approved'))
                .reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0)
            const totalRefundsAmount = repairRefundsAmount + saleRefundsAmount

            // Ganancia neta de taller descuenta costo de repuestos y devoluciones
            const repairNetProfit = repairDeliveredAmount - repairDeliveredPartsCost - repairRefundsAmount

            const repairsReady = (repairsReadyData || []) as unknown as RepairRow[]
            const repairReadyAmount = repairsReady.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)
            const repairReadyCount = repairsReady.length
            const repairActiveCount = repairsActiveCount || 0

            // Costo y ganancia: en pos-profit.ts, con tests.
            const costBreakdown = calculateSalesCost(itemsData)
            const profit = calculateProfit({
                totalSales: totalSales - saleRefundsAmount,
                netSales: netSales - saleRefundsAmount,
                totalCost: costBreakdown.totalCost,
                repairDeliveredAmount: repairNetProfit,
                costUnavailable
            })

            if (!costUnavailable && costBreakdown.itemsWithoutCost > 0) {
                warnings.push(
                    `${costBreakdown.itemsWithoutCost} ítem(s) vendidos no tienen precio de compra cargado: el margen mostrado es optimista.`
                )
            }

            const topProducts = costBreakdown.products.slice(0, 5)
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

            // Build allSales enriched with items cost
            const validSalesData = salesData || []
            const allSales = validSalesData.map((sale: any) => {
                const saleItems = itemsData.filter((i: any) => i.sale_id === sale.id)
                const saleCost = calculateSalesCost(saleItems).totalCost
                const refundAmount = saleRefundsAmount > 0 
                    ? afterSales.filter(c => c.source_type === 'sale' && c.sale_id === sale.id && (c.status === 'resolved' || c.status === 'approved')).reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0)
                    : 0
                return {
                    ...sale,
                    cost: saleCost,
                    refundAmount,
                    profit: (sale.total || 0) - saleCost - refundAmount
                }
            })

            // Fix recentSales missing fields
            const recentSales = (recentData || []).map((sale: any) => ({
                id: sale.id,
                created_at: sale.created_at,
                total: sale.total,
                payment_method: sale.payment_method,
                customer: sale.customer,
                items: sale.sale_items
            }))

            setStats({
                totalSales,
                totalTransactions: validSalesData.length,
                averageTicket,
                topProduct,
                dailySales,
                paymentMethods,
                topProducts,
                recentSales,
                allSales,
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
                    activeCount: repairActiveCount,
                    deliveredPartsCost: repairDeliveredPartsCost,
                    deliveredLaborCost: repairDeliveredLaborCost,
                    netProfit: repairNetProfit,
                    refundsAmount: repairRefundsAmount,
                    deliveredRepairs: repairsDelivered
                },
                refunds: {
                    totalAmount: totalRefundsAmount,
                    salesAmount: saleRefundsAmount,
                    repairsAmount: repairRefundsAmount
                },
                netSales,
                profitStats: {
                    ...profit,
                    itemsWithoutCost: costBreakdown.itemsWithoutCost
                },
                warnings
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

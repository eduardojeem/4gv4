import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfDay, subDays, format, parseISO, endOfDay, eachDayOfInterval } from 'date-fns'
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
        }
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const supabase = createClient()

    const fetchStats = useCallback(async () => {
        if (!dateRange?.from) return

        setLoading(true)
        setError(null)

        try {
            const from = startOfDay(dateRange.from).toISOString()
            const to = endOfDay(dateRange.to || dateRange.from).toISOString()

            // Fetch sales
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select(`
          id,
          created_at,
          total:total_amount,
          payment_method,
          customer:customers(name),
          sale_items(
            quantity,
            subtotal,
            product:products(name)
          )
        `)
                .gte('created_at', from)
                .lte('created_at', to)
                .order('created_at', { ascending: false })

            if (salesError) throw salesError

            // Calculate KPIs - Basic sales data first
            const totalSales = salesData?.reduce((acc, sale) => acc + (sale.total || 0), 0) || 0
            const totalTransactions = salesData?.length || 0
            
            // Fetch credit sales (separately, as they might not be in sales table or need specific details)
            const { data: creditData, error: creditError } = await supabase
                .from('customer_credits')
                .select(`
                    id,
                    principal,
                    created_at,
                    status
                `)
                .gte('created_at', from)
                .lte('created_at', to)
            
            if (creditError) console.error('Error fetching credits:', creditError)

            const credits = creditData || []
            
            // Calculate Credit Stats
            const creditTotalAmount = credits.reduce((sum, c) => sum + (c.principal || 0), 0)
            const creditCount = credits.length
            const creditAvgTicket = creditCount > 0 ? creditTotalAmount / creditCount : 0
            
            // Note: pendingAmount usually refers to outstanding balance, which might be across ALL time,
            // but here we might just want to show "how much credit was issued and is still pending" from this period?
            // Or maybe just total issued.
            // Let's assume "pendingAmount" means credit issued in this period that is still active/defaulted.
            const creditPendingAmount = credits
                .filter(c => c.status === 'active' || c.status === 'defaulted')
                .reduce((sum, c) => sum + (c.principal || 0), 0)

            // Merge Credit Sales into Total Sales if they are NOT in sales table
            // Assumption: createCreditSale does NOT create a sales record currently.
            // We should add them to totals for accuracy.
            
            // However, to avoid double counting if they ARE in sales table (with payment_method='credit'),
             // we should check if we have sales with payment_method='credit'.
             const hasCreditInSales = salesData?.some(s => s.payment_method === 'credit')
  
             let finalTotalSales = totalSales
             let finalTotalTransactions = totalTransactions
  
             if (!hasCreditInSales && creditCount > 0) {
                 finalTotalSales += creditTotalAmount
                 finalTotalTransactions += creditCount
            }

            // Calculate KPIs
            const averageTicket = finalTotalTransactions > 0 ? finalTotalSales / finalTotalTransactions : 0

            // Process Top Products
            const productMap = new Map<string, { name: string; sales: number; revenue: number }>()

            salesData?.forEach((sale: any) => {
                sale.sale_items?.forEach((item: any) => {
                    const name = item.product?.name || 'Producto eliminado'
                    const current = productMap.get(name) || { name, sales: 0, revenue: 0 }

                    productMap.set(name, {
                        name,
                        sales: current.sales + (item.quantity || 0),
                        revenue: current.revenue + (item.subtotal || 0)
                    })
                })
            })

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

            // Initialize all days with 0
            daysInInterval.forEach(day => {
                const key = format(day, 'dd/MM')
                daysMap.set(key, {
                    date: key,
                    fullDate: format(day, 'EEEE dd/MM/yyyy', { locale: es }),
                    sales: 0,
                    transactions: 0
                })
            })

            // Fill with data
            salesData?.forEach((sale: any) => {
                const d = parseISO(sale.created_at)
                const key = format(d, 'dd/MM')

                if (daysMap.has(key)) {
                    const entry = daysMap.get(key)!
                    entry.sales += (sale.total || 0)
                    entry.transactions += 1
                }
            })

            // Fill with credit data if not in sales
            if (!hasCreditInSales) {
                credits.forEach((credit: any) => {
                    const d = parseISO(credit.created_at)
                    const key = format(d, 'dd/MM')

                    if (daysMap.has(key)) {
                        const entry = daysMap.get(key)!
                        entry.sales += (credit.principal || 0)
                        entry.transactions += 1
                    }
                })
            }

            const dailySales = Array.from(daysMap.values())

            // Process Payment Methods
            const methodsMap = new Map<string, number>()
            salesData?.forEach((sale: any) => {
                let method = sale.payment_method || 'Otros'
                if (method === 'cash' || method === 'efectivo') method = 'Efectivo'
                else if (method === 'card' || method === 'tarjeta') method = 'Tarjeta' // Removed 'credit' from here to separate it if it exists
                else if (method === 'credit') method = 'Crédito'
                else if (method === 'transfer' || method === 'transferencia') method = 'Transferencia'
                else method = method.charAt(0).toUpperCase() + method.slice(1)

                methodsMap.set(method, (methodsMap.get(method) || 0) + (sale.total || 0))
            })

            // Add credits from customer_credits table if not in sales
            if (!hasCreditInSales && creditCount > 0) {
                 methodsMap.set('Crédito', (methodsMap.get('Crédito') || 0) + creditTotalAmount)
            }

            const colors: Record<string, string> = {
                'Efectivo': '#10b981',
                'Tarjeta': '#3b82f6',
                'Transferencia': '#f59e0b',
                'Crédito': '#8b5cf6', // Violet/Purple for Credit
                'Otros': '#6b7280'
            }

            const paymentMethods = Array.from(methodsMap.entries()).map(([name, value]) => ({
                name,
                value,
                color: colors[name] || '#6b7280'
            }))

            // Process Recent Sales
            const recentSales = (salesData || []).slice(0, 10).map((sale: any) => ({
                ...sale,
                items_count: sale.sale_items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0,
                customer_name: sale.customer?.name || 'Cliente Casual'
            }))

            setStats({
                totalSales: finalTotalSales,
                totalTransactions: finalTotalTransactions,
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface Sale {
    id: string
    sale_number: string
    customer_id?: string
    customer_name?: string
    subtotal: number
    tax: number
    discount: number
    total: number
    payment_method: string
    payment_status: string
    cashier_id?: string
    notes?: string
    created_at: string
    items?: SaleItem[]
}

export interface SaleItem {
    id: string
    sale_id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    discount: number
    subtotal: number
}

export interface SalesStats {
    total_sales: number
    total_revenue: number
    avg_ticket: number
    total_items_sold: number
    top_products: Array<{ name: string; quantity: number }>
}

export function useSales() {
    const [sales, setSales] = useState<Sale[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<SalesStats>({
        total_sales: 0,
        total_revenue: 0,
        avg_ticket: 0,
        total_items_sold: 0,
        top_products: []
    })

    const supabase = createClient()

    // Fetch sales
    const fetchSales = useCallback(async (dateFilter?: { from: string; to: string }) => {
        try {
            setLoading(true)

            let query = supabase
                .from('sales')
                .select(`
          *,
          sale_items (
            *,
            products (name)
          )
        `)
                .order('created_at', { ascending: false })

            if (dateFilter) {
                query = query
                    .gte('created_at', dateFilter.from)
                    .lte('created_at', dateFilter.to)
            }

            const { data, error } = await query

            if (error) throw error

            // Transform data
            const transformedSales: Sale[] = (data || []).map(sale => ({
                ...sale,
                total: sale.total_amount,
                tax: sale.tax_amount,
                discount: sale.discount_amount,
                subtotal: sale.total_amount - (sale.tax_amount || 0) + (sale.discount_amount || 0),
                items: (sale.sale_items || []).map((item: { id: string; product_id: string; quantity: number; price: number; subtotal: number; products?: { name: string } }) => ({
                    ...item,
                    total: item.subtotal,
                    product_name: item.products?.name || 'Unknown'
                }))
            }))

            setSales(transformedSales)
            calculateStats(transformedSales)
        } catch (error: unknown) {
            console.error('Error fetching sales:', error)
            toast.error('Error al cargar ventas')
        } finally {
            setLoading(false)
        }
    }, [])

    // Calculate stats
    const calculateStats = (salesData: Sale[]) => {
        const totalSales = salesData.length
        const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total, 0)
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0

        // Calculate total items sold
        const totalItemsSold = salesData.reduce((sum, sale) => {
            return sum + (sale.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0)
        }, 0)

        // Calculate top products
        const productMap = new Map<string, { name: string; quantity: number }>()

        salesData.forEach(sale => {
            sale.items?.forEach(item => {
                const existing = productMap.get(item.product_id)
                if (existing) {
                    existing.quantity += item.quantity
                } else {
                    productMap.set(item.product_id, {
                        name: item.product_name,
                        quantity: item.quantity
                    })
                }
            })
        })

        const topProducts = Array.from(productMap.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5)

        setStats({
            total_sales: totalSales,
            total_revenue: totalRevenue,
            avg_ticket: avgTicket,
            total_items_sold: totalItemsSold,
            top_products: topProducts
        })
    }

    // Get sale by ID
    const getSale = useCallback(async (saleId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select(`
          *,
          sale_items (
            *,
            products (name)
          ),
          payments (*)
        `)
                .eq('id', saleId)
                .single()

            if (error) throw error

            return data
        } catch (error: unknown) {
            console.error('Error fetching sale:', error)
            toast.error('Error al cargar venta')
            return null
        }
    }, [])

    // Cancel sale
    const cancelSale = useCallback(async (saleId: string, reason: string) => {
        try {
            const { data: sale, error: fetchError } = await supabase
                .from('sales')
                .select('*, sale_items (*)')
                .eq('id', saleId)
                .single()

            if (fetchError) throw fetchError

            // Update sale status
            const { error: updateError } = await supabase
                .from('sales')
                .update({
                    payment_status: 'cancelled',
                    notes: `${sale.notes || ''}\n\nCANCELADA: ${reason}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', saleId)

            if (updateError) throw updateError

            // Restore stock
            for (const item of sale.sale_items) {
                const { data: product } = await supabase
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', item.product_id)
                    .single()

                if (product) {
                    await supabase
                        .from('products')
                        .update({
                            stock_quantity: (product.stock_quantity || 0) + item.quantity
                        })
                        .eq('id', item.product_id)
                }
            }

            toast.success('Venta cancelada')
            await fetchSales()
        } catch (error: unknown) {
            console.error('Error cancelling sale:', error)
            toast.error('Error al cancelar venta')
        }
    }, [fetchSales])

    // Real-time subscription
    useEffect(() => {
        fetchSales()

        const channel = supabase
            .channel('sales-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sales'
                },
                () => {
                    fetchSales()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchSales])

    return {
        sales,
        loading,
        stats,
        fetchSales,
        getSale,
        cancelSale,
        refresh: fetchSales
    }
}

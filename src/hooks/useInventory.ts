'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface InventoryProduct {
    id: string
    name: string
    sku: string
    barcode?: string
    price: number
    stock_quantity: number
    min_stock?: number
    category: string
    image?: string
    tax_rate?: number
    is_active: boolean
    wholesale_price?: number
}

export interface LowStockAlert {
    id: string
    name: string
    sku: string
    current_stock: number
    min_stock: number
}

export function useInventory() {
    const [products, setProducts] = useState<InventoryProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])

    const supabase = createClient()

    // Fetch products
    const fetchProducts = useCallback(async (activeOnly: boolean = true) => {
        try {
            setLoading(true)

            let query = supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true })

            if (activeOnly) {
                query = query.eq('is_active', true)
            }

            const { data, error } = await query

            if (error) throw error

            setProducts(data || [])

            // Calculate low stock alerts
            const alerts: LowStockAlert[] = (data || [])
                .filter(p => p.min_stock && p.stock_quantity <= p.min_stock)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    current_stock: p.stock_quantity,
                    min_stock: p.min_stock || 0
                }))

            setLowStockAlerts(alerts)

            if (alerts.length > 0) {
                toast.warning(`${alerts.length} producto(s) con stock bajo`)
            }
        } catch (error: unknown) {
            console.error('Error fetching products:', error)
            toast.error('Error al cargar productos')
        } finally {
            setLoading(false)
        }
    }, [])

    // Search products
    const searchProducts = useCallback(async (query: string) => {
        if (!query.trim()) {
            return products
        }

        const searchTerm = query.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm) ||
            p.barcode?.toLowerCase().includes(searchTerm)
        )
    }, [products])

    // Get product by barcode
    const getProductByBarcode = useCallback(async (barcode: string) => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('barcode', barcode)
                .eq('is_active', true)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    toast.error('Producto no encontrado')
                    return null
                }
                throw error
            }

            return data
        } catch (error: unknown) {
            console.error('Error finding product:', error)
            toast.error('Error al buscar producto')
            return null
        }
    }, [])

    // Update stock
    const updateStock = useCallback(async (productId: string, quantity: number, operation: 'add' | 'subtract' = 'subtract') => {
        try {
            const product = products.find(p => p.id === productId)
            if (!product) {
                toast.error('Producto no encontrado')
                return false
            }

            const newStock = operation === 'add'
                ? product.stock_quantity + quantity
                : product.stock_quantity - quantity

            if (newStock < 0) {
                toast.error('Stock insuficiente')
                return false
            }

            const { error } = await supabase
                .from('products')
                .update({
                    stock_quantity: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId)

            if (error) throw error

            await fetchProducts()
            return true
        } catch (error: unknown) {
            console.error('Error updating stock:', error)
            toast.error('Error al actualizar stock')
            return false
        }
    }, [products, fetchProducts])

    // Adjust stock (for corrections)
    const adjustStock = useCallback(async (productId: string, newStock: number, reason: string) => {
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    stock_quantity: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId)

            if (error) throw error

            // Log the adjustment
            await supabase
                .from('stock_adjustments')
                .insert({
                    product_id: productId,
                    quantity: newStock,
                    reason,
                    created_at: new Date().toISOString()
                })

            toast.success('Stock ajustado')
            await fetchProducts()
            return true
        } catch (error: unknown) {
            console.error('Error adjusting stock:', error)
            toast.error('Error al ajustar stock')
            return false
        }
    }, [fetchProducts])

    // Real-time subscription
    useEffect(() => {
        fetchProducts()

        const channel = supabase
            .channel('inventory-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'products'
                },
                () => {
                    fetchProducts()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchProducts])

    return {
        products,
        loading,
        lowStockAlerts,
        fetchProducts,
        searchProducts,
        getProductByBarcode,
        updateStock,
        adjustStock,
        refresh: fetchProducts
    }
}

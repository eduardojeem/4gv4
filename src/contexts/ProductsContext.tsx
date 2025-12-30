'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

export interface Product {
    id: string
    name: string
    description?: string
    sku: string
    category: string
    price: number
    cost?: number
    stock: number
    min_stock: number
    image_url?: string
    active: boolean
    created_at: string
    updated_at: string
}

export interface ProductFormData {
    name: string
    description?: string
    sku: string
    category: string
    price: number
    cost?: number
    stock: number
    min_stock: number
    image_url?: string
    active?: boolean
}

export interface ProductsContextValue {
    products: Product[]
    isLoading: boolean
    error: Error | null

    fetchProducts: () => Promise<void>
    createProduct: (data: ProductFormData) => Promise<Product | null>
    updateProduct: (id: string, data: Partial<Product>) => Promise<Product | null>
    deleteProduct: (id: string) => Promise<boolean>
    updateStock: (id: string, quantity: number, operation: 'add' | 'subtract' | 'set') => Promise<boolean>

    getLowStockProducts: () => Product[]
    getProductsByCategory: (category: string) => Product[]
    searchProducts: (query: string) => Product[]
    getProductById: (id: string) => Product | undefined
    refreshProducts: () => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined)

// ============================================================================
// Provider
// ============================================================================

interface ProductsProviderProps {
    children: ReactNode
}

export function ProductsProvider({ children }: ProductsProviderProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Use ref to access latest products in callbacks without adding dependencies
    const productsRef = useRef(products)
    useEffect(() => {
        productsRef.current = products
    }, [products])

    const supabase = createClient()

    // Fetch all products
    const fetchProducts = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true })

            if (fetchError) throw fetchError

            setProducts(data || [])
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al cargar productos: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }, [supabase])

    // Create product
    const createProduct = useCallback(async (data: ProductFormData): Promise<Product | null> => {
        try {
            setError(null)

            const { data: newProduct, error: createError } = await supabase
                .from('products')
                .insert([{
                    name: data.name,
                    description: data.description,
                    sku: data.sku,
                    category: data.category,
                    price: data.price,
                    cost: data.cost,
                    stock: data.stock,
                    min_stock: data.min_stock,
                    image_url: data.image_url,
                    active: data.active ?? true
                }])
                .select()
                .single()

            if (createError) throw createError

            setProducts(prev => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)))
            toast.success('Producto creado exitosamente')
            return newProduct
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al crear producto: ' + error.message)
            return null
        }
    }, [supabase])

    // Update product
    const updateProduct = useCallback(async (
        id: string,
        data: Partial<Product>
    ): Promise<Product | null> => {
        try {
            setError(null)

            const { data: updatedProduct, error: updateError } = await supabase
                .from('products')
                .update(data)
                .eq('id', id)
                .select()
                .single()

            if (updateError) throw updateError

            setProducts(prev =>
                prev.map(product => product.id === id ? updatedProduct : product)
            )
            toast.success('Producto actualizado exitosamente')
            return updatedProduct
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al actualizar producto: ' + error.message)
            return null
        }
    }, [supabase])

    // Delete product
    const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
        try {
            setError(null)

            const { error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError

            setProducts(prev => prev.filter(product => product.id !== id))
            toast.success('Producto eliminado exitosamente')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al eliminar producto: ' + error.message)
            return false
        }
    }, [supabase])

    // Update stock
    const updateStock = useCallback(async (
        id: string,
        quantity: number,
        operation: 'add' | 'subtract' | 'set' = 'set'
    ): Promise<boolean> => {
        try {
            setError(null)

            const product = productsRef.current.find(p => p.id === id)
            if (!product) throw new Error('Producto no encontrado')

            let newStock: number
            switch (operation) {
                case 'add':
                    newStock = product.stock + quantity
                    break
                case 'subtract':
                    newStock = Math.max(0, product.stock - quantity)
                    break
                case 'set':
                default:
                    newStock = Math.max(0, quantity)
            }

            const { data: updatedProduct, error: updateError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', id)
                .select()
                .single()

            if (updateError) throw updateError

            setProducts(prev =>
                prev.map(p => p.id === id ? updatedProduct : p)
            )

            // Show warning if stock is low
            if (newStock <= updatedProduct.min_stock) {
                toast.warning(`Stock bajo: ${updatedProduct.name} (${newStock} unidades)`)
            } else {
                toast.success('Stock actualizado exitosamente')
            }

            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al actualizar stock: ' + error.message)
            return false
        }
    }, [supabase])

    // Get low stock products
    const getLowStockProducts = useCallback((): Product[] => {
        return products.filter(product => product.stock <= product.min_stock && product.active)
    }, [products])

    // Get products by category
    const getProductsByCategory = useCallback((category: string): Product[] => {
        return products.filter(product => product.category === category)
    }, [products])

    // Search products
    const searchProducts = useCallback((query: string): Product[] => {
        if (!query.trim()) return products

        const lowerQuery = query.toLowerCase()
        return products.filter(
            product =>
                product.name.toLowerCase().includes(lowerQuery) ||
                product.sku.toLowerCase().includes(lowerQuery) ||
                product.description?.toLowerCase().includes(lowerQuery) ||
                product.category.toLowerCase().includes(lowerQuery)
        )
    }, [products])

    // Get product by ID
    const getProductById = useCallback((id: string): Product | undefined => {
        return products.find(product => product.id === id)
    }, [products])

    // Refresh products (alias for fetchProducts)
    const refreshProducts = fetchProducts

    // Initial fetch
    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    // Supabase realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('products_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setProducts(prev => [...prev, payload.new as Product].sort((a, b) => a.name.localeCompare(b.name)))
                    } else if (payload.eventType === 'UPDATE') {
                        setProducts(prev =>
                            prev.map(product =>
                                product.id === payload.new.id ? payload.new as Product : product
                            )
                        )
                        // Check for low stock
                        const updatedProduct = payload.new as Product
                        if (updatedProduct.stock <= updatedProduct.min_stock && updatedProduct.active) {
                            toast.warning(`⚠️ Stock bajo: ${updatedProduct.name}`, {
                                description: `Solo quedan ${updatedProduct.stock} unidades`
                            })
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setProducts(prev =>
                            prev.filter(product => product.id !== payload.old.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<ProductsContextValue>(() => ({
        products,
        isLoading,
        error,
        fetchProducts,
        createProduct,
        updateProduct,
        deleteProduct,
        updateStock,
        getLowStockProducts,
        getProductsByCategory,
        searchProducts,
        getProductById,
        refreshProducts
    }), [
        products,
        isLoading,
        error,
        fetchProducts,
        createProduct,
        updateProduct,
        deleteProduct,
        updateStock,
        getLowStockProducts,
        getProductsByCategory,
        searchProducts,
        getProductById,
        refreshProducts
    ])

    return (
        <ProductsContext.Provider value={value}>
            {children}
        </ProductsContext.Provider>
    )
}

// ============================================================================
// Hook
// ============================================================================

export function useProducts() {
    const context = useContext(ProductsContext)
    if (context === undefined) {
        throw new Error('useProducts must be used within a ProductsProvider')
    }
    return context
}

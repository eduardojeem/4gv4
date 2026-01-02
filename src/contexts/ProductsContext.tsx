'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { resolveProductImageUrl } from '@/lib/images'

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
    // Standardized image field
    image?: string | null
    // Legacy compatibility
    image_url?: string | null
    images?: string[] | null
    
    active: boolean
    created_at: string
    updated_at: string
    // Original DB fields for compatibility
    sale_price?: number
    purchase_price?: number
    stock_quantity?: number
    is_active?: boolean
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
    // Standardized image handling
    images?: string[]
    // Legacy support
    image_url?: string
    image?: string
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
                .select('*, category:categories(name)')
                .order('name', { ascending: true })

            if (fetchError) throw fetchError

            const mappedProducts: Product[] = (data || []).map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                sku: item.sku,
                category: item.category?.name || item.category_id || 'Uncategorized',
                price: item.sale_price,
                cost: item.purchase_price,
                stock: item.stock_quantity,
                min_stock: item.min_stock,
                image_url: item.images?.[0] || null,
                image: item.images?.[0] || null,
                active: item.is_active,
                created_at: item.created_at,
                updated_at: item.updated_at,
                // Keep originals
                sale_price: item.sale_price,
                purchase_price: item.purchase_price,
                stock_quantity: item.stock_quantity,
                is_active: item.is_active,
                images: item.images
            }))

            setProducts(mappedProducts)
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

            const dbData = {
                name: data.name,
                description: data.description,
                sku: data.sku,
                category_id: data.category,
                sale_price: data.price,
                purchase_price: data.cost,
                stock_quantity: data.stock,
                min_stock: data.min_stock,
                images: data.image ? [data.image] : (data.image_url ? [data.image_url] : []),
                is_active: data.active ?? true
            }

            const { data: newProduct, error: createError } = await supabase
                .from('products')
                .insert([dbData])
                .select('*, category:categories(name)')
                .single()

            if (createError) throw createError

            const mappedProduct: Product = {
                id: newProduct.id,
                name: newProduct.name,
                description: newProduct.description,
                sku: newProduct.sku,
                category: newProduct.category?.name || newProduct.category_id || 'Uncategorized',
                price: newProduct.sale_price,
                cost: newProduct.purchase_price,
                stock: newProduct.stock_quantity,
                min_stock: newProduct.min_stock,
                image_url: newProduct.images?.[0] || null,
                image: newProduct.images?.[0] || null,
                active: newProduct.is_active,
                created_at: newProduct.created_at,
                updated_at: newProduct.updated_at,
                sale_price: newProduct.sale_price,
                purchase_price: newProduct.purchase_price,
                stock_quantity: newProduct.stock_quantity,
                is_active: newProduct.is_active,
                images: newProduct.images
            }

            setProducts(prev => [...prev, mappedProduct].sort((a, b) => a.name.localeCompare(b.name)))
            toast.success('Producto creado exitosamente')
            return mappedProduct
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

            const dbData: any = {}
            if (data.name !== undefined) dbData.name = data.name
            if (data.description !== undefined) dbData.description = data.description
            if (data.sku !== undefined) dbData.sku = data.sku
            if (data.category !== undefined) dbData.category_id = data.category
            if (data.price !== undefined) dbData.sale_price = data.price
            if (data.cost !== undefined) dbData.purchase_price = data.cost
            if (data.stock !== undefined) dbData.stock_quantity = data.stock
            if (data.min_stock !== undefined) dbData.min_stock = data.min_stock
            if (data.image !== undefined) dbData.images = [data.image]
            else if (data.image_url !== undefined) dbData.images = [data.image_url]
            if (data.active !== undefined) dbData.is_active = data.active

            const { data: updatedProduct, error: updateError } = await supabase
                .from('products')
                .update(dbData)
                .eq('id', id)
                .select('*, category:categories(name)')
                .single()

            if (updateError) throw updateError

            const mappedProduct: Product = {
                id: updatedProduct.id,
                name: updatedProduct.name,
                description: updatedProduct.description,
                sku: updatedProduct.sku,
                category: updatedProduct.category?.name || updatedProduct.category_id || 'Uncategorized',
                price: updatedProduct.sale_price,
                cost: updatedProduct.purchase_price,
                stock: updatedProduct.stock_quantity,
                min_stock: updatedProduct.min_stock,
                image_url: updatedProduct.images?.[0] || null,
                image: updatedProduct.images?.[0] || null,
                active: updatedProduct.is_active,
                created_at: updatedProduct.created_at,
                updated_at: updatedProduct.updated_at,
                sale_price: updatedProduct.sale_price,
                purchase_price: updatedProduct.purchase_price,
                stock_quantity: updatedProduct.stock_quantity,
                is_active: updatedProduct.is_active,
                images: updatedProduct.images
            }

            setProducts(prev =>
                prev.map(product => product.id === id ? mappedProduct : product)
            )
            toast.success('Producto actualizado exitosamente')
            return mappedProduct
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
                .update({ stock_quantity: newStock })
                .eq('id', id)
                .select('*, category:categories(name)')
                .single()

            if (updateError) throw updateError

            const mappedProduct: Product = {
                id: updatedProduct.id,
                name: updatedProduct.name,
                description: updatedProduct.description,
                sku: updatedProduct.sku,
                category: updatedProduct.category?.name || updatedProduct.category_id || 'Uncategorized',
                price: updatedProduct.sale_price,
                cost: updatedProduct.purchase_price,
                stock: updatedProduct.stock_quantity,
                min_stock: updatedProduct.min_stock,
                image_url: updatedProduct.images?.[0] || null,
                image: updatedProduct.images?.[0] || null,
                active: updatedProduct.is_active,
                created_at: updatedProduct.created_at,
                updated_at: updatedProduct.updated_at,
                sale_price: updatedProduct.sale_price,
                purchase_price: updatedProduct.purchase_price,
                stock_quantity: updatedProduct.stock_quantity,
                is_active: updatedProduct.is_active,
                images: updatedProduct.images
            }

            setProducts(prev =>
                prev.map(p => p.id === id ? mappedProduct : p)
            )

            // Show warning if stock is low
            if (newStock <= mappedProduct.min_stock) {
                toast.warning(`Stock bajo: ${mappedProduct.name} (${newStock} unidades)`)
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
                        const newProduct = payload.new as any
                        const mappedProduct: Product = {
                            id: newProduct.id,
                            name: newProduct.name,
                            description: newProduct.description,
                            sku: newProduct.sku,
                            category: 'Uncategorized',
                            price: newProduct.sale_price,
                            cost: newProduct.purchase_price,
                            stock: newProduct.stock_quantity,
                            min_stock: newProduct.min_stock,
                            image_url: newProduct.images?.[0] || null,
                            image: newProduct.images?.[0] || null,
                            active: newProduct.is_active,
                            created_at: newProduct.created_at,
                            updated_at: newProduct.updated_at,
                            sale_price: newProduct.sale_price,
                            purchase_price: newProduct.purchase_price,
                            stock_quantity: newProduct.stock_quantity,
                            is_active: newProduct.is_active,
                            images: newProduct.images
                        }
                        setProducts(prev => [...prev, mappedProduct].sort((a, b) => a.name.localeCompare(b.name)))
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedProduct = payload.new as any
                        const mappedProduct: Product = {
                            id: updatedProduct.id,
                            name: updatedProduct.name,
                            description: updatedProduct.description,
                            sku: updatedProduct.sku,
                            category: 'Uncategorized',
                            price: updatedProduct.sale_price,
                            cost: updatedProduct.purchase_price,
                            stock: updatedProduct.stock_quantity,
                            min_stock: updatedProduct.min_stock,
                            image_url: updatedProduct.images?.[0] || null,
                            image: updatedProduct.images?.[0] || null,
                            active: updatedProduct.is_active,
                            created_at: updatedProduct.created_at,
                            updated_at: updatedProduct.updated_at,
                            sale_price: updatedProduct.sale_price,
                            purchase_price: updatedProduct.purchase_price,
                            stock_quantity: updatedProduct.stock_quantity,
                            is_active: updatedProduct.is_active,
                            images: updatedProduct.images
                        }

                        setProducts(prev =>
                            prev.map(product => {
                                if (product.id === updatedProduct.id) {
                                    return { ...mappedProduct, category: product.category }
                                }
                                return product
                            })
                        )
                        // Check for low stock
                        if (mappedProduct.stock <= mappedProduct.min_stock && mappedProduct.active) {
                            toast.warning(`⚠️ Stock bajo: ${mappedProduct.name}`, {
                                description: `Solo quedan ${mappedProduct.stock} unidades`
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

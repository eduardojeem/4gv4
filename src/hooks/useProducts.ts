'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type { 
  Product, 
  ProductFormData, 
  ProductFilters, 
  ProductSortOptions, 
  ProductListResponse,
  ProductDashboardStats,
  Category,
  Supplier,
  PaginationOptions
} from '@/types/products'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Función para cargar productos con filtros y paginación
  const loadProducts = useCallback(async (
    filters: ProductFilters = {},
    sort: ProductSortOptions = { field: 'created_at', direction: 'desc' },
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<ProductListResponse> => {
    if (!config.supabase.isConfigured) {
      return {
        products: [],
        pagination: { page: 1, limit: 50, total: 0, total_pages: 0 },
        filters,
        sort
      }
    }

    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, email, phone)
        `)

      // Aplicar filtros
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
      }
      
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id)
      }
      
      if (filters.supplier_id) {
        query = query.eq('supplier_id', filters.supplier_id)
      }
      
      if (filters.brand) {
        query = query.ilike('brand', `%${filters.brand}%`)
      }
      
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active)
      }
      
      if (filters.price_min !== undefined) {
        query = query.gte('sale_price', filters.price_min)
      }
      
      if (filters.price_max !== undefined) {
        query = query.lte('sale_price', filters.price_max)
      }

      // Filtro por estado de stock
      if (filters.stock_status) {
        switch (filters.stock_status) {
          case 'out_of_stock':
            query = query.eq('stock_quantity', 0)
            break
          case 'low_stock':
            query = query.gt('stock_quantity', 0).filter('stock_quantity', 'lte', 'min_stock')
            break
          case 'in_stock':
            query = query.filter('stock_quantity', 'gt', 'min_stock')
            break
        }
      }

      // Aplicar ordenamiento
      query = query.order(sort.field, { ascending: sort.direction === 'asc' })

      // Aplicar paginación
      const from = (pagination.page - 1) * pagination.limit
      const to = from + pagination.limit - 1
      query = query.range(from, to)

      const { data, error: queryError, count } = await query

      if (queryError) throw queryError

      // Procesar productos con campos calculados
      const processedProducts: Product[] = (data || []).map(product => ({
        ...product,
        stock_status: getStockStatus(product.stock_quantity, product.min_stock),
        margin: product.sale_price - (product.purchase_price || 0),
        margin_percentage: product.purchase_price > 0 
          ? ((product.sale_price - product.purchase_price) / product.purchase_price) * 100 
          : 0,
        total_value: product.stock_quantity * product.sale_price
      }))

      setProducts(processedProducts)

      return {
        products: processedProducts,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / pagination.limit)
        },
        filters,
        sort
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar productos'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para obtener un producto por ID
  const getProduct = useCallback(async (id: string): Promise<Product | null> => {
    if (!config.supabase.isConfigured) return null

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, email, phone)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      return {
        ...data,
        stock_status: getStockStatus(data.stock_quantity, data.min_stock),
        margin: data.sale_price - (data.purchase_price || 0),
        margin_percentage: data.purchase_price > 0 
          ? ((data.sale_price - data.purchase_price) / data.purchase_price) * 100 
          : 0,
        total_value: data.stock_quantity * data.sale_price
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar producto'
      setError(errorMessage)
      return null
    }
  }, [supabase])

  // Función para crear producto
  const createProduct = useCallback(async (productData: ProductFormData): Promise<Product | null> => {
    if (!config.supabase.isConfigured) return null

    setLoading(true)
    setError(null)

    try {
      // Validar SKU único
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', productData.sku)
        .single()

      if (existingProduct) {
        throw new Error('Ya existe un producto con este SKU')
      }

      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, email, phone)
        `)
        .single()

      if (error) throw error

      const newProduct: Product = {
        ...data,
        stock_status: getStockStatus(data.stock_quantity, data.min_stock),
        margin: data.sale_price - (data.purchase_price || 0),
        margin_percentage: data.purchase_price > 0 
          ? ((data.sale_price - data.purchase_price) / data.purchase_price) * 100 
          : 0,
        total_value: data.stock_quantity * data.sale_price
      }

      setProducts(prev => [newProduct, ...prev])
      return newProduct

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para actualizar producto
  const updateProduct = useCallback(async (id: string, productData: Partial<ProductFormData>): Promise<Product | null> => {
    if (!config.supabase.isConfigured) return null

    setLoading(true)
    setError(null)

    try {
      // Si se está actualizando el SKU, validar que sea único
      if (productData.sku) {
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('sku', productData.sku)
          .neq('id', id)
          .single()

        if (existingProduct) {
          throw new Error('Ya existe un producto con este SKU')
        }
      }

      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, email, phone)
        `)
        .single()

      if (error) throw error

      const updatedProduct: Product = {
        ...data,
        stock_status: getStockStatus(data.stock_quantity, data.min_stock),
        margin: data.sale_price - (data.purchase_price || 0),
        margin_percentage: data.purchase_price > 0 
          ? ((data.sale_price - data.purchase_price) / data.purchase_price) * 100 
          : 0,
        total_value: data.stock_quantity * data.sale_price
      }

      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p))
      return updatedProduct

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para eliminar producto
  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    if (!config.supabase.isConfigured) return false

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error

      setProducts(prev => prev.filter(p => p.id !== id))
      return true

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para actualizar stock
  const updateStock = useCallback(async (
    id: string, 
    newStock: number, 
    movementType: 'entrada' | 'salida' | 'ajuste' = 'ajuste',
    notes?: string
  ): Promise<boolean> => {
    if (!config.supabase.isConfigured) return false

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', id)

      if (error) throw error

      // El trigger automáticamente registrará el movimiento
      setProducts(prev => prev.map(p => 
        p.id === id 
          ? { 
              ...p, 
              stock_quantity: newStock,
              stock_status: getStockStatus(newStock, p.min_stock),
              total_value: newStock * p.sale_price
            }
          : p
      ))

      return true

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar stock'
      setError(errorMessage)
      return false
    }
  }, [supabase])

  // Función para cargar categorías
  const loadCategories = useCallback(async (): Promise<Category[]> => {
    if (!config.supabase.isConfigured) return []

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      setCategories(data || [])
      return data || []

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar categorías'
      setError(errorMessage)
      return []
    }
  }, [supabase])

  // Función para cargar proveedores
  const loadSuppliers = useCallback(async (): Promise<Supplier[]> => {
    if (!config.supabase.isConfigured) return []

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      setSuppliers(data || [])
      return data || []

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar proveedores'
      setError(errorMessage)
      return []
    }
  }, [supabase])

  // Función para obtener estadísticas del dashboard
  const getDashboardStats = useCallback(async (): Promise<ProductDashboardStats> => {
    if (!config.supabase.isConfigured) {
      return {
        total_products: 0,
        active_products: 0,
        total_stock_value: 0,
        total_cost_value: 0,
        total_margin: 0,
        avg_margin_percentage: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        categories_count: 0,
        suppliers_count: 0,
        recent_movements_count: 0,
        alerts_count: 0
      }
    }

    try {
      const [
        { data: products },
        { data: categories },
        { data: suppliers },
        { data: movements },
        { data: alerts }
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('id').eq('is_active', true),
        supabase.from('suppliers').select('id').eq('is_active', true),
        supabase.from('product_movements').select('id').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('product_alerts').select('id').eq('is_resolved', false)
      ])

      const activeProducts = products?.filter(p => p.is_active) || []
      const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.stock_quantity * p.sale_price), 0)
      const totalCostValue = activeProducts.reduce((sum, p) => sum + (p.stock_quantity * (p.purchase_price || 0)), 0)
      const totalMargin = totalStockValue - totalCostValue
      const avgMarginPercentage = totalCostValue > 0 ? (totalMargin / totalCostValue) * 100 : 0
      const lowStockCount = activeProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock).length
      const outOfStockCount = activeProducts.filter(p => p.stock_quantity === 0).length

      return {
        total_products: products?.length || 0,
        active_products: activeProducts.length,
        total_stock_value: totalStockValue,
        total_cost_value: totalCostValue,
        total_margin: totalMargin,
        avg_margin_percentage: avgMarginPercentage,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        categories_count: categories?.length || 0,
        suppliers_count: suppliers?.length || 0,
        recent_movements_count: movements?.length || 0,
        alerts_count: alerts?.length || 0
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar estadísticas'
      setError(errorMessage)
      return {
        total_products: 0,
        active_products: 0,
        total_stock_value: 0,
        total_cost_value: 0,
        total_margin: 0,
        avg_margin_percentage: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        categories_count: 0,
        suppliers_count: 0,
        recent_movements_count: 0,
        alerts_count: 0
      }
    }
  }, [supabase])

  // Cargar datos iniciales
  useEffect(() => {
    loadCategories()
    loadSuppliers()
  }, [loadCategories, loadSuppliers])

  return {
    products,
    categories,
    suppliers,
    loading,
    error,
    loadProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    loadCategories,
    loadSuppliers,
    getDashboardStats
  }
}

// Función auxiliar para determinar el estado del stock
function getStockStatus(stockQuantity: number, minStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (stockQuantity === 0) return 'out_of_stock'
  if (stockQuantity <= minStock) return 'low_stock'
  return 'in_stock'
}
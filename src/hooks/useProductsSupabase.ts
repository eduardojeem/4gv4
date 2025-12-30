'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type { Database } from '@/lib/supabase/types'
import type { Product, ProductAlert, Category, Supplier } from '@/types/product-unified'

type ProductMovement = Database['public']['Tables']['product_movements']['Row']

interface ProductFilters {
  search?: string
  category?: string
  supplier?: string
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  priceMin?: number
  priceMax?: number
  isActive?: boolean
  featured?: boolean
}

interface ProductSort {
  field: 'name' | 'sku' | 'category' | 'price' | 'stock' | 'supplier' | 'margin' | 'created_at'
  direction: 'asc' | 'desc'
}

interface PaginationOptions {
  page: number
  limit: number
}

interface DashboardStats {
  totalProducts: number
  activeProducts: number
  totalStockValue: number
  totalCostValue: number
  totalMargin: number
  avgMarginPercentage: number
  lowStockCount: number
  outOfStockCount: number
  categoriesCount: number
  suppliersCount: number
}

export function useProductsSupabase(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // Estados para filtros, ordenamiento y paginación
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    category: '',
    supplier: '',
    stockStatus: 'all',
    isActive: undefined // Mostrar todos por defecto para depuración
  })
  const [sort, setSort] = useState<ProductSort>({
    field: 'name',
    direction: 'asc'
  })
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 1000 // Aumentado para soportar filtrado en cliente temporalmente
  })

  const supabase = createClient()

  // Función para obtener estadísticas del dashboard
  const fetchDashboardStats = useCallback(async () => {
    if (!enabled) return
    try {
      // Obtener productos para calcular estadísticas
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, sku, name, purchase_price, sale_price, stock_quantity, min_stock, is_active')

      if (productsError) throw productsError

      // Obtener categorías
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('id')

      if (categoriesError) throw categoriesError

      // Obtener proveedores
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id')

      if (suppliersError) throw suppliersError

      // Calcular estadísticas
      const productList = products as unknown as Product[]
      const totalProducts = productList?.length || 0
      const activeProducts = productList?.filter(p => p.is_active)?.length || 0
      const totalStockValue = productList?.reduce((sum, p) => sum + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0) || 0
      const totalCostValue = productList?.reduce((sum, p) => sum + ((p.purchase_price || 0) * (p.stock_quantity || 0)), 0) || 0
      const totalMargin = totalStockValue - totalCostValue
      const avgMarginPercentage = totalCostValue > 0 ? (totalMargin / totalCostValue) * 100 : 0
      const lowStockCount = productList?.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 5) && (p.stock_quantity || 0) > 0)?.length || 0
      const outOfStockCount = productList?.filter(p => (p.stock_quantity || 0) === 0)?.length || 0

      setDashboardStats({
        totalProducts,
        activeProducts,
        totalStockValue,
        totalCostValue,
        totalMargin,
        avgMarginPercentage,
        lowStockCount,
        outOfStockCount,
        categoriesCount: categories?.length || 0,
        suppliersCount: suppliers?.length || 0,
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }, [supabase, enabled])

  // Función para obtener productos con filtros y paginación
  const fetchProducts = useCallback(async (
    customFilters?: ProductFilters,
    customSort?: ProductSort,
    customPagination?: PaginationOptions
  ) => {
    if (!enabled) return
    const activeFilters = customFilters || filters
    const activeSort = customSort || sort
    const activePagination = customPagination || pagination
    setLoading(true)
    setError(null)

    try {
      if (!config.supabase.isConfigured) {
        console.warn('Supabase no está configurado. Verifica las variables de entorno.')
        setError('Supabase no está configurado. Verifica las variables de entorno.')
        setLoading(false)
        return
      }

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, email, phone, address)
        `, { count: 'exact' })

      // Aplicar filtros
      if (activeFilters.search) {
        query = query.or(`name.ilike.%${activeFilters.search}%,sku.ilike.%${activeFilters.search}%,brand.ilike.%${activeFilters.search}%`)
      }

      if (activeFilters.category) {
        query = query.eq('category_id', activeFilters.category)
      }

      if (activeFilters.supplier) {
        query = query.eq('supplier_id', activeFilters.supplier)
      }

      if (activeFilters.isActive !== undefined) {
        query = query.eq('is_active', activeFilters.isActive)
      }

      if (activeFilters.featured !== undefined) {
        query = query.eq('featured', activeFilters.featured)
      }

      if (activeFilters.priceMin !== undefined) {
        query = query.gte('sale_price', activeFilters.priceMin)
      }

      if (activeFilters.priceMax !== undefined) {
        query = query.lte('sale_price', activeFilters.priceMax)
      }

      if (activeFilters.stockStatus && activeFilters.stockStatus !== 'all') {
        if (activeFilters.stockStatus === 'in_stock') {
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (activeFilters.stockStatus === 'low_stock') {
          query = query.filter('stock_quantity', 'lte', 5)
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (activeFilters.stockStatus === 'out_of_stock') {
          query = query.filter('stock_quantity', 'eq', 0)
        }
      }

      // Aplicar ordenamiento mapeando a columnas reales de la BD
      const sortColumnMap: Record<string, string> = {
        name: 'name',
        sku: 'sku',
        category: 'category_id',
        price: 'sale_price',
        stock: 'stock_quantity',
        supplier: 'supplier_id',
        margin: 'sale_price',
        created_at: 'created_at'
      }
      const sortColumn = sortColumnMap[activeSort.field] || 'created_at'
      query = query.order(sortColumn, { ascending: activeSort.direction === 'asc' })

      // Aplicar paginación
      const from = (activePagination.page - 1) * activePagination.limit
      const to = from + activePagination.limit - 1
      query = query.range(from, to)

      // Log de diagnóstico
      console.log('Fetching products with filters:', activeFilters)
      
      const { data, error, count } = await query

      if (error) {
        console.error('Supabase error fetching products:', error)
        throw error
      }
      
      console.log(`Fetched ${data?.length || 0} products. Total count: ${count}`)

      if (!data || data.length === 0) {
        setProducts([])
      } else {
        setProducts(data as unknown as Product[])
      }
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [supabase, filters, sort, pagination, enabled])

  // Función para obtener categorías
  const fetchCategories = useCallback(async () => {
    if (!enabled) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCategories((data || []) as unknown as Category[])
    } catch (err) {
      console.error('Error fetching categories:', err)
      setCategories([])
    }
  }, [supabase, enabled])

  // Función para obtener proveedores
  const fetchSuppliers = useCallback(async () => {
    if (!enabled) return
    try {
      // Intento 1: esquema con is_active
      let res = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (res.error && (res.error as { code?: string }).code === '42703') {
        // Intento 2: esquema alternativo con status
        res = await supabase
          .from('suppliers')
          .select('*')
          .eq('status', 'active')
          .order('name')
      }

      if (res.error) throw res.error
      setSuppliers((res.data || []) as unknown as Supplier[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('Error fetching suppliers:', msg)
      setSuppliers([])
    }
  }, [supabase, enabled])

  // Función para obtener alertas
  const fetchAlerts = useCallback(async () => {
    if (!enabled) return
    try {
      // Generar alertas basadas en el estado actual de los productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock, supplier_id, category_id, images')

      if (productsError) throw productsError

      // Generar alertas automáticas basadas en los productos
      const generatedAlerts: ProductAlert[] = []
      let alertId = 1

      const productsToCheck = productsData as unknown as Product[]

      for (const product of productsToCheck || []) {
        // Alerta de stock bajo
        if (product.stock_quantity <= (product.min_stock || 5) && product.stock_quantity > 0) {
          generatedAlerts.push({
            id: `alert-${alertId++}`,
            product_id: product.id,
            type: 'low_stock',
            message: `Stock bajo: ${product.name} (${product.stock_quantity} unidades restantes)`,
            read: false,
            is_resolved: false,
            created_at: new Date().toISOString(),
            resolved_at: undefined,
            product_name: product.name,
            details: {
              current_stock: product.stock_quantity,
              min_stock: product.min_stock
            }
          } as ProductAlert)
        }

        // Alerta de stock agotado
        if (product.stock_quantity === 0) {
          generatedAlerts.push({
            id: `alert-${alertId++}`,
            product_id: product.id,
            type: 'out_of_stock',
            message: `Producto agotado: ${product.name}`,
            read: false,
            is_resolved: false,
            created_at: new Date().toISOString(),
            resolved_at: undefined,
            product_name: product.name,
            details: {
              current_stock: 0
            }
          } as ProductAlert)
        }

        // Alerta de sin proveedor
        if (!product.supplier_id) {
          generatedAlerts.push({
            id: `alert-${alertId++}`,
            product_id: product.id,
            alert_type: 'no_supplier',
            message: `Producto sin proveedor: ${product.name}`,
            is_resolved: false,
            created_at: new Date().toISOString(),
            resolved_at: null,
            resolved_by: null,
            products: undefined
          } as unknown as ProductAlert)
        }

        // Alerta de sin categoría
        if (!product.category_id) {
          generatedAlerts.push({
            id: `alert-${alertId++}`,
            product_id: product.id,
            alert_type: 'no_category',
            message: `Producto sin categoría: ${product.name}`,
            is_resolved: false,
            created_at: new Date().toISOString(),
            resolved_at: null,
            resolved_by: null,
            products: undefined
          } as unknown as ProductAlert)
        }

        // Alerta de sin imagen
        if (!product.images || (Array.isArray(product.images) && product.images.length === 0)) {
          generatedAlerts.push({
            id: `alert-${alertId++}`,
            product_id: product.id,
            alert_type: 'no_image',
            message: `Producto sin imagen: ${product.name}`,
            is_resolved: false,
            created_at: new Date().toISOString(),
            resolved_at: null,
            resolved_by: null,
            products: undefined
          } as unknown as ProductAlert)
        }
      }

      setAlerts(generatedAlerts)
    } catch (err) {
      console.error('Error fetching alerts:', err)
      setAlerts([])
    }
  }, [supabase, enabled])

  // Función para crear producto
  const createProduct = useCallback(async (productData: Database['public']['Tables']['products']['Insert']) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()

      if (error) throw error

      // Refrescar datos
      await Promise.all([
        fetchProducts(),
        fetchDashboardStats()
      ])

      return { success: true, data }
    } catch (err) {
      console.error('Error creating product:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase, fetchProducts, fetchDashboardStats])

  // Función para actualizar producto
  const updateProduct = useCallback(async (
    id: string, 
    productData: Database['public']['Tables']['products']['Update']
  ) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Refrescar datos
      await Promise.all([
        fetchProducts(),
        fetchDashboardStats()
      ])

      return { success: true, data }
    } catch (err) {
      console.error('Error updating product:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase, fetchProducts, fetchDashboardStats])

  // Función para eliminar producto
  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Refrescar datos
      await Promise.all([
        fetchProducts(),
        fetchDashboardStats()
      ])

      return { success: true }
    } catch (err) {
      console.error('Error deleting product:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase, fetchProducts, fetchDashboardStats])

  // Función para actualizar stock
  const updateStock = useCallback(async (
    productId: string,
    quantityChange: number,
    movementType: 'in' | 'out' | 'adjustment' | 'transfer',
    reason?: string,
    referenceId?: string,
    referenceType?: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('update_product_stock', {
        product_id: productId,
        quantity_change: quantityChange,
        movement_type: movementType,
        reason,
        reference_id: referenceId,
        reference_type: referenceType
      })

      if (error) throw error

      // Refrescar datos
      await Promise.all([
        fetchProducts(),
        fetchDashboardStats(),
        fetchAlerts()
      ])

      return { success: true, data }
    } catch (err) {
      console.error('Error updating stock:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase, fetchProducts, fetchDashboardStats, fetchAlerts])

  // Función para obtener movimientos de un producto
  const getProductMovements = useCallback(async (productId: string, limit = 50) => {
    try {
      const { data, error } = await supabase.rpc('get_recent_movements', {
        product_id: productId,
        limit_count: limit
      })

      if (error) throw error
      return { success: true, data: data || [] }
    } catch (err) {
      console.error('Error fetching product movements:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido',
        data: []
      }
    }
  }, [supabase])

  // Función para obtener todos los movimientos (historial global)
  const getAllMovements = useCallback(async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { success: true, data: data || [] }
    } catch (err) {
      console.error('Error fetching all movements:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido',
        data: []
      }
    }
  }, [supabase])

  // Función para crear categoría
  const createCategory = useCallback(async (name: string, description?: string) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, description, is_active: true })
        .select()
        .single()

      if (error) throw error
      
      // Refrescar categorías
      await fetchCategories()
      
      return { success: true, data }
    } catch (err) {
      console.error('Error creating category:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase, fetchCategories])

  // Función para obtener productos más vendidos
  const getTopSellingProducts = useCallback(async (limit = 10) => {
    try {
      const { data, error } = await supabase.rpc('get_top_selling_products', {
        limit_count: limit
      })

      if (error) throw error
      return { success: true, data: data || [] }
    } catch (err) {
      console.error('Error fetching top selling products:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido',
        data: []
      }
    }
  }, [supabase])

  // Función para resolver alerta (simulada para alertas dinámicas)
  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      // Como las alertas son dinámicas y se generan en tiempo real,
      // simplemente refrescamos las alertas para simular la resolución
      console.log(`Simulando resolución de alerta: ${alertId}`)
      
      // Refrescar alertas
      await fetchAlerts()

      return { success: true }
    } catch (err) {
      console.error('Error resolving alert:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [fetchAlerts])

  // Función para exportar productos a CSV
  const exportToCSV = useCallback(async (filters: ProductFilters = {}) => {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, email, phone, address)
        `)

      // Aplicar los mismos filtros que en fetchProducts
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
      }

      if (filters.category) {
        query = query.eq('category_id', filters.category)
      }

      if (filters.supplier) {
        query = query.eq('supplier_id', filters.supplier)
      }

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      }

      if (filters.priceMin !== undefined) {
        query = query.filter('sale_price', 'gte', filters.priceMin)
      }

      if (filters.priceMax !== undefined) {
        query = query.filter('sale_price', 'lte', filters.priceMax)
      }

      if (filters.stockStatus && filters.stockStatus !== 'all') {
        if (filters.stockStatus === 'in_stock') {
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (filters.stockStatus === 'low_stock') {
          query = query.filter('stock_quantity', 'lte', 5)
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (filters.stockStatus === 'out_of_stock') {
          query = query.filter('stock_quantity', 'eq', 0)
        }
      }

      const { data, error } = await query

      if (error) throw error

      // Convertir a CSV
      if (!data || data.length === 0) {
        return { success: false, error: 'No hay datos para exportar' }
      }

      const headers = [
        'SKU', 'Nombre', 'Descripción', 'Categoría', 'Marca', 'Proveedor',
        'Precio Compra', 'Precio Venta', 'Precio Mayorista', 'Stock', 'Stock Mínimo',
        'Unidad', 'Estado', 'Margen %', 'Valor Stock', 'Estado Stock'
      ]

      type CSVProduct = {
        sku: string
        name: string
        description?: string | null
        brand?: string | null
        purchase_price: number | null
        sale_price: number | null
        wholesale_price?: number | null
        stock_quantity: number | null
        min_stock: number | null
        unit_measure: string
        is_active: boolean
        category?: { name?: string } | null
        supplier?: { name?: string } | null
      }

      const items = (data as unknown as CSVProduct[])

      const csvContent = [
        headers.join(','),
        ...items.map(p => {
          const margin = (Number(p.sale_price || 0) - Number(p.purchase_price || 0))
          const marginPct = p.purchase_price ? (margin / Number(p.purchase_price)) * 100 : 0
          const stockValue = Number(p.sale_price || 0) * Number(p.stock_quantity || 0)
          const stockStatus = Number(p.stock_quantity || 0) === 0 ? 'Sin Stock' : (Number(p.stock_quantity || 0) <= Number(p.min_stock || 5) ? 'Stock Bajo' : 'En Stock')
          return [
            p.sku,
            `"${p.name}"`,
            `"${p.description || ''}"`,
            `"${p.category?.name || ''}"`,
            `"${p.brand || ''}"`,
            `"${p.supplier?.name || ''}"`,
            p.purchase_price,
            p.sale_price,
            p.wholesale_price || '',
            p.stock_quantity,
            p.min_stock,
            p.unit_measure,
            p.is_active ? 'Activo' : 'Inactivo',
            marginPct.toFixed(2),
            stockValue.toFixed(2),
            stockStatus
          ].join(',')
        })
      ].join('\n')

      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      return { success: true }
    } catch (err) {
      console.error('Error exporting to CSV:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [supabase])

  // Cargar datos iniciales
  useEffect(() => {
    if (!enabled) return
    Promise.all([
      fetchCategories(),
      fetchSuppliers(),
      fetchDashboardStats(),
      fetchAlerts()
    ])
  }, [enabled, fetchCategories, fetchSuppliers, fetchDashboardStats, fetchAlerts])

  // Cargar productos cuando cambien filtros, ordenamiento o paginación
  useEffect(() => {
    if (!enabled) return
    fetchProducts()
  }, [enabled, filters, sort, pagination, fetchProducts])

  // Memoizar valores calculados
  const memoizedValues = useMemo(() => ({
    products,
    categories,
    suppliers,
    alerts,
    dashboardStats,
    loading,
    error,
    totalCount,
    pagination: {
      totalPages: Math.ceil(totalCount / 20),
      hasNextPage: totalCount > products.length,
      hasPreviousPage: products.length > 0
    }
  }), [products, categories, suppliers, alerts, dashboardStats, loading, error, totalCount])

  return {
    ...memoizedValues,
    // Estados de filtros, ordenamiento y paginación
    filters,
    sort,
    pagination,
    setFilters,
    setSort,
    setPagination,
    // Variables calculadas adicionales
    totalProducts: totalCount,
    totalPages: Math.ceil(totalCount / pagination.limit),
    currentPage: pagination.page,
    // Funciones de datos
    fetchProducts,
    fetchDashboardStats,
    fetchCategories,
    fetchSuppliers,
    fetchAlerts,
    // Funciones CRUD
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    createCategory,
    // Funciones de consulta
    getProductMovements,
    getAllMovements,
    getTopSellingProducts,
    // Funciones de utilidad
    resolveAlert,
    exportToCSV,
    // Setters para compatibilidad
    setProducts,
    // Función para refrescar todos los datos
    refreshData: useCallback(async () => {
      await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchSuppliers(),
        fetchDashboardStats(),
        fetchAlerts()
      ])
    }, [fetchProducts, fetchCategories, fetchSuppliers, fetchDashboardStats, fetchAlerts]),
    refreshAll: useCallback(async () => {
      await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchSuppliers(),
        fetchDashboardStats(),
        fetchAlerts()
      ])
    }, [fetchProducts, fetchCategories, fetchSuppliers, fetchDashboardStats, fetchAlerts])
  }
}

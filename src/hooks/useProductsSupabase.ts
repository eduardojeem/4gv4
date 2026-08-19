'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type { Database } from '@/lib/supabase/types'
import type { Product, ProductAlert, Category, Supplier, Brand } from '@/types/product-unified'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { isLowStock, isOutOfStock } from '@/lib/products-dashboard-utils'

interface ProductFilters {
  search?: string
  category?: string
  supplier?: string
  brand?: string
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
  physicalProductsCount?: number
  servicesCount?: number
  activeProducts: number
  totalStockValue: number
  totalCostValue: number
  totalMargin: number
  avgMarginPercentage: number
  lowStockCount: number
  outOfStockCount: number
  categoriesCount: number
  brandsCount: number
  suppliersCount: number
}

interface ProductApiPayload {
  success?: boolean
  data?: Product
  error?: string
  code?: string
  message?: string
  details?: Array<{
    field?: string
    message?: string
  }>
}

interface ProductsListApiPayload {
  success?: boolean
  data?: {
    products?: Product[]
    total?: number
    page?: number
    per_page?: number
    /** El filtro de stock barrio hasta el tope: el listado y el total son parciales. */
    truncated?: boolean
    scan_cap?: number
  }
  error?: string
  message?: string
}

interface CategoryApiPayload {
  success?: boolean
  data?: Category
  error?: string
  message?: string
}

type ProductOperationResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

function getProductApiError(payload: ProductApiPayload | null, fallback: string) {
  if (!payload) return fallback

  const detailMessage = payload.details
    ?.map(detail => [detail.field, detail.message].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('; ')

  if (detailMessage) {
    return `${payload.error || fallback}: ${detailMessage}`
  }

  return payload.message || payload.error || fallback
}

export function useProductsSupabase(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  // Marca que el resultado quedo incompleto por el tope del barrido de stock.
  const [resultTruncated, setResultTruncated] = useState(false)

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
    limit: 20
  })

  const supabase = createClient()
  const { selectedBranchId } = useBranch()

  const applySelectedBranchStock = useCallback(async <T extends { id: string; stock_quantity?: number | null }>(items: T[]) => {
    if (!selectedBranchId || items.length === 0) {
      return items as Array<T & { branch_stock_quantity?: number }>
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { stockMap, branchScoped } = await (loadBranchInventoryStockMap as any)(
      supabase,
      selectedBranchId,
      items.map((item) => item.id)
    )

    return applyBranchInventoryToProducts(items, stockMap, branchScoped)
  }, [selectedBranchId, supabase])

  // Función para obtener estadísticas del dashboard
  const fetchDashboardStats = useCallback(async () => {
    if (!enabled) return
    try {
      // Obtener productos para calcular estadísticas
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, sku, name, purchase_price, sale_price, stock_quantity, min_stock, is_active, unit_measure, category:categories(name)')

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

      // Obtener marcas
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id')

      if (brandsError) throw brandsError

      // Calcular estadísticas
      const productList = await applySelectedBranchStock((products || []) as unknown as Product[])
      const totalProducts = productList?.length || 0
      const servicesCount = productList?.filter(isServiceLikeProduct)?.length || 0
      const physicalProductsCount = Math.max(0, totalProducts - servicesCount)
      const activeProducts = productList?.filter(p => p.is_active)?.length || 0
      const totalStockValue = productList?.filter(p => !isServiceLikeProduct(p))?.reduce((sum, p) => sum + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0) || 0
      const totalCostValue = productList?.filter(p => !isServiceLikeProduct(p))?.reduce((sum, p) => sum + ((p.purchase_price || 0) * (p.stock_quantity || 0)), 0) || 0
      const totalMargin = totalStockValue - totalCostValue
      const avgMarginPercentage = totalCostValue > 0 ? (totalMargin / totalCostValue) * 100 : 0
      const lowStockCount = productList?.filter(p => !isServiceLikeProduct(p) && isLowStock(p))?.length || 0
      const outOfStockCount = productList?.filter(p => !isServiceLikeProduct(p) && isOutOfStock(p))?.length || 0

      setDashboardStats({
        totalProducts,
        physicalProductsCount,
        servicesCount,
        activeProducts,
        totalStockValue,
        totalCostValue,
        totalMargin,
        avgMarginPercentage,
        lowStockCount,
        outOfStockCount,
        categoriesCount: categories?.length || 0,
        brandsCount: brands?.length || 0,
        suppliersCount: suppliers?.length || 0,
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }, [applySelectedBranchStock, supabase, enabled])

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

      const params = new URLSearchParams({
        page: String(Math.max(1, activePagination.page)),
        per_page: String(activePagination.limit > 0 ? activePagination.limit : 20),
        sort: activeSort.field,
        direction: activeSort.direction,
        stock_status: activeFilters.stockStatus || 'all',
      })

      if (activeFilters.search) params.set('query', activeFilters.search)
      if (activeFilters.category) params.set('category_id', activeFilters.category)
      if (activeFilters.supplier) params.set('supplier_id', activeFilters.supplier)
      if (activeFilters.brand) params.set('brand', activeFilters.brand)
      if (activeFilters.priceMin !== undefined) params.set('price_min', String(activeFilters.priceMin))
      if (activeFilters.priceMax !== undefined) params.set('price_max', String(activeFilters.priceMax))
      if (activeFilters.isActive !== undefined) params.set('is_active', String(activeFilters.isActive))
      if (activeFilters.featured !== undefined) params.set('featured', String(activeFilters.featured))
      if (selectedBranchId) params.set('strict_branch_stock', 'true')

      const response = await fetch(`/api/products?${params.toString()}`, {
        headers: branchHeaders(selectedBranchId),
      })
      const payload = await response.json().catch(() => null) as ProductsListApiPayload | null

      if (!response.ok || payload?.success === false || !Array.isArray(payload?.data?.products)) {
        throw new Error(payload?.message || payload?.error || 'No se pudieron cargar los productos')
      }

      setProducts(payload.data.products)
      setTotalCount(Number(payload.data.total || 0))
      setResultTruncated(payload.data.truncated === true)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, filters, sort, pagination, enabled])

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

  // Función para obtener marcas
  const fetchBrands = useCallback(async () => {
    if (!enabled) return
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBrands((data || []) as unknown as Brand[])
    } catch (err) {
      console.error('Error fetching brands:', err)
      setBrands([])
    }
  }, [supabase, enabled])

  // Función para obtener proveedores
  const fetchSuppliers = useCallback(async () => {
    if (!enabled) return
    try {
      // La tabla suppliers no tiene columna is_active — traer todos y filtrar si es necesario
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name')

      if (error) throw error
      setSuppliers((data || []) as unknown as Supplier[])
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
        .select('id, name, sku, stock_quantity, min_stock, supplier_id, category_id, unit_measure, images')

      if (productsError) throw productsError

      // Generar alertas automáticas basadas en los productos
      const generatedAlerts: ProductAlert[] = []
      let alertId = 1

      const productsToCheck = await applySelectedBranchStock((productsData || []) as unknown as Product[])

      for (const product of productsToCheck || []) {
        const skipMetadataAlerts = isServiceLikeProduct(product)

        // Alerta de stock bajo
        if (isLowStock(product)) {
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
        if (isOutOfStock(product)) {
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
        if (!skipMetadataAlerts && !product.supplier_id) {
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
        if (!skipMetadataAlerts && !product.category_id) {
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
        if (!skipMetadataAlerts && (!product.images || (Array.isArray(product.images) && product.images.length === 0))) {
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
  }, [applySelectedBranchStock, supabase, enabled])

  // Función para crear producto
  const createProduct = useCallback(async (productData: Database['public']['Tables']['products']['Insert']) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(productData),
      })
      const payload = await response.json().catch(() => null) as ProductApiPayload | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(getProductApiError(payload, 'Error al crear el producto'))
      }

      // Actualizar estado local inmediatamente
      const newProduct = payload.data as Product
      
      // Ensure local state update happens with functional update to avoid stale closures
      setProducts(prev => {
        // Check if product already exists to avoid duplicates
        const exists = prev.some(p => p.id === newProduct.id)
        if (exists) return prev
        
        const updated = [newProduct, ...prev]
        return updated
      })
      setTotalCount(prev => prev + 1)

      // Refrescar estadísticas en segundo plano
      fetchDashboardStats().catch(err => console.error('Error refreshing data after create:', err))
      
      // Force refresh of product list to ensure sync with DB triggers/defaults
      fetchProducts().catch(err => console.error('Error refreshing products after create:', err))

      return { success: true, data: newProduct }
    } catch (err: unknown) {
      console.error('Error creating product:', err)
      console.error('Error details:', err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : err)
      let errorMessage = 'Error al crear el producto'
      
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') { // Unique constraint violation
        errorMessage = 'Ya existe un producto con este SKU'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      
      return { 
        success: false, 
        error: errorMessage
      }
    }
  }, [selectedBranchId, fetchDashboardStats, fetchProducts])

  // Función para actualizar producto
  const updateProduct = useCallback(async (
    id: string, 
    productData: Database['public']['Tables']['products']['Update']
  ) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(productData),
      })
      const payload = await response.json().catch(() => null) as ProductApiPayload | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(getProductApiError(payload, 'Error al actualizar el producto'))
      }

      // Actualizar estado local inmediatamente
      const updatedProduct = payload.data as Product
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p))

      // Refrescar estadísticas en segundo plano
      fetchDashboardStats().catch(err => console.error('Error refreshing data after update:', err))

      return { success: true, data: updatedProduct }
    } catch (err: unknown) {
      console.error('Error updating product:', err)
      console.error('Error details:', err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : err)
      let errorMessage = 'Error al actualizar el producto'
      
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        errorMessage = 'Ya existe un producto con este SKU'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      
      return { 
        success: false, 
        error: errorMessage
      }
    }
  }, [selectedBranchId, fetchDashboardStats])

  // Función para eliminar producto
  const deleteProduct = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: branchHeaders(selectedBranchId),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Error al eliminar el producto')
      }

      // Refrescar datos en segundo plano
      Promise.all([
        fetchProducts(),
        fetchDashboardStats()
      ]).catch(err => console.error('Error refreshing data after delete:', err))

      return { success: true }
    } catch (err) {
      console.error('Error deleting product:', err)
      if (typeof err === 'object' && err !== null) {
          console.error('Detalles del error:', JSON.stringify(err, null, 2))
      }
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido' 
      }
    }
  }, [selectedBranchId, fetchProducts, fetchDashboardStats])

  // Función para actualizar stock
  const updateStock = useCallback(async (
    productId: string,
    quantityChange: number,
    movementType: 'in' | 'out' | 'adjustment' | 'transfer',
    reason?: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<ProductOperationResult> => {
    try {
      let data = null
      let error = null as { message?: string } | null

      if (selectedBranchId) {
        const currentProduct = products.find((product) => product.id === productId)
        const currentStock = Number(currentProduct?.stock_quantity || 0)
        const nextStock = currentStock + quantityChange

        if (nextStock < 0) {
          throw new Error('El ajuste dejaría el stock en negativo.')
        }

        const response = await supabase.rpc('set_branch_inventory_stock', {
          p_product_id: productId,
          p_branch_id: selectedBranchId,
          p_new_stock: nextStock,
          p_movement_type: movementType,
          p_reason: reason ?? null,
          p_reference_id: referenceId ?? null,
          p_reference_type: referenceType ?? null,
        })

        data = response.data
        error = response.error
      } else {
        const response = await supabase.rpc('update_product_stock', {
          product_id: productId,
          quantity_change: quantityChange,
          movement_type: movementType,
          reason,
          reference_id: referenceId,
          reference_type: referenceType
        })

        data = response.data
        error = response.error
      }

      if (error) throw error

      // Refrescar datos
      await Promise.all([
        fetchProducts(),
        fetchDashboardStats(),
        fetchAlerts()
      ])

      return { success: true, data }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'details' in err
          ? String(err.details)
          : JSON.stringify(err)
      console.error('Error updating stock:', errorMsg, err)
      return { 
        success: false, 
        error: errorMsg || 'Error desconocido' 
      }
    }
  }, [selectedBranchId, products, supabase, fetchProducts, fetchDashboardStats, fetchAlerts])

  // Función para obtener movimientos de un producto
  const getProductMovements = useCallback(async (productId: string, limit = 50) => {
    try {
      const query = supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(limit)

      const { data, error } = selectedBranchId
        ? await query.eq('branch_id', selectedBranchId)
        : await query

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
  }, [selectedBranchId, supabase])

  // Función para obtener todos los movimientos (historial global)
  const getAllMovements = useCallback(async (limit = 100) => {
    try {
      const query = supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      const { data, error } = selectedBranchId
        ? await query.eq('branch_id', selectedBranchId)
        : await query

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
  }, [selectedBranchId, supabase])

  // Función para crear categoría
  const createCategory = useCallback(async (name: string, description?: string) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || null,
          is_active: true,
        }),
      })
      const payload = await response.json().catch(() => null) as CategoryApiPayload | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || payload?.error || 'No se pudo crear la categoria')
      }
      
      // Refrescar categorías
      await fetchCategories()
      
      return { success: true, data: payload.data }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al crear la categoria'
      console.warn('Category creation failed:', errorMessage)
      return { 
        success: false, 
        error: errorMessage,
      }
    }
  }, [fetchCategories])

  // Función para obtener productos más vendidos
  const getTopSellingProducts = useCallback(async (limit = 10) => {
    try {
      const salesQuery = selectedBranchId
        ? supabase.from('sales').select('id').eq('branch_id', selectedBranchId)
        : supabase.from('sales').select('id')

      const { data: salesData, error: salesError } = await salesQuery.limit(5000)
      if (salesError) throw salesError

      const saleIds = (salesData || []).map((sale) => sale.id).filter(Boolean)
      if (saleIds.length === 0) {
        return { success: true, data: [] }
      }

      type TopSellingSaleItem = {
        product_id: string | null
        quantity: number | null
        subtotal: number | null
        product: {
          id: string
          name: string | null
          sku: string | null
          stock_quantity: number | null
          category?: { name?: string | null } | null
        } | null
      }

      const { data: saleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          subtotal,
          product:products(
            id,
            name,
            sku,
            stock_quantity,
            category:categories(name)
          )
        `)
        .in('sale_id', saleIds.slice(0, 5000))

      if (saleItemsError) throw saleItemsError

      const grouped = new Map<string, {
        product_id: string
        product_name: string
        product_sku: string
        category_name: string
        total_sold: number
        total_revenue: number
        current_stock: number
      }>()

      ;((saleItems || []) as unknown as TopSellingSaleItem[]).forEach((item) => {
        const productId = String(item.product_id || item.product?.id || '')
        if (!productId) return

        const current = grouped.get(productId) || {
          product_id: productId,
          product_name: String(item.product?.name || 'Producto sin nombre'),
          product_sku: String(item.product?.sku || ''),
          category_name: String(item.product?.category?.name || 'Sin categoria'),
          total_sold: 0,
          total_revenue: 0,
          current_stock: Number(item.product?.stock_quantity || 0),
        }

        current.total_sold += Number(item.quantity || 0)
        current.total_revenue += Number(item.subtotal || 0)
        grouped.set(productId, current)
      })

      if (selectedBranchId && grouped.size > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { stockMap, branchScoped } = await (loadBranchInventoryStockMap as any)(
          supabase,
          selectedBranchId,
          Array.from(grouped.keys())
        )

        if (branchScoped) {
          grouped.forEach((product, productId) => {
            product.current_stock = stockMap.has(productId) ? Number(stockMap.get(productId) || 0) : 0
          })
        }
      }

      return {
        success: true,
        data: Array.from(grouped.values())
          .sort((left, right) => right.total_sold - left.total_sold || right.total_revenue - left.total_revenue)
          .slice(0, limit)
      }
    } catch (err) {
      console.error('Error fetching top selling products:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido',
        data: []
      }
    }
  }, [selectedBranchId, supabase])

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

  const exportInventoryCSV = useCallback(async (filters: ProductFilters = {}) => {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, phone, address)
        `)

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
      }
      if (filters.category) query = query.eq('category_id', filters.category)
      if (filters.supplier) query = query.eq('supplier_id', filters.supplier)
      if (filters.brand) query = query.ilike('brand', filters.brand)
      if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive)
      if (filters.priceMin !== undefined) query = query.filter('sale_price', 'gte', filters.priceMin)
      if (filters.priceMax !== undefined) query = query.filter('sale_price', 'lte', filters.priceMax)

      if (filters.stockStatus && filters.stockStatus !== 'all' && !selectedBranchId) {
        if (filters.stockStatus === 'in_stock') query = query.filter('stock_quantity', 'gt', 0)
        if (filters.stockStatus === 'low_stock') query = query.filter('stock_quantity', 'gt', 0)
        if (filters.stockStatus === 'out_of_stock') query = query.filter('stock_quantity', 'eq', 0)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) return { success: false, error: 'No hay datos para exportar' }

      type CSVProduct = {
        id: string
        sku: string
        name: string
        description?: string | null
        brand?: string | null
        purchase_price: number | null
        sale_price: number | null
        wholesale_price?: number | null
        stock_quantity: number | null
        min_stock: number | null
        max_stock?: number | null
        unit_measure: string
        barcode?: string | null
        location?: string | null
        is_active: boolean
        featured?: boolean | null
        category?: { name?: string } | null
        supplier?: { name?: string } | null
      }

      const baseItems = await applySelectedBranchStock(data as unknown as CSVProduct[])
      let items = baseItems
      if (filters.stockStatus === 'low_stock') items = baseItems.filter(isLowStock)
      if (filters.stockStatus === 'in_stock') items = baseItems.filter(product => !isOutOfStock(product))
      if (filters.stockStatus === 'out_of_stock') items = baseItems.filter(isOutOfStock)
      if (items.length === 0) return { success: false, error: 'No hay datos para exportar' }

      const delimiter = ';'
      const exportHeaders = [
        'SKU', 'Nombre', 'Descripcion', 'Categoria', 'Marca', 'Proveedor',
        'Precio Compra', 'Precio Venta', 'Precio Mayorista', 'Stock', 'Stock Minimo',
        'Stock Maximo', 'Unidad', 'Codigo Barras', 'Ubicacion', 'Activo', 'Destacado',
        'Margen %', 'Valor Stock', 'Estado Stock', 'ID'
      ]
      const escapeCSVValue = (value: unknown) => {
        const str = String(value ?? '')
        return /[;"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
      }
      const formatNumber = (value: number | null | undefined) => Number(value || 0).toFixed(2)
      const rows = items.map(product => {
        const margin = Number(product.sale_price || 0) - Number(product.purchase_price || 0)
        const marginPct = product.purchase_price ? (margin / Number(product.purchase_price)) * 100 : 0
        const stockValue = Number(product.sale_price || 0) * Number(product.stock_quantity || 0)
        const stockStatus = isOutOfStock(product) ? 'Sin stock' : (isLowStock(product) ? 'Stock bajo' : 'En stock')
        return [
          product.sku,
          product.name,
          product.description || '',
          product.category?.name || '',
          product.brand || '',
          product.supplier?.name || '',
          formatNumber(product.purchase_price),
          formatNumber(product.sale_price),
          product.wholesale_price !== undefined && product.wholesale_price !== null ? formatNumber(product.wholesale_price) : '',
          product.stock_quantity,
          product.min_stock,
          product.max_stock || '',
          product.unit_measure,
          product.barcode || '',
          product.location || '',
          product.is_active ? 'Sí' : 'No',
          product.featured ? 'Sí' : 'No',
          marginPct.toFixed(2),
          stockValue.toFixed(2),
          stockStatus,
          product.id,
        ]
      })
      const csvContent = [
        `sep=${delimiter}`,
        exportHeaders.map(escapeCSVValue).join(delimiter),
        ...rows.map(row => row.map(escapeCSVValue).join(delimiter))
      ].join('\r\n')

      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true }
    } catch (err) {
      console.error('Error exporting inventory CSV:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido'
      }
    }
  }, [applySelectedBranchStock, selectedBranchId, supabase])

  const exportToPDF = useCallback(async (filters: ProductFilters = {}) => {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, phone, address)
        `)

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
      }

      if (filters.category) {
        query = query.eq('category_id', filters.category)
      }

      if (filters.supplier) {
        query = query.eq('supplier_id', filters.supplier)
      }

      if (filters.brand) {
        query = query.ilike('brand', filters.brand)
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
        if (filters.stockStatus === 'in_stock' && !selectedBranchId) {
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (filters.stockStatus === 'low_stock' && !selectedBranchId) {
          query = query.filter('stock_quantity', 'gt', 0)
        } else if (filters.stockStatus === 'out_of_stock' && !selectedBranchId) {
          query = query.filter('stock_quantity', 'eq', 0)
        }
      }

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) {
        return { success: false, error: 'No hay datos para exportar' }
      }

      type PDFProduct = {
        id: string
        sku: string
        name: string
        brand?: string | null
        sale_price: number | null
        stock_quantity: number | null
        min_stock: number | null
        is_active: boolean
        category?: { name?: string } | null
        supplier?: { name?: string } | null
      }

      const baseItems = await applySelectedBranchStock(data as unknown as PDFProduct[])
      let items = baseItems

      if (filters.stockStatus === 'low_stock') {
        items = baseItems.filter(isLowStock)
      } else if (filters.stockStatus === 'in_stock') {
        items = baseItems.filter(p => !isOutOfStock(p))
      } else if (filters.stockStatus === 'out_of_stock') {
        items = baseItems.filter(isOutOfStock)
      }

      if (items.length === 0) {
        return { success: false, error: 'No hay datos para exportar' }
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const generatedAt = new Date()
      const formatNumber = (value: number) => value.toLocaleString('es-PY')
      const formatGs = (value: number | null | undefined) => `Gs. ${Number(value || 0).toLocaleString('es-PY')}`
      const getStockStatus = (product: Pick<PDFProduct, 'stock_quantity' | 'min_stock'>) =>
        isOutOfStock(product) ? 'Sin stock' : (isLowStock(product) ? 'Stock bajo' : 'En stock')

      const activeCount = items.filter(p => p.is_active).length
      const lowStockCount = items.filter(isLowStock).length
      const outOfStockCount = items.filter(isOutOfStock).length
      const inventoryValue = items.reduce(
        (sum, product) => sum + Number(product.sale_price || 0) * Number(product.stock_quantity || 0),
        0
      )

      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, 297, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('Reporte de productos', 14, 13)
      doc.setFontSize(9)
      doc.text(`Generado: ${generatedAt.toLocaleString('es-PY')}`, 14, 21)
      doc.text(`Productos: ${formatNumber(items.length)}`, 232, 13)
      doc.text(`Valor inventario: ${formatGs(inventoryValue)}`, 232, 21)

      autoTable(doc, {
        startY: 36,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total productos', formatNumber(items.length)],
          ['Activos', formatNumber(activeCount)],
          ['Stock bajo', formatNumber(lowStockCount)],
          ['Sin stock', formatNumber(outOfStockCount)],
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [8, 145, 178], textColor: 255 },
        margin: { left: 14, right: 218 },
      })

      autoTable(doc, {
        startY: 36,
        head: [[
          'SKU',
          'Producto',
          'Categoria',
          'Marca',
          'Proveedor',
          'Stock',
          'Min.',
          'Precio',
          'Valor stock',
          'Estado',
        ]],
        body: items.map(product => [
          product.sku || '-',
          product.name || '-',
          product.category?.name || '-',
          product.brand || '-',
          product.supplier?.name || '-',
          formatNumber(Number(product.stock_quantity || 0)),
          formatNumber(Number(product.min_stock || 0)),
          formatGs(product.sale_price),
          formatGs(Number(product.sale_price || 0) * Number(product.stock_quantity || 0)),
          `${product.is_active ? 'Activo' : 'Inactivo'} / ${getStockStatus(product)}`,
        ]),
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 46 },
          2: { cellWidth: 30 },
          3: { cellWidth: 28 },
          4: { cellWidth: 32 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'right', cellWidth: 16 },
          7: { halign: 'right', cellWidth: 27 },
          8: { halign: 'right', cellWidth: 30 },
          9: { cellWidth: 34 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          doc.setFontSize(8)
          doc.setTextColor(100)
          doc.text(`Pagina ${doc.getCurrentPageInfo().pageNumber}`, 270, 202)
        },
      })

      doc.save(`productos_${generatedAt.toISOString().split('T')[0]}.pdf`)
      return { success: true }
    } catch (err) {
      console.error('Error exporting to PDF:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido'
      }
    }
  }, [applySelectedBranchStock, selectedBranchId, supabase])

  // Cargar datos iniciales
  useEffect(() => {
    if (!enabled) return
    Promise.all([
      fetchCategories(),
      fetchBrands(),
      fetchSuppliers(),
      fetchDashboardStats(),
      fetchAlerts()
    ])
  }, [enabled, fetchCategories, fetchBrands, fetchSuppliers, fetchDashboardStats, fetchAlerts])

  // Cargar productos cuando cambien filtros, ordenamiento o paginación
  useEffect(() => {
    if (!enabled) return
    fetchProducts()
  }, [enabled, filters, sort, pagination, fetchProducts])

  // Escuchar eventos de actualización global para sincronizar con /dashboard/repairs/inventory y /dashboard/products
  useEffect(() => {
    const handleSync = () => {
      fetchProducts().catch(err => console.error('Error auto-syncing products:', err))
      fetchDashboardStats().catch(err => console.error('Error auto-syncing stats:', err))
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('product-updated', handleSync)
      window.addEventListener('inventory-updated', handleSync)
      return () => {
        window.removeEventListener('product-updated', handleSync)
        window.removeEventListener('inventory-updated', handleSync)
      }
    }
  }, [fetchProducts, fetchDashboardStats])

  // Memoizar valores calculados
  const memoizedValues = useMemo(() => ({
    products,
    categories,
    brands,
    suppliers,
    alerts,
    dashboardStats,
    loading,
    error,
    totalCount,
    resultTruncated,
    pagination: {
      totalPages: Math.max(1, Math.ceil(totalCount / Math.max(1, pagination.limit))),
      hasNextPage: pagination.page < Math.max(1, Math.ceil(totalCount / Math.max(1, pagination.limit))),
      hasPreviousPage: pagination.page > 1
    }
  }), [products, categories, brands, suppliers, alerts, dashboardStats, loading, error, totalCount, pagination.page, pagination.limit])

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
    totalPages: Math.max(1, Math.ceil(totalCount / Math.max(1, pagination.limit || totalCount || 1))),
    currentPage: pagination.page,
    // Funciones de datos
    fetchProducts,
    fetchDashboardStats,
    fetchCategories,
    fetchBrands,
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
    exportToCSV: exportInventoryCSV,
    exportToPDF,
    // Setters para compatibilidad
    setProducts,
    // Función para refrescar todos los datos
    refreshData: useCallback(async () => {
      await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchBrands(),
        fetchSuppliers(),
        fetchDashboardStats(),
        fetchAlerts()
      ])
    }, [fetchProducts, fetchCategories, fetchBrands, fetchSuppliers, fetchDashboardStats, fetchAlerts]),
    refreshAll: useCallback(async () => {
      await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchBrands(),
        fetchSuppliers(),
        fetchDashboardStats(),
        fetchAlerts()
      ])
    }, [fetchProducts, fetchCategories, fetchBrands, fetchSuppliers, fetchDashboardStats, fetchAlerts])
  }
}

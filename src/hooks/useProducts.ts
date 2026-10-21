'use client'

import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useOrganizationScopedState } from '@/hooks/use-organization-scoped-state'

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
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap, type BranchInventoryClient } from '@/lib/branches/inventory'
import { knownCost, costTotal, costProfit } from '@/lib/products/known-cost'
import { PRODUCT_CLIENT_COLUMNS, asCostRpcClient, attachProductCost, attachProductCosts } from '@/lib/products/cost-columns'

export function useProducts() {
  const { organization } = useActiveOrganization()
  const organizationId = organization?.id
  const { selectedBranchId } = useBranch()
  const scopeKey = organizationId ? `${organizationId}:${selectedBranchId ?? "all"}` : undefined

  const [products, setProducts] = useOrganizationScopedState<Product[]>(scopeKey, [])
  const [categories, setCategories] = useOrganizationScopedState<Category[]>(scopeKey, [])
  const [suppliers, setSuppliers] = useOrganizationScopedState<Supplier[]>(scopeKey, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const applySelectedBranchStock = useCallback(async <T extends { id: string; stock_quantity?: number | null }>(items: T[]) => {
    if (!selectedBranchId || items.length === 0) {
      return items as Array<T & { branch_stock_quantity?: number }>
    }

    const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
      supabase as unknown as BranchInventoryClient,
      selectedBranchId,
      items.map((item) => item.id)
    )

    return applyBranchInventoryToProducts(items, stockMap, branchScoped)
  }, [selectedBranchId, supabase, organizationId])

  // Función para cargar productos con filtros y paginación
  const loadProducts = useCallback(async (
    filters: ProductFilters = {},
    sort: ProductSortOptions = { field: 'created_at', direction: 'desc' },
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<ProductListResponse> => {
    if (!config.supabase.isConfigured || !organizationId) {
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
          ${PRODUCT_CLIENT_COLUMNS},
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, phone)
        `).eq('organization_id', organizationId!)

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
            if (!selectedBranchId) {
              query = query.eq('stock_quantity', 0)
            }
            break
          case 'low_stock':
            if (!selectedBranchId) {
              query = query.gt('stock_quantity', 0).filter('stock_quantity', 'lte', 'min_stock')
            }
            break
          case 'in_stock':
            if (!selectedBranchId) {
              query = query.filter('stock_quantity', 'gt', 'min_stock')
            }
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
      // El costo se pide aparte: solo vuelve con permiso de costos (si no, null).
      const withCosts = await attachProductCosts(asCostRpcClient(supabase), (data || []) as unknown as Array<Product & { id: string }>, { organizationId })
      const branchAwareProducts = await applySelectedBranchStock(withCosts as Array<Product & { id: string }>)
      let filteredProducts = branchAwareProducts

      if (filters.stock_status === 'out_of_stock') {
        filteredProducts = branchAwareProducts.filter((product) => Number(product.stock_quantity || 0) === 0)
      } else if (filters.stock_status === 'low_stock') {
        filteredProducts = branchAwareProducts.filter((product) => Number(product.stock_quantity || 0) > 0 && Number(product.stock_quantity || 0) <= Number(product.min_stock || 0))
      } else if (filters.stock_status === 'in_stock') {
        filteredProducts = branchAwareProducts.filter((product) => Number(product.stock_quantity || 0) > Number(product.min_stock || 0))
      }

      const processedProducts: Product[] = filteredProducts.map(product => ({
        ...product,
        stock_status: getStockStatus(product.stock_quantity, product.min_stock),
        margin: costProfit(product.sale_price, knownCost(product.purchase_price)),
        margin_percentage: product.purchase_price == null ? null : product.purchase_price > 0
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
  }, [applySelectedBranchStock, selectedBranchId, supabase, organizationId])

  // Función para obtener un producto por ID
  const getProduct = useCallback(async (id: string): Promise<Product | null> => {
    if (!config.supabase.isConfigured || !organizationId) return null

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          ${PRODUCT_CLIENT_COLUMNS},
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_name, phone)
        `).eq('organization_id', organizationId!)
        .eq('id', id)
        .single()

      if (error) throw error

      const withCost = await attachProductCost(asCostRpcClient(supabase), data as unknown as Product & { id: string }, { organizationId })
      const [branchAwareProduct] = await applySelectedBranchStock([withCost as Product & { id: string }])

      return {
        ...branchAwareProduct,
        stock_status: getStockStatus(Number(branchAwareProduct.stock_quantity || 0), withCost.min_stock),
        margin: costProfit(withCost.sale_price, knownCost(withCost.purchase_price)),
        margin_percentage: withCost.purchase_price == null ? null : withCost.purchase_price > 0
          ? ((withCost.sale_price - withCost.purchase_price) / withCost.purchase_price) * 100
          : 0,
        total_value: Number(branchAwareProduct.stock_quantity || 0) * data.sale_price
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar producto'
      setError(errorMessage)
      return null
    }
  }, [applySelectedBranchStock, supabase, organizationId])

  // Función para crear producto
  const createProduct = useCallback(async (productData: ProductFormData): Promise<Product | null> => {
    if (!config.supabase.isConfigured || !organizationId) return null

    setLoading(true)
    setError(null)

    try {
      // Validar SKU único
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id').eq('organization_id', organizationId!)
        .eq('sku', productData.sku)
        .single()

      if (existingProduct) {
        throw new Error('Ya existe un producto con este SKU')
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(productData),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; data?: Product; error?: string } | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || 'Error al crear producto')
      }

      const newProduct = payload.data as Product

      setProducts(prev => [newProduct, ...prev])
      return newProduct

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, supabase, organizationId])

  // Función para actualizar producto
  const updateProduct = useCallback(async (id: string, productData: Partial<ProductFormData>): Promise<Product | null> => {
    if (!config.supabase.isConfigured || !organizationId) return null

    setLoading(true)
    setError(null)

    try {
      // Si se está actualizando el SKU, validar que sea único
      if (productData.sku) {
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id').eq('organization_id', organizationId!)
          .eq('sku', productData.sku)
          .neq('id', id)
          .single()

        if (existingProduct) {
          throw new Error('Ya existe un producto con este SKU')
        }
      }

      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(productData),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; data?: Product; error?: string } | null

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || 'Error al actualizar producto')
      }

      const updatedProduct = payload.data as Product

      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p))
      return updatedProduct

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, supabase, organizationId])

  // Función para eliminar producto
  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    if (!config.supabase.isConfigured || !organizationId) return false

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: branchHeaders(selectedBranchId),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Error al eliminar producto')
      }

      setProducts(prev => prev.filter(p => p.id !== id))
      return true

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar producto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, organizationId])

  // Función para actualizar stock
  const updateStock = useCallback(async (
    id: string,
    newStock: number,
    movementType: 'entrada' | 'salida' | 'ajuste' = 'ajuste',
    notes?: string
  ): Promise<boolean> => {
    if (!config.supabase.isConfigured || !organizationId) return false

    try {
      let error = null as { message?: string } | null

      if (selectedBranchId) {
        const response = await supabase.rpc('set_branch_inventory_stock', {
          p_product_id: id,
          p_branch_id: selectedBranchId,
          p_new_stock: newStock,
          p_movement_type: movementType === 'entrada' ? 'in' : movementType === 'salida' ? 'out' : 'adjustment',
          p_reason: notes ?? null,
        })
        error = response.error
      } else {
        const response = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', id)
        error = response.error
      }

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
  }, [selectedBranchId, supabase, organizationId])

  // Función para cargar categorías
  const loadCategories = useCallback(async (): Promise<Category[]> => {
    if (!config.supabase.isConfigured || !organizationId) return []

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*').eq('organization_id', organizationId!)
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
  }, [supabase, organizationId])

  // Función para cargar proveedores
  const loadSuppliers = useCallback(async (): Promise<Supplier[]> => {
    if (!config.supabase.isConfigured || !organizationId) return []

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*').eq('organization_id', organizationId!)
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
  }, [supabase, organizationId])

  // Función para obtener estadísticas del dashboard
  const getDashboardStats = useCallback(async (): Promise<ProductDashboardStats> => {
    if (!config.supabase.isConfigured || !organizationId) {
      return {
        total_products: 0,
        active_products: 0,
        total_stock_value: 0,
        total_cost_value: null,
        total_margin: null,
        avg_margin_percentage: null,
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
        { data: movements }
      ] = await Promise.all([
        supabase.from('products').select(PRODUCT_CLIENT_COLUMNS).eq('organization_id', organizationId!),
        supabase.from('categories').select('id').eq('organization_id', organizationId!).eq('is_active', true),
        supabase.from('suppliers').select('id').eq('organization_id', organizationId!).eq('status', 'active'),
        (selectedBranchId
          ? supabase.from('product_movements').select('id').eq('organization_id', organizationId!).eq('branch_id', selectedBranchId)
          : supabase.from('product_movements').select('id').eq('organization_id', organizationId!)
        ).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ])

      const withCosts = await attachProductCosts(asCostRpcClient(supabase), (products || []) as unknown as Array<Product & { id: string }>, { organizationId })
      const branchAwareProducts = await applySelectedBranchStock(withCosts as Array<Product & { id: string }>)
      const activeProducts = branchAwareProducts.filter(p => p.is_active) || []
      const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.stock_quantity * p.sale_price), 0)
      const totalCostValue = costTotal(activeProducts.map(p => p.purchase_price == null ? null : p.stock_quantity * p.purchase_price))
      const totalMargin = costProfit(totalStockValue, totalCostValue)
      const avgMarginPercentage = totalCostValue === null || totalMargin === null ? null : totalCostValue > 0 ? (totalMargin / totalCostValue) * 100 : 0
      const lowStockCount = activeProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock).length
      const outOfStockCount = activeProducts.filter(p => p.stock_quantity === 0).length
      const alertsCount = lowStockCount + outOfStockCount

      return {
        total_products: branchAwareProducts.length || 0,
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
        alerts_count: alertsCount
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar estadísticas'
      setError(errorMessage)
      return {
        total_products: 0,
        active_products: 0,
        total_stock_value: 0,
        total_cost_value: null,
        total_margin: null,
        avg_margin_percentage: null,
        low_stock_count: 0,
        out_of_stock_count: 0,
        categories_count: 0,
        suppliers_count: 0,
        recent_movements_count: 0,
        alerts_count: 0
      }
    }
  }, [applySelectedBranchStock, selectedBranchId, supabase, organizationId])

  // Cargar datos iniciales
  useEffect(() => {
    loadCategories()
    loadSuppliers()
  }, [loadCategories, loadSuppliers, organizationId])

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

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'

export interface Category {
  id: string
  name: string
  description?: string
  productCount?: number
}

export interface Supplier {
  id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  website?: string
  tax_id?: string
  payment_terms?: string
  credit_limit?: number
  current_debt?: number
  rating?: number
  status?: 'active' | 'inactive' | 'suspended'
  category?: string
  notes?: string
  productCount?: number
  created_at?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  category_id?: string
  category?: { name: string }
  supplier_id?: string
  supplier?: { name: string }
  sale_price: number
  purchase_price: number
  stock_quantity: number
  min_stock: number
  max_stock: number
  description?: string
  status: 'active' | 'inactive' | 'discontinued'
  barcode?: string
  weight?: number
  dimensions?: string
  image_url?: string
  created_at: string
  updated_at: string
}

interface UseInventoryProps {
  initialPage?: number
  initialPageSize?: number
}

const productApiFields = [
  'name',
  'sku',
  'description',
  'category_id',
  'supplier_id',
  'brand',
  'brand_id',
  'stock_quantity',
  'min_stock',
  'max_stock',
  'purchase_price',
  'sale_price',
  'wholesale_price',
  'offer_price',
  'has_offer',
  'is_active',
  'visibility',
  'warranty_months',
  'warranty_info',
  'return_window_days',
  'exchange_window_days',
  'return_policy',
  'exchange_policy',
  'images',
  'image_url',
  'barcode',
  'unit_measure',
] as const

function toProductApiPayload(productData: Partial<Product>) {
  const source = productData as Record<string, unknown>
  const payload: Record<string, unknown> = {}

  for (const field of productApiFields) {
    if (source[field] !== undefined) payload[field] = source[field]
  }

  if (payload.is_active === undefined && typeof source.status === 'string') {
    payload.is_active = source.status === 'active'
  }

  return payload
}

const supplierApiFields = [
  'name',
  'contact_name',
  'email',
  'phone',
  'address',
  'city',
  'country',
  'website',
  'tax_id',
  'payment_terms',
  'credit_limit',
  'current_debt',
  'rating',
  'status',
  'category',
  'notes',
  'is_active',
] as const

function toSupplierApiPayload(supplierData: Partial<Supplier>) {
  const source = supplierData as Record<string, unknown>
  const payload: Record<string, unknown> = {}

  for (const field of supplierApiFields) {
    if (source[field] !== undefined) payload[field] = source[field]
  }

  return payload
}

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useInventory({ initialPage = 1, initialPageSize = 10 }: UseInventoryProps = {}) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Paginación y Filtros
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    supplier: 'all',
    status: 'all',
    stockStatus: 'all', // 'low', 'out', 'normal', 'high'
    minPrice: null as number | null,
    maxPrice: null as number | null,
    minStock: null as number | null,
    maxStock: null as number | null,
    hasImage: false,
    dateAdded: '',
    lastMovement: '',
  })

  const { selectedBranchId } = useBranch()
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const productRequestRef = useRef<AbortController | null>(null)
  const hasLoadedProductsRef = useRef(false)

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar las categorias')
      }

      setCategories((payload.data || []).map((c: Partial<Category> & { products_count?: number }) => ({
        ...c,
        productCount: c.products_count ?? c.productCount ?? 0
      })) as Category[])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await fetch('/api/suppliers?limit=100', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar los proveedores')
      }

      setSuppliers((payload.data || []).map((s: Partial<Supplier> & { products_count?: number }) => ({
        ...s,
        productCount: s.productCount ?? s.products_count ?? 0
      })) as Supplier[])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    productRequestRef.current?.abort()
    const requestController = new AbortController()
    productRequestRef.current = requestController
    const isInitialLoad = !hasLoadedProductsRef.current

    if (isInitialLoad) setLoading(true)
    else setIsRefreshing(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
        sort: 'created_at',
        direction: 'desc',
      })
      if (selectedBranchId) params.set('strict_branch_stock', 'true')
      if (debouncedSearch.trim()) params.set('query', debouncedSearch.trim())
      if (filters.category !== 'all') params.set('category_id', filters.category)
      if (filters.supplier !== 'all') params.set('supplier_id', filters.supplier)
      if (filters.status === 'active' || filters.status === 'inactive') {
        params.set('is_active', String(filters.status === 'active'))
      }
      if (typeof filters.minPrice === 'number') params.set('price_min', String(filters.minPrice))
      if (typeof filters.maxPrice === 'number') params.set('price_max', String(filters.maxPrice))
      if (typeof filters.minStock === 'number') params.set('stock_min', String(filters.minStock))
      if (typeof filters.maxStock === 'number') params.set('stock_max', String(filters.maxStock))
      if (filters.hasImage) params.set('has_image', 'true')

      const stockStatus = ({
        out: 'out_of_stock',
        low: 'low_stock',
        normal: 'normal_stock',
        high: 'high_stock',
      } as Record<string, string>)[filters.stockStatus]
      if (stockStatus) params.set('stock_status', stockStatus)

      const dateAddedRange = filters.dateAdded ? getDayRange(filters.dateAdded) : null
      if (dateAddedRange) {
        params.set('created_from', dateAddedRange.start)
        params.set('created_to', dateAddedRange.end)
      }
      const lastMovementRange = filters.lastMovement ? getDayRange(filters.lastMovement) : null
      if (lastMovementRange) {
        params.set('updated_from', lastMovementRange.start)
        params.set('updated_to', lastMovementRange.end)
      }

      const response = await fetch(`/api/products?${params.toString()}`, {
        cache: 'no-store',
        headers: branchHeaders(selectedBranchId),
        signal: requestController.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.products)) {
        throw new Error(payload?.error || 'No se pudieron cargar los productos')
      }

      setProducts(payload.data.products.map((product: Product & { is_active?: boolean }) => ({
        ...product,
        status: product.status || (product.is_active === false ? 'inactive' : 'active'),
      })))
      setTotalCount(Number(payload.data.total) || 0)
      hasLoadedProductsRef.current = true
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos')
    } finally {
      if (productRequestRef.current === requestController) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [
    page,
    pageSize,
    selectedBranchId,
    debouncedSearch,
    filters.category,
    filters.supplier,
    filters.status,
    filters.stockStatus,
    filters.minPrice,
    filters.maxPrice,
    filters.minStock,
    filters.maxStock,
    filters.hasImage,
    filters.dateAdded,
    filters.lastMovement,
  ])

  // Carga inicial
  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [fetchCategories, fetchSuppliers])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [filters.search])

  useEffect(() => () => {
    productRequestRef.current?.abort()
  }, [])

  // Recargar productos cuando cambian dependencias
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    setPage(1)
  }, [
    filters.search,
    filters.category,
    filters.supplier,
    filters.status,
    filters.stockStatus,
    filters.minPrice,
    filters.maxPrice,
    filters.minStock,
    filters.maxStock,
    filters.hasImage,
    filters.dateAdded,
    filters.lastMovement,
    pageSize,
    selectedBranchId,
  ])

  // Operaciones CRUD
  const createProduct = async (productData: Partial<Product>) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify(toProductApiPayload(productData)),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo crear el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo crear el producto') }
    }
  }

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify(toProductApiPayload(productData)),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo actualizar el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo actualizar el producto') }
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: branchHeaders(selectedBranchId),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo eliminar el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo eliminar el producto') }
    }
  }

  // Supplier CRUD
  const createSupplier = async (supplierData: Partial<Supplier>) => {
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSupplierApiPayload(supplierData)),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo crear el proveedor' }
      }

      await fetchSuppliers()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo crear el proveedor') }
    }
  }

  const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    try {
      const response = await fetch('/api/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...toSupplierApiPayload(supplierData) }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo actualizar el proveedor' }
      }

      await fetchSuppliers()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo actualizar el proveedor') }
    }
  }

  const deleteSupplier = async (id: string) => {
    try {
      const response = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo eliminar el proveedor' }
      }

      await fetchSuppliers()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'No se pudo eliminar el proveedor') }
    }
  }

  return {
    products,
    categories,
    suppliers,
    loading,
    isRefreshing,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    filters,
    setFilters,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshProducts: fetchProducts,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    refreshSuppliers: fetchSuppliers
  }
}

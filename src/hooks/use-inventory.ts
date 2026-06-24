import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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

const STOCK_FILTER_SCAN_LIMIT = 250
const STOCK_FILTER_MAX_SCANNED_ROWS = 2000

export function useInventory({ initialPage = 1, initialPageSize = 10 }: UseInventoryProps = {}) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
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

  const supabase = createClient()

  const matchesStockStatus = useCallback((product: Product, stockStatus: string) => {
    if (stockStatus === 'out') return product.stock_quantity === 0
    if (stockStatus === 'low') return product.stock_quantity <= product.min_stock && product.stock_quantity > 0
    if (stockStatus === 'high') return product.stock_quantity >= product.max_stock
    if (stockStatus === 'normal') return product.stock_quantity > product.min_stock && product.stock_quantity < product.max_stock
    return true
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar las categorias')
      }

      setCategories((payload.data || []).map((c: any) => ({
        ...c,
        productCount: c.products_count ?? c.productCount ?? 0
      })))
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

      setSuppliers((payload.data || []).map((s: any) => ({
        ...s,
        productCount: s.productCount ?? s.products_count ?? 0
      })))
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let baseQuery = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name),
          supplier:suppliers(id, name)
        `, { count: 'exact' })

      // Aplicar filtros
      if (filters.search) {
        baseQuery = baseQuery.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters.category !== 'all') {
        // Asumiendo que filters.category es el ID o el nombre. Idealmente usar ID.
        // Si el UI pasa el nombre, habría que buscar el ID o filtrar por relación (más complejo en Supabase JS client directo a veces)
        // Por simplicidad, asumiremos que se pasa el ID o ajustaremos el componente para pasar ID.
        // Si es nombre:
        // query = query.filter('category.name', 'eq', filters.category) -> Esto no funciona directo en join
        // Mejor filtrar por category_id si es posible.
        // Por ahora, si filters.category es un UUID, filtramos por category_id
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.category)) {
           baseQuery = baseQuery.eq('category_id', filters.category)
        }
      }

      if (filters.supplier !== 'all') {
        baseQuery = baseQuery.eq('supplier_id', filters.supplier)
      }

      if (filters.status !== 'all') {
        baseQuery = baseQuery.eq('status', filters.status)
      }

      if (typeof filters.minPrice === 'number') {
        baseQuery = baseQuery.gte('sale_price', filters.minPrice)
      }

      if (typeof filters.maxPrice === 'number') {
        baseQuery = baseQuery.lte('sale_price', filters.maxPrice)
      }

      if (typeof filters.minStock === 'number') {
        baseQuery = baseQuery.gte('stock_quantity', filters.minStock)
      }

      if (typeof filters.maxStock === 'number') {
        baseQuery = baseQuery.lte('stock_quantity', filters.maxStock)
      }

      if (filters.hasImage) {
        baseQuery = baseQuery.not('image_url', 'is', null)
      }

      const dateAddedRange = filters.dateAdded ? getDayRange(filters.dateAdded) : null
      if (dateAddedRange) {
        baseQuery = baseQuery.gte('created_at', dateAddedRange.start).lt('created_at', dateAddedRange.end)
      }

      const lastMovementRange = filters.lastMovement ? getDayRange(filters.lastMovement) : null
      if (lastMovementRange) {
        baseQuery = baseQuery.gte('updated_at', lastMovementRange.start).lt('updated_at', lastMovementRange.end)
      }

      // Con filtros de stock calculados contra dos columnas, evitamos leer todo el catálogo.
      // Escaneamos lotes acotados hasta llenar la página solicitada. El total se informa como
      // mínimo conocido cuando el filtro no puede calcularse completamente en PostgREST.
      if (filters.stockStatus !== 'all') {
        const from = (page - 1) * pageSize
        const wanted = from + pageSize
        const filteredData: Product[] = []
        let scanned = 0
        let hasMoreRows = true

        while (filteredData.length < wanted && scanned < STOCK_FILTER_MAX_SCANNED_ROWS && hasMoreRows) {
          const rangeFrom = scanned
          const rangeTo = scanned + STOCK_FILTER_SCAN_LIMIT - 1
          const { data, error } = await baseQuery
            .order('created_at', { ascending: false })
            .range(rangeFrom, rangeTo)

          if (error) throw error

          const batch = (data || []) as Product[]
          hasMoreRows = batch.length === STOCK_FILTER_SCAN_LIMIT
          scanned += batch.length
          filteredData.push(...batch.filter((p) => matchesStockStatus(p, filters.stockStatus)))
        }

        setProducts(filteredData.slice(from, wanted))
        setTotalCount(hasMoreRows ? Math.max(filteredData.length, wanted + 1) : filteredData.length)
        return
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await baseQuery
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      setProducts((data || []) as Product[])
      setTotalCount(count || 0)

    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, page, pageSize, filters, matchesStockStatus])

  // Carga inicial
  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [fetchCategories, fetchSuppliers])

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
  ])

  // Operaciones CRUD
  const createProduct = async (productData: Partial<Product>) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toProductApiPayload(productData)),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo crear el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo crear el producto' }
    }
  }

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toProductApiPayload(productData)),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo actualizar el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo actualizar el producto' }
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'No se pudo eliminar el producto' }
      }

      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo eliminar el producto' }
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
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo crear el proveedor' }
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
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo actualizar el proveedor' }
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
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudo eliminar el proveedor' }
    }
  }

  return {
    products,
    categories,
    suppliers,
    loading,
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

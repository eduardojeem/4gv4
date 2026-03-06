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
    status: 'all',
    stockStatus: 'all' // 'low', 'out', 'normal', 'high'
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
      const { data, error } = await supabase
        .from('categories')
        .select('*, products(count)')
      
      if (error) throw error
      
      setCategories(data.map((c: any) => ({
        ...c,
        productCount: c.products?.[0]?.count || 0
      })))
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [supabase])

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*, products(count)')
        .order('name')
      
      if (error) throw error

      setSuppliers(data.map((s: any) => ({
        ...s,
        productCount: s.products?.[0]?.count || 0
      })))
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }, [supabase])

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

      if (filters.status !== 'all') {
        baseQuery = baseQuery.eq('status', filters.status)
      }
      // Con filtro de stock aplicamos filtro antes de paginar para mantener totalCount correcto.
      if (filters.stockStatus !== 'all') {
        const { data: fullData, error } = await baseQuery.order('created_at', { ascending: false })
        if (error) throw error

        const filteredData = (fullData as Product[]).filter((p) => matchesStockStatus(p, filters.stockStatus))
        const from = (page - 1) * pageSize
        const to = from + pageSize

        setProducts(filteredData.slice(from, to))
        setTotalCount(filteredData.length)
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
  }, [filters.search, filters.category, filters.status, filters.stockStatus, pageSize])

  // Operaciones CRUD
  const createProduct = async (productData: Partial<Product>) => {
    try {
      const { error } = await supabase.from('products').insert([productData])
      if (error) throw error
      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const { error } = await supabase.from('products').update(productData).eq('id', id)
      if (error) throw error
      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      await fetchProducts()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Supplier CRUD
  const createSupplier = async (supplierData: Partial<Supplier>) => {
    try {
      const { error } = await supabase.from('suppliers').insert([supplierData])
      if (error) throw error
      await fetchSuppliers()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    try {
      const { error } = await supabase.from('suppliers').update(supplierData).eq('id', id)
      if (error) throw error
      await fetchSuppliers()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  const deleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      await fetchSuppliers()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
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


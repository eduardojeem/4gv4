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
  contact_person?: string
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
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name),
          supplier:suppliers(id, name)
        `, { count: 'exact' })

      // Aplicar filtros
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
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
           query = query.eq('category_id', filters.category)
        }
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      // Filtros de stock (más complejo de hacer en servidor sin RPC o lógica compleja, 
      // pero podemos intentarlo con filtros simples o hacerlo en cliente si son pocos datos.
      // Para optimización real, debería ser en servidor.
      // Supabase no soporta comparaciones de columnas directas (stock <= min_stock) en .filter() estándar fácilmente sin raw sql filter.
      // Usaremos lógica cliente para stockFilter complejo por ahora si la paginación es pequeña, 
      // O idealmente un RPC 'get_products_with_stock_status'.
      // Para mantenerlo simple y "safe", si hay filtro de stock, quizás sea mejor traer más y filtrar, o no paginar.
      // Pero intentemos paginación estándar primero.
      
      // Paginación
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to).order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) throw error

      let processedData = data as Product[]

      // Filtrado de stock en cliente (limitación: solo filtra sobre la página actual si no usamos RPC)
      // Esto es un compromiso. Para hacerlo bien en servidor se necesita RPC o vistas.
      if (filters.stockStatus !== 'all') {
         // Si el usuario filtra por stock, esto podría devolver menos resultados por página de los esperados
         // Solución ideal: Crear una vista o función RPC.
         // Por ahora, aplicamos el filtro en memoria a los resultados devueltos (imperfecto pero funcional para UI)
         processedData = processedData.filter(p => {
            if (filters.stockStatus === 'out') return p.stock_quantity === 0
            if (filters.stockStatus === 'low') return p.stock_quantity <= p.min_stock && p.stock_quantity > 0
            if (filters.stockStatus === 'high') return p.stock_quantity >= p.max_stock
            if (filters.stockStatus === 'normal') return p.stock_quantity > p.min_stock && p.stock_quantity < p.max_stock
            return true
         })
      }

      setProducts(processedData)
      setTotalCount(count || 0)

    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, page, pageSize, filters])

  // Carga inicial
  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [fetchCategories, fetchSuppliers])

  // Recargar productos cuando cambian dependencias
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

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

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types/product'

type DBProduct = {
  id: string
  name: string
  sku: string
  stock: number | string
  min_stock: number | string
  purchase_price: number | string
  sale_price: number | string
  description?: string | null
  created_at: string
  updated_at?: string
  // Optional relations if selected later
  category_id?: string | null
  supplier_id?: string | null
}

export type UIProduct = Product

function mapDbToUi(
  p: DBProduct,
  categoryMap: Map<string, string>,
  supplierMap: Map<string, string>
): UIProduct {
  const categoryName = p.category_id && categoryMap.get(p.category_id) ? categoryMap.get(p.category_id)! : 'Sin categoría'
  const supplierName = p.supplier_id && supplierMap.get(p.supplier_id) ? supplierMap.get(p.supplier_id)! : '—'
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: categoryName,
    supplier: supplierName,
    purchase_price: typeof p.purchase_price === 'string' ? Number(p.purchase_price) : p.purchase_price ?? 0,
    sale_price: typeof p.sale_price === 'string' ? Number(p.sale_price) : p.sale_price ?? 0,
    stock_quantity: typeof p.stock === 'string' ? Number(p.stock) : p.stock ?? 0,
    min_stock: typeof p.min_stock === 'string' ? Number(p.min_stock) : p.min_stock ?? 0,
    created_at: p.created_at,
    description: p.description ?? undefined,
    image: undefined,
    featured: false,
    barcode: undefined,
  }
}

export function useProducts() {
  const supabase = createClient()
  const [products, setProducts] = useState<UIProduct[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  type SortField = 'name' | 'sku' | 'stock' | 'stock_quantity' | 'sale_price' | 'purchase_price' | 'created_at' | 'category' | 'supplier' | 'margin_percent'
  type SortDirection = 'asc' | 'desc'
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [total, setTotal] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null)
  const [marginRange, setMarginRange] = useState<[number, number] | null>(null)

  // Debounce search to reduce server load
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      // Map UI sort field to DB column when needed
      const orderField = sortField === 'stock_quantity' ? 'stock' : sortField

      let base = supabase
        .from('products')
        .select('id,name,sku,stock,min_stock,purchase_price,sale_price,description,created_at,category,category_id,supplier,supplier_id,margin_percent', { count: 'exact' })
        .order(orderField, { ascending: sortDirection === 'asc' })
        .range(from, to)

      if (debouncedSearch && debouncedSearch.length > 0) {
        const term = `%${debouncedSearch}%`
        // Expand server-side search to include category and description for better coverage
        base = base.or(
          `name.ilike.${term},sku.ilike.${term},supplier.ilike.${term},category.ilike.${term},description.ilike.${term}`
        )
      }

      // Server-side category and stock filters
      let query = base
      if (selectedCategory && selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }
      if (selectedSupplier && selectedSupplier !== 'all') {
        query = query.eq('supplier', selectedSupplier)
      }
      if (priceRange && Array.isArray(priceRange)) {
        const [min, max] = priceRange
        if (typeof min === 'number') {
          query = query.gte('sale_price', min)
        }
        if (typeof max === 'number') {
          query = query.lte('sale_price', max)
        }
      }
      if (marginRange && Array.isArray(marginRange)) {
        const [minM, maxM] = marginRange
        if (typeof minM === 'number') {
          query = query.gte('margin_percent', minM)
        }
        if (typeof maxM === 'number') {
          query = query.lte('margin_percent', maxM)
        }
      }
      if (stockFilter === 'out-of-stock') {
        query = base.eq('stock', 0)
      } else if (stockFilter === 'in-stock') {
        query = base.gt('stock', 0)
      } else if (stockFilter === 'low-stock') {
        query = base.eq('is_low_stock', true)
      }

      const { data, error, count } = await query
      // Fallbacks if generated columns don't exist yet
      if (error && stockFilter === 'low-stock' && /is_low_stock/.test(error.message || '')) {
        const { data: data2, error: error2, count: count2 } = await base
          .select('id,name,sku,stock,min_stock,purchase_price,sale_price,description,created_at,category_id,supplier_id', { count: 'exact' })
        if (error2) {
          setError(error2.message || 'Error cargando productos')
          setProducts([])
          setLoading(false)
          return
        }
        const filtered = (data2 || []).filter(p => {
          const qty = Number((p as any).stock ?? 0)
          const min = Number((p as any).min_stock ?? 0)
          return qty > 0 && qty <= min
        })
        setProducts(filtered as UIProduct[])
        setTotal(count2 ?? filtered.length)
        setLoading(false)
        return
      } else if (error && marginRange && /margin_percent/.test(error.message || '')) {
        // Fallback for margin filter: fetch without margin_percent and filter in JS
        const { data: data3, error: error3, count: count3 } = await base
          .select('id,name,sku,stock,min_stock,purchase_price,sale_price,description,created_at,category,category_id,supplier,supplier_id', { count: 'exact' })
        if (error3) {
          setError(error3.message || 'Error cargando productos')
          setProducts([])
          setLoading(false)
          return
        }
        const [minM, maxM] = marginRange
        const filteredByMargin = (data3 || []).filter(p => {
          const purchase = Number((p as any).purchase_price ?? 0)
          const sale = Number((p as any).sale_price ?? 0)
          const margin = purchase > 0 ? ((sale - purchase) / purchase) * 100 : 0
          return margin >= (typeof minM === 'number' ? minM : -Infinity) && margin <= (typeof maxM === 'number' ? maxM : Infinity)
        })

        // Continue mapping as usual
        const raw = filteredByMargin as DBProduct[]
        setTotal(typeof count3 === 'number' ? count3 : raw.length)

        const categoryIds = Array.from(new Set(raw.map(p => p.category_id).filter(Boolean))) as string[]
        const supplierIds = Array.from(new Set(raw.map(p => p.supplier_id).filter(Boolean))) as string[]

        const categoryMap = new Map<string, string>()
        const supplierMap = new Map<string, string>()

        if (categoryIds.length > 0) {
          const { data: catData } = await supabase
            .from('categories')
            .select('id,name')
            .in('id', categoryIds)
          if (catData) {
            for (const c of catData as { id: string; name: string }[]) {
              categoryMap.set(c.id, c.name)
            }
          }
        }

        if (supplierIds.length > 0) {
          const { data: supData } = await supabase
            .from('suppliers')
            .select('id,name')
            .in('id', supplierIds)
          if (supData) {
            for (const s of supData as { id: string; name: string }[]) {
              supplierMap.set(s.id, s.name)
            }
          }
        }

        const mapped = raw.map(p => mapDbToUi(p, categoryMap, supplierMap))
        setProducts(mapped)
        setLoading(false)
        return
      } else if (error && sortField === 'margin_percent' && /margin_percent/.test(error.message || '')) {
        // Fallback for sorting by margin when column doesn't exist
        // Re-query without ordering by margin_percent and sort in JS
        let baseNoOrder = supabase
          .from('products')
          .select('id,name,sku,stock,min_stock,purchase_price,sale_price,description,created_at,category,category_id,supplier,supplier_id', { count: 'exact' })
          .range(from, to)

        if (debouncedSearch && debouncedSearch.length > 0) {
          const term = `%${debouncedSearch}%`
          baseNoOrder = baseNoOrder.or(`name.ilike.${term},sku.ilike.${term},supplier.ilike.${term}`)
        }
        if (selectedCategory && selectedCategory !== 'all') {
          baseNoOrder = baseNoOrder.eq('category', selectedCategory)
        }
        if (selectedSupplier && selectedSupplier !== 'all') {
          baseNoOrder = baseNoOrder.eq('supplier', selectedSupplier)
        }
        if (priceRange && Array.isArray(priceRange)) {
          const [min, max] = priceRange
          if (typeof min === 'number') baseNoOrder = baseNoOrder.gte('sale_price', min)
          if (typeof max === 'number') baseNoOrder = baseNoOrder.lte('sale_price', max)
        }
        if (stockFilter === 'out-of-stock') {
          baseNoOrder = baseNoOrder.eq('stock', 0)
        } else if (stockFilter === 'in-stock') {
          baseNoOrder = baseNoOrder.gt('stock', 0)
        }

        const { data: dataNoOrder, error: errNoOrder, count: countNoOrder } = await baseNoOrder
        if (errNoOrder) {
          setError(errNoOrder.message || 'Error cargando productos')
          setProducts([])
          setLoading(false)
          return
        }

        const rawNoOrder = (dataNoOrder || []) as DBProduct[]
        setTotal(typeof countNoOrder === 'number' ? countNoOrder : rawNoOrder.length)

        const categoryIds = Array.from(new Set(rawNoOrder.map(p => p.category_id).filter(Boolean))) as string[]
        const supplierIds = Array.from(new Set(rawNoOrder.map(p => p.supplier_id).filter(Boolean))) as string[]

        const categoryMap = new Map<string, string>()
        const supplierMap = new Map<string, string>()

        if (categoryIds.length > 0) {
          const { data: catData } = await supabase
            .from('categories')
            .select('id,name')
            .in('id', categoryIds)
          if (catData) {
            for (const c of catData as { id: string; name: string }[]) {
              categoryMap.set(c.id, c.name)
            }
          }
        }

        if (supplierIds.length > 0) {
          const { data: supData } = await supabase
            .from('suppliers')
            .select('id,name')
            .in('id', supplierIds)
          if (supData) {
            for (const s of supData as { id: string; name: string }[]) {
              supplierMap.set(s.id, s.name)
            }
          }
        }

        const mappedNoOrder = rawNoOrder.map(p => mapDbToUi(p, categoryMap, supplierMap))
        // Sort by computed margin percent client-side
        mappedNoOrder.sort((a, b) => {
          const marginA = a.purchase_price > 0 ? ((a.sale_price - a.purchase_price) / a.purchase_price) * 100 : 0
          const marginB = b.purchase_price > 0 ? ((b.sale_price - b.purchase_price) / b.purchase_price) * 100 : 0
          return sortDirection === 'asc' ? marginA - marginB : marginB - marginA
        })

        setProducts(mappedNoOrder)
        setLoading(false)
        return
      } else if (error) {
        setError(error.message || 'Error cargando productos')
        setProducts([])
        setLoading(false)
        return
      }
      const raw = (data || []) as DBProduct[]
      setTotal(typeof count === 'number' ? count : raw.length)

      // Build relation maps for category and supplier names
      const categoryIds = Array.from(new Set(raw.map(p => p.category_id).filter(Boolean))) as string[]
      const supplierIds = Array.from(new Set(raw.map(p => p.supplier_id).filter(Boolean))) as string[]

      const categoryMap = new Map<string, string>()
      const supplierMap = new Map<string, string>()

      if (categoryIds.length > 0) {
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id,name')
          .in('id', categoryIds)
        if (!catErr && catData) {
          for (const c of catData as { id: string; name: string }[]) {
            categoryMap.set(c.id, c.name)
          }
        }
      }

      if (supplierIds.length > 0) {
        const { data: supData, error: supErr } = await supabase
          .from('suppliers')
          .select('id,name')
          .in('id', supplierIds)
        if (!supErr && supData) {
          for (const s of supData as { id: string; name: string }[]) {
            supplierMap.set(s.id, s.name)
          }
        }
      }

      const mapped = raw.map(p => mapDbToUi(p, categoryMap, supplierMap))
      setProducts(mapped)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Error inesperado cargando productos'
      setError(errorMessage)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [supabase, page, pageSize, debouncedSearch, sortField, sortDirection, stockFilter, selectedCategory, selectedSupplier, priceRange, marginRange])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    setProducts,
    loading,
    error,
    refresh: fetchProducts,
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedSupplier,
    setSelectedSupplier,
    priceRange,
    setPriceRange,
    marginRange,
    setMarginRange,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    stockFilter,
    setStockFilter,
    total,
  }
}
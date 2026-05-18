'use client'

// Force re-evaluation - remove this comment if HMR issues occur
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import type { Product as UnifiedProduct, Category as UnifiedCategory } from '@/types/product-unified'
import { config } from '@/lib/config'
import { useProductRealTimeSync } from './useRealTimeSync'
import { SALE_STATUS } from '@/lib/sales-status'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap } from '@/lib/branches/inventory'

type DbProductRow = Database['public']['Tables']['products']['Row']
type DbCategoryRow = Database['public']['Tables']['categories']['Row']
type Product = DbProductRow & {
  category?: DbCategoryRow
  supplier?: Database['public']['Tables']['suppliers']['Row']
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
  image_url?: string | null
  images?: string[] | null
  cost_price?: number | null
  categories?: { name: string } | null
}

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  stock: number
  subtotal: number
  discount_amount?: number
}

interface StockMovement {
  product_id: string
  new_stock?: number
}

interface SaleData {
  items: CartItem[]
  total: number
  payment_method: 'cash' | 'card' | 'transfer'
  customer_id?: string
  notes?: string
}

type PosProductRow = Product & {
  categories?: { name: string } | null
}

// ============================================================================
// Products Cache (stale-while-revalidate)
// ============================================================================
const productsCacheByBranch: Record<string, UnifiedProduct[] | undefined> = {}
const productsCacheTimestampsByBranch: Record<string, number | undefined> = {}
const productsFetchPromisesByBranch: Record<string, Promise<UnifiedProduct[]> | undefined> = {}
const PRODUCTS_CACHE_TTL = 3 * 60 * 1000 // 3 minutes - realtime handles freshness

function getBranchCacheKey(branchId?: string | null) {
  return branchId || 'global'
}

function getProductsCache(branchId?: string | null) {
  return productsCacheByBranch[getBranchCacheKey(branchId)] || null
}

function setProductsCache(branchId: string | null | undefined, products: UnifiedProduct[]) {
  const cacheKey = getBranchCacheKey(branchId)
  productsCacheByBranch[cacheKey] = products
  productsCacheTimestampsByBranch[cacheKey] = Date.now()
}

function isProductsCacheFresh(branchId?: string | null): boolean {
  const cacheKey = getBranchCacheKey(branchId)
  const timestamp = productsCacheTimestampsByBranch[cacheKey]
  return Array.isArray(productsCacheByBranch[cacheKey]) && typeof timestamp === 'number' && (Date.now() - timestamp) < PRODUCTS_CACHE_TTL
}


export function usePOSProducts() {
  const { selectedBranchId } = useBranch()
  const [products, setProducts] = useState<UnifiedProduct[]>(() => getProductsCache(selectedBranchId) || [])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(() => !isProductsCacheFresh(selectedBranchId))
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [realTimeEnabled, setRealTimeEnabled] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  // Función para actualizar un producto específico en tiempo real
  const updateProductInState = useCallback((updatedProduct: Product) => {
    setProducts(prevProducts => {
      const productIndex = prevProducts.findIndex(p => p.id === updatedProduct.id)
      
      if (productIndex >= 0) {
        const newProducts = [...prevProducts]
        
        const newCategoryId = updatedProduct.category_id
        const currentCategory = newProducts[productIndex].category
        const categoryChanged = newCategoryId !== newProducts[productIndex].category_id
        
        let newCategory = currentCategory
        if (categoryChanged) {
           newCategory = prevProducts.find(p => p.category_id === newCategoryId)?.category
        }

        newProducts[productIndex] = {
          ...newProducts[productIndex],
          name: updatedProduct.name,
          sale_price: updatedProduct.sale_price,
          stock_quantity: updatedProduct.stock_quantity,
          category_id: newCategoryId,
          category: newCategory,
          description: updatedProduct.description || undefined,
          image: updatedProduct.images?.[0] || updatedProduct.image_url || undefined,
          is_active: updatedProduct.is_active,
          purchase_price: updatedProduct.cost_price || newProducts[productIndex].purchase_price || 0
        }

        // Keep cache in sync
        setProductsCache(selectedBranchId, newProducts)
        return newProducts
      } else if (updatedProduct.is_active) {
        const newProduct = {
          id: updatedProduct.id,
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          barcode: updatedProduct.barcode || undefined,
          sale_price: updatedProduct.sale_price,
          stock_quantity: updatedProduct.stock_quantity,
          category_id: updatedProduct.category_id ?? null,
          category: prevProducts.find(p => p.category_id === updatedProduct.category_id)?.category,
          description: updatedProduct.description || undefined,
          image: updatedProduct.images?.[0] || updatedProduct.image_url || undefined,
          unit_measure: updatedProduct.unit_measure || 'unidad',
          is_active: updatedProduct.is_active,
          purchase_price: updatedProduct.cost_price || 0
        } as unknown as UnifiedProduct
        const updated = [...prevProducts, newProduct]
        setProductsCache(selectedBranchId, updated)
        return updated
      }
      
      return prevProducts
    })
  }, [selectedBranchId])

  // Función para actualizar stock en tiempo real
  const updateStockInState = useCallback((stockMovement: StockMovement) => {
    if (stockMovement.product_id) {
      setProducts(prevProducts => {
        const updatedProducts = prevProducts.map(product => 
          product.id === stockMovement.product_id
            ? { ...product, stock_quantity: stockMovement.new_stock ?? product.stock_quantity }
            : product
        )
        setProductsCache(selectedBranchId, updatedProducts)
        return updatedProducts
      })
    }
  }, [selectedBranchId])

  // Configurar sincronización en tiempo real
  const realTimeSync = useProductRealTimeSync(
    updateProductInState,
    updateStockInState
  )

  // Función para cargar productos desde Supabase
  const fetchProducts = useCallback(async () => {
    if (isProductsCacheFresh(selectedBranchId)) {
      setProducts(getProductsCache(selectedBranchId) || [])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const cacheKey = getBranchCacheKey(selectedBranchId)
      if (!productsFetchPromisesByBranch[cacheKey]) {
        productsFetchPromisesByBranch[cacheKey] = (async () => {
          const { data: dbProducts, error } = await supabase
            .from('products')
            .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active, image_url, images, categories(name)')
            .eq('is_active', true)
            .order('name')
            .limit(5000)

          if (error) {
            throw error
          }

          const baseProducts = (dbProducts || []).map((p: PosProductRow) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode,
            sale_price: Number(p.sale_price),
            stock_quantity: p.stock_quantity,
            category_id: p.category_id,
            category: p.categories ? { id: p.category_id, name: p.categories.name } : undefined,
            description: p.description,
            image: (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined) || p.image_url || undefined,
            unit_measure: 'unidad',
            is_active: p.is_active,
            purchase_price: 0
          } as unknown as UnifiedProduct))

          const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
            supabase,
            selectedBranchId,
            baseProducts.map((product) => product.id)
          )

          return applyBranchInventoryToProducts(baseProducts, stockMap, branchScoped)
        })().finally(() => {
          delete productsFetchPromisesByBranch[cacheKey]
        })
      }

      const unifiedProducts = await productsFetchPromisesByBranch[cacheKey]
      setProducts(unifiedProducts)
      setProductsCache(selectedBranchId, unifiedProducts)
    } catch (err) {
      console.error('[usePOSProducts] Error cargando productos:', err)
      setError(`Error al cargar productos: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, supabase])

  // Cargar productos iniciales (use cache if fresh)
  useEffect(() => {
    if (isProductsCacheFresh(selectedBranchId)) {
      setProducts(getProductsCache(selectedBranchId) || [])
      setLoading(false)
      return
    }
    fetchProducts()
  }, [fetchProducts, selectedBranchId])

  // Función para buscar producto por código de barras
  const findProductByBarcode = useCallback(async (barcode: string): Promise<UnifiedProduct | null> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            name
          )
        `)
        .eq('barcode', barcode)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error buscando por código de barras:', error)
        return null
      }

      if (!data) {
        return null
      }

      const baseProduct = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || undefined,
        sale_price: data.sale_price,
        stock_quantity: data.stock_quantity,
        category_id: data.category_id,
        category: data.categories ? { id: data.category_id, name: data.categories.name } as UnifiedCategory : undefined,
        description: data.description || undefined,
        image: data.images?.[0] || data.image_url || undefined,
        unit_measure: data.unit_measure || 'unidad',
        is_active: data.is_active,
        purchase_price: data.cost_price || 0
      } as unknown as UnifiedProduct

      const [branchAwareProduct] = await loadBranchInventoryStockMap(supabase, selectedBranchId, [baseProduct.id])
        .then(({ stockMap, branchScoped }) => applyBranchInventoryToProducts([baseProduct], stockMap, branchScoped))

      return branchAwareProduct
    } catch (err) {
      console.error('Error buscando producto por código de barras:', err)
      return null
    }
  }, [selectedBranchId, supabase])

  // Función para agregar producto al carrito
  const addToCart = useCallback((product: UnifiedProduct, quantity: number = 1) => {
    if (quantity <= 0) return false
    if (quantity > (product.stock_quantity || 0)) {
      setError(`Stock insuficiente. Disponible: ${product.stock_quantity || 0}`)
      return false
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity
        if (newQuantity > (product.stock_quantity || 0)) {
          setError(`Stock insuficiente. Disponible: ${product.stock_quantity || 0}`)
          return prevCart
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * item.price
              }
            : item
        )
      } else {
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.sale_price || 0,
          quantity,
          stock: product.stock_quantity || 0,
          subtotal: quantity * (product.sale_price || 0)
        }
        return [...prevCart, newItem]
      }
    })

    setError(null)
    return true
  }, [])

  // Función para remover producto del carrito
  const removeFromCart = useCallback((productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }, [])

  // Función para actualizar cantidad en el carrito
  const updateCartItemQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product) return

    if (quantity > (product.stock_quantity || 0)) {
      setError(`Stock insuficiente. Disponible: ${product.stock_quantity || 0}`)
      return
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.price
            }
          : item
      )
    )

    setError(null)
  }, [products, removeFromCart])

  // Función para limpiar el carrito
  const clearCart = useCallback(() => {
    setCart([])
    setError(null)
  }, [])

  // Procesa la venta de inventario vía API server-side para evitar depender de RPCs del cliente.
  const processSale = useCallback(async (saleData: SaleData) => {
    if (cart.length === 0 && (!saleData.items || saleData.items.length === 0)) {
      setError('El carrito está vacío')
      return { success: false, error: 'El carrito está vacío' }
    }

    setLoading(true)
    setError(null)

    try {
      const saleItems = (saleData.items || cart).map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: item.discount_amount || 0,
        subtotal: item.subtotal
      }))

      const payload = {
        p_sale_data: {
          code: `SALE-${Date.now()}`,
          customer_id: saleData.customer_id || null,
          total_amount: saleData.total,
          subtotal_amount: saleItems.reduce((sum, item) => sum + item.subtotal, 0),
          tax_amount: 0, // Ajustar si se manejan impuestos globales fuera del subtotal
          discount_amount: saleItems.reduce((sum, item) => sum + item.discount_amount, 0),
          payment_method: saleData.payment_method,
          payment_status: 'completed',
          notes: saleData.notes || '',
          status: SALE_STATUS.COMPLETED,
          created_at: new Date().toISOString()
        },
        p_items: saleItems,
        p_payments: [
          {
            payment_method: saleData.payment_method,
            amount: saleData.total,
            status: 'completed'
          }
        ]
      }

      const response = await fetch('/api/pos/process-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => null) as {
        success?: boolean
        error?: string
        saleId?: string
        data?: { id?: string }
      } | null

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'No se pudo procesar la venta POS')
      }

      // Limpiar carrito y recargar productos
      clearCart()
      await fetchProducts()

      return { 
        success: true, 
        saleId: result?.saleId || result?.data?.id,
        data: result?.data
      }
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error && Object.keys(error).length === 0
            ? 'Error desconocido (Posible error de red o endpoint faltante)'
            : 'Error desconocido')
      setError(`Error al procesar venta: ${errorMsg}`)
      return { 
        success: false, 
        error: errorMsg
      }
    } finally {
      setLoading(false)
    }
  }, [cart, clearCart, fetchProducts, selectedBranchId])

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = searchTerm === '' || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchTerm))

      const categoryName = product.category?.name || ''
      const matchesCategory = selectedCategory === 'all' || 
        categoryName === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  // Categorías disponibles
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category?.name).filter(Boolean))) as string[]
    return uniqueCategories.sort()
  }, [products])

  // Total del carrito
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.subtotal, 0)
  }, [cart])

  // Cantidad total de items en el carrito
  const cartItemsCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  // Realtime sync (products already loaded above)
  useEffect(() => {
    if (!config.supabase.isConfigured) return
    if (!realTimeEnabled) return

    realTimeSync.subscribe()
    return () => realTimeSync.unsubscribe()
  }, [realTimeEnabled, realTimeSync])

  // Función para alternar tiempo real
  const toggleRealTime = useCallback(() => {
    setRealTimeEnabled(prev => {
      const newValue = !prev
      if (newValue) {
        realTimeSync.subscribe()
      } else {
        realTimeSync.unsubscribe()
      }
      return newValue
    })
  }, [realTimeSync])

  return {
    // Estado
    products: filteredProducts,
    cart,
    loading,
    error,
    searchTerm,
    selectedCategory,
    categories,
    cartTotal,
    cartItemsCount,

    // Estado de tiempo real
    realTimeEnabled,
    realTimeStatus: {
      isConnected: realTimeSync.isConnected,
      connectionStatus: realTimeSync.connectionStatus,
      lastSync: realTimeSync.lastSync,
      eventsReceived: realTimeSync.eventsReceived,
      connectionHealth: realTimeSync.getConnectionHealth()
    },

    // Funciones de búsqueda y filtrado
    setSearchTerm,
    setSelectedCategory,
    findProductByBarcode,

    // Funciones del carrito
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,

    // Funciones de venta
    processSale,

    // Funciones de datos
    fetchProducts,
    refreshProducts: fetchProducts,

    // Funciones de tiempo real
    toggleRealTime,
    reconnectRealTime: realTimeSync.reconnect
  }
}

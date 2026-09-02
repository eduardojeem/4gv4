'use client'

// Force re-evaluation - remove this comment if HMR issues occur
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Database } from '@/lib/supabase/types'
import type { Product as UnifiedProduct } from '@/types/product-unified'
import { config } from '@/lib/config'
import { useProductRealTimeSync } from './useRealTimeSync'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { mapProductForPOS, type PosProductRow } from '@/app/dashboard/pos/lib/pos-product-mapper'

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
  installmentsEnabled?: boolean
  installmentsPlans?: Array<{ count: number; rate: number }>
}

interface StockMovement {
  product_id: string
  new_stock?: number
}

interface SaleData {
  items: CartItem[]
  total: number
  payment_method: 'cash' | 'card' | 'transfer' | 'credit'
  payments: Array<{
    payment_method: 'cash' | 'card' | 'transfer' | 'credit'
    amount: number
    reference?: string
    card_last4?: string
    provider?: string
    institution?: string
    channel?: 'card_terminal' | 'bank_transfer' | 'qr'
    terminal_id?: string
  }>
  session_id: string
  price_mode?: 'retail' | 'wholesale'
  order_discount_rate?: number
  customer_id?: string
  notes?: string
  credit?: { interest_rate: number; installment_count: number; frequency: 'weekly' | 'biweekly' | 'monthly'; first_installment_timing?: 'at_start' | 'next_cycle'; start_date?: string; first_payment?: import('@/lib/credits/first-payment').FirstInstallmentPayment }
  repair_ids?: string[]
  mark_repairs_delivered?: boolean
  delivery_outcome?: string
  store_credit_amount?: number
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

  const pendingSaleAttempt = useRef<{ signature: string; idempotencyKey: string } | null>(null)

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
          wholesale_price: updatedProduct.wholesale_price,
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
      }
      
      return prevProducts
    })
  }, [selectedBranchId])

  const syncProductInState = useCallback((product: UnifiedProduct) => {
    updateProductInState(product as unknown as Product)
  }, [updateProductInState])

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
          // NOTE: no filtramos por is_active. is_active controla la visibilidad
          // en el catálogo PÚBLICO; en el POS (venta interna) se debe poder
          // vender cualquier producto aunque esté oculto del público.
          const loadPage = async (page: number) => {
            const response = await fetch(`/api/products?page=${page}&per_page=100&strict_branch_stock=true`, {
              headers: branchHeaders(selectedBranchId),
              cache: 'no-store',
            })
            const payload = await response.json().catch(() => null) as {
              success?: boolean
              error?: string
              data?: {
                products?: Array<PosProductRow & { category?: { name?: string } | null }>
                total?: number
              }
            } | null
            if (!response.ok || !payload?.success || !Array.isArray(payload.data?.products)) {
              throw new Error(payload?.error || 'No se pudieron cargar los productos del POS')
            }
            return { products: payload.data.products, total: Number(payload.data.total || 0) }
          }

          const firstPage = await loadPage(1)
          const pageCount = Math.max(1, Math.ceil(firstPage.total / 100))
          const remainingPages = pageCount > 1
            ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => loadPage(index + 2)))
            : []
          const dbProducts = [firstPage, ...remainingPages].flatMap(page => page.products)

          return dbProducts.map((product) => mapProductForPOS({
            ...product,
            categories: product.categories ?? (product.category?.name ? { name: product.category.name } : null),
          } as PosProductRow))
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
  }, [selectedBranchId])

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
    return products.find(product => product.barcode === barcode) ?? null
  }, [products])

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
          subtotal: quantity * (product.sale_price || 0),
          installmentsEnabled: Boolean(product.installments_enabled),
          installmentsPlans: Array.isArray(product.installments_plans) ? product.installments_plans : [],
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
    if (cart.length === 0 && (!saleData.items || saleData.items.length === 0) && !saleData.repair_ids?.length) {
      setError('El carrito está vacío')
      return { success: false, error: 'El carrito está vacío' }
    }

    setLoading(true)
    setError(null)

    try {
      const saleItems = (saleData.items || cart).map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        discount_amount: item.discount_amount || 0,
      }))

      const signature = JSON.stringify({
        items: saleItems,
        payments: saleData.payments,
        customerId: saleData.customer_id || null,
        sessionId: saleData.session_id,
        repairs: saleData.repair_ids || [],
        priceMode: saleData.price_mode || 'retail',
        orderDiscountRate: saleData.order_discount_rate || 0,
        notes: saleData.notes || '',
        credit: saleData.credit || null,
        markRepairsDelivered: saleData.mark_repairs_delivered === true,
        deliveryOutcome: saleData.delivery_outcome || null,
        storeCreditAmount: saleData.store_credit_amount || 0,
      })
      if (pendingSaleAttempt.current?.signature !== signature) {
        pendingSaleAttempt.current = { signature, idempotencyKey: crypto.randomUUID() }
      }
      const idempotencyKey = pendingSaleAttempt.current.idempotencyKey

      const payload = {
        p_sale_data: {
          customer_id: saleData.customer_id || null,
          notes: saleData.notes || '',
        },
        p_items: saleItems,
        p_payments: saleData.payments,
        p_session_id: saleData.session_id,
        p_price_mode: saleData.price_mode || 'retail',
        p_order_discount_rate: saleData.order_discount_rate || 0,
        p_credit: saleData.credit || null,
        p_repair_ids: saleData.repair_ids || [],
        p_mark_repairs_delivered: saleData.mark_repairs_delivered === true,
        p_delivery_outcome: saleData.delivery_outcome || null,
        p_store_credit_amount: saleData.store_credit_amount || 0,
      }

      const response = await fetch('/api/pos/process-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
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

      pendingSaleAttempt.current = null
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
  }, [cart, fetchProducts, selectedBranchId])

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
    syncProduct: syncProductInState,

    // Funciones de tiempo real
    toggleRealTime,
    reconnectRealTime: realTimeSync.reconnect
  }
}

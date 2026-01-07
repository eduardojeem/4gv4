'use client'

// Force re-evaluation - remove this comment if HMR issues occur
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import type { Product as UnifiedProduct, Category as UnifiedCategory } from '@/types/product-unified'
import { config } from '@/lib/config'
import { useProductRealTimeSync } from './useRealTimeSync'

type DbProductRow = Database['public']['Tables']['products']['Row']
type DbCategoryRow = Database['public']['Tables']['categories']['Row']
type Product = DbProductRow & {
  category?: DbCategoryRow
  supplier?: Database['public']['Tables']['suppliers']['Row']
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  stock: number
  subtotal: number
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



export function usePOSProducts() {
  const [products, setProducts] = useState<UnifiedProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [realTimeEnabled, setRealTimeEnabled] = useState(true)

  const supabase = createClient()

  // Función para actualizar un producto específico en tiempo real
  const updateProductInState = useCallback((updatedProduct: Product) => {
    setProducts(prevProducts => {
      const productIndex = prevProducts.findIndex(p => p.id === updatedProduct.id)
      
      if (productIndex >= 0) {
        // Actualizar producto existente
        const newProducts = [...prevProducts]
        newProducts[productIndex] = {
          ...newProducts[productIndex],
          name: updatedProduct.name,
          sale_price: updatedProduct.sale_price,
          stock_quantity: updatedProduct.stock_quantity,
          description: updatedProduct.description || undefined,
          image: (updatedProduct as any).images?.[0] || (updatedProduct as any).image_url || undefined,
          is_active: updatedProduct.is_active,
          purchase_price: (updatedProduct as any).cost_price || (newProducts[productIndex] as any).purchase_price || 0
        }
        return newProducts
      } else if (updatedProduct.is_active) {
        // Agregar nuevo producto activo
        const newProduct: UnifiedProduct = {
          id: updatedProduct.id,
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          barcode: updatedProduct.barcode || undefined,
          sale_price: updatedProduct.sale_price,
          stock_quantity: updatedProduct.stock_quantity,
          category_id: updatedProduct.category_id || null as any,
          description: updatedProduct.description || undefined,
          image: (updatedProduct as any).images?.[0] || (updatedProduct as any).image_url || undefined,
          unit_measure: updatedProduct.unit_measure || 'unidad',
          is_active: updatedProduct.is_active,
          purchase_price: (updatedProduct as any).cost_price || 0
        }
        return [...prevProducts, newProduct]
      }
      
      return prevProducts
    })
  }, [])

  // Función para actualizar stock en tiempo real
  const updateStockInState = useCallback((stockMovement: StockMovement) => {
    if (stockMovement.product_id) {
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === stockMovement.product_id
            ? { ...product, stock_quantity: stockMovement.new_stock ?? product.stock_quantity }
            : product
        )
      )
    }
  }, [])

  // Configurar sincronización en tiempo real
  const realTimeSync = useProductRealTimeSync(
    updateProductInState,
    updateStockInState
  )

  // Función para cargar productos desde Supabase
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔄 [usePOSProducts] Cargando productos desde Supabase...')

      // 1. Obtener conteo total (para detectar filtros ocultos)
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.error('❌ [usePOSProducts] Error contando productos:', countError)
        setError('Error al conectar con la base de datos')
        // No retornamos, intentamos cargar igual
      } else {
        console.log('📊 [usePOSProducts] Total real en DB (count):', count)
      }

      // 2. Cargar productos
      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
        .order('name')
        .limit(5000)

      if (error) {
          throw error
      }

      console.log(`📦 [usePOSProducts] Productos cargados: ${dbProducts?.length || 0}`)
      
      if (count !== null && dbProducts && dbProducts.length < count) {
          console.warn(`⚠️ [usePOSProducts] Discrepancia: DB=${count} vs Cargados=${dbProducts.length}. Verifique RLS.`)
      }

      // Transformar a formato unificado
      const unifiedProducts: UnifiedProduct[] = (dbProducts || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        barcode: p.barcode,
        sale_price: Number(p.sale_price),
        stock_quantity: p.stock_quantity,
        category_id: p.category_id,
        description: p.description,
        image: undefined, 
        unit_measure: 'unidad',
        is_active: p.is_active, 
        purchase_price: 0 
      }))

      setProducts(unifiedProducts)
    } catch (err) {
      console.error('❌ [usePOSProducts] Error cargando productos:', err)
      setError(`Error al cargar productos: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para buscar producto por código de barras
  const findProductByBarcode = useCallback(async (barcode: string): Promise<UnifiedProduct | null> => {
    try {
      // FORZAR USO DE SUPABASE
      console.log('Buscando producto por código de barras en Supabase:', barcode)

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

      return {
        id: data.id,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || undefined,
        sale_price: data.sale_price,
        stock_quantity: data.stock_quantity,
        category_id: data.category_id,
        category: data.categories ? { id: data.category_id, name: data.categories.name } as UnifiedCategory : undefined,
        description: data.description || undefined,
        image: (data.images?.[0]) || (data as any).image_url || undefined,
        unit_measure: data.unit_measure || 'unidad',
        is_active: data.is_active,
        purchase_price: (data as any).cost_price || 0
      }
    } catch (err) {
      console.error('Error buscando producto por código de barras:', err)
      return null
    }
  }, [supabase])

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

  // Función para procesar venta
  const processSale = useCallback(async (saleData: SaleData) => {
    if (cart.length === 0) {
      setError('El carrito está vacío')
      return { success: false, error: 'El carrito está vacío' }
    }

    setLoading(true)
    setError(null)

    try {
      // PROCESAR VENTA EN SUPABASE
      console.log('Procesando venta en Supabase...', saleData)

      // Crear la venta en Supabase
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: saleData.total,
          payment_method: saleData.payment_method,
          customer_id: saleData.customer_id,
          notes: saleData.notes,
          status: 'completed'
        })
        .select()
        .single()

      if (saleError) {
        throw saleError
      }

      // Crear los items de la venta
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.subtotal
      }))

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)

      if (itemsError) throw itemsError

      // Actualizar stock de productos
      for (const item of cart) {
        const { error: stockError } = await supabase.rpc('update_product_stock', {
          product_id: item.id,
          quantity_change: -item.quantity,
          movement_type: 'sale',
          reference: `Venta #${sale.id}`,
          notes: `Venta de ${item.quantity} unidades`
        })

        if (stockError) {
          const newStock = Math.max(0, item.stock - item.quantity)
          try {
            const { error: fallbackError } = await supabase.rpc('update_product_stock', {
              product_id_param: item.id,
              new_stock: newStock,
              movement_type_param: 'sale',
              reference_type_param: 'sale',
              reference_id_param: sale.id,
              notes_param: `Venta de ${item.quantity} unidades`
            })
            if (fallbackError) {
              console.error('Fallback stock update failed:', fallbackError)
            }
          } catch (e) {
            console.error('Fallback RPC call threw:', e)
          }
        }
      }

      // Limpiar carrito y recargar productos
      clearCart()
      await fetchProducts()

      return { 
        success: true, 
        saleId: sale.id,
        data: sale
      }
    } catch (err) {
      console.error('Error processing sale:', err)
      setError(`Error al procesar venta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Error desconocido'
      }
    } finally {
      setLoading(false)
    }
  }, [cart, supabase, clearCart, fetchProducts])

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

  // Cargar productos al montar el componente
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Inicializar sincronización en tiempo real
  useEffect(() => {
    if (realTimeEnabled && config.supabase.isConfigured) {
      realTimeSync.subscribe()
      
      return () => {
        realTimeSync.unsubscribe()
      }
    }
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

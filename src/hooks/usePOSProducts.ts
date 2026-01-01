'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { config } from '@/lib/config'
import { useProductRealTimeSync } from './useRealTimeSync'

type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row']
  supplier?: Database['public']['Tables']['suppliers']['Row']
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface POSProduct {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  stock: number
  category: string
  description?: string
  image?: string
  unit_measure?: string
  is_active: boolean
  wholesalePrice?: number
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

// Datos mock para fallback
const mockProducts: POSProduct[] = [
  {
    id: '1',
    name: 'Smartphone Samsung Galaxy A54',
    description: 'Smartphone con cámara de 50MP y pantalla Super AMOLED',
    sku: 'SAM-A54-128',
    barcode: '7891234567890',
    price: 2500000,
    stock: 15,
    category: 'Electrónicos',
    image: '📱',
    unit_measure: 'unidad',
    is_active: true
  },
  {
    id: '2',
    name: 'Auriculares Bluetooth Sony',
    description: 'Auriculares inalámbricos con cancelación de ruido',
    sku: 'SONY-WH1000',
    barcode: '7891234567891',
    price: 850000,
    stock: 8,
    category: 'Electrónicos',
    image: '🎧',
    unit_measure: 'unidad',
    is_active: true
  },
  {
    id: '11',
    name: 'Teclado Mecánico Logitech',
    description: 'Teclado gaming con switches mecánicos',
    sku: 'LOG-MX-KEYS',
    barcode: '7891234567899',
    price: 450000,
    stock: 12,
    category: 'Accesorios',
    image: '⌨️',
    unit_measure: 'unidad',
    is_active: true
  },
  {
    id: '12',
    name: 'Mouse Gaming Razer',
    description: 'Mouse óptico para gaming con RGB',
    sku: 'RAZ-DEATHADDER',
    barcode: '7891234567900',
    price: 280000,
    stock: 20,
    category: 'Accesorios',
    image: '🖱️',
    unit_measure: 'unidad',
    is_active: true
  }
]

export function usePOSProducts() {
  const [products, setProducts] = useState<POSProduct[]>([])
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
          price: updatedProduct.sale_price,
          stock: updatedProduct.stock_quantity,
          description: updatedProduct.description || undefined,
          image: updatedProduct.images?.[0] || undefined,
          is_active: updatedProduct.is_active
        }
        return newProducts
      } else if (updatedProduct.is_active) {
        // Agregar nuevo producto activo
        const newProduct: POSProduct = {
          id: updatedProduct.id,
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          barcode: updatedProduct.barcode || undefined,
          price: updatedProduct.sale_price,
          stock: updatedProduct.stock_quantity,
          category: 'Sin categoría', // Se actualizará con la siguiente carga
          description: updatedProduct.description || undefined,
          image: updatedProduct.images?.[0] || undefined,
          unit_measure: updatedProduct.unit_measure || 'unidad',
          is_active: updatedProduct.is_active
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
            ? { ...product, stock: stockMovement.new_stock || product.stock }
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
      console.log('Iniciando fetchProducts desde Supabase...')
      
      // FORZAR USO DE SUPABASE - No usar datos mock
      console.log('Conectando a Supabase para obtener productos...')
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .order('name')

      console.log('Respuesta de Supabase:', { data, error })

      if (error) {
        console.error('Error de Supabase:', error)
        throw new Error(`Error de base de datos: ${error.message}`)
      }

      if (!data || data.length === 0) {
        console.log('No se encontraron productos en la base de datos')
        setProducts([])
        setError('No hay productos disponibles. Agregue productos a la base de datos.')
        return
      }

      console.log(`Procesando ${data.length} productos...`)

      const posProducts: POSProduct[] = data.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || undefined,
        price: product.sale_price,
        stock: product.stock_quantity,
        category: product.categories?.name || 'Sin categoría',
        description: product.description || undefined,
        image: product.images?.[0] || undefined,
        unit_measure: product.unit_measure || 'unidad',
        is_active: product.is_active,
        wholesalePrice: product.wholesale_price || undefined
      }))

      console.log('Productos procesados:', posProducts.length)
      setProducts(posProducts)
    } catch (err) {
      console.error('Error completo en fetchProducts:', err)
      setProducts([])
      setError(`Error al cargar productos: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para buscar producto por código de barras
  const findProductByBarcode = useCallback(async (barcode: string): Promise<POSProduct | null> => {
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
        price: data.sale_price,
        stock: data.stock_quantity,
        category: data.categories?.name || 'Sin categoría',
        description: data.description || undefined,
        image: data.images?.[0] || undefined,
        unit_measure: data.unit_measure || 'unidad',
        is_active: data.is_active,
        wholesalePrice: data.wholesale_price || undefined
      }
    } catch (err) {
      console.error('Error buscando producto por código de barras:', err)
      return null
    }
  }, [supabase])

  // Función para agregar producto al carrito
  const addToCart = useCallback((product: POSProduct, quantity: number = 1) => {
    if (quantity <= 0) return false
    if (quantity > product.stock) {
      setError(`Stock insuficiente. Disponible: ${product.stock}`)
      return false
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity
        if (newQuantity > product.stock) {
          setError(`Stock insuficiente. Disponible: ${product.stock}`)
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
          price: product.price,
          quantity,
          stock: product.stock,
          subtotal: quantity * product.price
        }
        return [...prevCart, newItem]
      }
    })

    setError(null)
    return true
  }, [])

  // Función para actualizar cantidad en el carrito
  const updateCartItemQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product) return

    if (quantity > product.stock) {
      setError(`Stock insuficiente. Disponible: ${product.stock}`)
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
  }, [products])

  // Función para remover producto del carrito
  const removeFromCart = useCallback((productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }, [])

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

      const matchesCategory = selectedCategory === 'all' || 
        product.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  // Categorías disponibles
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category)))
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

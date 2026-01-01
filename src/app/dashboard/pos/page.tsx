'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { usePOSProducts } from '@/hooks/usePOSProducts'
import type { Product } from '@/types/product-unified'
import { CartItem } from './types'

export default function POSPage() {
  // Estados principales
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Hook para productos desde Supabase
  const {
    products: inventoryProducts,
    loading: productsLoading,
    error: productsError,
    processSale: processInventorySale
  } = usePOSProducts()

  // Categorías únicas
  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    inventoryProducts.forEach(product => {
      if (product.category_id) {
        categorySet.add(product.category_id)
      }
    })
    return ['all', ...Array.from(categorySet)]
  }, [inventoryProducts])

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return inventoryProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.sku && product.sku.includes(searchTerm)) ||
                           (product.barcode && product.barcode.includes(searchTerm))
      const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [inventoryProducts, searchTerm, selectedCategory])

  // Funciones del carrito
  const addToCart = useCallback((product: Product) => {
    const existingItem = cart.find(item => item.id === product.id)
    const requestedQuantity = existingItem ? existingItem.quantity + 1 : 1

    if (product.stock_quantity < requestedQuantity) {
      toast.error(`Stock insuficiente. Disponible: ${product.stock_quantity}`)
      return
    }

    setCart(prev => {
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          sku: product.sku || '',
          price: product.sale_price,
          quantity: 1,
          stock: product.stock_quantity,
          subtotal: product.sale_price,
          category: product.category_id
        }]
      }
    })

    toast.success(`${product.name} agregado al carrito`)
  }, [cart])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      return
    }

    const product = inventoryProducts.find(p => p.id === id)
    if (product && quantity > product.stock_quantity) {
      toast.error(`Stock insuficiente. Disponible: ${product.stock_quantity}`)
      return
    }

    setCart(prev => prev.map(item =>
      item.id === id
        ? { ...item, quantity, subtotal: quantity * item.price }
        : item
    ))
  }, [inventoryProducts])

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  // Cálculos del carrito
  const cartCalculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    
    return {
      subtotal,
      total: subtotal,
      itemCount
    }
  }, [cart])

  // Procesar venta
  const processSale = useCallback(async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    try {
      await processInventorySale({
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          stock: item.stock,
          subtotal: item.subtotal
        })),
        total: cartCalculations.total,
        payment_method: 'cash'
      })

      toast.success('Venta procesada exitosamente')
      clearCart()
    } catch (error) {
      toast.error('Error al procesar la venta')
      console.error('Error processing sale:', error)
    }
  }, [cart, cartCalculations.total, processInventorySale, clearCart])

  if (productsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    )
  }

  if (productsError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error al cargar productos</p>
          <p className="text-sm text-muted-foreground">{productsError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Panel de Productos */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos ({filteredProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Búsqueda */}
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nombre, SKU o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category === 'all' ? 'Todas las categorías' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lista de productos */}
              <ScrollArea className="h-96">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.map(product => (
                    <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-sm">{product.name}</h3>
                          <Badge variant={product.stock_quantity > 0 ? "default" : "destructive"}>
                            Stock: {product.stock_quantity}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-primary mb-2">
                          {formatCurrency(product.sale_price)}
                        </p>
                        <Button
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity === 0}
                          className="w-full"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {product.stock_quantity === 0 ? 'Sin Stock' : 'Agregar'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {filteredProducts.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No se encontraron productos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel del Carrito */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito ({cartCalculations.itemCount})
                </span>
                {cart.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearCart}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  El carrito está vacío
                </p>
              ) : (
                <>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(item.price)} c/u
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(cartCalculations.total)}</span>
                    </div>
                  </div>

                  <Button onClick={processSale} className="w-full" size="lg">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Procesar Pago
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
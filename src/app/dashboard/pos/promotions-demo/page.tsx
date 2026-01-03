'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PromotionEngine } from '@/components/pos/PromotionEngine'
import { formatCurrency } from '@/lib/currency'
import { Plus, Minus, ShoppingCart } from 'lucide-react'
import type { CartItem } from '@/types/promotion'

// Mock products for demo removed
const mockProducts: any[] = []

export default function PromotionsDemoPage() {
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = (product: typeof mockProducts[0]) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.id)
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product_id === product.id
            ? { 
                ...item, 
                quantity: item.quantity + 1,
                total_price: (item.quantity + 1) * item.unit_price
              }
            : item
        )
      } else {
        return [...prevCart, {
          id: `cart-${product.id}-${Date.now()}`,
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unit_price: product.price,
          category_id: product.category_id,
          total_price: product.price
        }]
      }
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === productId)
      
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map(item =>
          item.product_id === productId
            ? { 
                ...item, 
                quantity: item.quantity - 1,
                total_price: (item.quantity - 1) * item.unit_price
              }
            : item
        )
      } else {
        return prevCart.filter(item => item.product_id !== productId)
      }
    })
  }

  const clearCart = () => {
    setCart([])
  }

  const getCartItemQuantity = (productId: string) => {
    const item = cart.find(item => item.product_id === productId)
    return item ? item.quantity : 0
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.total_price, 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demo Sistema de Promociones</h1>
          <p className="text-muted-foreground">
            Prueba el sistema de promociones agregando productos al carrito
          </p>
        </div>
        <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
          Limpiar Carrito
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Productos Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockProducts.map((product) => {
                  const quantity = getCartItemQuantity(product.id)
                  return (
                    <div key={product.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {product.category_id}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(product.price)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromCart(product.id)}
                            disabled={quantity === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCart(product)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                        >
                          Agregar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cart Items */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Carrito de Compras ({cart.length} items)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.unit_price)} x {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(item.total_price)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addToCart(mockProducts.find(p => p.id === item.product_id)!)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Promotions Section */}
        <div className="space-y-4">
          <PromotionEngine 
            cart={cart}
            onPromotionsChange={(promotions) => {
              console.log('Promociones aplicadas:', promotions)
            }}
          />
        </div>
      </div>

      {/* Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">
            Instrucciones de Prueba
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200">
          <div className="space-y-2 text-sm">
            <p><strong>1.</strong> Agrega productos al carrito usando los botones "+" o "Agregar"</p>
            <p><strong>2.</strong> Ve las promociones disponibles en el panel derecho</p>
            <p><strong>3.</strong> Prueba códigos como: WELCOME10, BULK15, FREESHIP</p>
            <p><strong>4.</strong> Observa cómo cambia el total con las promociones aplicadas</p>
            <p><strong>5.</strong> Prueba diferentes combinaciones de productos para ver promociones automáticas</p>
          </div>
          
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-md">
            <p className="font-medium mb-2">Códigos de prueba disponibles:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">WELCOME10</Badge>
              <Badge variant="secondary">BULK15</Badge>
              <Badge variant="secondary">FREESHIP</Badge>
              <Badge variant="secondary">SUMMER2024</Badge>
              <Badge variant="secondary">ACCESORIOS30</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
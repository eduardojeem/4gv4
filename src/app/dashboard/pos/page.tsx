'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, DollarSign } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  barcode?: string
}

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [total, setTotal] = useState(0)

  // Mock data - en producción esto vendría de la base de datos
  useEffect(() => {
    const mockProducts: Product[] = [
      { id: '1', name: 'iPhone 15 Pro', price: 12500000, stock: 5, category: 'smartphones', barcode: '123456789' },
      { id: '2', name: 'Samsung Galaxy S24', price: 9800000, stock: 8, category: 'smartphones', barcode: '987654321' },
      { id: '3', name: 'MacBook Air M3', price: 18500000, stock: 3, category: 'laptops', barcode: '456789123' },
      { id: '4', name: 'iPad Pro 12.9"', price: 15200000, stock: 6, category: 'tablets', barcode: '789123456' },
      { id: '5', name: 'AirPods Pro', price: 2800000, stock: 12, category: 'accesorios', barcode: '321654987' },
    ]
    setProducts(mockProducts)
  }, [])

  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
    setTotal(newTotal)
  }, [cart])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.includes(searchTerm)
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id)
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        ))
      }
    } else {
      setCart([...cart, { ...product, quantity: 1, subtotal: product.price }])
    }
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(id)
      return
    }

    const product = products.find(p => p.id === id)
    if (product && newQuantity <= product.stock) {
      setCart(cart.map(item =>
        item.id === id
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
          : item
      ))
    }
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
  }

  const processPayment = () => {
    // Aquí iría la lógica de procesamiento de pago
    alert(`Procesando pago por ₲${total.toLocaleString()}`)
    clearCart()
  }

  const formatPrice = (price: number) => {
    return `₲${price.toLocaleString()}`
  }

  const categories = ['all', 'smartphones', 'laptops', 'tablets', 'accesorios']

  return (
    <div className="container mx-auto p-4 h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Panel de Productos */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Búsqueda */}
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nombre o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              {/* Filtros de categoría */}
              <div className="flex gap-2 flex-wrap">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category === 'all' ? 'Todos' : category}
                  </Button>
                ))}
              </div>

              {/* Lista de productos */}
              <ScrollArea className="h-96">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.map(product => (
                    <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-sm">{product.name}</h3>
                          <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                            Stock: {product.stock}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-primary mb-2">
                          {formatPrice(product.price)}
                        </p>
                        <Button
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                          className="w-full"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
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
                  Carrito ({cart.length})
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
                              {formatPrice(item.price)} c/u
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
                            <p className="font-medium">{formatPrice(item.subtotal)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button onClick={processPayment} className="w-full" size="lg">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Procesar Pago
                    </Button>
                    <Button variant="outline" className="w-full">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Pago en Efectivo
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
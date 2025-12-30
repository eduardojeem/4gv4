/**
 * Componente de ejemplo para mostrar el uso del carrito con reparaciones
 * Incluye cálculo automático de IVA y desglose detallado
 */

import React from 'react'
import { useRepairCart } from '@/hooks/use-repair-cart'
import { Repair } from '@/types/repairs'
import { formatCurrency } from '@/lib/pos-calculator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Trash2, Plus, Minus } from 'lucide-react'

// Datos de ejemplo - PRECIOS CON IVA INCLUIDO
const sampleRepair: Repair = {
  id: 'repair-001',
  customer: {
    name: 'Juan Pérez',
    phone: '0981-123456',
    email: 'juan@example.com'
  },
  device: 'iPhone 12',
  deviceType: 'smartphone',
  brand: 'Apple',
  model: 'iPhone 12',
  issue: 'Pantalla rota',
  description: 'Reemplazo de pantalla LCD',
  status: 'listo',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 495000, // Total con IVA incluido
  finalCost: 495000,
  laborCost: 165000, // Mano de obra: 165,000 Gs (IVA incluido)
  technician: {
    id: 'tech-001',
    name: 'Carlos Técnico'
  },
  location: 'Taller Principal',
  warranty: '30 días',
  createdAt: '2024-12-27T10:00:00Z',
  estimatedCompletion: '2024-12-27T18:00:00Z',
  completedAt: '2024-12-27T16:30:00Z',
  lastUpdate: '2024-12-27T16:30:00Z',
  progress: 100,
  customerRating: null,
  notes: [],
  parts: [
    {
      id: 1,
      name: 'Pantalla LCD iPhone 12',
      cost: 275000, // 275,000 Gs (IVA incluido)
      quantity: 1,
      supplier: 'TechParts SA',
      partNumber: 'LCD-IP12-001'
    },
    {
      id: 2,
      name: 'Adhesivo pantalla',
      cost: 55000, // 55,000 Gs (IVA incluido)
      quantity: 1,
      supplier: 'TechParts SA',
      partNumber: 'ADH-IP12-001'
    }
  ],
  images: [],
  notifications: {
    customer: true,
    technician: false,
    manager: false
  }
}

const sampleProducts = [
  { id: 'prod-001', name: 'Funda iPhone 12', price: 45000 },
  { id: 'prod-002', name: 'Protector de pantalla', price: 25000 },
  { id: 'prod-003', name: 'Cable USB-C', price: 35000 }
]

export function RepairCartExample() {
  const {
    cart,
    addRepair,
    addProduct,
    removeItem,
    updateProductQuantity,
    clearCart,
    getCartSummary,
    getRepairTaxBreakdown
  } = useRepairCart()

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Sistema POS con Reparaciones</h1>
        <p className="text-muted-foreground mb-2">
          Ejemplo de carrito que calcula IVA automáticamente para reparaciones y productos
        </p>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
          💡 Los precios de reparación incluyen IVA (10%)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Agregar Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agregar Reparación */}
            <div>
              <h3 className="font-semibold mb-2">Reparación de Ejemplo</h3>
              <div className="p-3 border rounded-lg mb-2">
                <div className="text-sm">
                  <p><strong>Cliente:</strong> {sampleRepair.customer.name}</p>
                  <p><strong>Dispositivo:</strong> {sampleRepair.device}</p>
                  <p><strong>Problema:</strong> {sampleRepair.issue}</p>
                  <p><strong>Mano de obra:</strong> {formatCurrency(sampleRepair.laborCost)} <span className="text-xs text-muted-foreground">(IVA incl.)</span></p>
                  <p><strong>Repuestos:</strong> {formatCurrency(
                    sampleRepair.parts.reduce((sum, part) => sum + (part.cost * part.quantity), 0)
                  )} <span className="text-xs text-muted-foreground">(IVA incl.)</span></p>
                  <p className="text-xs text-blue-600 mt-1">
                    <strong>Total con IVA:</strong> {formatCurrency(sampleRepair.laborCost + sampleRepair.parts.reduce((sum, part) => sum + (part.cost * part.quantity), 0))}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => addRepair(sampleRepair)}
                className="w-full"
              >
                Agregar Reparación al Carrito
              </Button>
            </div>

            <Separator />

            {/* Agregar Productos */}
            <div>
              <h3 className="font-semibold mb-2">Productos</h3>
              <div className="space-y-2">
                {sampleProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(product.price)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addProduct(product)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <Button 
              variant="outline" 
              onClick={clearCart}
              className="w-full"
            >
              Limpiar Carrito
            </Button>
          </CardContent>
        </Card>

        {/* Carrito */}
        <Card>
          <CardHeader>
            <CardTitle>Carrito de Compras</CardTitle>
          </CardHeader>
          <CardContent>
            {cart.productItems.length === 0 && cart.repairItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                El carrito está vacío
              </p>
            ) : (
              <div className="space-y-4">
                {/* Reparaciones */}
                {cart.repairItems.map(item => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">Reparación</Badge>
                          <span className="font-medium">{item.repair.device}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.repair.customer.name} - {item.repair.issue}
                        </p>
                        
                        {/* Desglose de costos */}
                        <div className="text-xs space-y-1 bg-muted p-2 rounded">
                          <div className="text-center text-blue-600 font-semibold mb-1">
                            Precios con IVA incluido (10%)
                          </div>
                          <div className="flex justify-between">
                            <span>Mano de obra (con IVA):</span>
                            <span>{formatCurrency(item.laborCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Repuestos (con IVA):</span>
                            <span>{formatCurrency(item.partsCost)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-green-600">
                            <span>Subtotal (sin IVA):</span>
                            <span>{formatCurrency(item.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-blue-600">
                            <span>IVA extraído ({item.taxRate}%):</span>
                            <span>{formatCurrency(item.taxAmount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span>{formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Productos */}
                {cart.productItems.map(item => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">Producto</Badge>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.subtotal)}
                          <br />
                          IVA ({item.taxRate}%): {formatCurrency(item.taxAmount)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProductQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProductQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Totales */}
                <div className="border-t pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(cart.totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>IVA Total:</span>
                      <span>{formatCurrency(cart.totals.totalTax)}</span>
                    </div>
                    {cart.repairItems.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-4">
                        <div>Desglose IVA Reparaciones:</div>
                        <div>• Mano de obra: {formatCurrency(cart.totals.repairTaxBreakdown.laborTax)}</div>
                        <div>• Repuestos: {formatCurrency(cart.totals.repairTaxBreakdown.partsTax)}</div>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(cart.totals.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Botón de Checkout */}
                <Button className="w-full" size="lg">
                  Procesar Pago - {formatCurrency(cart.totals.total)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen en texto */}
      {(cart.productItems.length > 0 || cart.repairItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Carrito</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">
              {getCartSummary()}
            </pre>
            {cart.repairItems.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Desglose IVA Reparaciones:</h4>
                <p className="text-sm text-muted-foreground">
                  {getRepairTaxBreakdown()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
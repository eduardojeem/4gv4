/**
 * Componente para mostrar el resumen de la venta
 * Extraído del CheckoutModal para mejor modularización
 */

import React from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { config, getTaxConfig } from '@/lib/config'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  wholesalePrice?: number
}

interface CartCalculations {
  subtotal: number
  subtotalAfterAllDiscounts: number
  generalDiscount: number
  wholesaleDiscount: number
  wholesaleDiscountRate: number
  tax: number
  total: number
  repairCost?: number
  repairSubtotal?: number
  repairTax?: number
}

interface SaleSummaryProps {
  cart: CartItem[]
  cartCalculations: CartCalculations
  discount: number
  isWholesale: boolean
  WHOLESALE_DISCOUNT_RATE: number
  formatCurrency: (amount: number) => string
}

export function SaleSummary({
  cart,
  cartCalculations,
  discount,
  isWholesale,
  WHOLESALE_DISCOUNT_RATE,
  formatCurrency
}: SaleSummaryProps) {

  return (
    <div className="space-y-4">
      <h3 className="font-semibold mb-4">Resumen de la Venta</h3>
      
      {/* Items del carrito */}
      <div className="space-y-2 text-sm">
        {cart.map(item => {
          const appliedUnit = isWholesale
            ? (typeof item.wholesalePrice === 'number' ? item.wholesalePrice : (item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100))))
            : item.price
          return (
            <div key={item.id} className="flex justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span>{formatCurrency(appliedUnit * item.quantity)}</span>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* Cálculos */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>{config.pricesIncludeTax ? 'Subtotal (IVA incluido):' : 'Subtotal:'}</span>
          <span>{formatCurrency(cartCalculations.subtotalAfterAllDiscounts)}</span>
        </div>

        {cartCalculations.generalDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span>Descuento ({discount}%):</span>
            <span>-{formatCurrency(cartCalculations.generalDiscount)}</span>
          </div>
        )}

        {isWholesale && cartCalculations.wholesaleDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span>Descuento mayorista ({cartCalculations.wholesaleDiscountRate}%):</span>
            <span>-{formatCurrency(cartCalculations.wholesaleDiscount)}</span>
          </div>
        )}

        {cartCalculations.repairCost && cartCalculations.repairCost > 0 && (
          <>
            <div className="flex justify-between text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" /> 
                Reparación (con IVA):
              </span>
              <span>+{formatCurrency(cartCalculations.repairCost)}</span>
            </div>
            {(cartCalculations as any).repairSubtotal && (cartCalculations as any).repairTax && (
              <div className="text-xs text-muted-foreground pl-4 space-y-1">
                <div className="flex justify-between">
                  <span>• Subtotal reparación:</span>
                  <span>{formatCurrency((cartCalculations as any).repairSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• IVA reparación:</span>
                  <span>{formatCurrency((cartCalculations as any).repairTax)}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between">
          <span>{getTaxConfig().label} ({getTaxConfig().percentage}%):</span>
          <span>{formatCurrency(cartCalculations.tax)}</span>
        </div>
      </div>

      <Separator />

      {/* Total */}
      <div className="flex justify-between font-bold text-lg">
        <span>Total:</span>
        <span className="text-primary">{formatCurrency(cartCalculations.total)}</span>
      </div>

      {/* Información adicional */}
      {isWholesale && (
        <div className="mt-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Precio Mayorista Aplicado
          </Badge>
        </div>
      )}

      {config.pricesIncludeTax && (
        <div className="text-xs text-muted-foreground">
          * Los precios incluyen IVA
        </div>
      )}
    </div>
  )
}
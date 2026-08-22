/**
 * Componente para mostrar el resumen de la venta
 * Extraído del CheckoutModal para mejor modularización
 */

import React from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { config, getTaxConfig } from '@/lib/config'
import { useCheckout } from '../../contexts/CheckoutContext'
import { buildPosCreditSummary, formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  wholesalePrice?: number
  isService?: boolean
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
  isWholesale: boolean
  WHOLESALE_DISCOUNT_RATE: number
  formatCurrency: (amount: number) => string
}

export function SaleSummary({
  cart,
  cartCalculations,
  isWholesale,
  WHOLESALE_DISCOUNT_RATE,
  formatCurrency
}: SaleSummaryProps) {
  const { discount, paymentMethod, isMixedPayment, paymentSplit, creditTerms, storeCreditApplied } = useCheckout()
  const amountDueAfterStoreCredit = Math.max(0, cartCalculations.total - storeCreditApplied)
  const mixedCreditPrincipal = React.useMemo(() => paymentSplit
    .filter(split => split.method === 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const immediatePayment = React.useMemo(() => paymentSplit
    .filter(split => split.method !== 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const isMixedCreditSale = isMixedPayment && mixedCreditPrincipal > 0
  const isCreditSale = paymentMethod === 'credit' || isMixedCreditSale
  const creditPrincipal = isMixedCreditSale ? mixedCreditPrincipal : amountDueAfterStoreCredit
  const creditSummary = React.useMemo(
    () => buildPosCreditSummary(creditPrincipal, creditTerms),
    [creditPrincipal, creditTerms],
  )
  const displayedTotal = isCreditSale
    ? cartCalculations.total + creditSummary.interestAmount
    : cartCalculations.total

  return (
    <div className="space-y-4">
      <h4 className="mb-4 text-sm font-semibold text-muted-foreground">Detalle del total</h4>
      
      {/* Items del carrito */}
      <div className="space-y-2 text-sm">
        {cart.map(item => {
          const appliedUnit = isWholesale
            ? (typeof item.wholesalePrice === 'number' ? item.wholesalePrice : (item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100))))
            : item.price
          return (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words">{item.name} <span className="text-muted-foreground">× {item.quantity}</span></span>
              <span className="shrink-0 font-medium tabular-nums">{formatCurrency(appliedUnit * item.quantity)}</span>
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
            {cartCalculations.repairSubtotal && cartCalculations.repairTax && (
              <div className="text-xs text-muted-foreground pl-4 space-y-1">
                <div className="flex justify-between">
                  <span>• Subtotal reparación:</span>
                  <span>{formatCurrency(cartCalculations.repairSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• IVA reparación:</span>
                  <span>{formatCurrency(cartCalculations.repairTax)}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between">
          <span>{getTaxConfig().label} ({getTaxConfig().percentage}%):</span>
          <span>{formatCurrency(cartCalculations.tax)}</span>
        </div>
        {isCreditSale && (
          <>
            {isMixedCreditSale && (
              <div className="flex justify-between text-amber-700 dark:text-amber-300">
                <span>Pago inmediato:</span>
                <span>{formatCurrency(immediatePayment)}</span>
              </div>
            )}
            <div className="flex justify-between text-blue-700 dark:text-blue-300">
              <span>Capital financiado:</span>
              <span>{formatCurrency(creditPrincipal)}</span>
            </div>
            <div className="flex justify-between text-blue-700 dark:text-blue-300">
              <span>Interes credito ({creditTerms.interestRate}%):</span>
              <span>+{formatCurrency(creditSummary.interestAmount)}</span>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              <div>
                {creditSummary.installmentCount} cuotas {creditTerms.frequency === 'monthly' ? 'mensuales' : creditTerms.frequency === 'biweekly' ? 'quincenales' : 'semanales'} de{' '}
                <strong>{formatCurrency(creditSummary.installmentAmount)}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-blue-200 pt-1 dark:border-blue-800">
                <span>Primera cuota:</span>
                <strong>{formatPosCreditDueDate(creditSummary.firstDueDate)}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Total */}
      <div className="flex items-end justify-between gap-3 rounded-lg bg-primary/10 px-3 py-3">
        <span>{isCreditSale ? 'Total final con financiación:' : 'Total:'}</span>
        <span className="text-xl font-bold tabular-nums text-primary sm:text-2xl">{formatCurrency(displayedTotal)}</span>
      </div>

      {/* El saldo a favor no baja el total: baja lo que hay que cobrar. */}
      {storeCreditApplied > 0 && (
        <>
          <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
            <span>Saldo a favor aplicado:</span>
            <span>- {formatCurrency(storeCreditApplied)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>{isCreditSale ? 'A financiar:' : 'A cobrar:'}</span>
            <span className="text-primary">
              {formatCurrency(isCreditSale ? creditSummary.financedTotal : amountDueAfterStoreCredit)}
            </span>
          </div>
        </>
      )}

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

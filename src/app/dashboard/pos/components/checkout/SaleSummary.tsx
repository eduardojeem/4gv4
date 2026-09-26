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
import { firstPaymentError } from '@/lib/credits/first-payment'
import { FirstInstallmentPaymentFields } from './FirstInstallmentPaymentFields'
import { CheckoutProductRow, type CheckoutProductItem } from './CheckoutProductRow'

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
  cart: CheckoutProductItem[]
  cartCalculations: CartCalculations
  isWholesale: boolean
  WHOLESALE_DISCOUNT_RATE: number
  formatCurrency: (amount: number) => string
  onUpdateQuantity?: (id: string, quantity: number) => void
}

export function SaleSummary({
  cart,
  cartCalculations,
  isWholesale,
  WHOLESALE_DISCOUNT_RATE,
  formatCurrency,
  onUpdateQuantity
}: SaleSummaryProps) {
  const { discount, paymentMethod, isMixedPayment, paymentSplit, creditTerms, setCreditTerms, storeCreditApplied, paymentStatus } = useCheckout()
  const amountDueAfterStoreCredit = Math.max(0, cartCalculations.total - storeCreditApplied)
  const mixedCreditPrincipal = React.useMemo(() => paymentSplit
    .filter(split => split.method === 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const immediatePayment = React.useMemo(() => paymentSplit
    .filter(split => split.method !== 'credit')
    .reduce((total, split) => total + split.amount, 0), [paymentSplit])
  const isMixedCreditSale = isMixedPayment && mixedCreditPrincipal > 0
  const isCreditSale = isMixedPayment ? isMixedCreditSale : paymentMethod === 'credit'
  const creditPrincipal = isMixedCreditSale ? mixedCreditPrincipal : amountDueAfterStoreCredit
  const creditSummary = React.useMemo(
    () => buildPosCreditSummary(creditPrincipal, creditTerms),
    [creditPrincipal, creditTerms],
  )
  const displayedTotal = isCreditSale
    ? cartCalculations.total + creditSummary.interestAmount
    : cartCalculations.total
  const paymentError = isCreditSale ? firstPaymentError(creditTerms.firstPayment, creditSummary.installmentAmount, creditSummary.firstInstallmentTiming) : null
  const firstPaymentAmount = isCreditSale && creditTerms.firstPayment && !paymentError ? creditSummary.installmentAmount : 0
  const collectNow = (isMixedPayment ? immediatePayment : isCreditSale ? 0 : amountDueAfterStoreCredit) + firstPaymentAmount

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Detalle del total</h4><span className="text-xs text-muted-foreground">{cart.length} ítems</span></div>
      
      {/* Items del carrito */}
      <div role="region" aria-label="Productos de la venta" tabIndex={0} className="max-h-56 overflow-y-auto overscroll-contain rounded-md border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring divide-y [scrollbar-gutter:stable] max-sm:max-h-[30dvh]">
        {cart.map(item => {
          const appliedUnit = isWholesale
            ? (typeof item.wholesalePrice === 'number' ? item.wholesalePrice : (item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100))))
            : item.price
          return (
            <CheckoutProductRow key={item.id} item={item} unitPrice={appliedUnit} formatCurrency={formatCurrency} onUpdateQuantity={onUpdateQuantity} disabled={paymentStatus === 'processing'} />
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
                {creditSummary.installmentCount} cuotas {creditTerms.frequency === 'monthly' ? 'mensuales' : creditTerms.frequency === 'biweekly' ? 'quincenales' : 'semanales'} desde{' '}
                <strong>{formatCurrency(creditSummary.installmentAmount)}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-blue-200 pt-1 dark:border-blue-800">
                <span>Primera cuota:</span>
                <strong>{formatPosCreditDueDate(creditSummary.firstDueDate)}</strong>
              </div>
              <p className="mt-1">{creditSummary.firstInstallmentTiming === 'at_start' ? 'Desde el inicio del crédito' : 'Desde el próximo ciclo'}. {firstPaymentAmount > 0 ? 'La cuota 1 se registrará pagada al confirmar; las restantes quedarán pendientes.' : 'Cuotas pendientes hasta registrar su cobro.'}</p>
              {creditSummary.lastInstallmentAmount !== creditSummary.installmentAmount && <p className="mt-1">Última cuota: {formatCurrency(creditSummary.lastInstallmentAmount)} (redondeo).</p>}
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Total */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-muted px-3 py-3">
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

      {isCreditSale && <FirstInstallmentPaymentFields
        payment={creditTerms.firstPayment}
        onChange={firstPayment => setCreditTerms({ ...creditTerms, firstPayment })}
        amount={creditSummary.installmentAmount}
        available={creditSummary.firstInstallmentTiming === 'at_start'}
        formatCurrency={formatCurrency}
        disabled={paymentStatus === 'processing'}
      />}
      {paymentError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{paymentError}</p>}
      <section aria-label="Resumen del cobro" className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
        <div aria-live="polite">
          <p className="text-sm font-medium">Total a cobrar ahora</p>
          <p data-testid="checkout-collect-now" className="break-words text-2xl font-bold tabular-nums text-primary">{formatCurrency(collectNow)}</p>
        </div>
        {isCreditSale && <>
          <dl className="space-y-2 border-t pt-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt>Entrega inicial</dt><dd className="font-medium tabular-nums">{formatCurrency(isMixedPayment ? immediatePayment : 0)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt>Primera cuota a cobrar</dt><dd className="font-medium tabular-nums">{formatCurrency(firstPaymentAmount)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2 border-t pt-2"><dt>Saldo del crédito después del cobro</dt><dd data-testid="checkout-credit-balance" className="font-semibold tabular-nums">{formatCurrency(creditSummary.financedTotal - firstPaymentAmount)}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">La primera cuota forma parte del crédito: no aumenta el precio ni se descuenta otra vez del capital financiado.</p>
        </>}
        <p className="text-xs text-muted-foreground">Todavía no se registra ningún cobro. Revisá los datos y confirmá en el siguiente paso.</p>
      </section>

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

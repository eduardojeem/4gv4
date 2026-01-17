/**
 * Componente para selección de métodos de pago
 * Extraído del CheckoutModal para mejor modularización
 */

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Users, Clock, AlertCircle } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency as defaultFormatCurrency } from '@/lib/currency'
import { useCheckout } from '../../contexts/CheckoutContext'
import { CreditStatusPanel } from './CreditStatusPanel'

interface PaymentMethodsProps {
  // Cálculos
  cartTotal: number
  
  // Crédito
  canUseCredit: boolean
  creditSummary?: {
    availableCredit: number
    usedCredit: number
  }
  
  formatCurrency: (amount: number) => string
}

export function PaymentMethods({
  cartTotal,
  canUseCredit,
  creditSummary,
  formatCurrency
}: PaymentMethodsProps) {
  
  const {
    isMixedPayment,
    setIsMixedPayment,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    cardNumber,
    setCardNumber,
    transferReference,
    setTransferReference,
    splitAmount,
    setSplitAmount,
    paymentSplit,
    addPaymentSplit,
    removePaymentSplit
  } = useCheckout()

  // Calcular totales locales usando el contexto
  const getTotalPaid = useCallback(() => {
    return paymentSplit.reduce((total, split) => total + split.amount, 0)
  }, [paymentSplit])

  const getRemainingAmount = useCallback(() => {
    // Redondear a 2 decimales para evitar problemas de punto flotante
    return Math.round((cartTotal - getTotalPaid()) * 100) / 100
  }, [cartTotal, getTotalPaid])

  // Cálculos para pago en efectivo simple
  const cashChange = Math.max(0, cashReceived - cartTotal)
  const cashRemaining = Math.max(0, cartTotal - cashReceived)

  const paymentMethods = [
    { id: 'cash', label: 'Efectivo', icon: GSIcon, color: 'text-muted-foreground' },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'text-muted-foreground' },
    { id: 'transfer', label: 'Transferencia', icon: Users, color: 'text-muted-foreground' },
    { id: 'credit', label: 'Crédito', icon: Clock, color: 'text-muted-foreground' }
  ]

  return (
    <div className="space-y-4">
      {/* Toggle entre pago simple y mixto */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Método de Pago</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMixedPayment(!isMixedPayment)}
          className="text-xs"
        >
          {isMixedPayment ? 'Pago Simple' : 'Pago Mixto'}
        </Button>
      </div>

      {!isMixedPayment ? (
        // Pago simple
        <div className="space-y-2">
          {paymentMethods.map(method => (
            <Button
              key={method.id}
              variant={paymentMethod === method.id ? "default" : "outline"}
              className={`w-full justify-start transition-all ${
                method.id === 'credit' && !canUseCredit 
                  ? 'opacity-70' // Visualmente distinto pero interactivo
                  : paymentMethod === method.id 
                  ? 'ring-2 ring-primary ring-offset-2' 
                  : 'hover:bg-accent'
              }`}
              onClick={() => setPaymentMethod(method.id)}
              // Permitimos seleccionar crédito incluso si no es válido para mostrar la advertencia
              // disabled={method.id === 'credit' && !canUseCredit}
            >
              <method.icon className={`h-4 w-4 mr-2 ${method.color}`} />
              <span className="flex-1 text-left">{method.label}</span>
              {method.id === 'credit' && (
                <div className="ml-auto flex flex-col items-end">
                  {creditSummary && (creditSummary.availableCredit + creditSummary.usedCredit) > 0 ? (
                    // Cliente con crédito configurado
                    <>
                      <span className={`text-xs font-semibold ${
                        canUseCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {canUseCredit ? 
                          `${formatCurrency(creditSummary.availableCredit)}` : 
                          'Insuficiente'
                        }
                      </span>
                      {canUseCredit && (
                        <span className="text-[10px] text-muted-foreground">
                          disponible
                        </span>
                      )}
                    </>
                  ) : (
                    // Cliente sin crédito configurado
                    <span className="text-[10px] text-muted-foreground">
                      No habilitado
                    </span>
                  )}
                </div>
              )}
            </Button>
          ))}
          
          {/* Información adicional para venta a crédito */}
          {paymentMethod === 'credit' && canUseCredit && creditSummary && (
            <CreditStatusPanel
              cartTotal={cartTotal}
              creditSummary={creditSummary}
              formatCurrency={formatCurrency}
            />
          )}
          
          {/* Advertencia si no tiene crédito suficiente */}
          {paymentMethod === 'credit' && !canUseCredit && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  {!creditSummary || (creditSummary.availableCredit + creditSummary.usedCredit) === 0 ? (
                    // Cliente sin límite de crédito configurado
                    <>
                      <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                        Crédito no habilitado
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        Este cliente no tiene un límite de crédito asignado. Configure el límite de crédito en la ficha del cliente para habilitar ventas a crédito.
                      </p>
                    </>
                  ) : (
                    // Cliente con crédito insuficiente
                    <>
                      <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                        Cliente con crédito insuficiente
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                        El cliente no tiene suficiente crédito disponible para esta venta.
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-red-600 dark:text-red-400">Total de la venta:</span>
                          <span className="font-semibold text-red-800 dark:text-red-200">{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600 dark:text-red-400">Crédito disponible:</span>
                          <span className="font-semibold text-red-800 dark:text-red-200">{formatCurrency(creditSummary.availableCredit)}</span>
                        </div>
                        <div className="flex justify-between border-t border-red-300 dark:border-red-700 pt-1 mt-1">
                          <span className="text-red-700 dark:text-red-300 font-medium">Faltante:</span>
                          <span className="font-bold text-red-900 dark:text-red-100">{formatCurrency(cartTotal - creditSummary.availableCredit)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Pago mixto
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Total a pagar:</span>
              <span className="font-bold text-primary">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Pagado:</span>
              <span className="font-medium text-primary">{formatCurrency(getTotalPaid())}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Restante:</span>
              <span className={`font-medium ${getRemainingAmount() > 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatCurrency(getRemainingAmount())}
              </span>
            </div>
          </div>

          {/* Lista de pagos agregados */}
          {paymentSplit.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Pagos agregados:</h4>
              {paymentSplit.map(split => (
                <div key={split.id} className="flex items-center justify-between bg-card border border-border rounded p-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm capitalize">{split.method}</span>
                    {split.reference && (
                      <span className="text-xs text-muted-foreground">({split.reference})</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{formatCurrency(split.amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePaymentSplit(split.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Agregar nuevo pago */}
          <div className="border rounded-lg p-3 space-y-3">
            <h4 className="text-sm font-medium">Agregar pago:</h4>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <Button
                  key={method.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentMethod(method.id)}
                  className={paymentMethod === method.id ? 'bg-accent ring-1 ring-ring' : ''}
                  disabled={method.id === 'credit' && !canUseCredit}
                >
                  <method.icon className="h-3 w-3 mr-1" />
                  {method.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Campos específicos por método de pago */}
      {paymentMethod === 'cash' && !isMixedPayment && (
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">Efectivo recibido</label>
          <Input
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(Number(e.target.value))}
            placeholder="0"
          />
          {cashRemaining > 0 && (
            <p className="text-sm text-destructive mt-2">
              Restante: {formatCurrency(cashRemaining)}
            </p>
          )}
          {cashChange > 0 && (
            <p className="text-sm text-primary mt-1">
              Cambio: {formatCurrency(cashChange)}
            </p>
          )}
        </div>
      )}

      {paymentMethod === 'card' && !isMixedPayment && (
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">Últimos 4 dígitos</label>
          <Input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="1234"
            maxLength={4}
          />
        </div>
      )}

      {paymentMethod === 'transfer' && !isMixedPayment && (
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">Referencia</label>
          <Input
            type="text"
            value={transferReference}
            onChange={(e) => setTransferReference(e.target.value)}
            placeholder="Número de referencia"
          />
        </div>
      )}

      {/* Campos para pago mixto */}
      {isMixedPayment && paymentMethod && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Monto a pagar con {paymentMethod}</label>
            <Input
              type="number"
              placeholder={`Máximo: ${formatCurrency(getRemainingAmount())}`}
              min={0}
              max={getRemainingAmount()}
              value={Number.isFinite(splitAmount) ? splitAmount : 0}
              onChange={(e) => setSplitAmount(Number(e.target.value))}
            />
          </div>

          {paymentMethod === 'card' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Últimos 4 dígitos</label>
              <Input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          )}

          {paymentMethod === 'transfer' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Referencia</label>
              <Input
                type="text"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                placeholder="Número de referencia"
              />
            </div>
          )}

          <Button
            onClick={() => {
              const amount = Number(splitAmount)
              const requiresCard = paymentMethod === 'card'
              const requiresRef = paymentMethod === 'transfer'
              const isCardOk = !requiresCard || (cardNumber && cardNumber.length === 4)
              const isRefOk = !requiresRef || !!transferReference
              
              if (amount > 0 && amount <= getRemainingAmount() && isCardOk && isRefOk) {
                addPaymentSplit(
                  paymentMethod,
                  amount,
                  paymentMethod === 'transfer' ? transferReference :
                    paymentMethod === 'card' ? cardNumber : undefined
                )
                setSplitAmount(0)
                setPaymentMethod('')
              }
            }}
            className="w-full"
            disabled={
              !paymentMethod ||
              splitAmount <= 0 ||
              splitAmount > getRemainingAmount() ||
              (paymentMethod === 'card' && cardNumber.length < 4) ||
              (paymentMethod === 'transfer' && !transferReference)
            }
          >
            Agregar Pago
          </Button>
        </div>
      )}
    </div>
  )
}
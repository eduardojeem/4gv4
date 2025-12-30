/**
 * Componente para selección de métodos de pago
 * Extraído del CheckoutModal para mejor modularización
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Users, Clock } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'

interface PaymentMethodsProps {
  // Estado de pago
  isMixedPayment: boolean
  setIsMixedPayment: (value: boolean) => void
  paymentMethod: string
  setPaymentMethod: (method: string) => void
  
  // Campos específicos por método
  cashReceived: number
  setCashReceived: (amount: number) => void
  cardNumber: string
  setCardNumber: (number: string) => void
  transferReference: string
  setTransferReference: (reference: string) => void
  
  // Pago mixto
  splitAmount: number
  setSplitAmount: (amount: number) => void
  paymentSplit: Array<{
    id: string
    method: string
    amount: number
    reference?: string
  }>
  addPaymentSplit: (method: string, amount: number, reference?: string) => void
  removePaymentSplit: (id: string) => void
  getTotalPaid: () => number
  getRemainingAmount: () => number
  
  // Cálculos
  cartTotal: number
  cartChange: number
  cartRemaining: number
  
  // Crédito
  canUseCredit: boolean
  creditSummary?: {
    availableCredit: number
    usedCredit: number
  }
  
  formatCurrency: (amount: number) => string
}

export function PaymentMethods({
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
  removePaymentSplit,
  getTotalPaid,
  getRemainingAmount,
  cartTotal,
  cartChange,
  cartRemaining,
  canUseCredit,
  creditSummary,
  formatCurrency
}: PaymentMethodsProps) {
  
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
              className="w-full justify-start"
              onClick={() => setPaymentMethod(method.id)}
              disabled={method.id === 'credit' && !canUseCredit}
            >
              <method.icon className={`h-4 w-4 mr-2 ${method.color}`} />
              {method.label}
              {method.id === 'credit' && creditSummary && (
                <span className="ml-auto text-xs">
                  {canUseCredit ? 
                    `Disponible: ${formatCurrency(creditSummary.availableCredit)}` : 
                    'Sin crédito'
                  }
                </span>
              )}
            </Button>
          ))}
          
          {/* Información adicional para venta a crédito */}
          {paymentMethod === 'credit' && canUseCredit && creditSummary && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Venta a Crédito</span>
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <div>Total: {formatCurrency(cartTotal)}</div>
                <div>Crédito disponible: {formatCurrency(creditSummary.availableCredit)}</div>
                <div>Nuevo saldo: {formatCurrency(creditSummary.usedCredit + cartTotal)}</div>
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
          {cartRemaining > 0 && (
            <p className="text-sm text-destructive mt-2">
              Restante: {formatCurrency(cartRemaining)}
            </p>
          )}
          {cartChange > 0 && (
            <p className="text-sm text-primary mt-1">
              Cambio: {formatCurrency(cartChange)}
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